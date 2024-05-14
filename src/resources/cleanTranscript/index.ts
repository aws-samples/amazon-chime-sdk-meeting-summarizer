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
const PREFIX = process.env.PREFIX;

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
      const prompt = createPayload(transcript);
      console.log(prompt);
      const input = createInvokeModelInput(prompt);
      console.log(input);
      const response = await invokeModel(input);
      console.log(response);
      const bedrockResponse = JSON.parse(
        new TextDecoder().decode(response.body),
      );

      console.log(bedrockResponse);
      const summary = bedrockResponse.content[0].text;

      console.log(summary);
      await writeBucket(latestObjectKey, summary, PREFIX || 'clean-transcript');

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

const createPayload = (transcript: string): string => {
  const prompt = `Human: You are a transcript editor, please follow the <instructions> tags.

    <transcript> ${transcript} </transcript>
    
        <instructions> 
        - The <transcript> contains a speaker diarized transcript 
        - Go over the transcript and remove all filler words. For example  "um, uh, er, well, like, you know, okay, so, actually, basically, honestly, anyway, literally, right, I mean."
        - Fix any errors in transcription that may be caused by homophones based on the context of the sentence.  For example, "one instead of won" or "high instead of hi"
        - In addition, please fix the transcript in cases where diarization is improperly performed. For example, in some cases you will see
        that sentences are split between two speakers. In this case infer who the actual speaker is and attribute it to them. 
        - Please review the following example of this, 

        Input Example
        Chris: Adam you are saying the wrong thing. What 
        Adam: um do you mean, Chris?
        
        Output: 
        Chris: Adam you are saying the wrong thing.
        Adam: What do you mean, Chris? 

        - In your response, return the entire cleaned transcript, including all of the filler word removal and the improved diarization. Only return the transcript, do not include any leading or trailing sentences. You are not summarizing. You are cleaning the transcript. Do not include any xml tags <>
        </instructions>
    
    Assistant:`;
  return JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 10000,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  });
};

const createInvokeModelInput = (prompt: string): InvokeModelCommandInput => {
  return {
    body: prompt,
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
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
  prefix: string,
): Promise<PutObjectCommandOutput | httpResponse> => {
  try {
    const newKey = `${prefix}/${extractAfterFirstSlash(latestObjectKey)}`;
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
        UpdateExpression: 'SET transcript = :value',
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
