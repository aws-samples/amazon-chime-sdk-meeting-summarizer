import React, { useState, useEffect, useContext } from 'react';
import {
    Container,
    SpaceBetween,
    Button,
    FormField,
    Textarea,
    Calendar,
    TimeInput,
    Select,
    Toggle
} from '@cloudscape-design/components';
import moment from 'moment';
import { post } from 'aws-amplify/api';
import '@aws-amplify/ui-react/styles.css';
import '@cloudscape-design/global-styles/index.css';
import 'react-datetime/css/react-datetime.css';

import { AuthContext } from '../AuthContext';

interface SelectOption {
    label: string;
    value: string;
}

const languages: SelectOption[] = [
    { label: "English (en-US)", value: "en-US" },
    { label: "Arabic (arb)", value: "arb" },
    { label: "Chinese, Mandarin (cmn-CN)", value: "cmn-CN" },
    { label: "Danish (da-DK)", value: "da-DK" },
    { label: "Dutch (nl-NL)", value: "nl-NL" },
    { label: "English (en-AU)", value: "en-AU" },
    { label: "English (en-GB)", value: "en-GB" },
    { label: "English (en-IN)", value: "en-IN" },
    { label: "French (fr-FR)", value: "fr-FR" },
    { label: "French (fr-CA)", value: "fr-CA" },
    { label: "German (de-DE)", value: "de-DE" },
    { label: "Hindi (hi-IN)", value: "hi-IN" },
    { label: "Italian (it-IT)", value: "it-IT" },
    { label: "Japanese (ja-JP)", value: "ja-JP" },
    { label: "Korean (ko-KR)", value: "ko-KR" },
    { label: "Norwegian (nb-NO)", value: "nb-NO" },
    { label: "Polish (pl-PL)", value: "pl-PL" },
    { label: "Portuguese (pt-BR)", value: "pt-BR" },
    { label: "Portuguese (pt-PT)", value: "pt-PT" },
    { label: "Russian (ru-RU)", value: "ru-RU" },
    { label: "Spanish (es-ES)", value: "es-ES" },
    { label: "Spanish (es-MX)", value: "es-MX" },
    { label: "Spanish (es-US)", value: "es-US" },
    { label: "Swedish (sv-SE)", value: "sv-SE" },
    { label: "Turkish (tr-TR)", value: "tr-TR" },
    { label: "Welsh (cy-GB)", value: "cy-GB" }
];

// const getNext15MinIncrement = (): string => {
//     const now = moment();
//     const minutesToAdd = 15 - (now.minute() % 15);
//     const next15Minutes = now.add(minutesToAdd, 'minutes');
//     return next15Minutes.toISOString();
// };

const Home: React.FC = () => {
    const [meetingInfo, setMeetingInfo] = useState('');
    const [localTimeZone, setLocalTimeZone] = useState('');
    const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
    const [selectedTime, setSelectedTime] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState<SelectOption>(languages[0]);
    const [scheduleForLater, setScheduleForLater] = useState(false);

    const { authToken } = useContext(AuthContext);

    const handleLanguageChange = (option: any) => {
        if (option && option.label) {
            const language = languages.find(lang => lang.value === option.value);
            if (language) {
                setSelectedLanguage(language);
            }
        }
    };

    useEffect(() => {
        const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setLocalTimeZone(localTimeZone);
    }, []);

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

    return (
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
                            <Button onClick={handlePresentMeeting}>Start Now</Button>
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
                                options={languages.map(lang => ({
                                    label: lang.label,
                                    value: lang.value
                                }))}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ marginRight: '10px', fontWeight: 'bold' }}>Schedule for Later:</span>
                            <Toggle
                                checked={scheduleForLater}
                                onChange={({ detail }) => setScheduleForLater(detail.checked)}
                            />
                        </div>
                        {scheduleForLater && (
                            <>
                                <FormField label="Start Date">
                                    <Calendar
                                        onChange={handleDateChange}
                                        value={selectedDate}
                                    />
                                </FormField>
                                <FormField label="Start Time">
                                    <TimeInput
                                        onChange={({ detail }) => setSelectedTime(detail.value)}
                                        value={selectedTime}
                                        placeholder="15:30"
                                    />
                                </FormField>
                                <Button onClick={handleFutureMeeting}>Schedule Future Meeting</Button>
                            </>
                        )}
                    </SpaceBetween>
                </div>
            </SpaceBetween>
        </Container>
    );
};

export default Home;