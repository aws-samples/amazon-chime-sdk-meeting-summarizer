// import path from 'path';
import { Stack, Duration } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  CompositePrincipal,
  ManagedPolicy,
  Role,
  ServicePrincipal,
  Effect,
  PolicyStatement,
  PolicyDocument,
} from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { CfnScheduleGroup } from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';

interface LambdaResourcesProps {
  bucket: Bucket;
  callTable: Table;
  eventbridge: CfnScheduleGroup;
  eventbridge_role: Role;
  dialOut: Function;
  logLevel: string;
  dataSourceId: string;
  knowledgeBaseId: string;
}
export class LambdaResources extends Construct {
  public readonly botScheduler: Function;
  public readonly startTranscribe: Function;
  public readonly createTranscript: Function;
  public readonly speakerDiarization: Function;
  public readonly callSummary: Function;
  public readonly dataSyncLambda: Function;

  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
    super(scope, id);

    const botSchedulerRole = new Role(this, 'botSchedulerRole', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
        new ServicePrincipal('scheduler.amazonaws.com'),
      ),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const eventBridgeSchedulerPolicy = new PolicyStatement({
      actions: ['iam:PassRole', 'scheduler:CreateSchedule'],
      resources: [props.eventbridge_role.roleArn, '*'],
    });

    botSchedulerRole.addToPolicy(eventBridgeSchedulerPolicy);

    const transcribeRole = new Role(this, 'startTranscribeRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const transcribePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['transcribe:StartTranscriptionJob'],
      resources: ['*'],
    });


    transcribeRole.addToPolicy(transcribePolicy);

    const createTranscriptRole = new Role(this, 'createTranscriptRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const speakerDiarizationRole = new Role(this, 'speakerDiarizationRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const callSummaryRole = new Role(this, 'callSummaryRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const bedrockPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${Stack.of(this).region
        }::foundation-model/anthropic.claude-v2`,
      ],
    });

    const dataSyncLambdaRole = new Role(this, 'dataSyncLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['bedrockPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: [
                'bedrock:StartIngestionJob',
              ],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    speakerDiarizationRole.addToPolicy(bedrockPolicy);
    callSummaryRole.addToPolicy(bedrockPolicy);
    botSchedulerRole.addToPolicy(bedrockPolicy);

    props.bucket.grantReadWrite(botSchedulerRole);
    props.bucket.grantReadWrite(transcribeRole);
    props.bucket.grantReadWrite(createTranscriptRole);
    props.bucket.grantReadWrite(speakerDiarizationRole);
    props.bucket.grantReadWrite(callSummaryRole);

    props.callTable.grantWriteData(botSchedulerRole);
    props.callTable.grantWriteData(speakerDiarizationRole);
    props.callTable.grantWriteData(transcribeRole)
    props.callTable.grantWriteData(callSummaryRole);

    this.botScheduler = new NodejsFunction(this, 'botSchedulerLambda', {
      entry: './src/resources/botScheduler/index.ts',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: 'lambdaHandler',
      timeout: Duration.minutes(5),
      role: botSchedulerRole,
      environment: {
        Bucket: props.bucket.bucketName,
        EVENTBRIDGE_TARGET_LAMBDA: props.dialOut.functionArn,
        EVENTBRIDGE_GROUP_NAME: props.eventbridge.name!,
        EVENTBRIDGE_LAMBDA_ROLE: props.eventbridge_role.roleArn,
        TABLE: props.callTable.tableName,
      },
    });

    this.startTranscribe = new NodejsFunction(this, 'startTranscribeLambda', {
      entry: './src/resources/startTranscribe/index.ts',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: 'lambdaHandler',
      timeout: Duration.minutes(5),
      role: transcribeRole,
      environment: {
        BUCKET: props.bucket.bucketName,
        PREFIX_TRANSCRIBE_S3: 'transcribe-output',
        PREFIX_MEETING_MP3: 'meeting-mp3',
        TABLE: props.callTable.tableName
      },
    });

    this.createTranscript = new NodejsFunction(this, 'createTranscriptLambda', {
      entry: './src/resources/createTranscript/index.ts',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: 'lambdaHandler',
      timeout: Duration.minutes(2),
      role: createTranscriptRole,
      environment: {
        BUCKET: props.bucket.bucketName,
        TRANSCRIBE_OUTPUT: 'transcribe-output',
        INITIAL_TRANSCRIPT_PREFIX: 'non-diarized-transcript',
      },
    });

    this.speakerDiarization = new NodejsFunction(
      this,
      'speakerDiarizationLambda',
      {
        entry: './src/resources/speakerDiarization/index.ts',
        runtime: Runtime.NODEJS_LATEST,
        architecture: Architecture.ARM_64,
        handler: 'lambdaHandler',
        timeout: Duration.minutes(5),
        role: speakerDiarizationRole,
        environment: {
          DIARIZED_TRANSCRIPT_PREFIX: 'diarized-transcript',
          BUCKET: props.bucket.bucketName,
          TABLE: props.callTable.tableName,
        },
      },
    );

    this.callSummary = new NodejsFunction(this, 'callSummaryLambda', {
      entry: './src/resources/callSummary/index.ts',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: 'lambdaHandler',
      timeout: Duration.minutes(5),
      role: callSummaryRole,
      environment: {
        CALL_SUMMARY_PREFIX: 'call-summary',
        BUCKET: props.bucket.bucketName,
        TABLE: props.callTable.tableName,
      },
    });

    this.dataSyncLambda = new NodejsFunction(this, 'dataSyncLambda', {
      entry: './src/resources/dataSync/index.ts',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: 'handler',
      timeout: Duration.minutes(5),
      role: dataSyncLambdaRole,
      environment: {
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        DATA_SOURCE_ID: props.dataSourceId,
        LOG_LEVEL: props.logLevel,
      },
    });

    props.bucket.grantRead(this.dataSyncLambda);

    props.bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.dataSyncLambda),
      { prefix: 'knowledge-base' },
      { suffix: '.txt' },
    );

    props.bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.botScheduler),
      { prefix: 'meeting-invite' },
      { suffix: '.txt' },
    );
    props.bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.startTranscribe),
      { prefix: 'meeting-mp3/' },
      { suffix: '.wav' },
    );
    props.bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.createTranscript),
      { prefix: 'transcribe-output' },
      { suffix: '.json' },
    );
    props.bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.speakerDiarization),
      { prefix: 'non-diarized-transcript' },
      { suffix: '.txt' },
    );
    props.bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.callSummary),
      { prefix: 'diarized-transcript' },
      { suffix: '.txt' },
    );
  }
}