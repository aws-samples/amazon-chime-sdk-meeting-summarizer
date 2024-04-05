import React, { useContext, useEffect, useState } from 'react';
import {
    Container,
    SpaceBetween,
    Button,
    FormField,
    Textarea,
    Calendar,
    TimeInput,
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

function MeetingHandler() {
    const [localTimeZone, setLocalTimeZone] = useState('');
    const [meetingInfo, setMeetingInfo] = useState('');
    const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
    const [selectedTime, setSelectedTime] = useState('');
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

    async function handleMeeting(isImmediate = false) {
        if (!meetingInfo.trim()) {
            setShowWarning(true);
            return;
        }
        setShowWarning(false);

        if (!authToken) {
            setErrorMessage("Authorization token is missing.");
            setShowError(true);
            return;
        }

        setShowInProgress(true);

        try {
            let formattedDate;
            if (isImmediate) {
                formattedDate = moment().format('YYYY-MM-DDTHH:mm:ss');
                console.log(formattedDate)
            } else {
                if (!selectedDate || !selectedTime) {
                    setShowWarning(true);
                    setShowInProgress(false);
                    return;
                }
                const date = moment(selectedDate).format('YYYY-MM-DD');
                const time = moment(selectedTime, 'HH:mm').format('HH:mm:ss');
                formattedDate = `${date}T${time}`;
                console.log(formattedDate)
            }

            const requestData = { meetingInfo, formattedDate, localTimeZone };

            const response = await post({
                apiName: 'request',
                path: 'createMeeting',
                options: {
                    headers: { Authorization: authToken },
                    body: requestData,
                },
            }).response;

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
            setShowError(true);
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
                                    rows={scheduleForLater ? 19 : 10}
                                    placeholder="Enter meeting information"
                                />
                            </FormField>
                            {!scheduleForLater && (
                                <Button
                                    onClick={() => handleMeeting(true)}>
                                    <span style={{ marginRight: '8px' }}>
                                        <Icon name="call" />
                                    </span>
                                    Start now
                                </Button>
                            )}
                        </SpaceBetween>
                    </div>
                    <div style={{ width: '40vh' }}>
                        <SpaceBetween size="m" direction="vertical">
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
                                            placeholder="15:30:00"
                                        />
                                    </FormField>
                                    <Button
                                        onClick={() => handleMeeting(false)}>
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