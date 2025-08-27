'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/ChatSidebar';
import ChatWindow from '@/components/ChatWindow';

export default function ChatPage() {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  const handleSelectConversation = (conversationId: number, otherUserId: number, otherUserName: string) => {
    setSelectedConversation(conversationId);
    setSelectedUserId(otherUserId);
    setSelectedUserName(otherUserName);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <ChatSidebar
        selectedConversation={selectedConversation}
        onSelectConversation={handleSelectConversation}
      />
      <ChatWindow
        conversationId={selectedConversation}
        otherUserId={selectedUserId}
        otherUserName={selectedUserName}
      />
    </div>
  );
}