import { useState, useEffect } from 'react';

export const useChat = (socket, roomId, onMessageReceived) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (onMessageReceived && message.userId !== socket.id) {
        onMessageReceived();
      }
    });

    socket.on('chat-history', (history) => {
      setMessages(history);
    });

    return () => {
      socket.off('chat-message');
      socket.off('chat-history');
    };
  }, [socket, onMessageReceived]);

  const sendMessage = (text) => {
    if (!text.trim() || !socket) return;

    const message = {
      id: Date.now(),
      text: text.trim(),
      timestamp: new Date().toISOString(),
      userId: socket.id
    };

    socket.emit('send-message', { roomId, message });
  };

  return { messages, sendMessage };
};