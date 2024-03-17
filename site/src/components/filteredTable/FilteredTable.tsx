import React, { useState } from 'react';
import { Pagination, Table, PropertyFilter, PropertyFilterProps, Button, Container, Popover, StatusIndicator } from '@cloudscape-design/components';

interface TableItem {
    call_id: string;
    scheduled_time: string;
    meeting_type: string;
    summary: string;
    transcript: string;
    meeting_mp3: string;
}

const mockApiData = [
    { call_id: "9216995623", scheduled_time: "1710460927000", meeting_type: "Chime", meeting_mp3: "4ab5f391-e9ed-4f59-9bbd-af14d5530948-0.wav", summary: "https://mock.s3.amazonaws.com/call-summary/9216995623.1710461075000.txt", transcript: "https://mock.s3.amazonaws.com/diarized-transcript/9216995623.1710461075000.txt" },
    { call_id: "9216995623", scheduled_time: "1710460927000", meeting_type: "Chime", meeting_mp3: "4ab5f391-e9ed-4f59-9bbd-af14d5530948-0.wav", summary: "https://mock.s3.amazonaws.com/call-summary/9216995623.1710461075000.txt", transcript: "https://mock.s3.amazonaws.com/diarized-transcript/9216995623.1710461075000.txt" },
    { call_id: "9216995623", scheduled_time: "1710460927000", meeting_type: "Chime", meeting_mp3: "4ab5f391-e9ed-4f59-9bbd-af14d5530948-0.wav", summary: "https://mock.s3.amazonaws.com/call-summary/9216995623.1710461075000.txt", transcript: "https://mock.s3.amazonaws.com/diarized-transcript/9216995623.1710461075000.txt" },
    { call_id: "9216995623", scheduled_time: "1710460927000", meeting_type: "Chime", meeting_mp3: "4ab5f391-e9ed-4f59-9bbd-af14d5530948-0.wav", summary: "https://mock.s3.amazonaws.com/call-summary/9216995623.1710461075000.txt", transcript: "https://mock.s3.amazonaws.com/diarized-transcript/9216995623.1710461075000.txt" },
    { call_id: "9216995623", scheduled_time: "1710460927000", meeting_type: "Chime", meeting_mp3: "4ab5f391-e9ed-4f59-9bbd-af14d5530948-0.wav", summary: "https://mock.s3.amazonaws.com/call-summary/9216995623.1710461075000.txt", transcript: "https://mock.s3.amazonaws.com/diarized-transcript/9216995623.1710461075000.txt" },
    { call_id: "9216995623", scheduled_time: "1710460927000", meeting_type: "Chime", meeting_mp3: "4ab5f391-e9ed-4f59-9bbd-af14d5530948-0.wav", summary: "https://mock.s3.amazonaws.com/call-summary/9216995623.1710461075000.txt", transcript: "https://mock.s3.amazonaws.com/diarized-transcript/9216995623.1710461075000.txt" },
];

function extractFileName(url: string): string {
    return url.split('/').pop() ?? '';
}

const handleChatClick = (item: TableItem) => {
    console.log("Chat clicked for item:", item);
};

const columnDefinitions = [
    {
        id: 'call_id',
        header: 'Call ID',
        cell: (item: TableItem) => item.call_id
    },
    {
        id: 'scheduled_time',
        header: 'Scheduled Time',
        cell: (item: TableItem) => item.scheduled_time
    },
    {
        id: 'meeting_type',
        header: 'Meeting Type',
        cell: (item: TableItem) => item.meeting_type
    },
    {
        id: 'meeting_mp3',
        header: 'Meeting Audio',
        cell: (item: TableItem) => <a href={item.meeting_mp3} target="_blank" rel="noopener noreferrer">{item.meeting_mp3}</a>
    },
    {
        id: 'summary',
        header: 'Summary',
        cell: (item: TableItem) => {
            const fileName = extractFileName(item.summary);
            return <a href={item.summary} target="_blank" rel="noopener noreferrer">{fileName}</a>;
        }
    },
    {
        id: 'transcript',
        header: 'Transcript',
        cell: (item: TableItem) => {
            const fileName = extractFileName(item.transcript);
            return <a href={item.transcript} target="_blank" rel="noopener noreferrer">{fileName}</a>;
        },
    },
    {
        id: 'chat',
        header: 'Chat',
        cell: (item: TableItem) => (
            <Popover
                dismissButton={false}
                position="top"
                size="small"
                triggerType="custom"
                content={
                    <StatusIndicator type="success">
                        Contextual chatbot development in progress!
                    </StatusIndicator>
                }
            >
                <Button
                    onClick={() => handleChatClick(item)}
                    iconName="contact"
                    variant="icon"
                >
                </Button>
            </Popover>

        )
    },
];

function FilteredTable() {
    const [selectedItems, setSelectedItems] = useState<TableItem[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(1);
    const [filteringQuery, setFilteringQuery] = useState<PropertyFilterProps.Query>({ tokens: [], operation: 'and' });

    const pageSize = 10;
    const paginatedItems = mockApiData.slice((currentPageIndex - 1) * pageSize, currentPageIndex * pageSize);
    const totalPages = Math.ceil(mockApiData.length / pageSize);

    const filteringProperties = [
        {
            key: 'call_id',
            label: 'Call ID',
            dataType: 'string',
            groupValuesLabel: 'Call ID Values',
            propertyLabel: 'Call ID'
        },
        {
            key: 'scheduled_time',
            label: 'Scheduled Time',
            dataType: 'string',
            groupValuesLabel: 'Scheduled Time Values',
            propertyLabel: 'Scheduled Time'
        },
        {
            key: 'meeting_type',
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
        <Container>
            <Table
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
        </Container>
    );
}

export default FilteredTable;