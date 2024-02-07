import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  ChimeSDKVoiceClient,
  CreateSipMediaApplicationCallCommand,
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

interface httpResponse {
  statusCode: number;
  body: String;
}


export //Prompt
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
            - For Google only, the ${meetingInvitation} will call a meetingID a 'PIN', so treat it as a meetingID
            - Remove all spaces from the PIN (e.g., #### ## #### -> ##########). 
            - Extract Google the dialIn number
            - Locate the dial-in number following the text "otherwise, to join by phone"
            - Format the extracted Google dial-in number as (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)

          3. If Microsoft Teams - Instructions if meeting type is is Microsoft Teams. 
            - Pay attention to these instructions carefully            
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - in the ${meetingInvitation}, there are two IDs a 'Meeting ID' (### ### ### ##) and a 'Phone Conference ID' (### ### ###), ignore the 'Meeting ID' use the 'Phone Conference ID'
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - Find the phone number, extract it and store it as the dialIn number (format (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)
    
          4. meetingType rules
          - The only valid responses for meetingType are 'Chime', 'Webex', 'Zoom', 'Google', 'Teams'

          5. meetingId Format Rules 

          Zoom: ### #### ####
          Webex: #### ### ####
          Chime: #### ## ####
          Google: ### ### #### (last character is always '#')
          Teams: ### ### ###
          
          6. Other notes
          - Ensure that the program does not create fake phone numbers and only includes the Microsoft or Google dial-in number if the meeting type is Google or Teams.
          - Ensure that the meetingId matches perfectly.

          
          7.    Generate FINAL JSON Response:

              - Create a response object with the following format:
              { 
                meetingId: "meeting id goes here with spaces removed",
                meetingType: "meeting type goes here (options: 'Chime', 'Webex', 'Zoom', 'Google', 'Teams')",
                dialIn: "Insert Microsoft or Google Dial-In number with no dashes or spaces, or N/A if not a Google Meeting or Teams Meeting"
              }

              Meeting ID Formats:


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
  dialIn
}: {
  meetingID: string;
  meetingType: string;
  scheduledTime: number;
  dialIn: string;
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
          dialIn : dialIn
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
  dialIn
}: {
  meetingType: string;
  meetingID: string;
  scheduledTime: number;
  dialIn: string;

}): Promise<httpResponse> {
  console.log(
    `dialing out meetingType: ${meetingType} MeetingId:${meetingID} at ${scheduledTime.toString()}`,
  );
  if (meetingType && meetingID && scheduledTime) {
    console.log('SMA Caller Initiated');
    try {
      if (meetingType === 'Chime') {
        console.log('Chime');
        const response = await chimeSdkClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: '+18555524463',
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID,
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Webex') {
        console.log('Webex');
        const response = await chimeSdkClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: '+18446213956',
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingType
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Zoom') {
        console.log('Zoom');
        const response = await chimeSdkClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: '+13017158592',
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Google') {
        console.log('Google');
        const response = await chimeSdkClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: dialIn,
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID,
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Teams') {
        console.log('Teams');
        console.log(dialIn, meetingType, meetingID)
        const response = await chimeSdkClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: dialIn,
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID
            },
          }),
        );
        console.log(response);
      } else {
        console.log('To be Built soon');
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ Message: 'Call initiated successfully' }),
      };
    } catch (error: any) {
      console.error(error);

      return {
        statusCode: 500,
        body: JSON.stringify({ Error: error.message }),
      };
    }
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ Error: 'Missing required parameters' }),
    };
  }
}


