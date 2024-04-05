import React, { useContext, useState } from 'react';
import {
    TypingDots,
    TypingDot,
    Avatar,
    ChatContainer,
    SendMessageContainer,
    StyledTextarea,
    UserMessageContainer,
    UserMessageBubble,
    APIMessageBubble,
    APIMessageContainer
} from './StyledContextualChatbot';
import { CustomDrawer } from '../contextualChatbot/StyledContextualChatbot';
import {
    Button,
    Box,
    Icon,
    Header
} from '@cloudscape-design/components';
import { AuthContext } from '../../AuthContext';
import { post } from 'aws-amplify/api';

interface ApiResponse {
    output?: {
        text: string;
    };
}

function ContextualChatbot({ }) {
    const [errorMessage, setErrorMessage] = useState('');
    const [messages, setMessages] = useState<{ text: string; fromUser: boolean }[]>([]);
    const [messageText, setMessageText] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(true);

    const { authToken } = useContext(AuthContext);

    function isApiResponse(object: any): object is ApiResponse {
        return 'output' in object && typeof object.output === 'object' && 'text' in object.output;
    }

    const addNewMessage = (messageText: string, fromUser: boolean) => {
        setMessages(prevMessages => [...prevMessages, { text: messageText, fromUser }]);
    };

    const sendMessageToAPI = async (message: string) => {
        if (!authToken) {
            setErrorMessage("Authorization token is missing.");
            console.log(errorMessage)
            return;
        }

        if (!message.trim()) {
            console.log("Message is empty.");
            return;
        }

        addNewMessage(message, true);
        setIsTyping(true);

        try {
            const restOperation = await post({
                apiName: 'request',
                path: 'retrieveAndGenerate',
                options: {
                    headers: { Authorization: authToken },
                    body: {
                        inputText: message,
                    },
                },
            });

            const response = await restOperation.response;

            if (response.statusCode === 200) {
                const responseBody = await response.body.json();

                if (isApiResponse(responseBody) && responseBody.output) {
                    const newMessage = responseBody.output.text;
                    addNewMessage(newMessage, false);
                    setMessageText("");
                    setIsTyping(false);
                } else {
                    setErrorMessage('Invalid response format');
                }
            } else {
                setErrorMessage('Failed to retrieve data');
            }
        } catch (error) {
            setIsTyping(false);
            if (error instanceof Error) {
                setErrorMessage(error.message || 'An error occurred');
                console.log(errorMessage);
            } else {
                setErrorMessage('An unexpected error occurred');
                console.log(errorMessage);
            }
        }
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
    };

    return (
        <>
            {isDrawerOpen && (
                <CustomDrawer>

                    <Header
                        variant="h3"
                        actions={
                            <Button variant="normal" onClick={handleCloseDrawer}>
                                <Icon name="close" />
                            </Button>}
                    >
                        Summarizer chatbot

                    </Header>

                    <Box padding={{ vertical: "l", horizontal: "l" }}>

                        <ChatContainer>
                            <div>
                                {messages.map((msg, index) => (
                                    msg.fromUser ? (
                                        <UserMessageContainer key={index}>
                                            <UserMessageBubble>{msg.text}</UserMessageBubble>
                                            <Avatar>
                                                <Icon name="user-profile" />
                                            </Avatar>
                                        </UserMessageContainer>
                                    ) : (
                                        <APIMessageContainer key={index}>
                                            <APIMessageBubble>{msg.text}</APIMessageBubble>
                                        </APIMessageContainer>
                                    )
                                ))}
                            </div>
                            {isTyping &&
                                <TypingDots>
                                    <TypingDot />
                                    <TypingDot />
                                    <TypingDot />
                                </TypingDots>
                            }
                        </ChatContainer>

                        <SendMessageContainer>
                            <StyledTextarea
                                placeholder="Type your message here..."
                                autoFocus
                                value={messageText}
                                onChange={(event) => setMessageText(event.detail.value)}
                            />
                            <Button variant="normal" onClick={() => sendMessageToAPI(messageText)}>
                                <Icon name="caret-right-filled" />
                            </Button>
                        </SendMessageContainer>

                    </Box>
                </CustomDrawer>
            )}
        </>
    );
};

export default ContextualChatbot;