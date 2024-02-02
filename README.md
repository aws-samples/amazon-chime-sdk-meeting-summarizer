# Amazon Chime SDK Meeting Summarizer

![Image](/images/Diagram.png)

## Overview

This README provides an overview of the Chime Summarizer, a CDK application deploying infrastructure for a generative AI cross-platform call transcription and summarization bot. The bot is designed to be compatible with Amazon Chime, Cisco Webex, and Zoom. Leveraging Amazon Bedrock, Chime SDK, and Amazon Transcribe, it captures, transcribes, diarizes, and summarizes meeting audio to deliver comprehensive call summaries.

## Key Features

- Gen AI for Call Scheduling, Speaker Diarization, and Summarization.

### Bot Scheduling Lambda

To enhance user experience, users can easily schedule the bot by copying and pasting a meeting invite into a form. Using prompt engineering in Bedrock, meeting details such as meetingID and meeting type are extracted and passed to the SIP media application Lambda. In the following code, we create the prompt which will be passed into the model.

```typescript
const createPrompt = (meetingInvitation: string): string => {
  return JSON.stringify({
    prompt: `Human:${meetingInvitation} You are an information extracting bot. Go over the ${meetingInvitation} and determine what the meeting id and meeting type are <instructions></instructions> xml tags

      <instructions>
          - Read the  ${meetingInvitation}
          - Determine if the meeting invitation is a Chime meeting, a Zoom meeting, a Google meeting, or a Webex meeting
          - Extract the meeting id associated with the meeting invite
          - Once you determine the meetingid, remove all spaces from it in your response (ex: #### ## #### -> ##########)
          - Your response should only contain an object with the format
          - The format should look like this {meetingId : "meeting id goes here with the spaces removed", meetingType : "meeting type goes here (the options are 'Chime', 'Webex', 'Zoom', 'Google' "}
          - No unnecessary spacing should be added
          - For example {meetingId: "Meeting ID Goes Here", meetingType: "Meeting Type Goes here"}
          - Zoom meetings ids follow the following format ### #### ####
          - Webex meeting ids follow the following format #### ### ####
          - Chime meetingids follow the following format #### ## ####
      </instructions>

      Assistant: Should I add anything else in my answer?

      Human: Only return a JSON formatted response with the meetingid and meetingtype associated with it. Do not add any other words to your answer. Do not add any introductory sentences in your answer.
      \nAssistant:`,
    max_tokens_to_sample: 100,
    temperature: 0,
  });
};
```

### Speaker Diarization Lambda

Due to the limitation of speaker names in call audio collected via the dial-in feature, Amazon Bedrock infers speaker names based on conversation context. Prompt engineering helps identify speakers, returning a JSON object with speaker information.In the following code, we create the prompt which will be passed into the model.

```typescript
const createPrompt = (transcript: string): string => {
  return JSON.stringify({
    prompt: `Human:${transcript} You are a meeting transcript names extractor. Go over the ${transcript} and extract the names from it. Use the following instructions in the <instructions></instructions> xml tags
          
            <instructions>
            - Extract the names like this example - spk_0: "name1", spk_1: "name2".
            - Only extract the names like the example above and do not add any other words to your response
            - Your response should only have a list of "speakers" and their associated name separated by a ":" surrounded by {}
            - if there is only one speaker identified then surround your answer with {}
            - the format should look like this {"spk_0" : "Name", "spk_1: "Name2", etc.}, no unnecessary spacing should be added
            </instructions>
          
            Assistant: Should I add anything else in my answer?
          
            Human: Only return a JSON formatted response with the Name and the speaker label associated to it. Do not add any other words to your answer. Do NOT EVER add any introductory sentences in your answer. Only give the names of the speakers actively speaking in the meeting. Only give the names of the speakers actively speaking in the meeting in the format shown above.
               \nAssistant:`,
    max_tokens_to_sample: 4000,
    temperature: 0,
  });
};
```

### Speaker Summarization Lambda

Transcripts are converted into digestible meeting summaries using prompt engineering in Amazon Bedrock. This process generates concise summaries, including follow-up tasks discussed during the call, with the flexibility to customize focus areas. In the following code, we create the prompt which will be passed into the model. In the following code, we create the prompt which will be passed into the model.

```typescript
const createPrompt = (transcript: string): string => {
  return JSON.stringify({
    prompt: `Human:${transcript} You are a transcript summarizing bot. You will go over the ${transcript} and provide a summary of the  <instructions></instructions> xml tags
      
        <instructions>
            - Go over the conversation that was had in the ${transcript}
            - Create a summary based on what ocurred on the meeting 
            - Highlight specific action items that came up in the meeting, including follow-up tasks for each person
            - If relevant, focus on what specific AWS services were mentioned during the conversation. 
        </instructions>
      
        Assistant: Should I add anything else in my answer?
      
        Human: If there is not enough context to generate a proper summary, then just return a string that says "Meeting not long enough to generate a transcript.    \nAssistant:`,
    max_tokens_to_sample: 4000,
    temperature: 0,
  });
};
```

## Invoking the Model

The following code shows how to pass the prompts created above to the Amazon Bedrock SDK in scheduling, diarization, and summarization Lambdas we start

First we pass in the prompt and select the model.

```typescript
const createInvokeModelInput = (prompt: string): InvokeModelCommandInput => {
  return {
    body: prompt,
    modelId: 'anthropic.claude-v2',
    accept: 'application/json',
    contentType: 'application/json',
  };
};
```

Then we invoke the model sending the InvokeModelCommandInput to the Amazon Bedrock SDK.

```typescript
const invokeModel = async (
  input: InvokeModelCommandInput,
): Promise<InvokeModelCommandOutput> => {
  const output = bedrock.send(new InvokeModelCommand(input));
  return output;
};
```

## Application Flow

### 1. User Schedules the Summarizer Bot:

- Accesses the S3 static react app deployment via CloudFront.
- Pastes meeting invite into a text box and schedules the bot using a date picker.
- API Gateway handles the request and forwards it.

### 2. The Bot Scheduler:

- Lambda triggered by event payload containing meeting invite text and meeting time.
- Amazon Bedrock processes the text to extract meeting details.
- Bot is scheduled to join the call via Amazon Eventbridge Scheduler.
- Dynamo DB record is with the extracted meetingID (PK) and meetingType (SK)

### 3. Start SIP Media Application Lambda:

- Amazon Eventbridge Scheduler initiates the lambda function.
- Chime SIP media application initiates the call to the conferencing service.

### 4. SIP Media Application Handler Lambda:

- Joins application and initiates recording.
- Sends recording to S3.

### 5. Amazon Transcribe Lambda:

- Triggered by S3 event.
- Transcribes audio, assigning generic speaker labels.
- Outputs JSON file.

### 6. Create Transcript Lambda:

- Generates a legible transcript from the JSON file.
- Stores non-diarized transcript in S3.

### 7. Speaker Name Identification and Diarization Lambda:

- Transcript retrieved and passed to Amazon Bedrock.
- Bedrock identifies speaker names based on conversation context.
- Updates Dynamo DB record with diarized transcript location.
- Dynamo DB record updated with the transcripts S3 location.

### 8. Generate Summaries Lambda:

- Diarized speaker transcript passed into Bedrock.
- Bedrock generates summaries based on speaker contributions and identifies follow-up items.
- Summaries uploaded to S3.
- Dynamo DB record updated with the summary's S3 location.

## Limitations

- For optimal results, speakers are encouraged to use microphones or headphone speakers.
- Amazon Transcribe supports speaker diarization for up to 10 speakers.
- If speaker names are not mentioned, Bedrock will return generic speaker labels.

## Deployment

### Requirements

- yarn installed
- AWS account

### Deploy

```bash
yarn launch
```

### Clean-up

```bash
yarn cdk destroy
```
