import { Container, ExpandableSection, Pagination, PropertyFilter, PropertyFilterProps, Table } from '@cloudscape-design/components';
import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../AuthContext';
import { get } from 'aws-amplify/api';

interface ApiResponseItem {
    Arn: string;
    CreationDate: string;
    GroupName: string;
    LastModificationDate: string;
    Name: string;
    State: string;
    ScheduleExpression: string;
}

const columnDefinitions = [
    {
        id: 'Arn',
        header: 'ARN',
        cell: (item: ApiResponseItem) => item.Arn
    },
    {
        id: 'CreationDate',
        header: 'Creation Date',
        cell: (item: ApiResponseItem) => item.CreationDate
    },
    {
        id: 'State',
        header: 'State',
        cell: (item: ApiResponseItem) => item.State
    },
    {
        id: 'ScheduleExpression',
        header: 'Schedule Expression',
        cell: (item: ApiResponseItem) => item.ScheduleExpression
    },
];

function ScheduledMeetings() {
    const [selectedItems, setSelectedItems] = useState<ApiResponseItem[]>([]);
    const [filteringQuery, setFilteringQuery] = useState<PropertyFilterProps.Query>({ tokens: [], operation: 'and' });
    const [errorMessage, setErrorMessage] = useState('');
    const [apiResponse, setApiResponse] = useState<ApiResponseItem[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isLoading, setIsLoading] = useState(true);

    const { authToken } = useContext(AuthContext);

    const paginatedItems = apiResponse.slice((currentPageIndex - 1) * pageSize, currentPageIndex * pageSize);
    const totalPages = Math.ceil(apiResponse.length / pageSize);

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
                    path: 'getMeetings?type=Scheduled',
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
                            'Arn' in item && 'CreationDate' in item &&
                            'State' in item && 'ScheduleExpression' in item;
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
            key: 'Arn',
            label: 'Schedule ARN',
            dataType: 'string',
            groupValuesLabel: 'Schedule Arns',
            propertyLabel: 'Schedule Arn'
        },
        {
            key: 'CreationDate',
            label: 'Creation Date',
            dataType: 'string',
            groupValuesLabel: 'Creation Date Values',
            propertyLabel: 'Creation Date'
        },
        {
            key: 'State',
            label: 'State',
            dataType: 'string',
            groupValuesLabel: 'State Values',
            propertyLabel: 'State'
        },
        {
            key: 'ScheduleExpression',
            label: 'ScheduleExpression',
            dataType: 'string',
            groupValuesLabel: 'ScheduleExpression Values',
            propertyLabel: 'Schedule Expression'
        }
    ];

    return (
        <div style={{ paddingTop: '20px' }}>
            <Container >
                <ExpandableSection
                    headerText="Your future meetings"
                    // expanded
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
        </div>
    )
}

export default ScheduledMeetings;