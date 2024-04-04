import { Duration } from 'aws-cdk-lib';
import {
  RestApi,
  LambdaIntegration,
  EndpointType,
  MethodLoggingLevel,
  CognitoUserPoolsAuthorizer,
  AuthorizationType,
} from 'aws-cdk-lib/aws-apigateway';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
  CompositePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Runtime, Architecture, Function } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnScheduleGroup } from 'aws-cdk-lib/aws-scheduler';
import { ChimePhoneNumber, ChimeSipMediaApp } from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface InfrastructureProps {
  readonly userPool: IUserPool;
  bucket: Bucket;
  callTable: Table;
  eventbridge: CfnScheduleGroup;
  eventbridge_role: Role;
  smaApp: ChimeSipMediaApp;
  phoneNumber: ChimePhoneNumber;
  dialOut: Function;
  knowledgeBaseId: string;
}

export class Infrastructure extends Construct {
  public apiUrl: string;
  public requestProcessorLambda: Function;


  constructor(scope: Construct, id: string, props: InfrastructureProps) {
    super(scope, id);

    const infrastructureRole = new Role(this, 'infrastructureRole', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
        new ServicePrincipal('scheduler.amazonaws.com'),
        new ServicePrincipal('dynamodb.amazonaws.com'),
      ),
      inlinePolicies: {
        ['BedrockPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: [
                'bedrock:InvokeModel',
                'bedrock:GetAgentKnowledgeBase',
                'bedrock:GetFoundationModel',
                'bedrock:GetFoundationModelAvailability',
                'bedrock:GetKnowledgeBase',
                'bedrock:InvokeAgent',
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListAgentKnowledgeBases',
                'bedrock:Retrieve',
                'bedrock:RetrieveAndGenerate',
              ],
            }),
          ],
        }),
        ['ChimePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:CreateSipMediaApplicationCall'],
            }),
          ],
        }),
        ['SchedulerPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: [
                'scheduler:CreateSchedule',
                'scheduler:GetSchedule',
                'scheduler:GetScheduleGroup',
                'scheduler:ListScheduleGroups',
                'scheduler:ListSchedules',
                'iam:PassRole',
              ],
            }),
          ],
        }),
        ['DynamoDBPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['dynamodb:Scan'],
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

    this.requestProcessorLambda = new NodejsFunction(
      this,
      'requestProcessorLambda',
      {
        entry: './src/resources/requestProcessor/index.ts',
        runtime: Runtime.NODEJS_LATEST,
        architecture: Architecture.ARM_64,
        handler: 'lambdaHandler',
        timeout: Duration.minutes(5),
        role: infrastructureRole,
        environment: {
          EVENTBRIDGE_TARGET_LAMBDA: props.dialOut.functionArn,
          EVENTBRIDGE_GROUP_NAME: props.eventbridge.name!,
          EVENTBRIDGE_LAMBDA_ROLE: props.eventbridge_role.roleArn,
          TABLE: props.callTable.tableName,
          SMA_PHONE: props.phoneNumber.phoneNumber,
          SMA_APP: props.smaApp.sipMediaAppId,
          KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        },
      },
    );

    props.bucket.grantReadWrite(this.requestProcessorLambda);
    props.callTable.grantWriteData(this.requestProcessorLambda);

    const api = new RestApi(this, 'meetingSummarizerAPI', {
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'x-amz-security-token',
        ],
        allowMethods: ['OPTIONS', 'POST', 'GET'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    const auth = new CognitoUserPoolsAuthorizer(this, 'auth', {
      cognitoUserPools: [props.userPool],
    });

    const requestIntegration = new LambdaIntegration(
      this.requestProcessorLambda,
    );

    const createMeeting = api.root.addResource('createMeeting');
    const getMeetings = api.root.addResource('getMeetings');
    const retrieveAndGenerate = api.root.addResource('retrieveAndGenerate');
    const downloadFile = api.root.addResource('downloadFile');

    createMeeting.addMethod('POST', requestIntegration, {
      authorizer: auth,
      authorizationType: AuthorizationType.COGNITO,
    });
    getMeetings.addMethod('GET', requestIntegration, {
      authorizer: auth,
      authorizationType: AuthorizationType.COGNITO,
    });
    retrieveAndGenerate.addMethod('POST', requestIntegration, {
      authorizer: auth,
      authorizationType: AuthorizationType.COGNITO,
    });
    downloadFile.addMethod('POST', requestIntegration, {
      authorizer: auth,
      authorizationType: AuthorizationType.COGNITO,
    });

    this.apiUrl = api.url;
  }
}
