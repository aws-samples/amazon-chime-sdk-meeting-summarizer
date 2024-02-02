import {
  newOutboundCallHandler,
  callAnsweredHandler,
  hangupHandler,
} from './eventHandlers';

import {
  InvocationEventType,
  SchemaVersion,
  SipMediaApplicationEvent,
  SipMediaApplicationResponse,
  Actions,
  TransactionAttributes,
} from './sip-media-application';

export interface MeetingAssistTransactionAttributes
  extends TransactionAttributes {
  MeetingId?: string;
  MeetingType?: string;
  ScheduledTime?: string;
  dialIn?: string;
}

export const lambdaHandler = async (
  event: SipMediaApplicationEvent,
): Promise<SipMediaApplicationResponse> => {
  console.log('Lambda is invoked with call details:' + JSON.stringify(event));
  let actions: Actions[] = [];
  let transactionAttributes: MeetingAssistTransactionAttributes = event
    .CallDetails.TransactionAttributes
    ? event.CallDetails.TransactionAttributes
    : {};

  switch (event.InvocationEventType) {
    case InvocationEventType.RINGING:
      console.log('RINGING');
      actions = [];
      break;

    case InvocationEventType.NEW_OUTBOUND_CALL:
      console.log('NEW_OUTBOUND_CALL');
      ({ actions, transactionAttributes } = await newOutboundCallHandler(
        event,
        transactionAttributes,
      ));
      break;

    case InvocationEventType.ACTION_SUCCESSFUL:
      console.log('ACTION SUCCESSFUL');
      break;

    case InvocationEventType.ACTION_INTERRUPTED:
      console.log('ACTION_INTERRUPTED');
      break;

    case InvocationEventType.ACTION_FAILED:
      console.log('ACTION_FAILED');
      break;

    case InvocationEventType.HANGUP:
      console.log('HANGUP');
      ({ actions, transactionAttributes } = await hangupHandler(
        event,
        transactionAttributes,
      ));
      break;

    case InvocationEventType.CALL_ANSWERED:
      console.log('CALL ANSWERED');
      ({ actions, transactionAttributes } = await callAnsweredHandler(
        event,
        transactionAttributes,
      ));
      break;

    default:
      console.log('FAILED ACTION');
      actions = [];
  }

  const response: SipMediaApplicationResponse = {
    SchemaVersion: SchemaVersion.VERSION_1_0,
    Actions: actions,
    TransactionAttributes: transactionAttributes,
  };

  console.log('Sending response:' + JSON.stringify(response));
  return response;
};
