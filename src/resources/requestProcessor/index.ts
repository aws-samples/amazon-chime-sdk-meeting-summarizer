/* eslint-disable import/no-extraneous-dependencies */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import moment from 'moment';
import {
  createPrompt,
  createInvokeModelInput,
  invokeModel,
  dialOut,
  writeDynamo,
  scheduleEventBridge,
} from './utils';

const response: APIGatewayProxyResult = {
  body: '',
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  },
};

export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log(event);
  const body = JSON.parse(event.body!);

  const input = createInvokeModelInput(createPrompt(body.meetingInfo));
  console.log(`input: ${JSON.stringify(input, null, 2)}`);
  const bedrockResponse = JSON.parse(
    new TextDecoder().decode((await invokeModel(input)).body),
  );
  console.log(`bedrockResponse: ${JSON.stringify(bedrockResponse, null, 2)}`);
  let { meetingId, meetingType, dialIn } = JSON.parse(bedrockResponse.completion);
  if (!meetingId || !meetingType) {
    response.body = JSON.stringify('bad request');
    response.statusCode = 500;
    return response;
  }
  meetingId = meetingId.replace(/\s/g, ''); // Remove spaces from meetingId

  console.log(`meetingID: ${meetingId} meetingType: ${meetingType}`);
  console.log(`body.formattedDate: ${body.formattedDate}`);
  const requestedDate = moment(body.formattedDate);
  console.log(`requestedDate: ${requestedDate}`);
  await writeDynamo({
    meetingID: meetingId,
    meetingType: meetingType,
    scheduledTime: requestedDate.valueOf(),
  });

  const now = moment();
  if (requestedDate.isBefore(now)) {
    console.log('Starting summarizer now');
    await dialOut({
      meetingID: meetingId,
      meetingType: meetingType,
      scheduledTime: requestedDate.valueOf(),
      dialIn: dialIn,
    });
  } else {
    console.log('Scheduling summarizer for future');
    await scheduleEventBridge({
      meetingID: meetingId,
      meetingType: meetingType,
      scheduledTime: requestedDate.valueOf(),
      dialIn,
    });
  }
  try {
    response.body = JSON.stringify('good request');
    return response;
  } catch (err) {
    console.log(err);
    response.body = JSON.stringify('bad request');
    response.statusCode = 500;
    return response;
  }
};
