import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  ChimeSDKVoiceClient,
  CreateSipMediaApplicationCallCommand,
  CreateSipMediaApplicationCallCommandOutput,
} from '@aws-sdk/client-chime-sdk-voice';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import {
  SchedulerClient,
  CreateScheduleCommand,
  CreateScheduleOutput,
} from '@aws-sdk/client-scheduler';
import moment from 'moment';

const AWS_REGION = process.env.AWS_REGION;
const TABLE_NAME = process.env.TABLE || '';
const SMA_PHONE = process.env.SMA_PHONE || '';
const SMA_APP = process.env.SMA_APP || '';
const EVENTBRIDGE_TARGET_LAMBDA = process.env.EVENTBRIDGE_TARGET_LAMBDA || '';
const EVENTBRIDGE_GROUP_NAME = process.env.EVENTBRIDGE_GROUP_NAME || '';
const EVENTBRIDGE_LAMBDA_ROLE = process.env.EVENTBRIDGE_LAMBDA_ROLE || '';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const schedulerClient = new SchedulerClient({ region: AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
const chimeSdkClient = new ChimeSDKVoiceClient({ region: AWS_REGION });

export const createPrompt = (meetingInvitation: string): string => {
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
export const createInvokeModelInput = (
  prompt: string,
): InvokeModelCommandInput => {
  return {
    body: prompt,
    modelId: 'anthropic.claude-v2',
    accept: 'application/json',
    contentType: 'application/json',
  };
};

export const invokeModel = async (
  input: InvokeModelCommandInput,
): Promise<InvokeModelCommandOutput> => {
  const output = await bedrockClient.send(new InvokeModelCommand(input));
  return output;
};

export const scheduleEventBridge = async ({
  meetingID,
  meetingType,
  scheduledTime,
}: {
  meetingID: string;
  meetingType: string;
  scheduledTime: number;
}): Promise<CreateScheduleOutput> => {
  const scheduledMoment = moment(scheduledTime);
  const scheduledTimeExpression = scheduledMoment
    .toISOString()
    .replace(/\.\d{3}/, '')
    .replace(/Z$/, '');

  console.log(
    `scheduling meeting ${meetingID} for ${scheduledTimeExpression} `,
  );

  const result = await schedulerClient.send(
    new CreateScheduleCommand({
      Description: 'Meeting',
      FlexibleTimeWindow: {
        Mode: 'OFF',
      },
      GroupName: EVENTBRIDGE_GROUP_NAME,
      Name: `${meetingID}${scheduledTime}`,
      ScheduleExpression: `at(${scheduledTimeExpression})`,
      State: 'ENABLED',
      Target: {
        Arn: EVENTBRIDGE_TARGET_LAMBDA,
        RoleArn: EVENTBRIDGE_LAMBDA_ROLE,
        Input: JSON.stringify({
          meetingID: meetingID,
          meetingType: meetingType,
          scheduledTime: scheduledTime,
        }),
      },
    }),
  );
  return result;
};

export async function writeDynamo({
  meetingID,
  meetingType,
  scheduledTime,
}: {
  meetingID: string;
  meetingType: string;
  scheduledTime: number;
}): Promise<void> {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        call_id: { S: meetingID },
        scheduled_time: { S: scheduledTime.toString() },
        meeting_type: { S: meetingType },
        transcript: { S: 'Available After Meeting' },
        summary: { S: 'Available After The Meeting' },
      },
    }),
  );
}

export async function dialOut({
  meetingType,
  meetingID,
  scheduledTime,
}: {
  meetingType: string;
  meetingID: string;
  scheduledTime: number;
}): Promise<CreateSipMediaApplicationCallCommandOutput> {
  console.log(
    `dialing out meetingType: ${meetingType} MeetingId:${meetingID} at ${scheduledTime.toString()}`,
  );
  const createSipMediaApplicationCallResponse = await chimeSdkClient.send(
    new CreateSipMediaApplicationCallCommand({
      FromPhoneNumber: SMA_PHONE,
      ToPhoneNumber: '+18555524463',
      SipMediaApplicationId: SMA_APP,
      ArgumentsMap: {
        meetingType: meetingType,
        meetingID: meetingID,
        scheduledTime: scheduledTime.toString(),
      },
    }),
  );
  return createSipMediaApplicationCallResponse;
}
