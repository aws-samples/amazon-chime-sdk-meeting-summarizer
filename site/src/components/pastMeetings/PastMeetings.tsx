import React, { useContext, useEffect, useState } from 'react';
import { Pagination, Table, PropertyFilter, PropertyFilterProps, Button, Container, ExpandableSection, Icon } from '@cloudscape-design/components';
import { AuthContext } from '../../AuthContext';
import { get } from 'aws-amplify/api';
import ContextualChatbot from '../contextualChatbot/ContextualChatbot';
import { FixedButtonContainer, StyledButton } from '../contextualChatbot/StyledContextualChatbot';

interface ApiResponseItem {
    callId: string;
    scheduledTime: string;
    meetingType: string;
    summary: string;
    transcript: string;
}


function PastMeetings() {
    const [selectedItems, setSelectedItems] = useState<ApiResponseItem[]>([]);
    const [filteringQuery, setFilteringQuery] = useState<PropertyFilterProps.Query>({ tokens: [], operation: 'and' });
    const [errorMessage, setErrorMessage] = useState('');
    const [apiResponse, setApiResponse] = useState<ApiResponseItem[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isLoading, setIsLoading] = useState(true);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const { authToken } = useContext(AuthContext);

    const paginatedItems = apiResponse.slice((currentPageIndex - 1) * pageSize, currentPageIndex * pageSize);
    const totalPages = Math.ceil(apiResponse.length / pageSize);


    function extractFileName(url: string): string {
        return url.split('/').pop() ?? '';
    }

    const toggleDrawer = () => {
        setIsDrawerOpen(!isDrawerOpen);
    };

    const columnDefinitions = [
        {
            id: 'callId',
            header: 'Call ID',
            cell: (item: ApiResponseItem) => item.callId
        },
        {
            id: 'scheduledTime',
            header: 'Scheduled Time',
            cell: (item: ApiResponseItem) => item.scheduledTime
        },
        {
            id: 'meetingType',
            header: 'Meeting Type',
            cell: (item: ApiResponseItem) => item.meetingType
        },
        {
            id: 'summary',
            header: 'Summary',
            cell: (item: ApiResponseItem) => {
                const fileName = extractFileName(item.summary);
                return fileName
            }
        },
        {
            id: 'transcript',
            header: 'Transcript',
            cell: (item: ApiResponseItem) => {
                const fileName = extractFileName(item.transcript);
                return fileName
            },
        },
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
                const restOperation = await get({
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
                            'meetingType' in item && 'summary' in item && 'transcript' in item;
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
            key: 'meetingType',
            label: 'Meeting Type',
            dataType: 'string',
            groupValuesLabel: 'Meeting Type Values',
            propertyLabel: 'Meeting Type'
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