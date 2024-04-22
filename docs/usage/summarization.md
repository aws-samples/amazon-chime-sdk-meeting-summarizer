## Prompt Engineering for Speaker Summarization

Transcripts are converted into digestible meeting summaries using prompt engineering in Amazon Bedrock. This process generates concise summaries, including follow-up tasks discussed during the call, with the flexibility to customize focus areas. In the following code, we create the prompt which will be passed into the model. In the following code, we create the prompt which will be passed into the model. 

```typescript

const createPrompt = (transcript: string): string => {

  const prompt = `Human: You are a transcript summarizing bot. You will go over the transcript below and provide a summary of the content within the <instructions> tags.

  <transcript> ${transcript} </transcript>
  
    <instructions> 
    - Generate the summary in the language that the transcript is in. 
    - Go over the conversation that was had in the transcript. 
    - Create a summary based on what occurred in the meeting. 
    - Highlight specific action items that came up in the meeting, including follow-up tasks for each person. 
    - If relevant, focus on what specific AWS services were mentioned during the conversation. 
    - If there's sufficient context, infer the speaker's role and mention it in the summary. For instance, "Bob, the customer/designer/sales rep/..." 
    </instructions>
  
  Assistant:
    
    Assistant: Should I add anything else in my answer?
  
    Human: No matter the length of the transcript, summarize what happened. Do not include any xml tags <>   \nAssistant:`;
  return JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 10000,
    messages: [
        {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        },
    ],
    });
};


```