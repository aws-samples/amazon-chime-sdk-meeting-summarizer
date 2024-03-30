import React, { useState, useEffect, useContext } from 'react';
import { CodeView } from '@cloudscape-design/code-view';
import { post } from 'aws-amplify/api';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext, useFileReaderContext } from '../AuthContext';
import { Button } from '@cloudscape-design/components';

interface PresignedUrlResponse {
    url: string;
}

const Reader: React.FC = () => {
    const navigate = useNavigate();

    const { fileData } = useFileReaderContext();
    const { bucketName, fileKey } = fileData;
    const [fileContent, setFileContent] = useState('');

    const { authToken } = useContext(AuthContext);

    async function getFileContentFromS3(bucketName: string, fileKey: string, authToken: string): Promise<string> {
        try {

            if (!authToken) {
                throw new Error('Auth token is missing');
            }

            const presignedUrlResponse = post({
                apiName: 'request',
                path: 'downloadFile',
                options: {
                    headers: { Authorization: authToken },
                    body: { bucketName, fileKey }
                },
            });

            const response = await presignedUrlResponse.response;
            if (response.statusCode !== 200) {
                throw new Error('Failed to retrieve presigned URL');
            }

            const presignedUrlData = await response.body.json() as PresignedUrlResponse | null;
            if (presignedUrlData === null || !presignedUrlData.url) {
                throw new Error('Failed to retrieve valid presigned URL');
            }

            const fileResponse = await fetch(presignedUrlData.url);
            if (!fileResponse.ok) {
                throw new Error(`HTTP error! Status: ${fileResponse.status}`);
            }
            return await fileResponse.text();
        } catch (error) {
            console.error('Error fetching file content from S3:', error);
            throw error;
        }
    }


    useEffect(() => {
        async function fetchFileContent() {
            try {
                const localStorageKey = `fileContent-${bucketName}-${fileKey}`;
                let content = localStorage.getItem(localStorageKey);

                if (!content && bucketName && fileKey && authToken) {
                    content = await getFileContentFromS3(bucketName, fileKey, authToken);
                    localStorage.setItem(localStorageKey, content);
                }
                setFileContent(content || '');
            } catch (error) {
                console.error('Error fetching file content:', error);
                setFileContent('Error loading file content.');
            }
        }

        fetchFileContent();
    }, [bucketName, fileKey, authToken]);



    const goBack = () => {
        navigate(-1);
    };

    return (
        <>
            <Button
                ariaLabel="Return"
                iconAlign="left"
                iconName="angle-left-double"
                target="_blank"
                variant="normal"
                onClick={() => {
                    goBack()
                }}
            >
                Return
            </Button>

            <div style={{ margin: '30px' }}>
                <CodeView
                    lineNumbers
                    content={fileContent}
                />
            </div >

        </>
    );
};

export default Reader;