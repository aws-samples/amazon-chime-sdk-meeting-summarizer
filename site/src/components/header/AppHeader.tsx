import React from 'react';
import { Header, ButtonDropdown, Icon, ButtonDropdownProps } from '@cloudscape-design/components';
import { signOut } from 'aws-amplify/auth';

interface DropdownEvent {
    detail: {
        id: string;
    };
}

const AppHeader: React.FC<{ userName: string }> = ({ userName }) => {
    const handleDropdownClick = (event: DropdownEvent) => {
        const itemId = event.detail.id;
        switch (itemId) {
            case 'signout':
                handleSignOut();
                break;
            default:
                break;
        }
    };
    const handleSignOut = async () => {
        try {
            console.log('logout clicked');
            await signOut();
        } catch (error) {
            console.error('Error signing out: ', error);
        }
    };
    const userMenuItems: ButtonDropdownProps.ItemOrGroup[] = [
        {
            id: 'signout',
            text: 'Sign Out',
        }
    ];

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60px',
            marginLeft: '15px',
            marginRight: '10px'
        }}>
            <Header
                variant="h1"
                actions={
                    <ButtonDropdown variant="normal" items={userMenuItems} onItemClick={handleDropdownClick}>
                        <Icon name="user-profile" /> {userName}
                    </ButtonDropdown>
                }>
                <span style={{ color: 'white' }}>Amazon Chime Meeting Summarizer</span>
            </Header>
        </div>
    );
};

export default AppHeader;