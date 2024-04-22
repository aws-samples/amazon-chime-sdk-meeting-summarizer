## Prompt Engineering for Speaker Diarization
Due to the limitation of speaker names in call audio collected via the dial-in feature, Amazon Bedrock infers speaker names based on conversation context. Prompt engineering helps identify speakers, returning a JSON object with speaker information.In the following code, we create the prompt which will be passed into the model. 

```typescript
const createPrompt = (transcript: string): string => {
  const prompt = `Human: You are a meeting transcript names extractor. Go over the transcript and extract the names from it. Use the following instructions in the <instructions></instructions> xml tags
  <transcript> ${transcript} </transcript>
  <instructions>
  - Extract the names like this example - spk_0: "name1", spk_1: "name2".
  - If no name is found for a speaker, use UNKNOWN_X where X is the speaker label number
  - Only extract the names like the example above and do not add any other words to your response
  - Your response should only have a list of "speakers" and their associated name separated by a ":" surrounded by {}
  - if there is only one speaker identified then surround your answer with {}
  - the format should look like this {"spk_0" : "Name", "spk_1: "Name2", etc.}, no unnecessary spacing should be added
  </instructions>

  Assistant: Should I add anything else in my answer?

  Human: Only return a JSON formatted response with the Name and the speaker label associated to it. Do not add any other words to your answer. Do NOT EVER add any introductory sentences in your answer. Only give the names of the speakers actively speaking in the meeting. Only give the names of the speakers actively speaking in the meeting in the format shown above.
  
Assistant:`;
  return JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 10000,
    messages: [
        {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        },
    ],
    temperature: 0.0,
    });
};


```