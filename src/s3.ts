import { RemovalPolicy } from 'aws-cdk-lib';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class S3Resources extends Construct {
  public readonly processingBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.processingBucket = new Bucket(this, 'processingBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      eventBridgeEnabled: true,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [HttpMethods.GET],
          allowedOrigins: ['*'],
          exposedHeaders: [],
          maxAge: 3000,
        },
      ],
    });

    const processingBucketPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:PutObjectAcl'],
      principals: [new ServicePrincipal('voiceconnector.chime.amazonaws.com')],
      resources: [
        this.processingBucket.bucketArn,
        `${this.processingBucket.bucketArn}/*`,
      ],
      sid: 'SIPMediaApplicationRead',
    });

    this.processingBucket.addToResourcePolicy(processingBucketPolicy);

    new BucketDeployment(this, 'uploadBucketDeployment', {
      sources: [
        Source.data('call-summary/CALL_SUMMARY_FILES', ''),
        Source.data('diarized-transcript/DIARIZED_TRANSCRIPT_FILES', ''),
        Source.data('meeting-mp3/MEETING_MP3_FILES', ''),
        Source.data(
          'non-diarized-transcript/NON_DIARIZED_TRANSCRIPT_FILES',
          '',
        ),
        Source.data('transcribe-output/TRANSCRIBE_OUTPUT_FILES', ''),
        Source.data('knowledge-base/KNOWLEDGE_BASE_FILES', ''),
      ],
      destinationBucket: this.processingBucket,
    });
  }
}