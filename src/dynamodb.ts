import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  Table,
  BillingMode,
  TableEncryption,
} from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseResources extends Construct {
  public callTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.callTable = new Table(this, 'callTable', {
      partitionKey: {
        name: 'call_id',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'scheduled_time',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'TTL',
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
  }
}
