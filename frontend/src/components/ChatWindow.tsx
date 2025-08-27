'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Send, Image, Smile } from 'lucide-react';
import { format } from 'date-fns';

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

interface ChatWindowProps {
  conversationId: number | null;
  otherUserId: number | null;
  otherUserName: string;
}

export default function ChatWindow({ conversationId, otherUserId, otherUserName }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const { socket, joinConversation, sendMessage, startTyping, stopTyping } = useSocket();

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      joinConversation(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (socket) {
      socket.on('new_message', handleNewMessage);
      socket.on('user_typing', handleUserTyping);
      socket.on('user_stopped_typing', handleUserStoppedTyping);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('user_typing', handleUserTyping);
        socket.off('user_stopped_typing', handleUserStoppedTyping);
      };
    }
  }, [socket, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/conversation/${conversationId}`);
      setMessages(response.data);
      console.log('Fetched messages:', response.data);
      
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (message: Message) => {
    if (message.conversation_id === conversationId) {
      setMessages(prev => [...prev, message]);
    }
  };

  const handleUserTyping = (data: any) => {
    if (data.conversationId === conversationId && data.userId !== user?.id) {
      setTypingUsers(prev => new Set([...prev, data.userId]));
    }
  };

  const handleUserStoppedTyping = (data: any) => {
    if (data.conversationId === conversationId) {
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.userId);
        return updated;
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversationId) return;

    const text = messageText.trim();
    setMessageText('');
    handleStopTyping();

    try {
      sendMessage(conversationId, text);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageText(text); // Restore message on error
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('conversationId', conversationId.toString());

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/send-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Fetch messages after upload
      fetchMessages();
    } catch (error) {
      console.error('Failed to upload image:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    handleStartTyping();
  };

  const handleStartTyping = () => {
    if (!typing && conversationId) {
      setTyping(true);
      startTyping(conversationId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
    if (typing && conversationId) {
      setTyping(false);
      stopTyping(conversationId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const isConsecutiveMessage = (currentMessage: Message, prevMessage: Message | null) => {
    if (!prevMessage) return false;
    
    const timeDiff = new Date(currentMessage.created_at).getTime() - new Date(prevMessage.created_at).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    return currentMessage.sender_id === prevMessage.sender_id && timeDiff < fiveMinutes;
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-700 mb-2">Welcome to Chat</h3>
          <p className="text-gray-500">Select a conversation or start a new one to begin chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-medium">
            {otherUserName.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">{otherUserName}</h3>
            <p className="text-sm text-gray-500">
              {typingUsers.size > 0 ? 'Typing...' : 'Click to view profile'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const isConsecutive = isConsecutiveMessage(message, prevMessage);
            const isOwn = message.sender_id === user?.id;

            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                  isConsecutive ? 'mt-1' : 'mt-4'
                }`}
              >
                <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
                  {!isConsecutive && !isOwn && (
                    <div className="text-xs text-gray-500 mb-1 ml-1">
                      {message.sender_name}
                    </div>
                  )}
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      isOwn
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    } ${
                      isConsecutive
                        ? isOwn
                          ? 'rounded-br-sm'
                          : 'rounded-bl-sm'
                        : ''
                    }`}
                  >
                    {message.message_type === 'image' ? (
                      <img
                        src={`${(process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api$/, '')}${message.image_url}`}
                        alt="Shared image"
                        className="max-w-full h-auto rounded-md"
                        onLoad={scrollToBottom}
                      />
                    ) : (
                      <p className="text-sm">{message.message_text}</p>
                    )}
                  </div>
                  <div className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                    {formatMessageTime(message.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <Image className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={messageText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
          />
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}