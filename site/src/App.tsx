import React, { useState, useEffect } from 'react';
import { AmplifyConfig } from './Config';
import { signOut } from 'aws-amplify/auth';
import { post } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import {
    ContentLayout,
    Container,
    Header,
    SpaceBetween,
    Button,
    FormField,
    Textarea,
} from '@cloudscape-design/components';
import moment from 'moment';
import DateTime from 'react-datetime';
import '@cloudscape-design/global-styles/index.css';
import 'react-datetime/css/react-datetime.css';

Amplify.configure(AmplifyConfig);

const getNext15MinIncrement = (): string => {
    const now = moment();
    const minutesToAdd = 15 - (now.minute() % 15);
    const next15Minutes = now.add(minutesToAdd, 'minutes');
    return next15Minutes.toISOString();
};

const App: React.FC = () => {
    const [meetingInfo, setMeetingInfo] = useState('');
    const [localTimeZone, setLocalTimeZone] = useState('');
    const [selectedDate, setSelectedDate] = useState<moment.Moment | string | null>(getNext15MinIncrement());
    const [authToken, setAuthToken] = useState<string | undefined | null>(null);

    useEffect(() => {
        async function getToken() {
            const authToken = (await fetchAuthSession()).tokens?.idToken?.toString();
            console.log(authToken);
            setAuthToken(authToken);
        }
        getToken();
    }, []);

    useEffect(() => {
        const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log(localTimeZone);
        setLocalTimeZone(localTimeZone);
    }, []);

    async function handleSignOut() {
        try {
            await signOut();
        } catch (error) {
            console.log('error signing out: ', error);
        }
    }

    async function handleFutureMeeting() {
        if (!meetingInfo.trim()) {
            alert('Please enter meeting information before submitting.');
            return; // Prevents further execution of the function
        }
        const formattedDate = selectedDate!.toString();
        console.log(`formattedDate: ${formattedDate}`);

        const requestData = {
            meetingInfo,
            formattedDate,
            localTimeZone,
        };
        console.log(`requestedData: ${JSON.stringify(requestData, null, 2)}`);
        try {
            const restOperation = post({
                apiName: 'request',
                path: 'request',
                options: {
                    headers: {
                        Authorization: authToken!,
                    },
                    body: requestData,
                },
            });

            const { body } = await restOperation.response;
            const response = await body.json();

            console.log('POST call succeeded');
            console.log(response);
        } catch (error: any) {
            console.error('An error occurred during the POST request:', error);
            if (error.name === 'FetchError') {
                // Check for a 502 status code
                if (error.response && error.response.status === 502) {
                    console.error('Server returned a 502 Bad Gateway response.');
                    // Handle the 502 error specifically
                    // e.g., alert the user, retry the request, etc.
                } else {
                    // Handle other FetchErrors
                }
            } else {
                // Handle other types of errors
            }
        }
    }

    async function handlePresentMeeting() {
        if (!meetingInfo.trim()) {
            alert('Please enter meeting information before submitting.');
            return;
        }
        const now = moment();
        const formattedDate = now.toString();

        const requestData = {
            meetingInfo,
            formattedDate,
            localTimeZone,
        };

        const restOperation = post({
            apiName: 'request',
            path: 'request',
            options: {
                headers: {
                    Authorization: authToken!,
                },
                body: requestData,
            },
        });
        const { body } = await restOperation.response;
        const response = await body.json();

        console.log('POST call succeeded');
        console.log(response);
    }

    var yesterday = moment().subtract(1, 'day');
    function valid(current: moment.Moment): boolean {
        return current.isAfter(yesterday);
    }

    return (
        <Authenticator>
            <ContentLayout
                header={
                    <SpaceBetween size="m">
                        <Header variant="h1" actions={<Button onClick={handleSignOut}>Sign Out</Button>}>
                            Amazon Chime SDK Meeting Summarizer
                        </Header>
                    </SpaceBetween>
                }
            >
                <Container>
                    <SpaceBetween size="m">
                        <FormField label="Meeting Information">
                            <Textarea
                                onChange={({ detail }) => setMeetingInfo(detail.value)}
                                value={meetingInfo}
                                rows={20}
                                placeholder="Enter meeting information"
                            />
                        </FormField>
                        <SpaceBetween size="m" direction="horizontal">
                            <Button onClick={handlePresentMeeting}>Start Now</Button>
                            <Button onClick={handleFutureMeeting}>Schedule Future Meeting</Button>
                        </SpaceBetween>
                        <FormField label="Start Date/Time">
                            <DateTime
                                onChange={(detail) => {
                                    setSelectedDate(detail);
                                }}
                                initialValue={moment(getNext15MinIncrement()).format('MM/DD/YYYY h:mm A')}
                                isValidDate={valid}
                                timeConstraints={{
                                    minutes: { min: 0, max: 59, step: 15 },
                                }}
                            />
                        </FormField>
                    </SpaceBetween>
                </Container>
            </ContentLayout>
        </Authenticator>
    );
};

export default App;
