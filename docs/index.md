# Overview

This docs provides an overview of the Chime Summarizer, a CDK application deploying infrastructure for a generative AI cross-platform call transcription and summarization bot. The bot is designed to be compatible with Amazon Chime, Cisco Webex, and Zoom. Leveraging Amazon Bedrock, Chime SDK, and Amazon Transcribe, it captures, transcribes, diarizes, and summarizes meeting audio to deliver comprehensive call summaries.

!!! example "Deploy Chime Summarizer"
    
    ```
    yarn launch
    ```

    ![summarizer deploy](./static/chime.png){ align=right width=25% }

    The deployment will create in the account:

    - the ReactJS frontend integrated with Amazon Cognito
    - the Lambda functions to handle all the integrations
    - the DynamoDB to store all the calls metadata
    - the API Gateway to handle all the frontend calls