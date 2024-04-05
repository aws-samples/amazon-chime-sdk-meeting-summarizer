import { Stack } from 'aws-cdk-lib';
import {
  Dashboard,
  LogQueryVisualizationType,
  LogQueryWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface CloudWatchResourcesProps {
  smaHandler: Function;
  dialOut: Function;
  createTranscript: Function;
  speakerDiarization: Function;
  callSummary: Function;
  startTranscribe: Function;
  requestProcessor: Function;
}

export class CloudWatchResources extends Construct {
  public dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: CloudWatchResourcesProps) {
    super(scope, id);

    this.dashboard = new Dashboard(this, 'Dashboard', {
      dashboardName: 'MeetingSummarizerDashboard',
    });

    this.dashboard.addWidgets(
      new LogQueryWidget({
        title: 'MeetingSummarizerLogs',
        logGroupNames: [
          props.smaHandler.logGroup.logGroupName,
          props.callSummary.logGroup.logGroupName,
          props.dialOut.logGroup.logGroupName,
          props.startTranscribe.logGroup.logGroupName,
          props.createTranscript.logGroup.logGroupName,
          props.speakerDiarization.logGroup.logGroupName,
          props.requestProcessor.logGroup.logGroupName,
        ],
        width: 24,
        height: 60,
        region: Stack.of(this).region,
        view: LogQueryVisualizationType.TABLE,
        queryLines: ['fields @message', 'sort @timestamp desc', 'limit 400'],
      }),
    );
  }
}
