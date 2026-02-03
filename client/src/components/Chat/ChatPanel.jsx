import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, FileText, Image as ImageIcon, File } from 'lucide-react';
import './ChatPanel.css';

const ChatMessage = ({ message, isOwn }) => {
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const renderMessageContent = () => {
    if (message.type === 'file') {
      const isImage = message.fileType?.startsWith('image/');

      return (
        <div className="message-file">
          {isImage ? (
            <>
              <div className="message-image-container">
                <img
                  src={message.fileData}
                  alt={message.fileName}
                  className="message-image"
                  onClick={() => window.open(message.fileData, '_blank')}
                  onError={(e) => {
                    console.error('Image load error:', e);
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <div className="image-file-name">{message.fileName}</div>
            </>
          ) : (
            <div className="message-file-info">
              <FileText size={24} />
              <span className="file-name">{message.fileName}</span>
            </div>
          )}
          <a
            href={message.fileData}
            download={message.fileName}
            className="file-download-btn"
          >
            Download
          </a>
        </div>
      );
    }

    return <p className="message-text">{message.text}</p>;
  };

  return (
    <div className={`chat-message ${isOwn ? 'own' : ''}`}>
      <div className="message-content">
        {renderMessageContent()}
      </div>
      <span className="message-time text-mono">{time}</span>
    </div>
  );
};

const ChatPanel = ({ messages, onSendMessage, currentUserId }) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Limit file size to 10MB (aligned with server limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }

      // Check file type
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        alert('File type not supported. Please upload images, PDFs, or documents.');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (selectedFile) {
      // Send file
      const reader = new FileReader();
      reader.onload = () => {
        onSendMessage({
          type: 'file',
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileData: reader.result,
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(selectedFile);
    } else if (inputValue.trim()) {
      // Send text
      onSendMessage({
        type: 'text',
        text: inputValue.trim(),
      });
      setInputValue('');
    }
  };

  return (
    <div className="chat-panel">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p className="text-mono">No messages yet</p>
            <p className="text-muted">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isOwn={message.userId === currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {selectedFile && (
        <div className="file-preview">
          <div className="file-preview-content">
            {selectedFile.type.startsWith('image/') ? (
              <ImageIcon size={20} />
            ) : (
              <File size={20} />
            )}
            <span className="file-preview-name">{selectedFile.name}</span>
            <button
              type="button"
              className="file-remove-btn"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <form className="chat-input-container" onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />

        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          <Paperclip size={20} />
        </button>

        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={!!selectedFile}
        />

        <button
          type="submit"
          className="send-btn"
          disabled={!inputValue.trim() && !selectedFile}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;