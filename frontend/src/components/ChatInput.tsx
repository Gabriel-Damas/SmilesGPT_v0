import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faSearch } from '@fortawesome/free-solid-svg-icons';
import { useChat } from '../context/ChatContext';
import { uploadFile, lookupCpf, UploadedFileInfo } from '../api/chatApi';
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

const InputWrapper = styled.div`
  width: 100%;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AttachButton = styled(InputButton)`
  color: var(--text-secondary);
  font-size: 16px;

  &:hover {
    background-color: var(--bg-elevated);
    color: var(--accent-current, #6366f1);
    border-radius: 4px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const FileChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 4px;
`;

const FileChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.10);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: var(--accent-current, #6366f1);
  font-size: 12px;
  font-weight: 500;
  max-width: 320px;
  overflow: hidden;
`;

const FileChipText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileChipRemove = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--accent-current, #6366f1);
  font-size: 14px;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  &:hover { opacity: 0.7; }
`;

const UploadingLabel = styled.span`
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
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
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { sendMessage, loading } = useChat();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lookupInputRef = useRef<HTMLInputElement>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    setUploadedFile(null);
    try {
      const info = await uploadFile(file);
      setUploadedFile(info);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar o arquivo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadError(null);
  };

  const buildMessageWithFile = (text: string): string => {
    if (!uploadedFile) return text;
    const header = [
      `### Arquivo anexado: ${uploadedFile.filename}`,
      `${uploadedFile.rows} linhas × ${uploadedFile.cols} colunas`,
      `Colunas: ${uploadedFile.columns.join(', ')}`,
      '',
      '**Prévia dos dados (até 10 linhas):**',
      uploadedFile.preview_markdown,
      '',
      '---',
      '',
    ].join('\n');
    return text.trim() ? `${header}${text}` : header.trimEnd();
  };

  const handleSubmit = async () => {
    const hasContent = inputValue.trim() || uploadedFile;
    if (!hasContent || loading || isUploading) return;

    // Contexto completo para o LLM (com preview dos dados)
    const apiContent = buildMessageWithFile(inputValue);
    // Display limpo para o usuario (so nome + tipo do arquivo)
    const ext = uploadedFile?.filename.split('.').pop()?.toUpperCase() || '';
    const displayContent = uploadedFile
      ? `\uD83D\uDCCE ${uploadedFile.filename}${inputValue.trim() ? '\n\n' + inputValue.trim() : ''}`
      : inputValue;

    setInputValue('');
    setUploadedFile(null);

    await sendMessage(apiContent, includeHistory, displayContent);

    if (textareaRef.current) {
      textareaRef.current.style.height = '50px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <InputWrapper>

      {/* Chip do arquivo anexado */}
      {(uploadedFile || isUploading || uploadError) && (
        <FileChipRow>
          {isUploading && <UploadingLabel>Carregando arquivo...</UploadingLabel>}
          {uploadedFile && !isUploading && (
            <FileChip title={`${uploadedFile.rows} linhas × ${uploadedFile.cols} colunas`}>
              <span>&#128206;</span>
              <FileChipText>{uploadedFile.filename}</FileChipText>
              <FileChipRemove onClick={handleRemoveFile} title="Remover arquivo" type="button">
                ×
              </FileChipRemove>
            </FileChip>
          )}
          {uploadError && (
            <UploadingLabel style={{ color: 'var(--color-error, #ef4444)' }}>
              {uploadError}
            </UploadingLabel>
          )}
        </FileChipRow>
      )}

      <InputContainer data-testid="chat-input-container">

        {/* Input de arquivo oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          data-testid="file-input"
        />
        {/* Input oculto para lookup CPF */}
        <input
          ref={lookupInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleLookupCpf}
          data-testid="lookup-input"
        />

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
          <AttachButton
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isUploading}
            title="Anexar arquivo CSV ou XLSX"
            data-testid="attach-button"
          >
            <FontAwesomeIcon icon={faPaperclip} />
          </AttachButton>
          <SendButton
            onClick={handleSubmit}
            disabled={loading || isUploading}
            data-testid="send-button"
          />
        </ButtonsRight>

      </InputContainer>

    </InputWrapper>
  );
};

export default ChatInput;