import React, { useContext, useEffect, useState } from 'react';
import {
    Container,
    SpaceBetween,
    Button,
    FormField,
    Textarea,
    Calendar,
    TimeInput,
    Select,
    Toggle,
    Icon,
    Flashbar
} from '@cloudscape-design/components';
import moment from 'moment';
import { post } from 'aws-amplify/api';
import '@aws-amplify/ui-react/styles.css';
import '@cloudscape-design/global-styles/index.css';
import 'react-datetime/css/react-datetime.css';

import { AuthContext } from '../../AuthContext';
import { SelectOption, SupportedLanguages } from './SupportedLanguageOptions';

function MeetingHandler() {
    const [localTimeZone, setLocalTimeZone] = useState('');
    const [meetingInfo, setMeetingInfo] = useState('');
    const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
    const [selectedTime, setSelectedTime] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState<SelectOption>(SupportedLanguages[0]);
    const [scheduleForLater, setScheduleForLater] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [showInProgress, setShowInProgress] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const { authToken } = useContext(AuthContext);

    useEffect(() => {
        setLocalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }, []);


    const handleDateChange = (event: { detail: { value: string } }) => {
        const newDate = event.detail.value;
        if (moment(newDate).isAfter(moment().subtract(1, 'day'))) {
            setSelectedDate(newDate);
        } else {
            console.error("Selected date is invalid");
        }
    };

    const handleLanguageChange = (option: any) => {
        if (option && option.label) {
            const language = SupportedLanguages.find(lang => lang.value === option.value);
            if (language) {
                setSelectedLanguage(language);
            }
        }
    };

    async function handleFutureMeeting() {
        if (!meetingInfo.trim()) {
            alert('Please enter meeting information before submitting.');
            return;
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
                if (error.response && error.response.status === 502) {
                    console.error('Server returned a 502 Bad Gateway response.');
                } else {
                }
            } else {
            }
        }
    }

    async function handlePresentMeeting() {
        if (!meetingInfo.trim()) {
            setShowWarning(true);
            return;
        }
        setShowInProgress(true);
        try {
            const now = moment();
            const formattedDate = now.toString();
            const requestData = { meetingInfo, formattedDate, localTimeZone };

            const restOperation = await post({
                apiName: 'request',
                path: 'request',
                options: {
                    headers: {
                        Authorization: authToken!,
                    },
                    body: requestData,
                },
            });

            const response = await restOperation.response;
            setShowInProgress(false);

            if (response.statusCode === 200) {
                setShowSuccess(true);
            } else {
                setErrorMessage('An error occurred');
                setShowError(true);
            }
        } catch (error) {
            setShowInProgress(false);
            if (error instanceof Error) {
                setErrorMessage(error.message || 'An error occurred');
            } else {
                setErrorMessage('An unexpected error occurred');
            }
        }
    }

    return (
        <>
            {showWarning && (
                <Flashbar items={[{
                    type: "warning",
                    content: "Please enter meeting information before submitting.",
                    dismissible: true,
                    dismissLabel: "Dismiss message",
                    onDismiss: () => setShowWarning(false),
                    id: "meetingInfoWarning"
                }]} />
            )}
            {showInProgress && (
                <Flashbar items={[{
                    type: "success",
                    loading: true,
                    content: "Your request is being processed...",
                    dismissible: true,
                    id: "inProgressMessage"
                }]} />
            )}
            {showSuccess && (
                <Flashbar items={[{
                    type: "success",
                    content: "The meeting summarizer bot will connect to your call shortly.",
                    dismissible: true,
                    onDismiss: () => setShowSuccess(false),
                    id: "successMessage"
                }]} />
            )}
            {showError && (
                <Flashbar items={[{
                    header: "Error",
                    type: "error",
                    content: errorMessage,
                    dismissible: true,
                    onDismiss: () => setShowError(false),
                    id: "errorMessage"
                }]} />
            )}
            <br />
            <Container>
                <SpaceBetween size="m" direction="horizontal">
                    <div style={{ width: '60vh' }}>
                        <SpaceBetween size="m" direction="vertical">
                            <FormField label="Meeting Information">
                                <Textarea
                                    onChange={({ detail }) => setMeetingInfo(detail.value)}
                                    value={meetingInfo}
                                    rows={scheduleForLater ? 22 : 10}
                                    placeholder="Enter meeting information"
                                />
                            </FormField>
                            {!scheduleForLater && (
                                <Button
                                    onClick={handlePresentMeeting}>
                                    <span style={{ marginRight: '8px' }}>
                                        <Icon name="call" />
                                    </span>
                                    Start Now
                                </Button>
                            )}
                        </SpaceBetween>
                    </div>
                    <div style={{ width: '40vh' }}>
                        <SpaceBetween size="m" direction="vertical">
                            <div>
                                <p style={{ fontWeight: 'bold' }}>What language will be spoken during the call?</p>
                                <Select
                                    selectedOption={selectedLanguage}
                                    onChange={({ detail }) => handleLanguageChange(detail.selectedOption)}
                                    options={SupportedLanguages.map(lang => ({
                                        label: lang.label,
                                        value: lang.value
                                    }))}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ marginRight: '10px', fontWeight: 'bold' }}>Schedule for later:</span>
                                <Toggle
                                    checked={scheduleForLater}
                                    onChange={({ detail }) => setScheduleForLater(detail.checked)}
                                />
                            </div>
                            {scheduleForLater && (
                                <>
                                    <FormField label="Start date">
                                        <Calendar
                                            onChange={handleDateChange}
                                            value={selectedDate}
                                        />
                                    </FormField>
                                    <FormField label="Start time">
                                        <TimeInput
                                            onChange={({ detail }) => setSelectedTime(detail.value)}
                                            value={selectedTime}
                                            placeholder="15:30"
                                        />
                                    </FormField>
                                    <Button
                                        onClick={handleFutureMeeting}>
                                        <span style={{ marginRight: '8px' }}>
                                            <Icon name="calendar" />
                                        </span>
                                        Schedule future meeting
                                    </Button>
                                </>
                            )}
                        </SpaceBetween>
                    </div>
                </SpaceBetween>
            </Container>
        </>
    );
}

export default MeetingHandler;