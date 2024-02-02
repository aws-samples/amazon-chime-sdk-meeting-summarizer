import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  GetObjectCommand,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import {
  SchedulerClient,
  CreateScheduleCommand,
  CreateScheduleOutput,
} from '@aws-sdk/client-scheduler';
import { S3Event } from 'aws-lambda';

//Environment Variables
const TABLE_NAME = process.env.TABLE;
const EVENTBRIDGE_TARGET_LAMBDA = process.env.EVENTBRIDGE_TARGET_LAMBDA;
const EVENTBRIDGE_GROUP_NAME = process.env.EVENTBRIDGE_GROUP_NAME;
const EVENTBRIDGE_LAMBDA_ROLE = process.env.EVENTBRIDGE_LAMBDA_ROLE;
const AWS_REGION = process.env.AWS_REGION;

// Import Clients
const s3Client = new S3Client({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient([AWS_REGION]);
const schedulerClient = new SchedulerClient([AWS_REGION]);
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

interface httpResponse {
  statusCode: number;
  body: String;
}

export const lambdaHandler = async (event: S3Event): Promise<httpResponse> => {
  const timezone = 'America/New_York';
  const current_time = new Date().toLocaleString('en-US', {
    timeZone: timezone,
  });
  const epochTime = Math.floor(new Date(current_time).getTime() / 1000);
  const scheduledTimeExpression = new Date(epochTime * 1000)
    .toISOString()
    .replace(/\.\d{3}/, '')
    .replace(/Z$/, '');

  try {
    const latestObjectKey = extractLatestObjectKey(event);
    const params = createGetObjectParams(
      event.Records[0].s3.bucket.name,
      latestObjectKey,
    );
    const data = await getObject(params);
    const meetingInvitation = await data.Body?.transformToString();

    if (data && meetingInvitation) {
      const prompt = createPrompt(meetingInvitation);
      const input = createInvokeModelInput(prompt);
      const response = await invokeModel(input);
      const bedrockResponse = JSON.parse(
        new TextDecoder().decode(response.body),
      );
      const meetingInfo = JSON.parse(bedrockResponse.completion);
      const meetingID: string = meetingInfo.meetingId;
      const meetingType: string = meetingInfo.meetingType;
      const dialIn: string = meetingInfo.dialIn;

      await scheduleEventBridge(
        meetingID,
        meetingType,
        scheduledTimeExpression,
        epochTime,
        dialIn,
      );

      await writeDynamo(meetingID, meetingType, epochTime);

      return {
        statusCode: 200,
        body: JSON.stringify({ Message: 'Call Scheduled Successfully' }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ Error: 'Missing required parameters' }),
      };
    }
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ Error: error.message }),
    };
  }
};

//Helper functions

const extractLatestObjectKey = (event: S3Event): string => {
  return event.Records[0].s3.object.key;
};

const createGetObjectParams = (
  bucketName: string,
  key: string,
): { Bucket: string; Key: string } => {
  return { Bucket: bucketName, Key: key };
};

