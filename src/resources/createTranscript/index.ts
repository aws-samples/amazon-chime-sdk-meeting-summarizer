import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { S3Event } from 'aws-lambda';

const INITIAL_TRANSCRIPT_PREFIX = process.env.INITIAL_TRANSCRIPT_PREFIX || '';
const BUCKET = process.env.BUCKET || '';
const AWS_REGION = process.env.AWS_REGION;

const s3Client = new S3Client({ region: AWS_REGION });
const extractBetweenSlash = (s: string) => s.split('/')[1];

interface httpResponse {
  statusCode: number;
  body: String;
}

interface transcription {
  jobName: string;
  accountId: string;
  status: string;
  results: {
    transcripts: [{ transcript: string }];
    speaker_labels: {
      segments: [
        {
          start_time: string;
          end_time: string;
          speaker_label: string;
          items: Array<{
            speaker_label: string;
            start_time: string;
            end_time: string;
          }>;
        },
      ];
      channel_label: string;
      speakers: number;
    };
    items: Array<{
      type: string;
      alternatives: [{ confidence: string; content: string }];
      start_time: string;
      end_time: string;
      speaker_label: string;
    }>;
  };
}

export const lambdaHandler = async (
  event: S3Event,
  _context: any,
): Promise<httpResponse> => {
  try {
    const latestObjectKey = extractLatestObjectKey(event);
    const params = createGetObjectParams(
      event.Records[0].s3.bucket.name,
      latestObjectKey,
    );
    const data = await getObject(params);
    const transcribeJSON: string = (await data.Body?.transformToString()) ?? '';
    const jsonTranscribe: transcription = JSON.parse(transcribeJSON);

    const conversation = createConversation(jsonTranscribe);

    const objectContent = conversation.join('\n');

    // Generate the new TXT key
    const objectTxtKey = latestObjectKey.replace('.json', '.txt');
    const objectTxtKeyFinal = `${INITIAL_TRANSCRIPT_PREFIX}/${extractBetweenSlash(
      objectTxtKey,
    )}`;
    // Upload the TXT file to the destination S3 bucket
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectTxtKeyFinal,
        Body: objectContent,
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        Message: 'Lambda function processed successfully',
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: `Error: ${error.message}`,
    };
  }
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

function createConversation(jsonTranscribe: transcription): string[] {
  console.log('Creating Conversation');
  const conversation: string[] = [];
  let currentSpeaker: string | null = null;
  let currentConversation = '';

  for (const item of jsonTranscribe.results?.items || []) {
    if ('speaker_label' in item) {
      const speakerLabel = item.speaker_label;
      const content = item.alternatives[0]?.content || '';

      if (currentSpeaker !== speakerLabel) {
        if (currentSpeaker) {
          conversation.push(`${currentSpeaker}: ${currentConversation}`);
        }
        currentSpeaker = speakerLabel;
        currentConversation = content;
      } else {
        currentConversation += ` ${content}`;
      }
    }
  }

  // Append the last segment
  if (currentSpeaker) {
    conversation.push(`${currentSpeaker}: ${currentConversation}`);
  }

  return conversation;
}
