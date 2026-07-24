import React from 'react';
import styled from 'styled-components';
import UserMenu from './UserMenu';
import { ThemeToggle } from './ThemeToggle';

const TopNav = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  height: 56px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 20;
`;

const LeftActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const RightActions = styled.div`
  display: flex;
  align-items: center;
  margin-left: auto;
`;

const ChatTopNav: React.FC = () => {
  return (
    <TopNav data-testid="chat-top-nav">
      <LeftActions>
        <ThemeToggle />
      </LeftActions>
      <RightActions>
        <UserMenu />
      </RightActions>
    </TopNav>
  );
};

export default ChatTopNav;
