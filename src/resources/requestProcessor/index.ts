/* eslint-disable import/no-extraneous-dependencies */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createApiResponse,
  handleDownloadRequest,
  handleTitleUpdate,
  methodNotAllowedResponse,
  parseAndHandleCreateMeeting,
  parseAndHandleGetMeetings,
  retrieveAndGenerate,
} from './utils';

export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log(event);

  switch (event.resource) {

    case '/createMeeting':
      if (event.httpMethod === 'POST') {
        return parseAndHandleCreateMeeting(event);
      }
      return methodNotAllowedResponse();

    case '/getMeetings':
      if (event.httpMethod === 'GET') {
        const meetingType = event.queryStringParameters?.type === 'Scheduled' ? 'Scheduled' : 'Past';
        return parseAndHandleGetMeetings(meetingType);
      }
      return methodNotAllowedResponse();

    case '/retrieveAndGenerate':
      if (event.httpMethod === 'POST') {
        if (event.body) {
          const body = JSON.parse(event.body);
          const inputText = body.inputText.trim();

          if (inputText) {
            return retrieveAndGenerate(inputText);
          } else {
            return createApiResponse(JSON.stringify('Missing sessionId or inputText'), 400);
          }
        } else {
          return createApiResponse(JSON.stringify('No request body found'), 400);
        }
      }
      return methodNotAllowedResponse();

    case '/downloadFile':
      if (event.httpMethod === 'POST') {
        if (event.body) {
          const body = JSON.parse(event.body);
          const fileKey = body.fileKey;
          const bucketName = body.bucketName;

          if (bucketName && fileKey) {
            return handleDownloadRequest(bucketName, fileKey);
          } else {
            return createApiResponse(JSON.stringify('Missing fileKey'), 400);
          }
        } else {
          return createApiResponse(JSON.stringify('No request body found'), 400);
        }
      }
      return methodNotAllowedResponse();

    case '/updateMeetingTitle':
      if (event.httpMethod === 'POST') {
        if (event.body) {
          const body = JSON.parse(event.body);
          const meetingId = body.meetingId;
          const scheduledTime = body.scheduledTime;
          const newTitle = body.newTitle;

          if (meetingId && scheduledTime && newTitle) {
            return handleTitleUpdate(meetingId, scheduledTime, newTitle);
          } else {
            return createApiResponse(JSON.stringify('Missing meetingId or newTitle'), 400);
          }
        } else {
          return createApiResponse(JSON.stringify('No request body found'), 400);
        }
      }
      return methodNotAllowedResponse();

    default:
      return createApiResponse(JSON.stringify('Not Found'), 404);

  };
};