import {
  PolicyStatement,
  Role,
  ServicePrincipal,
  Effect,
} from 'aws-cdk-lib/aws-iam';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { CfnScheduleGroup } from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';

interface EventBridgeResourceProps {
  dialOut: Function;
}

export class EventBridgeResources extends Construct {
  public readonly eventbridgeRole: Role;
  public readonly eventbridgeScheduleGroup: CfnScheduleGroup;
  constructor(scope: Construct, id: string, props: EventBridgeResourceProps) {
    super(scope, id);

    this.eventbridgeScheduleGroup = new CfnScheduleGroup(
      this,
      'eventBridgeScheduleGroup',
      {
        name: 'MeetingSummarizer',
      },
    );

    const eventbridgePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [props.dialOut.functionArn],
    });

    this.eventbridgeRole = new Role(this, 'eventBridgeRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
    });

    this.eventbridgeRole.addToPolicy(eventbridgePolicy);
  }
}
