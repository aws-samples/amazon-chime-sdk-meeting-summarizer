import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateConfiguration,
} from '@aws-sdk/client-bedrock-agent-runtime';
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

import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';

import {
  SchedulerClient,
  CreateScheduleCommand,
  CreateScheduleOutput,
  ListSchedulesCommand,
  GetScheduleCommand,
} from '@aws-sdk/client-scheduler';

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import moment from 'moment-timezone';

const AWS_REGION = process.env.AWS_REGION;
const TABLE_NAME = process.env.TABLE || '';
const SMA_PHONE = process.env.SMA_PHONE || '';
const SMA_APP = process.env.SMA_APP || '';
const EVENTBRIDGE_TARGET_LAMBDA = process.env.EVENTBRIDGE_TARGET_LAMBDA || '';
const EVENTBRIDGE_GROUP_NAME = process.env.EVENTBRIDGE_GROUP_NAME || '';
const EVENTBRIDGE_LAMBDA_ROLE = process.env.EVENTBRIDGE_LAMBDA_ROLE || '';
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID || '';
const MODEL_ARN = process.env.MODEL_ARN || 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const schedulerClient = new SchedulerClient({ region: AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
const chimeSdkClient = new ChimeSDKVoiceClient({ region: AWS_REGION });
const bedrockRetrieveClient = new BedrockAgentRuntimeClient({ region: AWS_REGION });


interface httpResponse {
  statusCode: number;
  body: String;
}

// Functions after refactoring

export const parseAndHandleCreateMeeting = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body!);
    const { meetingInfo, formattedDate, localTimeZone } = body;

    const input = createInvokeModelInput(createPrompt(meetingInfo));
    const bedrockResponse = JSON.parse(
      new TextDecoder().decode((await invokeModel(input)).body),
    );
    let { meetingId, meetingType, dialIn } = JSON.parse(bedrockResponse.completion);

    if (!meetingId || !meetingType) {
      return createApiResponse(JSON.stringify('Bad request: Missing meetingId or meetingType'), 400);
    }

    meetingId = meetingId.replace(/\s/g, '');
    const requestedDate = moment.tz(formattedDate, localTimeZone);
    const now = moment.tz(localTimeZone);

    await writeDynamo({
      meetingID: meetingId,
      meetingType: meetingType,
      scheduledTime: requestedDate.valueOf(),
    });

    if (requestedDate.isSameOrBefore(now)) {
      console.log('Starting summarizer now');
      await dialOut({
        meetingID: meetingId,
        meetingType: meetingType,
        scheduledTime: requestedDate.valueOf(),
        dialIn: dialIn,
      });
    } else {
      console.log('Scheduling summarizer for future');
      await scheduleEventBridge({
        meetingID: meetingId,
        meetingType: meetingType,
        scheduledTime: requestedDate.valueOf(),
        dialIn,
      });
    }

    return createApiResponse(JSON.stringify('Good request'));


  } catch (err) {
    console.error(err);
    return createApiResponse(JSON.stringify('Internal Server Error'), 500);
  }
};

export const parseAndHandleGetMeetings = async (
  meetingType: 'Past' | 'Scheduled',
): Promise<APIGatewayProxyResult> => {
  try {
    if (meetingType === 'Scheduled') {
      const detailedSchedules = await getAllScheduleDetails();
      return createApiResponse(JSON.stringify(detailedSchedules));
    } else {
      const items = await scanDynamoDBTable();
      return createApiResponse(JSON.stringify(items));
    }
  } catch (err) {
    console.error(err);
    return createApiResponse(JSON.stringify('Internal Server Error'), 500);
  }
};

export function methodNotAllowedResponse(): APIGatewayProxyResult {
  return createApiResponse(JSON.stringify('Method Not Allowed'), 405);
}

export function createApiResponse(body: string, statusCode: number = 200): APIGatewayProxyResult {
  return {
    statusCode,
    body,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Content-Type': 'application/json',
    },
  };
}

export const retrieveAndGenerate = async (
  inputText: string,
): Promise<APIGatewayProxyResult> => {
  const retrieveAndGenerateConfig: RetrieveAndGenerateConfiguration = {
    type: 'KNOWLEDGE_BASE',
    knowledgeBaseConfiguration: {
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      modelArn: MODEL_ARN,
    }, 
  };

  const input = {
    input: {
      text: inputText,
    },
    retrieveAndGenerateConfiguration: retrieveAndGenerateConfig,
  };

  try {
    const command = new RetrieveAndGenerateCommand(input);
    const response = await bedrockRetrieveClient.send(command);
    return createApiResponse(JSON.stringify(response));
  } catch (err) {
    console.error('Error in retrieveAndGenerate:', err);
    throw err;
  }
};

