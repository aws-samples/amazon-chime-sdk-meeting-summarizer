## Bot Scheduling Lambda

To enhance user experience, users can easily schedule the bot by copying and pasting a meeting invite into a form. Using prompt engineering in Bedrock, meeting details such as meetingID and meeting type are extracted and passed to the SIP media application Lambda. In the following code, we create the prompt which will be passed into the model. 

```typescript
//See full code in src/resources/requestprocessor/utils.ts
const createPrompt = (meetingInvitation: string): string => {
  return JSON.stringify({
    prompt: `Human: You are a an information extracting bot. Go over the meeting invitation below and determine what the meeting id and meeting type are <instructions></instructions> xml tags
        
            <meeting_invitation>  
                    ${meetingInvitation}
            </meeting_invitation> 

            <instructions>  

          1. Identify Meeting Type:
              Determine if the meeting invitation is for Chime, Zoom, Google, Microsoft Teams, or Webex meetings.

          2. Chime, Zoom, and Webex
              - Find the meetingID
              - Remove all spaces from the meeting ID (e.g., #### ## #### -> ##########). 

          2. If Google -  Instructions Extract Meeting ID and Dial in 
            - For Google only, the meeting invitation will call a meetingID a 'PIN', so treat it as a meetingID
            - Remove all spaces from the PIN (e.g., #### ## #### -> ##########). 
            - Extract Google the dialIn number
            - Locate the dial-in number following the text "otherwise, to join by phone"
            - Format the extracted Google dial-in number as (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)

          3. If Microsoft Teams - Instructions if meeting type is is Microsoft Teams. 
            - Pay attention to these instructions carefully            
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - in the meeting invitation, there are two IDs a 'Meeting ID' (### ### ### ##) and a 'Phone Conference ID' (### ### ###), ignore the 'Meeting ID' use the 'Phone Conference ID'
            - The meetingId we want to store in the generated response is the 'Phone Conference ID' : ### ### ###
            - Find the phone number, extract it and store it as the dialIn number (format (+1 ###-###-####), removing dashes and spaces. For example +1 111-111-1111 would become +11111111111)
    
          4. meetingType rules
          - The only valid responses for meetingType are 'Chime', 'Webex', 'Zoom', 'Google', 'Teams'

          5. meetingId Format Rules 

          Zoom: ### #### ####
          Webex: #### ### ####
          Chime: #### ## ####
          Google: ### ### #### (last character is always '#')
          Teams: ### ### ###
          
          6. Other notes
          - Ensure that the program does not create fake phone numbers and only includes the Microsoft or Google dial-in number if the meeting type is Google or Teams.
          - Ensure that the meetingId matches perfectly.
          - If present extract a "meeting title" and store it in the FINAL JSON Response as "meetingTitle"
          - If no title is detected then store the value of "No Title Detected In Invite"

          
          7.    Generate FINAL JSON Response:

              - Create a response object with the following format:
              { 
                meetingId: "meeting id goes here with spaces removed",
                meetingType: "meeting type goes here (options: 'Chime', 'Webex', 'Zoom', 'Google', 'Teams')",
                dialIn: "Insert Microsoft or Google Dial-In number with no dashes or spaces, or N/A if not a Google Meeting or Teams Meeting"
                meetingTitle: "Insert Extracted Meeting Title or return 'No Title Detected in Invite",
              }

              Meeting ID Formats:


          </instructions>
        
          Assistant: Should I add anything else in my answer?
        
          Human: Only return a JSON formatted response with the meetingid and meetingtype associated to it. Do not add any other words to your answer. Do not add any introductory sentences in your answer.    \nAssistant:`,
    max_tokens_to_sample: 100,
    temperature: 0,
  });
};
```