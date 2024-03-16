import React from 'react';

interface AuthContextType {
    authToken: string | null | undefined;
    setAuthToken: (token: string | null | undefined) => void;
    userEmail: string;
    setUserEmail: (email: string) => void;
}

export const AuthContext = React.createContext<AuthContextType>({
    authToken: null,
    setAuthToken: () => { },
    userEmail: '',
    setUserEmail: () => { }
});