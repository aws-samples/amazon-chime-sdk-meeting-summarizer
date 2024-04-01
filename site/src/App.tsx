import React from 'react';
import { AmplifyConfig } from './Config';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './MainLayout';
import Home from './pages/Home';
import Reader from './pages/Reader';
import { FileReaderProvider } from './AuthContext';

Amplify.configure(AmplifyConfig);

const App: React.FC = () => {
    return (
        <Authenticator>
            <Router>
                <FileReaderProvider>
                    <MainLayout>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/reader/:type/:id" element={<Reader />} />
                        </Routes>
                    </MainLayout>
                </FileReaderProvider>
            </Router>
        </Authenticator>
    );
};

export default App;