const getObject = async (params: {
  Bucket: string;
  Key: string;
}): Promise<GetObjectCommandOutput> => {
  return s3Client.send(new GetObjectCommand(params));
};
//Prompt
const createPrompt = (meetingInvitation: string): string => {
  return JSON.stringify({
    prompt: `Human:${meetingInvitation} You are a an information extracting bot. Go over the ${meetingInvitation} and determine what the meeting id and meeting type are <instructions></instructions> xml tags
        
          <instructions>  

          1. Identify Meeting Type:
              Determine if the ${meetingInvitation} is for Chime, Zoom, Google, Microsoft Teams, or Webex meetings.

          2. Chime, Zoom, and Webex
              - Find the meetingID
              - Remove all spaces from the meeting ID (e.g., #### ## #### -> ##########). 

          2. If Google -  Instructions Extract Meeting ID and Dial in 
            - For Google only, the ${meetingInvitation} will call a meetingID a 'pin', so treat it as a meetingID
            - Remove all spaces from the meeting ID (e.g., #### ## #### -> ##########). 
            - Extract Google and Microsoft Dial-In Number (if applicable):
            - If the meeting is a Google meeting, extract the unique dial-in number.
            - Locate the dial-in number following the text "to join by phone dial."
            - Format the extracted Google dial-in number as (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)

          3. If Microsoft Teams - Instructions if meeting type is is Microsoft Teams. 
            - Pay attention to these instructions carefully            
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - in the ${meetingInvitation}, there are two IDs a 'Meeting ID' (### ### ### ##) and a 'Phone Conference ID' (### ### ###), ignore the 'Meeting ID' use the 'Phone Conference ID'
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - The meetingID that we want is referenced as the 'Phone Conference ID' store that one as the meeting ID. 
            - Find the phone number, extract it and store it as the dialIn number (format (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)
    
          4. meetingType rules
          - The only valid responses for meetingType are 'Chime', 'Webex', 'Zoom', 'Google', 'Teams'
          
          
          5.    Generate Response:

              - Create a response object with the following format:
              { 
                meetingId: "meeting id goes here with spaces removed",
                meetingType: "meeting type goes here (options: 'Chime', 'Webex', 'Zoom', 'Google', 'Teams')",
                dialIn: "Insert Google Dial-In number with no dashes or spaces, or N/A if not a Google Meeting"
              }

              Meeting ID Formats:

              Zoom: ### #### ####
              Webex: #### ### ####
              Chime: #### ## ####
              Google: ### ### #### (last character is always '#')
              Teams: ### ### ###

              Ensure that the program does not create fake phone numbers and only includes the Microsoft or Google dial-in number if the meeting type is Google or Teams.

          </instructions>
        
          Assistant: Should I add anything else in my answer?
        
          Human: Only return a JSON formatted response with the meetingid and meetingtype associated to it. Do not add any other words to your answer. Do not add any introductory sentences in your answer.    \nAssistant:`,
    max_tokens_to_sample: 100,
    temperature: 0,
  });
};

const createInvokeModelInput = (prompt: string): InvokeModelCommandInput => {
  return {
    body: prompt,
    modelId: 'anthropic.claude-v2',
    accept: 'application/json',
    contentType: 'application/json',
  };
};

const invokeModel = async (
  input: InvokeModelCommandInput,
): Promise<InvokeModelCommandOutput> => {
  const output = bedrockClient.send(new InvokeModelCommand(input));
  return output;
};

const scheduleEventBridge = async (
  meetingID: string,
  meetingType: string,
  scheduledTimeExpression: string,
  epochTime: number,
  dialIn: string,
): Promise<CreateScheduleOutput> => {
  const result = await schedulerClient.send(
    new CreateScheduleCommand({
      Description: 'Meeting',
      FlexibleTimeWindow: {
        Mode: 'OFF',
      },
      GroupName: EVENTBRIDGE_GROUP_NAME,
      Name: `${meetingID}${epochTime}`,
      ScheduleExpression: `at(${scheduledTimeExpression})`,
      State: 'ENABLED',
      Target: {
        Arn: EVENTBRIDGE_TARGET_LAMBDA,
        RoleArn: EVENTBRIDGE_LAMBDA_ROLE,
        Input: JSON.stringify({
          meetingID: meetingID,
          meetingType: meetingType,
          scheduledTime: epochTime,
          dialIn: dialIn,
        }),
      },
    }),
  );
  return result;
};

const writeDynamo = async (
  meetingID: string,
  meetingType: string,
  epochTime: Number,
): Promise<PutItemCommandOutput> => {
  const result = await dynamoClient.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        call_id: { S: meetingID },
        scheduled_time: { S: `${epochTime}` },
        meeting_type: { S: meetingType },
        transcript: { S: 'Available After Meeting' },
        summary: { S: 'Available After The Meeting' },
      },
    }),
  );
  return result;
};
