/* eslint-disable import/no-extraneous-dependencies */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createApiResponse,
  methodNotAllowedResponse,
  parseAndHandleCreateMeeting,
  parseAndHandleGetMeetings,
} from './utils';

export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log(event);

  switch (event.resource) {

    case '/createMeeting':
      if (event.httpMethod === 'POST') {
        return await parseAndHandleCreateMeeting(event);
      }
      return methodNotAllowedResponse();

    case '/getMeetings':
      if (event.httpMethod === 'GET') {
        const meetingType = event.queryStringParameters?.type === 'Scheduled' ? 'Scheduled' : 'Past';
        return await parseAndHandleGetMeetings(meetingType);
      }
      return methodNotAllowedResponse();

    default:
      return createApiResponse(JSON.stringify('Not Found'), 404);

  };
};