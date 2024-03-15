import React from 'react';
import { AmplifyConfig } from './Config';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';


Amplify.configure(AmplifyConfig);

const App: React.FC = () => {
    return (
        <Authenticator>
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                </Routes>
            </Router>
        </Authenticator>
    );
};
export default App;
