import {
  ActionTypes,
  PollyLanguageCodes,
  Engine,
  TextType,
  PollyVoiceIds,
  PauseActionParameters,
  SendDigitsActionParameters,
  RecordAudioActionParameters,
} from './sip-media-application';

const BUCKET_NAME = process.env.BUCKET_NAME;

export function hangupAction({ callId }: { callId: string }) {
  return {
    Type: ActionTypes.HANGUP,
    Parameters: {
      SipResponseCode: '0',
      CallId: callId,
    },
  };
}

export function speakAction({
  text,
  callId,
}: {
  text: string;
  callId: string;
}) {
  return {
    Type: ActionTypes.SPEAK,
    Parameters: {
      Text: text,
      CallId: callId,
      Engine: Engine.NEURAL,
      LanguageCode: PollyLanguageCodes.EN_US,
      TextType: TextType.TEXT,
      VoiceId: PollyVoiceIds.JOANNA,
    },
  };
}

export function pauseAction({
  callId,
  milliSeconds,
}: {
  callId: string;
  milliSeconds: number;
}) {
  return {
    Type: ActionTypes.PAUSE,
    Parameters: {
      CallId: callId,
      DurationInMilliseconds: milliSeconds,
    } as PauseActionParameters,
  };
}

export function sendDigitsAction({
  callId,
  digits,
  milliSeconds,
}: {
  callId: string;
  digits: string;
  milliSeconds: number;
}) {
  return {
    Type: ActionTypes.SEND_DIGITS,
    Parameters: {
      CallId: callId,
      Digits: digits,
      ToneDurationInMilliseconds: milliSeconds,
    } as SendDigitsActionParameters,
  };
}

export function recordAudioAction({
  callId,
  prefix,
}: {
  callId: string;
  prefix: string;
}) {
  return {
    Type: ActionTypes.RECORD_AUDIO,
    Parameters: {
      CallId: callId,
      DurationInSeconds: 7200,
      SilenceDurationInSeconds: 30,
      SilenceThreshold: 100,
      RecordingTerminators: ['#'],
      RecordingDestination: {
        Type: 'S3',
        BucketName: BUCKET_NAME,
        Prefix: prefix,
      },
    } as RecordAudioActionParameters,
  };
}