// Private Functions after refactoring

async function scanDynamoDBTable() {
  const params = {
    TableName: TABLE_NAME,
  };

  try {
    const command = new ScanCommand(params);
    const scanResult = await dynamoClient.send(command);

    if (!scanResult.Items) {
      return [];
    }

    const transformedItems = scanResult.Items.map(item => {
      return {
        summary: item.summary.S,
        meetingType: item.meeting_type.S,
        transcript: item.transcript.S,
        callId: item.call_id.S,
        scheduledTime: item.scheduled_time.S,
      };
    });

    return transformedItems;
  } catch (err) {
    console.error('Error scanning DynamoDB table:', err);
    return createApiResponse(JSON.stringify('Internal Server Error'), 500);
  }
}

async function writeDynamo({
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

const listSchedulesInGroup = async () => {
  if (!EVENTBRIDGE_GROUP_NAME) {
    console.error('EventBridge group name is not set.');
    throw new Error('EventBridge group name is required.');
  }

  try {
    const command = new ListSchedulesCommand({ GroupName: EVENTBRIDGE_GROUP_NAME });
    const response = await schedulerClient.send(command);
    return response.Schedules;
  } catch (err) {
    console.error('Error listing schedules in EventBridge group:', err);
    throw err;
  }
};

const getScheduleDetails = async (scheduleName: string) => {
  try {
    const command = new GetScheduleCommand({
      Name: scheduleName,
      GroupName: EVENTBRIDGE_GROUP_NAME,
    });
    const response = await schedulerClient.send(command);
    return response;
  } catch (err) {
    console.error('Error getting schedule details:', err);
    throw err;
  }
};

const getAllScheduleDetails = async () => {
  try {
    const schedulesResponse = await listSchedulesInGroup();
    if (!schedulesResponse || !Array.isArray(schedulesResponse)) {
      console.error('No schedules found or schedulesResponse is undefined.');
      return [];
    }

    const detailedSchedules = [];

    for (const schedule of schedulesResponse) {
      if (typeof schedule.Name === 'string') {
        const details = await getScheduleDetails(schedule.Name);
        detailedSchedules.push({
          ...schedule,
          ScheduleExpression: details.ScheduleExpression,
        });
      } else {
        console.error('Schedule name is undefined for a schedule:', schedule);
      }
    }

    return detailedSchedules;
  } catch (err) {
    console.error('Error retrieving all schedule details:', err);
    throw err;
  }
};

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

const scheduleEventBridge = async ({
  meetingID,
  meetingType,
  scheduledTime,
  dialIn,
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
          dialIn: dialIn,
        }),
      },
    }),
  );
  return result;
};

const invokeModel = async (
  input: InvokeModelCommandInput,
): Promise<InvokeModelCommandOutput> => {
  const output = await bedrockClient.send(new InvokeModelCommand(input));
  return output;
};

const createInvokeModelInput = (
  prompt: string,
): InvokeModelCommandInput => {
  return {
    body: prompt,
    modelId: 'anthropic.claude-v2',
    accept: 'application/json',
    contentType: 'application/json',
  };
};

async function dialOut({
  meetingType,
  meetingID,
  scheduledTime,
  dialIn,
}: {
  meetingType: string;
  meetingID: string;
  scheduledTime: number;
  dialIn: string;

}): Promise<httpResponse> {

  console.log(
    `dialing out meetingType: ${meetingType} MeetingId:${meetingID} at ${scheduledTime.toString()}`,
  );

  const scheduledTime1 = scheduledTime.toString();

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
              scheduledTime: scheduledTime1,
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
              meetingID: meetingType,
              scheduledTime: scheduledTime1,
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
              meetingID: meetingID,
              scheduledTime: scheduledTime1,
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
              scheduledTime: scheduledTime1,
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Teams') {
        console.log('Teams');
        console.log(dialIn, meetingType, meetingID);
        const response = await chimeSdkClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: dialIn,
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID,
              scheduledTime: scheduledTime1,
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