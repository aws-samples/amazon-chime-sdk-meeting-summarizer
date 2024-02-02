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
            - Read the  ${meetingInvitation}
            - Determine if the meeting invitation is a Chime meeting, a Zoom meeting, a Google meeting or a Webex meeting
            - Extract the meeting id associated with the meeting invite
            - once you determine the meetingid, remove all spaces from it in your response (ex: #### ## #### -> ##########)
            - Your response should only contain an object with the format
            - the format should look like this {meetingId : "meeting id goes here with the spaces removed", meetingType : "meeting type goes here (the options are 'Chime', 'Webex', 'Zoom', 'Google' "}, no unnecessary spacing should be added
            - For example {meetingId: "Meeting ID Goes Here", meetingType: "Meeting Type Goes here"}
            - Zoom meetings ids follow the following format ### #### ####
            - Webex meeting ids follow the following format #### ### ####
            - Chime meetingids follow the following format #### ## ####

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
