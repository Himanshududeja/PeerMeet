import { useState, useEffect } from 'react';

export const useChat = (socket, roomId) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('chat-history', (history) => {
      setMessages(history);
    });

    return () => {
      socket.off('chat-message');
      socket.off('chat-history');
    };
  }, [socket]);

  const sendMessage = (messageData) => {
    if (!socket) return;
    
    const message = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      userId: socket.id,
      ...messageData
    };

    socket.emit('send-message', { roomId, message });
  };

  return { messages, sendMessage };
};