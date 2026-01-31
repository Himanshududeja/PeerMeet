import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import './ChatPanel.css';

const ChatMessage = ({ message, isOwn }) => {
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`chat-message ${isOwn ? 'own' : ''}`}>
      <div className="message-content">
        <p className="message-text">{message.text}</p>
      </div>
      <span className="message-time text-mono">{time}</span>
    </div>
  );
};

const ChatPanel = ({ messages, onSendMessage, currentUserId }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
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

      <form className="chat-input-container" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!inputValue.trim()}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;