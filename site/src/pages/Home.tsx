import React from 'react';

import FilteredTable from '../components/filteredTable/FilteredTable';
import MeetingHandler from '../components/meetingHandler/MeetingHandler';


const Home: React.FC = () => {
    return (
        <>
            <MeetingHandler />
            <div style={{ paddingTop: '20px' }}></div>
            <FilteredTable />
        </>
    );
};

export default Home;