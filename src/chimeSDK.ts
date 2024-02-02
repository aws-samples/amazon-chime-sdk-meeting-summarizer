import { Duration, Stack } from 'aws-cdk-lib';
import {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  ChimePhoneNumber,
  ChimeSipMediaApp,
  ChimeSipRule,
  TriggerType,
  PhoneNumberType,
  PhoneProductType,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface ChimeSDKProps {
  bucket: Bucket;
}

export class ChimeSDKResources extends Construct {
  public readonly phoneNumber: ChimePhoneNumber;
  public readonly smaApp: ChimeSipMediaApp;
  public readonly sipRule: ChimeSipRule;
  public readonly smaHandler: Function;
  public readonly dialOut: Function;

  constructor(scope: Construct, id: string, props: ChimeSDKProps) {
    super(scope, id);

    this.phoneNumber = new ChimePhoneNumber(this, 'phoneNumber', {
      phoneState: 'VA',
      phoneNumberType: PhoneNumberType.LOCAL,
      phoneProductType: PhoneProductType.SMA,
    });

    this.smaHandler = new NodejsFunction(this, 'smaHandlerLambda', {
      entry: './src/resources/smaHandler/index.ts',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: 'lambdaHandler',
      timeout: Duration.minutes(5),
      environment: {
        BUCKET_NAME: props.bucket.bucketName,
        PREFIX_MEETING_MP3: 'meeting-mp3',
      },
    });

    this.smaApp = new ChimeSipMediaApp(this, 'sipMediaApp', {
      region: Stack.of(this).region,
      endpoint: this.smaHandler.functionArn,
    });

    const dialOutRole = new Role(this, 'dialOutRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      inlinePolicies: {
        ['chimePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:CreateSipMediaApplicationCall'],
            }),
          ],
        }),
      },
    });

    props.bucket.grantWrite(dialOutRole);

    this.dialOut = new NodejsFunction(this, 'dialOutLambda', {
      entry: './src/resources/dialOut/index.ts',
      handler: 'lambdaHandler',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(300),
      role: dialOutRole,
      environment: {
        SMA_PHONE: this.phoneNumber.phoneNumber,
        SMA_APP: this.smaApp.sipMediaAppId,
      },
    });

    this.sipRule = new ChimeSipRule(this, 'sipRule', {
      triggerType: TriggerType.TO_PHONE_NUMBER,
      triggerValue: this.phoneNumber.phoneNumber,
      targetApplications: [
        {
          region: Stack.of(this).region,
          priority: 1,
          sipMediaApplicationId: this.smaApp.sipMediaAppId,
        },
      ],
    });
  }
}
