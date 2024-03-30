import React, { ReactNode, createContext, useContext, useState } from 'react';

interface AuthContextType {
    authToken: string | null | undefined;
    setAuthToken: (token: string | null | undefined) => void;
    userEmail: string;
    setUserEmail: (email: string) => void;
}

interface FileReaderContextData {
    fileData: {
        bucketName: string;
        fileKey: string;
    };
    setFileData: (data: { bucketName: string; fileKey: string }) => void;
}

interface FileReaderProviderProps {
    children: ReactNode;
}

export const AuthContext = React.createContext<AuthContextType>({
    authToken: null,
    setAuthToken: () => { },
    userEmail: '',
    setUserEmail: () => { }
});

export const FileReaderContext = createContext<FileReaderContextData | null>(null);

export const useFileReaderContext = () => {
    const context = useContext(FileReaderContext);
    if (context === null) {
        throw new Error('useFileReaderContext must be used within a FileReaderProvider');
    }
    return context;
};

export const FileReaderProvider: React.FC<FileReaderProviderProps> = ({ children }) => {
    const [fileData, setFileData] = useState({
        bucketName: '',
        fileKey: '',
    });

    return (
        <FileReaderContext.Provider value={{ fileData, setFileData }}>
            {children}
        </FileReaderContext.Provider>
    );
};