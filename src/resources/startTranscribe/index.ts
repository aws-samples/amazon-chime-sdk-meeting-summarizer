import {
  DynamoDBClient,
  UpdateItemCommandOutput,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import { S3Event } from 'aws-lambda';

const PREFIX_TRANSCRIBE_S3 = process.env.PREFIX_TRANSCRIBE_S3;
const BUCKET = process.env.BUCKET;
const AWS_REGION = process.env.AWS_REGION;
const TABLE = process.env.TABLE;


const transcribeClient = new TranscribeClient({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });

interface httpResponse {
  statusCode: number;
  body: String;
}

interface meetingInfo {
  meetingID: string;
  scheduledTime: string;
}

export const lambdaHandler = async (
  event: S3Event,
  _context: any,
): Promise<httpResponse> => {
  try {
    const s3bucket = event.Records[0].s3.bucket.name;
    const s3object = event.Records[0].s3.object.key;

    console.log(s3object);
    const audioSource = `s3://${s3bucket}/${s3object}`;


    await updateDynamo(s3object);

    const extractBeforeSlash = (s: string) => s.split('/')[1];
    const jobName = extractBeforeSlash(s3object);

    // Start a Transcribe job
    const response = await transcribeClient.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        IdentifyLanguage: true,
        MediaFormat: 'wav',
        Media: {
          MediaFileUri: audioSource,
        },
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 10,
        },
        OutputBucketName: `${BUCKET}`,
        OutputKey: `${PREFIX_TRANSCRIBE_S3}/`,
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: response }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ Error: error.message }),
    };
  }
};


const updateDynamo = async (
  latestObjectKey: string,
): Promise<UpdateItemCommandOutput | httpResponse> => {
  const dynamoVariables: meetingInfo = extractCallId(latestObjectKey);
  const value = `https://${BUCKET}.s3.amazonaws.com/${latestObjectKey}`;
  try {
    // Send the command to DynamoDB
    const response = await dynamoClient.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: {
          call_id: { S: dynamoVariables.meetingID },
          scheduled_time: { S: dynamoVariables.scheduledTime },
        },
        UpdateExpression: 'SET meeting_audio = :value',
        ExpressionAttributeValues: {
          ':value': { S: value },
        },
      }),
    );
    console.log(response);
    return response;
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ Error: error.message }),
    };
  }
};

const extractCallId = (inputString: string): meetingInfo => {
  const partsBetweenSlashes = inputString.split('/')[1];
  const [meetingID, scheduledTime] = partsBetweenSlashes.split('.');
  return { meetingID, scheduledTime };
};
