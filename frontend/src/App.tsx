import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { ChatProvider } from './context/ChatContext';
import LeftComponent from './components/LeftComponent';
import ChatArea from './components/ChatArea';
import IntroPage from './components/IntroPage';
import { useTheme } from './hooks/useTheme';

// Define the props type explicitly
interface AppContainerProps {
  'data-testid'?: string;
}

interface MainContentProps {
  'data-testid'?: string;
}

const AppContainer = styled.div<AppContainerProps>`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
`;

const MainContent = styled.div<MainContentProps>`
  display: flex;
  height: 100vh;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;

const ModalContainer = styled.div`
  background: var(--bg-surface);
  border-radius: 16px;
  box-shadow: 0 16px 40px var(--shadow-color);
  width: 420px;
  max-width: 90vw;
  padding: 24px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
`;

const ModalCloseButton = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 4px;
  color: var(--text-muted);

  &:hover {
    color: var(--text-secondary);
  }
`;

const ModalSectionTitle = styled.p`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
`;

const ModalCard = styled.div`
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color-strong);
`;

const ModalIcon = styled.div<{ variant?: 'success' | 'warning' }>`
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  color: ${({ variant }) =>
    variant === 'warning' ? '#b45309' : '#15803d'};
  background: ${({ variant }) =>
    variant === 'warning' ? '#fffbeb' : '#ecfdf3'};
  border: 1px solid
    ${({ variant }) =>
      variant === 'warning' ? '#facc15' : '#bbf7d0'};
`;

const ModalTextGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ModalCardTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
`;

const ModalCardDescription = styled.span`
  font-size: 12px;
  color: var(--text-secondary);
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
`;

const ModalPrimaryButton = styled.button`
  border-radius: 999px;
  padding: 9px 22px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-light) 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 10px 25px var(--accent-glow-current);
  transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px var(--accent-glow-current);
    filter: brightness(1.04);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 6px 16px var(--accent-glow-current);
    filter: brightness(0.98);
  }
`;

const ModalButtonSparkles = styled.span`
  font-size: 14px;
`;

const fadeInMain = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const MainWrapper = styled.div`
  animation: ${fadeInMain} 0.6s ease-out;
  width: 100%;
  height: 100%;
`;

const App: React.FC = () => {
  useTheme();
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('chat_intro_seen_v1');
  });
  const [enteringChat, setEnteringChat] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);

  const handleEnterChat = () => {
    sessionStorage.setItem('chat_intro_seen_v1', 'true');
    setEnteringChat(true);
    setTimeout(() => {
      setShowIntro(false);
    }, 400);
  };

  useEffect(() => {
    if (!showIntro) {
      const hasSeen = sessionStorage.getItem('chat_news_seen_v1');
      if (!hasSeen) {
        setShowNewsModal(true);
        sessionStorage.setItem('chat_news_seen_v1', 'true');
      }
    }
  }, [showIntro]);

  const handleCloseModal = () => {
    setShowNewsModal(false);
  };

  if (showIntro) {
    return <IntroPage onEnter={handleEnterChat} />;
  }

  return (
    <ChatProvider>
      <AppContainer data-testid="app-container">
        <MainWrapper>
          <MainContent data-testid="main-content">
            <LeftComponent />
            <ChatArea />
          </MainContent>
        </MainWrapper>

        {showNewsModal && (
          <ModalOverlay>
            <ModalContainer role="dialog" aria-modal="true" aria-labelledby="novidades-title">
              <ModalHeader>
                <ModalTitle id="novidades-title">
                  <span>🚀</span>
                  Novidades
                </ModalTitle>
                <ModalCloseButton
                  type="button"
                  onClick={handleCloseModal}
                  aria-label="Fechar aviso de novidades"
                >
                  ×
                </ModalCloseButton>
              </ModalHeader>

              <ModalSectionTitle>O que há de novo:</ModalSectionTitle>

              <ModalCard>
                <ModalIcon>✔</ModalIcon>
                <ModalTextGroup>
                  <ModalCardTitle>Dados do Siebel</ModalCardTitle>
                  <ModalCardDescription>
                    Agora o chat consegue consultar transações de acúmulo diretamente.
                  </ModalCardDescription>
                </ModalTextGroup>
              </ModalCard>

              <ModalCard>
                <ModalIcon>✔</ModalIcon>
                <ModalTextGroup>
                  <ModalCardTitle>Exportação</ModalCardTitle>
                  <ModalCardDescription>
                    Novo sistema de download implementado. Baixe as tabelas geradas com um clique.
                  </ModalCardDescription>
                </ModalTextGroup>
              </ModalCard>

              <ModalCard>
                <ModalIcon variant="warning">!</ModalIcon>
                <ModalTextGroup>
                  <ModalCardTitle>Ajude‑nos a evoluir</ModalCardTitle>
                  <ModalCardDescription>
                    Estamos melhorando frequentemente as respostas graças ao feedback de vocês. Caso
                    encontre algo fora do padrão ou o chat não localize uma resposta, por favor,
                    entre em contato com Alvaro Gabry ou time de dados.
                  </ModalCardDescription>
                </ModalTextGroup>
              </ModalCard>

              <ModalFooter>
                <ModalPrimaryButton type="button" onClick={handleCloseModal}>
                  Entendi!
                  <ModalButtonSparkles>✨</ModalButtonSparkles>
                </ModalPrimaryButton>
              </ModalFooter>
            </ModalContainer>
          </ModalOverlay>
        )}
      </AppContainer>
    </ChatProvider>
  );
};

export default App;
