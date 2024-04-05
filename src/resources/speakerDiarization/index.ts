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
const PREFIX = process.env.DIARIZED_TRANSCRIPT_PREFIX;
const KNOWLEDGE_BASE_PREFIX = process.env.KNOWLEDGE_BASE_PREFIX;

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
    console.log('Clean Transcript Function');

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

      const responseReadable = new TextDecoder().decode(response.body);

      const speakerNames = JSON.parse(responseReadable);

      const processedSpeakers = speakerNames.completion;

      const newTranscript = replaceSpeakerLabels(transcript, processedSpeakers);

      await writeBucket(latestObjectKey, newTranscript, PREFIX || 'diarized-transcript');
      await writeBucket(latestObjectKey, newTranscript, KNOWLEDGE_BASE_PREFIX || 'knowledge-base');

      await updateDynamo(latestObjectKey, processedSpeakers);

      console.log('Lambda function processed successfully.');
      return {
        statusCode: 200,
        body: JSON.stringify({
          Message: 'Lambda function processed successfully',
        }),
      };
    } else {
      console.error('Missing transcript');
      return {
        statusCode: 400,
        body: JSON.stringify({ Error: 'Missing transcript' }),
      };
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ Error: error.message }),
    };
  }
};

// Helper functions

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
    prompt: `Human: You are a meeting transcript names extractor. Go over the transcript and extract the names from it. Use the following instructions in the <instructions></instructions> xml tags
      <transcript> ${transcript} </transcript>
      <instructions>
      - Some transcripts will be in different languages other than English. 
      - Extract the names like this example - spk_0: "name1", spk_1: "name2".
      - Only extract the names like the example above and do not add any other words to your response
      - Your response should only have a list of "speakers" and their associated name separated by a ":" surrounded by {}
      - if there is only one speaker identified then surround your answer with {}
      - the format should look like this {"spk_0" : "Name", "spk_1: "Name2", etc.}, no unnecessary spacing should be added
      </instructions>
    
      Assistant: Should I add anything else in my answer?
    
      Human: Only return a JSON formatted response with the Name and the speaker label associated to it. Do not add any other words to your answer. Do NOT EVER add any introductory sentences in your answer. Only give the names of the speakers actively speaking in the meeting. Only give the names of the speakers actively speaking in the meeting in the format shown above.
      
    Assistant:`,
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

const replaceSpeakerLabels = (
  transcript: string,
  speakerNames: any,
): string => {
  const test = JSON.parse(speakerNames);
  for (const key in test) {
    if (Object.prototype.hasOwnProperty.call(test, key)) {
      // Create a regular expression with word boundary anchors for the speaker label
      const pattern = new RegExp(`\\b${key}\\b`, 'g');
      // Replace occurrences of the speaker label with the corresponding name in the transcript
      transcript = transcript.replace(pattern, test[key]);
    }
  }
  console.log(transcript);
  return transcript;
};

const writeBucket = async (
  latestObjectKey: string,
  newTranscript: string,
  prefix: string,
): Promise<PutObjectCommandOutput | httpResponse> => {
  try {
    const newKey = `${prefix}/${extractAfterFirstSlash(latestObjectKey)}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: newKey,
      Body: newTranscript,
    });
    const response = await s3Client.send(command);
    console.log(response);
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
  processedSpeakers: string,
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
        UpdateExpression: 'SET transcript = :value,  meeting_participants = :processedSpeakers',
        ExpressionAttributeValues: {
          ':value': { S: value },
          ':processedSpeakers': { S: processedSpeakers },
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

const extractAfterFirstSlash = (input: string): string | undefined => {
  const parts = input.split('/');
  return parts.length > 1 ? parts[1] : undefined;
};
