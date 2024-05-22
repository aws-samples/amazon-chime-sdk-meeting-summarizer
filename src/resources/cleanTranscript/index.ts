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

const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });

interface httpResponse {
  statusCode: number;
  body: string;
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
      const chunks = splitTranscript(transcript, 3500);
      const processedChunks = await Promise.all(
        chunks.map(async (chunkText) => {
          const prompt = createPayload(chunkText);
          const input = createInvokeModelInput(prompt);
          const response = await invokeModel(input);
          if (response.body) {
            try {
              const bedrockResponse = JSON.parse(
                new TextDecoder().decode(response.body),
              );
              return bedrockResponse.content[0].text;
            } catch (error) {
              console.error('Error parsing Bedrock response:', error);
              throw error;
            }
          } else {
            throw new Error('Empty response body from Bedrock');
          }
        }),
      );

      if (processedChunks.length > 0) {
        const enhancedTranscript = processedChunks.join('\n');
        const cleanTranscriptPrefix = PREFIX || 'clean-transcript';
        await writeBucket(
          latestObjectKey,
          enhancedTranscript,
          cleanTranscriptPrefix,
        );
        await updateDynamo(latestObjectKey);
      } else {
        console.warn('No processed chunks found');
      }
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

function splitTranscript(transcript: string, maxTokens: number): string[] {
  const lines = transcript.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 <= maxTokens) {
      currentChunk += line + '\n';
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = line + '\n';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

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
  const prompt = `Human: You are a transcript editor. Please follow the instructions below to enhance the given transcript.

  <transcript>
  ${transcript}
  </transcript>
  
  <instructions>
  - The <transcript> contains a speaker-diarized transcript.
  - Remove all filler words, such as "um," "uh," "er," "well," "like," "you know," "okay," "so," "actually," "basically," "honestly," "anyway," "literally," "right," and "I mean."
  - Correct any errors in transcription caused by homophones based on the context of the sentence. For example, replace "one" with "won" or "high" with "hi" when appropriate.
  - Fix issues with improper diarization, where sentences are split between two speakers. Infer the actual speaker based on context and attribute the entire sentence to them.
  - Return the entire cleaned transcript with filler words removed and diarization improved. Do not include any additional text or XML tags. Only include the cleaned transcription.
  - Each different speaker should be on a new line. with a space between the lines to make it more readable
  - Also be aware, sometimes at the beginning of the conversation you may notice from the transcript that diarization is poorly done. This is because people are talking over each other. Infer what is going on and do your best to attribute and fix the transcript to be more coherent
  - Also double check the speaker labels to make sure they are correct. For example if you see the following situation Court: My name is Adam  then correct it to say Adam: My name is Adam.

  


  Example:
  Input:
  Chris: Adam you are saying the wrong thing. What
  Adam: um do you mean, Chris?
  
  Output:
  Chris: Adam you are saying the wrong thing.
  Adam: What do you mean, Chris?
  
  
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
  return bedrockClient.send(new InvokeModelCommand(input));
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
  const [meetingID, scheduledTime] = partsAfterFirstSlash.split('.');
  return { meetingID, scheduledTime };
};
