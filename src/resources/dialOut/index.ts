import {
  ChimeSDKVoiceClient,
  CreateSipMediaApplicationCallCommand,
} from '@aws-sdk/client-chime-sdk-voice';

const SMA_PHONE: string | undefined = process.env.SMA_PHONE;
const SMA_APP: string | undefined = process.env.SMA_APP;
const AWS_REGION: string | undefined = process.env.AWS_REGION;

const chimeSdkVoiceClient = new ChimeSDKVoiceClient({ region: AWS_REGION });

interface meetingPayload {
  meetingID: string;
  meetingType: string;
  scheduledTime: number;
  dialIn: string;
}

interface httpResponse {
  statusCode: number;
  body: String;
}

export const lambdaHandler = async (
  event: meetingPayload,
  _context: any,
): Promise<httpResponse> => {
  const meetingType = event.meetingType;
  const meetingID = event.meetingID;
  const scheduledTime = event.scheduledTime.toString();
  const dialIn = event.dialIn;

  if (meetingType && meetingID && scheduledTime) {
    console.log('SMA Caller Initiated');
    try {
      if (meetingType === 'Chime') {
        console.log('Chime');
        const response = await chimeSdkVoiceClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: '+18555524463',
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID,
              scheduledTime: scheduledTime,
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Webex') {
        console.log('Webex');
        const response = await chimeSdkVoiceClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: '+18446213956',
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingType,
              scheduledTime: scheduledTime,
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Zoom') {
        console.log('Zoom');
        const response = await chimeSdkVoiceClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: '+13017158592',
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID,
              scheduledTime: scheduledTime,
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Google') {
        console.log('Google');
        const response = await chimeSdkVoiceClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: dialIn,
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID,
              scheduledTime: scheduledTime,
            },
          }),
        );
        console.log(response);
      } else if (meetingType === 'Teams') {
        console.log('Teams');
        const response = await chimeSdkVoiceClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: SMA_PHONE,
            ToPhoneNumber: dialIn,
            SipMediaApplicationId: SMA_APP,
            ArgumentsMap: {
              meetingType: meetingType,
              meetingID: meetingID,
              scheduledTime: scheduledTime,
            },
          }),
        );
        console.log(response);
      } else {
        console.log('To be Built soon');
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ Message: 'Call initiated successfully' }),
      };
    } catch (error: any) {
      console.error(error);

      return {
        statusCode: 500,
        body: JSON.stringify({ Error: error.message }),
      };
    }
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ Error: 'Missing required parameters' }),
    };
  }
};
