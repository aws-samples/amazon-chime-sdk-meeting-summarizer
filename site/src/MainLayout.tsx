import React, { useEffect, useState } from 'react';
import AppHeader from './components/header/AppHeader';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { Grid } from '@cloudscape-design/components';
import { AuthContext } from './AuthContext';

interface AuthEventData {
    payload: {
        event: string;
        data?: {
            email?: string;
        };
    };
}

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [userEmail, setUserEmail] = useState<string>('');
    const [authToken, setAuthToken] = useState<string | undefined | null>(null);

    useEffect(() => {
        const updateAuthData = async () => {
            try {
                const session = await fetchAuthSession();
                const accessToken = session.tokens?.idToken?.toString();
                if (accessToken) {
                    setAuthToken(accessToken);
                } else {
                    setAuthToken('');
                }
                const idToken = session.tokens?.idToken;
                if (idToken) {
                    const email = typeof idToken.payload.email === 'string' ? idToken.payload.email : '';
                    const alias = email.split('@')[0];
                    setUserEmail(alias);
                } else {
                    setUserEmail('');
                }
            } catch (error) {
                console.error('Error fetching auth data: ', error);
                setAuthToken('');
                setUserEmail('');
            }
        };
        const authListener = (data: AuthEventData) => {
            if (data.payload.event === 'signIn' || data.payload.event === 'signOut') {
                updateAuthData();
            }
        };
        const unsubscribe = Hub.listen('auth', authListener);
        updateAuthData();
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ authToken, setAuthToken, userEmail, setUserEmail }}>
            <Grid disableGutters gridDefinition={[{ colspan: 12 }, { colspan: 12 }]}>
                <div style={{ backgroundColor: '#232f3e' }}>
                    <AppHeader userName={userEmail} />
                </div>
                <div style={{ padding: '15px' }}>
                    {children}
                </div>
            </Grid>
        </AuthContext.Provider>
    );
};

export default MainLayout;