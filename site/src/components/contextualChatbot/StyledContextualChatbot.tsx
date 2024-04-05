import { Button, Drawer } from "@cloudscape-design/components";
import styled, { keyframes } from "styled-components";
import { Textarea as OriginalTextarea } from '@cloudscape-design/components';

const loadingFade = keyframes`
  0% {
    opacity: 0;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
  }
`
export const TypingDots = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  bottom: 17%;
  left: 71%;
  width: 5em;
  height: 2em;
  background-color: #d1dae0;
  border-radius: 30px;
`;


export const TypingDot = styled.div`
  float: left;
  width: 8px;
  height: 8px;
  margin: 0 4px;
  background: #232f3e;
  border-radius: 50%;
  opacity: 0;
  animation: ${loadingFade} 1s infinite;

  &:nth-child(1) {
    animation-delay: 0s;
  }

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
`;

export const Avatar = styled.div`
  background-color: #d1dae0;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  margin: 5px;
  justify-content: center;
  box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
  align-items: center;
`;

export const CustomDrawer = styled(Drawer)`
  position: fixed;
  right: 0;
  bottom: 0;
  width: 500px; 
  height: 500px;
  max-height: 100vh;
  margin-bottom: 30px;
  margin-right: 50px;
  background-color: white;
  border-radius: 30px;
  border: 2px solid #d1dae0; 
  box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
  z-index: 1001; 
  .awsui_drawer__main { 
    height: 100%;
  }
`;


export const ChatContainer = styled.div`
  position: relative; 
  display: flex;
  flex-direction: column;
  height: 300px;
  overflow-y: auto;
  background-color: white;

`;

export const SendMessageContainer = styled.div`
  display: flex;
  align-items: center;
  position: fixed;
  bottom: 30px;  
  right: 50px;   
  left: auto;    
  width: calc(510px - 10px); 
  padding: 10px;
  background-color: white;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 30px;
  border-bottom-left-radius: 30px;  
  border: 2px solid #d1dae0; 
  box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
  z-index: 1001; 
`;

export const StyledTextarea = styled(OriginalTextarea)`
  margin-right: 10px;
  margin-left: 10px; 
  padding: 10px;
  width: 600px;
  background-color: white;
`;

export const UserMessageContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
`;

export const UserMessageBubble = styled.div`
  background-color: #d1dae0;
  border-radius: 10px;
  padding: 10px;
  max-width: 70%;
`;

export const APIMessageContainer = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-top: 10px;
`;

export const APIMessageBubble = styled.div`
  background-color: #556880;
  color: white;
  border-radius: 10px;
  padding: 10px;
  max-width: 70%;
`;

export const FixedButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center; 
  position: fixed;
  width: 70px;
  height: 60px;
  bottom: 20px;
  right: 30px;
  z-index: 1000;
  background-color: white;
  border-radius: 50%;
  text-align: center;
`;

export const StyledButton = styled(Button)`
  flex: 1;
`;