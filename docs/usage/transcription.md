
## Prompt Engineering for Transcript Cleaning

Using prompt engineering, we can improve the quality of the diarization and also perform tasks such as the removal of filler words. Refer to the prompt below to see how we improved the quality of the transcript. 


```typescript
//See full code in src/resources/cleanTranscript
const createPayload = (transcript: string): string => {
    const prompt = `Human: You are a transcript editor, please follow the <instructions> tags.

    <transcript> ${transcript} </transcript>
    
        <instructions> 
        - The <transript> contains a speaker diarized transcript 
        - Go over the transcript and remove all filler words. For example  "um, uh, er, well, like, you know, okay, so, actually, basically, honestly, anyway, literally, right, I mean."
        - Fix any errors in transcription that may be caused by homophones based on the context of the sentence.  For example, "one instead of won" or "high instead of hi"
        - In addition, please fix the transcript in cases where diarization is improperly performed. For example, in some cases you will see
        that sentences are split between two speakers. In this case infer who the actual speaker is and attribute it to them. 
        - Please review the following example of this, 

        Input Example
        Chris: Adam you are saying the wrong thing. What 
        Adam: um do you mean, Chris?
        
        Output: 
        Chris: Adam you are saying the wrong thing.
        Adam: What do you mean, Chris? 

        - In your response, return the entire cleaned transcript, including all of the filler word removal and the improved diarization. Only return the transcript, do not include any leading or trailing sentences. You are not summarizing. You are cleaning the transcript. Do not include any xml tags <>
        </instructions>
    
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
        });
    };
 ```