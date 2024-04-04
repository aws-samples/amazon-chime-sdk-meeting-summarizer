import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  S3Resources,
  DatabaseResources,
  LambdaResources,
  ChimeSDKResources,
  EventBridgeResources,
  CloudWatchResources,
  Site,
  Infrastructure,
  Cognito,
  BedrockKnowledgeBaseResources,
} from './';

config();

export interface AmazonChimeSDKMeetingSummarizerProps extends StackProps {
  logLevel: string;
  allowedDomain: string;
}

export class AmazonChimeSDKMeetingSummarizer extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKMeetingSummarizerProps,
  ) {
    super(scope, id, props);

    const databaseResources = new DatabaseResources(this, 'databaseResources');
    const s3Resources = new S3Resources(this, 's3Resources');
    const chimeResources = new ChimeSDKResources(this, 'chimeSDKResources', {
      bucket: s3Resources.processingBucket,
    });
    const eventbridgeResources = new EventBridgeResources(
      this,
      'eventbridgeResources',
      { dialOut: chimeResources.dialOut },
    );

    const bedrockResources = new BedrockKnowledgeBaseResources(
      this,
      'BedrockKnowledgeBaseResources',
      {
        bucket: s3Resources.processingBucket,
        namePrefix: 'chatbot-knowledge-base',
      },
    );

    const lambdaResources = new LambdaResources(this, 'lambdaResources', {
      bucket: s3Resources.processingBucket,
      callTable: databaseResources.callTable,
      eventbridge: eventbridgeResources.eventbridgeScheduleGroup,
      eventbridge_role: eventbridgeResources.eventbridgeRole,
      dialOut: chimeResources.dialOut,
      logLevel: props.logLevel,
      knowledgeBaseId: bedrockResources.knowledgeBaseId,
      dataSourceId: bedrockResources.dataSourceId,
    });

    const cognitoResources = new Cognito(this, 'Cognito', {
      allowedDomain: props.allowedDomain,
    });

    const infrastructure = new Infrastructure(this, 'Infrastructure', {
      userPool: cognitoResources.userPool,
      bucket: s3Resources.processingBucket,
      callTable: databaseResources.callTable,
      eventbridge: eventbridgeResources.eventbridgeScheduleGroup,
      eventbridge_role: eventbridgeResources.eventbridgeRole,
      dialOut: chimeResources.dialOut,
      smaApp: chimeResources.smaApp,
      phoneNumber: chimeResources.phoneNumber,
      knowledgeBaseId: bedrockResources.knowledgeBaseId,
    });

    const site = new Site(this, 'Site', {
      apiUrl: infrastructure.apiUrl,
      userPool: cognitoResources.userPool,
      userPoolClient: cognitoResources.userPoolClient,
      userPoolRegion: cognitoResources.userPoolRegion,
      identityPool: cognitoResources.identityPool,
    });


    new CloudWatchResources(this, 'cloudwatchResources', {
      smaHandler: chimeResources.smaHandler,
      dialOut: chimeResources.dialOut,
      createTranscript: lambdaResources.createTranscript,
      speakerDiarization: lambdaResources.speakerDiarization,
      callSummary: lambdaResources.callSummary,
      startTranscribe: lambdaResources.startTranscribe,
      requestProcessor: infrastructure.requestProcessorLambda,
    });

    new CfnOutput(this, 'siteBucket', { value: site.siteBucket.bucketName });
    new CfnOutput(this, 'summarizerSite', {
      value: site.distribution.distributionDomainName,
    });
    new CfnOutput(this, 'knowledgeBaseRoleArn', {
      value: bedrockResources.knowledgeBaseRole.roleArn,
    });
    new CfnOutput(this, 'dataSourceId', {
      value: bedrockResources.dataSourceId,
    });
    new CfnOutput(this, 'collectionName', {
      value: bedrockResources.collectionName,
    });
    new CfnOutput(this, 'knowledgeBaseId', {
      value: bedrockResources.knowledgeBaseId,
    });
  }
}

const props = {
  logLevel: process.env.LOG_LEVEL || '',
  allowedDomain: process.env.ALLOWED_DOMAIN || '',
};
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const app = new App();

new AmazonChimeSDKMeetingSummarizer(app, 'AmazonChimeSDKMeetingSummarizer', {
  ...props,
  env: devEnv,
});

app.synth();
