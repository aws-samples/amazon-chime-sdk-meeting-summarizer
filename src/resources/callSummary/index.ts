import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandOutput,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  DynamoDBClient,
  UpdateItemCommandOutput,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandOutput,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { S3Event } from 'aws-lambda';

const AWS_REGION = process.env.AWS_REGION;
const TABLE = process.env.TABLE;
const BUCKET = process.env.BUCKET;
const PREFIX = process.env.CALL_SUMMARY_PREFIX;

//import clients
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });

interface httpResponse {
  statusCode: number;
  body: String;
}

interface meetingInfo {
  meetingID: string;
  scheduledTime: string;
}

export const lambdaHandler = async (event: S3Event): Promise<httpResponse> => {
  try {
    const latestObjectKey = extractLatestObjectKey(event);
    const params = createGetObjectParams(
      event.Records[0].s3.bucket.name,
      latestObjectKey,
    );
    const data = await getObject(params);
    const transcript = await data.Body?.transformToString();

    if (transcript) {
      const prompt = createPrompt(transcript);
      const input = createInvokeModelInput(prompt);
      const response = await invokeModel(input);
      const bedrockResponse = JSON.parse(
        new TextDecoder().decode(response.body),
      );
      const summary = bedrockResponse.completion;

      await writeBucket(latestObjectKey, summary);
      await updateDynamo(latestObjectKey);
    }
  } catch (error: any) {
    return {
      statusCode: 500,
      body: `Error: ${error.message}`,
    };
  }

  return {
    statusCode: 200,
    body: 'Lambda Succeeded, Call Summary Generated',
  };
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

const createPrompt = (transcript: string): string => {
  return JSON.stringify({
    prompt: `Human:${transcript} You are a transcript summarizing bot. You will go over the ${transcript} and provide a summary of the  <instructions></instructions> xml tags
      
        <instructions>
            - Go over the conversation that was had in the ${transcript}
            - Create a summary based on what ocurred on the meeting 
            - Highlight specific action items that came up in the meeting, including follow-up tasks for each person
            - If relevant, focus on what specific AWS services were mentioned during the conversation. 
        </instructions>
      
        Assistant: Should I add anything else in my answer?
      
        Human: If there is not enough context to generate a proper summary, then just return a string that says "Meeting not long enough to generate a transcript.    \nAssistant:`,
    max_tokens_to_sample: 4000,
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

const extractAfterFirstSlash = (input: string): string | undefined => {
  const parts = input.split('/');
  return parts.length > 1 ? parts[1] : undefined;
};

const writeBucket = async (
  latestObjectKey: string,
  summary: string,
): Promise<PutObjectCommandOutput | httpResponse> => {
  try {
    const newKey = `${PREFIX}/${extractAfterFirstSlash(latestObjectKey)}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: newKey,
      Body: summary,
    });
    await s3Client.send(command);
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ Error: error.message }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Wrote to Transcript to Bucket ${BUCKET}`,
    }),
  };
};

const updateDynamo = async (
  latestObjectKey: string,
): Promise<UpdateItemCommandOutput | httpResponse> => {
  const dynamoVariables: meetingInfo = extractCallId(latestObjectKey);
  const newKey = `${PREFIX}/${extractAfterFirstSlash(latestObjectKey)}`;
  const value = `https://${BUCKET}.s3.amazonaws.com/${newKey}`;
  try {
    // Send the command to DynamoDB
    const response = await dynamoClient.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: {
          call_id: { S: dynamoVariables.meetingID },
          scheduled_time: { S: dynamoVariables.scheduledTime },
        },
        UpdateExpression: 'SET summary = :value',
        ExpressionAttributeValues: {
          ':value': { S: value },
        },
      }),
    );
    return response;
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ Error: error.message }),
    };
  }
};

const extractCallId = (inputString: string): meetingInfo => {
  const partsAfterFirstSlash = inputString.split('/')[1];
  const meetingID = partsAfterFirstSlash.split('.')[0];
  const scheduledTime = partsAfterFirstSlash.split('.')[1];
  return { meetingID, scheduledTime };
};