import {
  speakAction,
  hangupAction,
  sendDigitsAction,
  pauseAction,
  recordAudioAction,
} from './actions';

import { MeetingAssistTransactionAttributes } from './index';
import { SipMediaApplicationEvent, Actions } from './sip-media-application';

export async function newOutboundCallHandler(
  event: SipMediaApplicationEvent,
  transactionAttributes: MeetingAssistTransactionAttributes,
) {
  let actions: Actions[] = [];

  transactionAttributes.MeetingId =
    event.ActionData?.Parameters.Arguments.meetingID || '';
  transactionAttributes.MeetingType =
    event.ActionData?.Parameters.Arguments.meetingType || '';
  transactionAttributes.ScheduledTime =
    event.ActionData?.Parameters.Arguments.scheduledTime || '';
  return { actions, transactionAttributes };
}

export async function hangupHandler(
  event: SipMediaApplicationEvent,
  transactionAttributes: MeetingAssistTransactionAttributes,
) {
  let actions: Actions[] = [];
  event.CallDetails.Participants.forEach((participant) => {
    if (participant.Status == 'Connected') {
      actions.push(hangupAction({ callId: participant.CallId }));
    }
  });
  return { actions, transactionAttributes };
}

export async function callAnsweredHandler(
  event: SipMediaApplicationEvent,
  transactionAttributes: MeetingAssistTransactionAttributes,
) {
  let actions: Actions[] = [];

  const introMessage =
    'Hi. The meeting summariizer bot will be joining soon';
  const startMessage =
    'I am a summarizer bot. I will be collecting call audio to create a call transcript and summary. To maximize the quality of the transcription and summary, please use a microphone or headset.';

  const callId = event.CallDetails.Participants[0].CallId;
  let meetingDigits: string = '';
  switch (transactionAttributes.MeetingType) {
    case 'Webex':
      meetingDigits = `${transactionAttributes.MeetingId}#,,,,,,,,,,,,,,,#`;
      break;
    case 'Zoom':
      meetingDigits = `${transactionAttributes.MeetingId}#,,,,,,,,,,,,,,,,,,,,#`;
      break;
    case 'Chime':
      meetingDigits = `${transactionAttributes.MeetingId}#`;
      break;
    case 'Google' :
      meetingDigits = `${transactionAttributes.MeetingId}#`;
      break;
    case 'Teams':
      meetingDigits = `${transactionAttributes.MeetingId}#`;
  }

  const prefix = `meeting-mp3/${transactionAttributes.MeetingId!}.${transactionAttributes.ScheduledTime!}`;

  actions = [
    pauseAction({ callId: callId, milliSeconds: 1000 }),
    speakAction({ callId: callId, text: introMessage }),
    pauseAction({ callId: callId, milliSeconds: 5000 }),
    sendDigitsAction({
      callId: callId,
      digits: meetingDigits,
      milliSeconds: 300,
    }),
    pauseAction({ callId: callId, milliSeconds: 12000 }),
    speakAction({ callId: callId, text: startMessage }),
    pauseAction({ callId: callId, milliSeconds: 1000 }),
    recordAudioAction({ callId: callId, prefix: prefix }),
  ];

  return { actions, transactionAttributes };
}
