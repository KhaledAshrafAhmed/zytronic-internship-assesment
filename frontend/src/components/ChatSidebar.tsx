'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';

interface User {
  id: number;
  username: string;
  email: string;
  is_online: boolean;
  last_seen: string;
}

interface Conversation {
  conversation_id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_online: boolean;
  last_message: string;
  last_message_type: string;
  last_message_time: string;
  unread_count: number;
}

interface ChatSidebarProps {
  selectedConversation: number | null;
  onSelectConversation: (conversationId: number, otherUserId: number, otherUserName: string) => void;
}

export default function ChatSidebar({ selectedConversation, onSelectConversation }: ChatSidebarProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const { onlineUsers } = useSocket();

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/users/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const startConversation = async (otherUserId: number, otherUserName: string) => {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/conversation`, {
        otherUserId
      });
      
      const { conversation_id } = response.data;
      onSelectConversation(conversation_id, otherUserId, otherUserName);
      setShowUsers(false);
      fetchConversations(); // Refresh conversations list
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const formatLastMessage = (message: string, type: string) => {
    if (type === 'image') return '📷 Image';
    return message.length > 30 ? message.substring(0, 30) + '...' : message;
  };

  if (loading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Chats</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
            >
              New Chat
            </button>
            <button
              onClick={logout}
              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Welcome, {user?.username}!</p>
      </div>

      {/* Users List */}
      {showUsers && (
        <div className="border-b border-gray-200 max-h-48 overflow-y-auto">
          <div className="p-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Start a conversation</h3>
            {users.map((u) => (
              <div
                key={u.id}
                onClick={() => startConversation(u.id, u.username)}
                className="flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded-md"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  {onlineUsers.has(u.id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{u.username}</p>
                  <p className="text-xs text-gray-500">
                    {onlineUsers.has(u.id) ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No conversations yet.</p>
            <p className="text-sm">Click "New Chat" to start chatting!</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.conversation_id}
              onClick={() => onSelectConversation(conv.conversation_id, conv.other_user_id, conv.other_user_name)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedConversation === conv.conversation_id ? 'bg-indigo-50 border-indigo-200' : ''
              }`}
            >
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                    {conv.other_user_name.charAt(0).toUpperCase()}
                  </div>
                  {onlineUsers.has(conv.other_user_id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">{conv.other_user_name}</h3>
                    {conv.last_message_time && (
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-600">
                      {conv.last_message ? formatLastMessage(conv.last_message, conv.last_message_type) : 'Start a conversation'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}