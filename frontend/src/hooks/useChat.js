import { useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export function useChat() {
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/chat/sessions');
      setSessions(response.data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch chat sessions:', err);
      toast.error('Failed to load chat history.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/chat/sessions/${sessionId}`);
      setMessages(response.data.messages || []);
      setActiveSessionId(sessionId);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      toast.error('Failed to load session messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = async (message, mode) => {
    setLoading(true);
    try {
      const response = await api.post('/api/chat', {
        message,
        mode,
        sessionId: activeSessionId
      });

      const { response: aiResponse, sessionId } = response.data;

      // Update state locally to give a fast feel
      const newUserMsg = { id: Math.random().toString(), role: 'user', content: message };
      const newAiMsg = { id: Math.random().toString(), role: 'assistant', content: aiResponse };
      
      setMessages(prev => [...prev, newUserMsg, newAiMsg]);

      if (!activeSessionId) {
        setActiveSessionId(sessionId);
        await fetchSessions();
      }
      return aiResponse;
    } catch (err) {
      console.error('Failed to send chat message:', err);
      toast.error(err.response?.data?.error || 'Failed to send message.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = () => {
    setMessages([]);
    setActiveSessionId(null);
  };

  const deleteSession = async (sessionId) => {
    try {
      await api.delete(`/api/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        startNewSession();
      }
      toast.success('Chat session deleted.');
    } catch (err) {
      console.error('Failed to delete chat session:', err);
      toast.error('Failed to delete chat session.');
    }
  };

  return {
    sessions,
    messages,
    loading,
    activeSessionId,
    setActiveSessionId,
    fetchSessions,
    fetchMessages,
    sendMessage,
    startNewSession,
    deleteSession
  };
}
