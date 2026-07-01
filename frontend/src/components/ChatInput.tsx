import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useChat } from '../context/ChatContext';
import sendIconUrl from '../assets/images/send_icon.svg';

interface InputContainerProps {
  'data-testid'?: string;
}

const InputContainer = styled.div<InputContainerProps>`
  width: 100%;
  max-width: 680px;
  min-height: 50px;
  position: relative;

  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;

  background-color: var(--bg-surface);
  box-shadow: 0px 1px 3px -1px var(--shadow-color),
    0px 2px 0px 0px var(--shadow-color);

  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 8px;
  margin-top: 0px;
`;

const TextArea = styled.textarea`
  width: 100%;
  border: none;
  outline: none;
  font-size: 15px;

  padding: 6px 30px 6px 0;

  color: var(--text-primary);

  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;

  min-height: 40px;
  max-height: 90px;

  overflow-y: auto;

  background-color: transparent;
  font-family: inherit;
  resize: none;
  box-sizing: border-box;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TypingPlaceholder = styled.div`
  position: absolute;
  left: 12px;
  top: 35%;
  transform: translateY(-50%);

  font-size: 15px;
  color: var(--text-secondary);

  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;

  width: 0;

  animation:
    typing 2s steps(60, end) forwards,
    blink 0.75s step-end infinite;

  @keyframes typing {
    from {
      width: 0;
    }
    to {
      width: 200px;
    }
  }

  @keyframes blink {
    50% {
      border-color: transparent;
    }
  }
`;

const ButtonsRight = styled.div`
  display: flex;
  align-items: center;
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
`;

const InputButton = styled.button`
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;

  display: flex;
  justify-content: center;
  align-items: center;

  cursor: pointer;
  margin: 0 4px;

  &:hover {
    background-color: var(--bg-elevated);
    border-radius: 4px;
  }
`;

const SendButton = styled(InputButton)`
  background-image: url(${sendIconUrl});
  background-size: 16px;
  background-repeat: no-repeat;
  background-position: center;

  &:hover {
    background-color: rgba(79, 70, 229, 0.08);
    color: var(--accent-current);
  }
`;

interface ChatInputProps {
  fixed?: boolean;
  includeHistory: boolean;
  setIncludeHistory: (value: boolean) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  fixed = false,
  includeHistory,
  setIncludeHistory
}) => {
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, loading } = useChat();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(
        50,
        Math.min(textareaRef.current.scrollHeight, 100)
      );
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = async () => {
    if (inputValue.trim() && !loading) {
      const value = inputValue;
      setInputValue('');

      await sendMessage(value, includeHistory);

      if (textareaRef.current) {
        textareaRef.current.style.height = '50px';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <InputContainer data-testid="chat-input-container">

      {!inputValue && (
        <TypingPlaceholder>
          Pergunte qualquer coisa
        </TypingPlaceholder>
      )}

      <TextArea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        data-testid="chat-input-textarea"
      />

      <ButtonsRight data-testid="buttons-right">
        <SendButton
          onClick={handleSubmit}
          disabled={loading}
          data-testid="send-button"
        />
      </ButtonsRight>

    </InputContainer>
  );
};

export default ChatInput;