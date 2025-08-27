'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  message_text: string;
  message_type: 'text' | 'image';
  image_url?: string;
  is_read: boolean;
  created_at: string;
}

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: Set<number>;
  sendMessage: (conversationId: number, messageText: string, messageType?: string, imageUrl?: string) => void;
  joinConversation: (conversationId: number) => void;
  startTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (user && token) {
      const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
        auth: {
          token: token
        }
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
      });

      newSocket.on('user_online', (data) => {
        setOnlineUsers(prev => new Set([...prev, data.userId]));
      });

      newSocket.on('user_offline', (data) => {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          updated.delete(data.userId);
          return updated;
        });
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, token]);

  const sendMessage = (conversationId: number, messageText: string, messageType = 'text', imageUrl?: string) => {
    if (socket) {
      socket.emit('send_message', {
        conversationId,
        messageText,
        messageType,
        imageUrl
      });
    }
  };

  const joinConversation = (conversationId: number) => {
    if (socket) {
      socket.emit('join_conversation', conversationId);
    }
  };

  const startTyping = (conversationId: number) => {
    if (socket) {
      socket.emit('typing_start', { conversationId });
    }
  };

  const stopTyping = (conversationId: number) => {
    if (socket) {
      socket.emit('typing_stop', { conversationId });
    }
  };

  return (
    <SocketContext.Provider value={{
      socket,
      onlineUsers,
      sendMessage,
      joinConversation,
      startTyping,
      stopTyping
    }}>
      {children}
    </SocketContext.Provider>
  );
};