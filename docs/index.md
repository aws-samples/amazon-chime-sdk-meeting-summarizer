# Overview

Welcome to the Amazon Chime Meeting Summarizer documentation site.

This docs provides an overview of the Chime Summarizer, a CDK application deploying infrastructure for a generative AI cross-platform call transcription and summarization bot. The bot is designed to be compatible with Amazon Chime, Cisco Webex, and Zoom. Leveraging Amazon Bedrock, Chime SDK, and Amazon Transcribe, it captures, transcribes, diarizes, and summarizes meeting audio to deliver comprehensive call summaries.

!!! example "Deploy Chime Summarizer"
    
    ```
    yarn launch
    ```

    ![summarizer deploy](./static/bedrock.png){ align=right width=15% }

    The deployment will create in the account:

    - the ReactJS frontend integrated with Amazon Cognito
    - the Lambda functions to handle all the AWS Bedrock integrations
    - the DynamoDB to store all the meetings metadata
    - the API Gateway to handle all the frontend requests

## Benefits of the `Chime Meeting Summarizer` solution

Enhance your meeting efficiency with the `Chime Meeting Summarizer`. This tool is designed to optimize your meeting management and information retrieval. Key features include:

- [x] **Speaker-Specific Transcription:** Obtain detailed, speaker-identified transcripts of your meetings, ensuring clarity in who said what for better follow-up and accountability.
- [x] **Concise Meeting Summaries:** Access quick, comprehensive summaries of each meeting, ideal for revisiting key points without needing to go through the entire transcript.
- [x] **Audio Playback Capability:** Listen to the audio of your meetings at any time, useful for catching nuances that text transcriptions might miss.
- [x] **Interactive Chatbot for Quick Access:** Use an AI-powered chatbot to efficiently search and retrieve specific information from your transcripts and summaries, aiding in quick responses to follow-up questions or clarifications post-meeting.
