import {
  TranscribeClient,
  StartTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import { S3Event } from 'aws-lambda';

const PREFIX_TRANSCRIBE_S3 = process.env.PREFIX_TRANSCRIBE_S3;
const BUCKET = process.env.BUCKET;
const AWS_REGION = process.env.AWS_REGION;

const transcribeClient = new TranscribeClient({ region: AWS_REGION });

interface httpResponse {
  statusCode: number;
  body: String;
}

export const lambdaHandler = async (
  event: S3Event,
  _context: any,
): Promise<httpResponse> => {
  try {
    const s3bucket = event.Records[0].s3.bucket.name;
    const s3object = event.Records[0].s3.object.key;

    const audioSource = `s3://${s3bucket}/${s3object}`;

    const extractBeforeSlash = (s: string) => s.split('/')[1];
    const jobName = extractBeforeSlash(s3object);

    // Start a Transcribe job
    const response = await transcribeClient.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        LanguageCode: 'en-US',
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
