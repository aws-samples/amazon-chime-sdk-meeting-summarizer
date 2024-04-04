import React, { useContext, useEffect, useState } from 'react';
import { Pagination, Button, Table, PropertyFilter, PropertyFilterProps, Container, ExpandableSection, Icon } from '@cloudscape-design/components';
import { format } from 'date-fns';
import { get, post } from 'aws-amplify/api';
import { useNavigate } from 'react-router-dom';

import { AuthContext, useFileReaderContext } from '../../AuthContext';
import ContextualChatbot from '../contextualChatbot/ContextualChatbot';
import { FixedButtonContainer, StyledButton } from '../contextualChatbot/StyledContextualChatbot';

interface ApiResponseItem {
    callId: string;
    scheduledTime: string;
    meetingType: string;
    summary: string;
    transcript: string;
    audio: string,
    title: string,
}

interface ApiResponse {
    url?: string;
}

interface FileDetails {
    bucketName: string;
    fileKey: string;
}

function PastMeetings() {
    const navigate = useNavigate();

    const [selectedItems, setSelectedItems] = useState<ApiResponseItem[]>([]);
    const [filteringQuery, setFilteringQuery] = useState<PropertyFilterProps.Query>({ tokens: [], operation: 'and' });
    const [errorMessage, setErrorMessage] = useState('');
    const [apiResponse, setApiResponse] = useState<ApiResponseItem[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isLoading, setIsLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);


    const { authToken } = useContext(AuthContext);
    const { setFileData } = useFileReaderContext();

    const paginatedItems = apiResponse.slice((currentPageIndex - 1) * pageSize, currentPageIndex * pageSize);
    const totalPages = Math.ceil(apiResponse.length / pageSize);

    const toggleDrawer = () => {
        setIsDrawerOpen(!isDrawerOpen);
    };

    function extractFileName(url: string) {
        return url.split('/').pop();
    }

    function extractBucketName(url: string) {
        const urlParts = url.split('.s3.');
        if (urlParts.length > 1) {
            const bucketUrlPart = urlParts[0];
            return bucketUrlPart.split('//').pop();
        }
        return null;
    }

    async function getDownloadUrl(bucketName: string, fileKey: string): Promise<string | null> {
        if (!authToken) {
            const message = "Authorization token is missing.";
            setErrorMessage(message);
            console.log(message);
            return null;
        }

        try {
            const restOperation = await post({
                apiName: 'request',
                path: 'downloadFile',
                options: {
                    headers: { Authorization: authToken },
                    body: { bucketName, fileKey }
                },
            });

            const response = await restOperation.response;

            if (response.statusCode === 200) {
                const data = await response.body.json() as ApiResponse;
                if (data && 'url' in data && typeof data.url === 'string') {
                    return data.url;
                } else {
                    console.error('Incorrect format of the response data');
                    return null;
                }
            } else {
                const errorData = await response.body.json();
                setErrorMessage('Failed to retrieve download URL');
                return null;
            }

        } catch (error) {
            console.error('Error fetching download URL:', error);
            return null;
        }
    }

    async function downloadFile(bucketName: string, fileKey: string, fileName: string) {
        try {
            const fileUrl = await getDownloadUrl(bucketName, fileKey);
            if (typeof fileUrl === 'string') {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                console.error('Failed to get a valid download URL');
            }
        } catch (error) {
            console.error('Error in file download:', error);
        }
    }

    function handleReadFile(type: string, fileUrl: string, bucketName: string, fileKey: string,) {
        const epochTimeMatch = fileUrl.match(/\.(\d+)\.txt$/);
        if (!epochTimeMatch) {
            console.error('Failed to extract epoch time');
            return;
        }
        const epochTime = epochTimeMatch[1];

        setFileData({ bucketName, fileKey });

        navigate(`/reader/${type}/${epochTime}`);
    }

    const columnDefinitions = [
        {
            id: 'callId',
            header: 'Meeting ID',
            cell: (item: ApiResponseItem) => item.callId
        },
        {
            id: 'scheduledTime',
            header: 'Meeting Time',
            cell: (item: ApiResponseItem) => {
                const date = new Date(Number(item.scheduledTime));
                return format(date, 'PPpp');
            },
        },
        {
            id: 'meetingType',
            header: 'Meeting Type',
            cell: (item: ApiResponseItem) => item.meetingType
        },
        {
            id: 'title',
            header: 'Meeting Title',
            cell: (item: ApiResponseItem) => item.title
        },

        {
            id: 'audio',
            header: 'Meeting Audio',
            cell: (item: ApiResponseItem) => {
                const AudioPlayer = () => {
                    const [audioUrl, setAudioUrl] = useState<string | null>(null);

                    useEffect(() => {
                        async function fetchAudioUrl() {

                            const audioFileUrl = item.audio;
                            if (!audioFileUrl) {
                                console.error('File URL is undefined');
                                return;
                            }

                            const bucketName = extractBucketName(audioFileUrl);
                            if (!bucketName) {
                                console.error('Failed to extract bucket name');
                                return;
                            }

                            const urlParts = audioFileUrl.split(`.s3.amazonaws.com/`);
                            const fileKey = urlParts.length > 1 ? urlParts[1] : undefined;

                            if (bucketName && fileKey) {
                                const url = await getDownloadUrl(bucketName, fileKey);
                                if (url) {
                                    setAudioUrl(url);
                                }
                            }
                        }

                        fetchAudioUrl();
                    }, []);

                    if (!audioUrl) {
                        return <span>Loading audio...</span>;
                    }

                    return (
                        <audio controls>
                            <source src={audioUrl} type="audio/wav" />
                            Your browser does not support the audio element.
                        </audio>
                    );
                };

                return <AudioPlayer />;
            }
        },
        {
            id: 'summary',
            header: 'Meeting Summary',
            cell: (item: ApiResponseItem) => {
                return (
                    <div>
                        <Button
                            iconAlign="left"
                            iconName="download"
                            variant="link"
                            ariaLabel="Download Summary"
                            onClick={() => {
                                const fileUrl = item.summary;
                                if (!fileUrl) {
                                    console.error('File URL is undefined');
                                    return;
                                }

                                const bucketName = extractBucketName(fileUrl);
                                if (!bucketName) {
                                    console.error('Failed to extract bucket name');
                                    return;
                                }

                                const urlParts = fileUrl.split(`.s3.amazonaws.com/`);
                                const fileKey = urlParts.length > 1 ? urlParts[1] : undefined;

                                if (fileKey) {
                                    const fileName = extractFileName(fileUrl);
                                    if (fileName) {
                                        downloadFile(bucketName, fileKey, fileName);
                                    } else {
                                        console.error('Failed to extract file name');
                                    }
                                } else {
                                    console.error('Failed to extract file key');
                                }
                            }}
                        >
                            Download
                        </Button>

                        <br />

                        <Button
                            iconName="file-open"
                            ariaLabel="Read Summary"
                            variant="link"
                            iconAlign="left"
                            onClick={() => {
                                const fileUrl = item.summary;
                                if (!fileUrl) {
                                    console.error('File URL is undefined');
                                    return;
                                }
                                const bucketName = extractBucketName(fileUrl);
                                if (!bucketName) {
                                    console.error('Failed to extract bucket name');
                                    return;
                                }

                                const urlParts = fileUrl.split(`.s3.amazonaws.com/`);
                                const fileKey = urlParts.length > 1 ? urlParts[1] : undefined;

                                if (fileKey) {
                                    const fileName = extractFileName(fileUrl);
                                    if (fileName) {
                                        handleReadFile('summary', item.summary, bucketName, fileKey)
                                    } else {
                                        console.error('Failed to extract file name');
                                    }
                                } else {
                                    console.error('Failed to extract file key');
                                }
                            }}
                        >
                            Read File
                        </Button>
                    </div>
                );
            }
        },
        {
            id: 'transcript',
            header: 'Meeting Transcript',
            cell: (item: ApiResponseItem) => {
                return (
                    <div>
                        <Button
                            iconAlign="left"
                            iconName="download"
                            variant="link"
                            ariaLabel="Download Transcript"
                            onClick={() => {
                                const fileUrl = item.transcript;
                                if (!fileUrl) {
                                    console.error('File URL is undefined');
                                    return;
                                }

                                const bucketName = extractBucketName(fileUrl);
                                if (!bucketName) {
                                    console.error('Failed to extract bucket name');
                                    return;
                                }

                                const urlParts = fileUrl.split(`.s3.amazonaws.com/`);
                                const fileKey = urlParts.length > 1 ? urlParts[1] : undefined;

                                if (fileKey) {
                                    const fileName = extractFileName(fileUrl);
                                    if (fileName) {
                                        downloadFile(bucketName, fileKey, fileName);
                                    } else {
                                        console.error('Failed to extract file name');
                                    }
                                } else {
                                    console.error('Failed to extract file key');
                                }
                            }}
                        >
                            Download
                        </Button>

                        <br />

                        <Button
                            iconName="file-open"
                            ariaLabel="Read Transcript"
                            iconAlign="left"
                            variant="link"
                            onClick={() => {
                                const fileUrl = item.transcript;
                                if (!fileUrl) {
                                    console.error('File URL is undefined');
                                    return;
                                }
                                const bucketName = extractBucketName(fileUrl);
                                if (!bucketName) {
                                    console.error('Failed to extract bucket name');
                                    return;
                                }

                                const urlParts = fileUrl.split(`.s3.amazonaws.com/`);
                                const fileKey = urlParts.length > 1 ? urlParts[1] : undefined;

                                if (fileKey) {
                                    const fileName = extractFileName(fileUrl);
                                    if (fileName) {
                                        handleReadFile('transcript', item.transcript, bucketName, fileKey)
                                    } else {
                                        console.error('Failed to extract file name');
                                    }
                                } else {
                                    console.error('Failed to extract file key');
                                }
                            }}
                        >
                            Read File
                        </Button>
                    </div>
                );
            }
        },
    ];

    const filteringProperties = [
        {
            key: 'callId',
            label: 'Call ID',
            dataType: 'string',
            groupValuesLabel: 'Call ID Values',
            propertyLabel: 'Call ID'
        },
        {
            key: 'scheduledTime',
            label: 'Scheduled Time',
            dataType: 'string',
            groupValuesLabel: 'Scheduled Time Values',
            propertyLabel: 'Scheduled Time'
        },
        {
            key: 'audio',
            label: 'Audio',
            dataType: 'string',
            groupValuesLabel: 'Audio Values',
            propertyLabel: 'Audio'
        },
        {
            key: 'summary',
            label: 'Summary',
            dataType: 'string',
            groupValuesLabel: 'Summary Values',
            propertyLabel: 'Summary'
        },
        {
            key: 'summary',
            label: 'Summary',
            dataType: 'string',
            groupValuesLabel: 'Summary Values',
            propertyLabel: 'Summary'
        },
        {
            key: 'transcript',
            label: 'Transcript',
            dataType: 'string',
            groupValuesLabel: 'Transcript Values',
            propertyLabel: 'Transcript'
        }
    ];

    useEffect(() => {
        async function getTableData() {

            if (!authToken) {
                setErrorMessage("Authorization token is missing.");
                console.log(errorMessage)
                return;
            }

            setIsLoading(true);

            try {
                const restOperation = get({
                    apiName: 'request',
                    path: 'getMeetings',
                    options: {
                        headers: { Authorization: authToken },
                    },
                });

                const response = await restOperation.response;

                if (response.statusCode === 200) {
                    setIsLoading(false);
                    const responseBody = await response.body.json();

                    if (Array.isArray(responseBody) && responseBody.every(item => {
                        return typeof item === 'object' && item !== null &&
                            'callId' in item && 'scheduledTime' in item &&
                            'meetingType' in item && 'summary' in item && 'transcript' in item
                            && 'audio' in item && 'title' in item;
                    })) {
                        setApiResponse(responseBody as unknown as ApiResponseItem[]);
                    } else {
                        setErrorMessage('Invalid response format');
                    }
                } else {
                    setErrorMessage('Failed to retrieve data');
                }

            } catch (error) {
                if (error instanceof Error) {
                    setIsLoading(false);
                    setErrorMessage(error.message || 'An error occurred');
                } else {
                    setErrorMessage('An unexpected error occurred');
                }
            }
        }
        getTableData();

    }, [authToken]);

    return (
        <>
            <div className="contextual-chatbot">
                {isDrawerOpen && (
                    <ContextualChatbot />
                )}
            </div>

            <div style={{ paddingTop: '20px' }}>
                <Container>
                    <br />
                    <ExpandableSection
                        headerText="Your past meetings"
                        expanded
                        disableContentPaddings
                    >
                        <Table
                            loading={isLoading}
                            items={paginatedItems}
                            columnDefinitions={columnDefinitions}
                            selectedItems={selectedItems}
                            onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                            pagination={
                                <Pagination
                                    pagesCount={totalPages}
                                    currentPageIndex={currentPageIndex}
                                    onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
                                />
                            }
                            filter={
                                <PropertyFilter
                                    query={filteringQuery as PropertyFilterProps.Query}
                                    onChange={({ detail }) => setFilteringQuery(detail as PropertyFilterProps.Query)}
                                    filteringProperties={filteringProperties} />
                            }
                        />
                    </ExpandableSection>
                </Container>

                <FixedButtonContainer>
                    <StyledButton
                        onClick={() => toggleDrawer()}
                    >
                        <Icon
                            name="contact"
                            size="large"
                            variant="link"
                        />
                    </StyledButton>
                </FixedButtonContainer>
            </div>
        </>
    );
}

export default PastMeetings;