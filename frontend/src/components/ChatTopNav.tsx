import React from 'react';
import styled from 'styled-components';
import UserMenu from './UserMenu';
import { ThemeToggle } from './ThemeToggle';

const GENIE_URL = '/genie/rooms/01f186bd33491d25b212d8c9ec9503c4';

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

const GenieSwitchButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: var(--text-primary);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accent-current, #6366f1);
    color: var(--accent-current, #6366f1);
    background: rgba(99, 102, 241, 0.08);
  }
`;

const ChatTopNav: React.FC = () => {
  const handleSwitchToGenie = () => {
    window.location.href = GENIE_URL;
  };

  return (
    <TopNav data-testid="chat-top-nav">
      <LeftActions>
        <ThemeToggle />
        <GenieSwitchButton
          type="button"
          onClick={handleSwitchToGenie}
          data-testid="switch-to-smiles-catalogo-completo-button"
          title="Abrir a Genie Smiles Catalogo Completo"
        >
          <span>✨</span>
          <span>Smiles Catalogo Completo</span>
        </GenieSwitchButton>
      </LeftActions>
      <RightActions>
        <UserMenu />
      </RightActions>
    </TopNav>
  );
};

export default ChatTopNav;
