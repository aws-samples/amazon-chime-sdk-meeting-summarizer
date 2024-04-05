import { CustomResource, Duration, Stack, Names } from 'aws-cdk-lib';
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
  CompositePrincipal,
  ArnPrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface BedrockKnowledgeBaseResourcesProps {
  bucket: Bucket;
  namePrefix: string;
}

export class BedrockKnowledgeBaseResources extends Construct {
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  collectionArn: string;
  collectionId: string;
  collectionName: string;
  collectionEndpoint: string;
  knowledgeBaseRole: Role;
  dataSourceId: string;

  constructor(
    scope: Construct,
    id: string,
    props: BedrockKnowledgeBaseResourcesProps,
  ) {
    super(scope, id);

    const knowledgeBaseCustomResourceRole = new Role(
      this,
      'knowledgeBaseCustomResourceRole',
      {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        inlinePolicies: {
          ['bedrockPolicy']: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: ['*'],
                actions: [
                  'bedrock:*KnowledgeBase',
                  'bedrock:*DataSource',
                  'iam:PassRole',
                ],
              }),
            ],
          }),
          ['ssmPolicy']: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: [
                  `arn:aws:ssm:${Stack.of(this).region}:${
                    Stack.of(this).account
                  }:parameter/${props.namePrefix}*`,
                ],
                actions: [
                  'ssm:PutParameter',
                  'ssm:GetParameter',
                  'ssm:DeleteParameter',
                ],
              }),
            ],
          }),
          ['aossPolicy']: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: ['*'],
                actions: ['aoss:*', 'iam:CreateServiceLinkedRole'],
              }),
            ],
          }),
        },
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole',
          ),
        ],
      },
    );

    this.knowledgeBaseRole = new Role(this, 'knowledgeBaseRole', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('bedrock.amazonaws.com'),
        new ServicePrincipal('lambda.amazonaws.com'),
        new ArnPrincipal(knowledgeBaseCustomResourceRole.roleArn),
      ),
      inlinePolicies: {
        ['bedrockPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: [
                'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',
              ],
              actions: ['bedrock:InvokeModel'],
            }),
          ],
        }),
        ['aossPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['aoss:*'],
            }),
          ],
        }),
      },
    });

    props.bucket.grantReadWrite(this.knowledgeBaseRole);

    const knowledgeBaseCustomResource = new NodejsFunction(
      this,
      'knowledgeBaseCustomResourceLambda',
      {
        entry: './src/resources/knowledgeBase/index.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_LATEST,
        architecture: Architecture.ARM_64,
        timeout: Duration.minutes(15),
        role: knowledgeBaseCustomResourceRole,
      },
    );

    const knowledgeBaseProvider = new Provider(this, 'knowledgeBaseProvider', {
      onEventHandler: knowledgeBaseCustomResource,
      logRetention: RetentionDays.ONE_WEEK,
    });

    const bedrockKnowledgeBase = new CustomResource(
      this,
      'KnowledgeBaseCustomResource',
      {
        serviceToken: knowledgeBaseProvider.serviceToken,
        properties: {
          bucketArn: props.bucket.bucketArn,
          knowledgeBaseRoleArn: this.knowledgeBaseRole.roleArn,
          knowledgeBaseCustomResourceRole:
            knowledgeBaseCustomResourceRole.roleArn,
          accessPolicyArns: JSON.stringify([]),
          nameSuffix: Names.uniqueId(this).slice(-6).toLowerCase(),
          namePrefix: props.namePrefix,
          knowledgeBaseEmbeddingModelArn:
            'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',
        },
      },
    );

    this.knowledgeBaseArn =
      bedrockKnowledgeBase.getAttString('knowledgeBaseArn');
    this.knowledgeBaseId = bedrockKnowledgeBase.getAttString('knowledgeBaseId');
    this.collectionArn = bedrockKnowledgeBase.getAttString('collectionArn');
    this.collectionId = bedrockKnowledgeBase.getAttString('collectionId');
    this.collectionName = bedrockKnowledgeBase.getAttString('collectionName');
    this.collectionEndpoint =
      bedrockKnowledgeBase.getAttString('collectionEndpoint');
    this.dataSourceId = bedrockKnowledgeBase.getAttString('dataSourceId');
  }
}