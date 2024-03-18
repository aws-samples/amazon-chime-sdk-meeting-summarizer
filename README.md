# Amazon Chime SDK Meeting Summarizer

![Image](/images/Diagram.png)

## Overview

This README provides an overview of the Chime Summarizer, a CDK application deploying infrastructure for a generative AI cross-platform call transcription and summarization bot. The bot is designed to be compatible with Amazon Chime, Cisco Webex, and Zoom. Leveraging Amazon Bedrock, Chime SDK, and Amazon Transcribe, it captures, transcribes, diarizes, and summarizes meeting audio to deliver comprehensive call summaries.

## Key Features

- Gen AI for Call Scheduling, Speaker Diarization, and Summarization.

## Triggering the Bot (2 ways)

1) Static React App Form

Visit the CloudFront distribution domain name generated during the deployment and create an account. Paste the meeting invite and choose to schedule a time or to trigger the bot immediately. When possible, utilize a 'Copy' button when retreiving meeting invite info to paste into the form.

![Image](/images/FrontendForm.png)


2) Upload Directly to the S3 bucket under prefix meeting-invite

This option triggers the bot immediately. 

## Viewing Transcripts and Summaries
For now, transcripts and summaries exist only in the S3 bucket created during deployment. To view transcripts, go to the bucket created by the deployment and look under the 'diarized-transcript' and 'call-summary' prefix. Future iterations will make these outputs viewable on the frontend. 

### Bot Scheduling Lambda

To streamline the user experience, users can conveniently schedule the bot by simply copying and pasting a meeting invite into a form. Utilizing prompt engineering within Bedrock, the system adeptly extracts crucial meeting details, including the meeting ID and type, and transfers them to the SIP media application Lambda. In the provided code, the prompt is crafted for input into the model, showcasing Amazon Bedrock's proficiency in handling a diverse range of meeting invite formats. For instance, straightforward meeting invites like Chime require extracting basic information such as the meeting ID and type, while more intricate invitations like Google Meets or Microsoft Teams necessitate specific instructions for extracting additional details like a unique dial-in number. This underscores Bedrock's versatility in efficiently processing various inputs, ensuring a consistent and reliable output.

```typescript
//Prompt
const createPrompt = (meetingInvitation: string): string => {
  return JSON.stringify({
    prompt: `Human:${meetingInvitation} You are a an information extracting bot. Go over the ${meetingInvitation} and determine what the meeting id and meeting type are <instructions></instructions> xml tags
        
          <instructions>  

          1. Identify Meeting Type:
              Determine if the ${meetingInvitation} is for Chime, Zoom, Google, Microsoft Teams, or Webex meetings.

          2. Chime, Zoom, and Webex
              - Find the meetingID
              - Remove all spaces from the meeting ID (e.g., #### ## #### -> ##########). 

          2. If Google -  Instructions Extract Meeting ID and Dial in 
            - For Google only, the ${meetingInvitation} will call a meetingID a 'pin', so treat it as a meetingID
            - Remove all spaces from the meeting ID (e.g., #### ## #### -> ##########). 
            - Extract Google and Microsoft Dial-In Number (if applicable):
            - If the meeting is a Google meeting, extract the unique dial-in number.
            - Locate the dial-in number following the text "to join by phone dial."
            - Format the extracted Google dial-in number as (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)

          3. If Microsoft Teams - Instructions if meeting type is is Microsoft Teams. 
            - Pay attention to these instructions carefully            
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - in the ${meetingInvitation}, there are two IDs a 'Meeting ID' (### ### ### ##) and a 'Phone Conference ID' (### ### ###), ignore the 'Meeting ID' use the 'Phone Conference ID'
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - The meetingID that we want is referenced as the 'Phone Conference ID' store that one as the meeting ID. 
            - Find the phone number, extract it and store it as the dialIn number (format (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)
    
          4. meetingType rules
          - The only valid responses for meetingType are 'Chime', 'Webex', 'Zoom', 'Google', 'Teams'
          
          
          5.    Generate Response:

              - Create a response object with the following format:
              { 
                meetingId: "meeting id goes here with spaces removed",
                meetingType: "meeting type goes here (options: 'Chime', 'Webex', 'Zoom', 'Google', 'Teams')",
                dialIn: "Insert Google Dial-In number with no dashes or spaces, or N/A if not a Google Meeting"
              }

              Meeting ID Formats:

              Zoom: ### #### ####
              Webex: #### ### ####
              Chime: #### ## ####
              Google: ### ### #### 
              Teams: ### ### ###

              Ensure that the program does not create fake phone numbers and only includes the Microsoft or Google dial-in number if the meeting type is Google or Teams.

          </instructions>
        
          Assistant: Should I add anything else in my answer?
        
          Human: Only return a JSON formatted response with the meetingid and meetingtype associated to it. Do not add any other words to your answer. Do not add any introductory sentences in your answer.    \nAssistant:`,
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
- If speaker names are not mentioned, AWS Bedrock will return generic speaker labels.

## Deployment

### Requirements

- yarn installed
- AWS account
- Anthropic Models enabled in the AWS Account: https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html 


### Deploy

```bash
yarn launch
```

### Clean-up

```bash
yarn cdk destroy
```
