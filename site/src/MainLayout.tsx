import React, { useEffect, useState } from 'react';
import AppHeader from './components/header/AppHeader';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import '@aws-amplify/ui-react/styles.css';
import '@cloudscape-design/global-styles/index.css';
import 'react-datetime/css/react-datetime.css';
import { Grid } from '@cloudscape-design/components';

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
    useEffect(() => {
        const authListener = (data: AuthEventData) => {
            const { payload } = data;
            if (payload.event === 'signIn' || payload.event === 'signOut') {
                updateUserName();
            }
        };
        const unsubscribe = Hub.listen('auth', authListener);
        updateUserName();
        return unsubscribe;
    }, []);

    const updateUserName = async () => {
        try {
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken;
            if (idToken) {
                const email = typeof idToken.payload.email === 'string' ? idToken.payload.email : '';
                setUserEmail(email);
            } else {
                setUserEmail('');
            }
        } catch (error) {
            console.error('Error fetching user info: ', error);
            setUserEmail('');
        }
    };

    return (
        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }]}>
            <div style={{ backgroundColor: '#232f3e' }}>
                <AppHeader userName={userEmail} />
            </div>
            <div>{children}</div>
        </Grid>
    );
};

export default MainLayout;
