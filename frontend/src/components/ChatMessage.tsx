import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Message } from '../types';
import { useChat } from '../context/ChatContext';

import copyIconUrl from '../assets/images/copy_icon.svg';
import buttonIconUrl from '../assets/images/buttonIcon.svg';

/* =========================
   ANIMAÇÕES
========================= */

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const glowPulse = keyframes`
  0% { box-shadow: 0 0 0 rgba(59,130,246,0); }
  50% { box-shadow: 0 0 25px rgba(59,130,246,0.25); }
  100% { box-shadow: 0 0 0 rgba(59,130,246,0); }
`;

/* =========================
   LAYOUT
========================= */

const MessageContainer = styled.div<{ isUser: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;

  align-items: ${p => (p.isUser ? 'flex-end' : 'flex-start')};

  animation: ${fadeInUp} 0.25s ease-out;

  margin-bottom: ${p => (p.isUser ? '6px' : '3px')};
`;

/* =========================
   USER
========================= */

const UserMessageContent = styled.div`
  background: linear-gradient(135deg, var(--bg-elevated), rgba(79,70,229,0.06));

  padding: 10px 14px;
  border-radius: 14px;

  font-size: 15px;
  line-height: 1.5;

  border: 1px solid rgba(0,0,0,0.06);

  > p {
    margin: 0;
  }
`;

/* =========================
   BOT
========================= */

const BotMessageContent = styled.div<{ isThinking?: boolean }>`
  width: 100%;
  padding: 10px;

  border-radius: 14px;

  background: var(--bg-surface);
  border: 1px solid var(--border-color);

  font-size: 15px;
  line-height: 1.55;

  ${({ isThinking }) =>
    isThinking &&
    css`
      animation: ${glowPulse} 1.4s infinite ease-in-out;
      border-color: rgba(59,130,246,0.35);
    `}
`;

/* =========================
   HEADER
========================= */

const ModelInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  margin-bottom: 6px;
`;

const ModelIcon = styled.div`
  width: 22px;
  height: 22px;
  background-image: url(${buttonIconUrl});
  background-size: 18px;
  background-position: center;
  background-repeat: no-repeat;
`;

const ModelName = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

/* =========================
   COPY BUTTON
========================= */

const MessageActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const ActionButton = styled.button`
  width: 26px;
  height: 26px;

  border: none;
  background: transparent;

  cursor: pointer;
  border-radius: 6px;

  &:hover {
    background: var(--bg-elevated);
  }
`;

const CopyButton = styled(ActionButton)`
  background-image: url(${copyIconUrl});
  background-size: 16px;
  background-repeat: no-repeat;
  background-position: center;
`;

/* =========================
   THINKING + DOTS
========================= */

const ThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  font-size: 14px;
  color: var(--text-muted);
`;

const Spinner = styled.div`
  width: 14px;
  height: 14px;

  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.1);
  border-top: 2px solid var(--accent-current);

  animation: spin 0.6s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const DotsWrapper = styled.span`
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
`;

const Dot = styled.span`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-muted);

  animation: bounce 1.2s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0.4);
      opacity: 0.4;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

/* =========================
   COMPONENT
========================= */

interface ChatMessageProps {
  message: Message;
  streamingMessageId?: string | null;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  streamingMessageId = null
}) => {
  const { copyMessage } = useChat();

  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const isThinking = message.isThinking;
  const isStreaming = streamingMessageId === message.message_id;

  const cleanContent = message.content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();

  const handleCopy = async () => {
    await copyMessage(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {cleanContent}
    </ReactMarkdown>
  );

  /* =========================
     USER
  ========================= */

  if (isUser) {
    return (
      <MessageContainer isUser>
        <UserMessageContent>
          {renderContent()}
        </UserMessageContent>
      </MessageContainer>
    );
  }

  /* =========================
     THINKING
  ========================= */

  if (isThinking) {
    return (
      <MessageContainer isUser={false}>
        <ModelInfo>
          <ModelIcon />
          <ModelName>Assistente</ModelName>
        </ModelInfo>

        <BotMessageContent isThinking>
          <ThinkingIndicator>
            <Spinner />
            Processando resposta
            <DotsWrapper>
              <Dot />
              <Dot />
              <Dot />
            </DotsWrapper>
          </ThinkingIndicator>
        </BotMessageContent>
      </MessageContainer>
    );
  }

  /* =========================
     BOT NORMAL
  ========================= */

  return (
    <MessageContainer isUser={false}>
      <ModelInfo>
        <ModelIcon />
        <ModelName>Assistente</ModelName>
      </ModelInfo>

      <BotMessageContent>
        {renderContent()}

        <MessageActions>
          <CopyButton onClick={handleCopy} />
        </MessageActions>
      </BotMessageContent>
    </MessageContainer>
  );
};

export default ChatMessage;