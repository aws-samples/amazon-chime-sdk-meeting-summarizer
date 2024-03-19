import React from 'react';

import PastMeetings from '../components/pastMeetings/PastMeetings';
import MeetingHandler from '../components/meetingHandler/MeetingHandler';
import ScheduledMeetings from '../components/scheduledMeetings/ScheduledMeetings';


const Home: React.FC = () => {
    return (
        <>
            <MeetingHandler />

            <ScheduledMeetings />

            <PastMeetings />
        </>
    );
};

export default Home;