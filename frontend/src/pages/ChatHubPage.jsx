import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ModeSelector from '../components/chat/ModeSelector';
import Spinner from '../components/ui/Spinner';
import { Plus, MessageSquare, Trash2, Menu, X, Sparkles } from 'lucide-react';

export default function ChatHubPage() {
  const {
    sessions,
    messages,
    loading,
    activeSessionId,
    fetchSessions,
    fetchMessages,
    sendMessage,
    startNewSession,
    deleteSession
  } = useChat();

  const [activeMode, setActiveMode] = useState('study');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-scroll messages list to the bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text) => {
    try {
      await sendMessage(text, activeMode);
    } catch (err) {
      // error handled in useChat
    }
  };

  const handleSelectSession = (sessionId, mode) => {
    fetchMessages(sessionId);
    setActiveMode(mode);
    setSidebarOpen(false); // Close sidebar on mobile
  };

  const handleNewChat = () => {
    startNewSession();
    setSidebarOpen(false);
  };

  return (
    <div className="flex bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-gray-200 dark:border-gray-800/80 overflow-hidden h-[calc(100vh-140px)] relative">
      
      {/* 1. Mobile Sidebar toggle button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-40 p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-blue-600 block md:hidden"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* 2. Conversations Sidebar */}
      <div className={`w-[260px] border-r border-gray-200 dark:border-gray-800/80 bg-white dark:bg-gray-850 flex-shrink-0 flex flex-col justify-between absolute md:static top-0 bottom-0 left-0 z-30 transition-transform duration-300 md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4 flex flex-col gap-4 overflow-hidden h-full">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Conversation
          </button>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-2 mb-2">
              Recent Chats
            </h3>

            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[10px] text-gray-400 font-semibold italic">No previous chats.</p>
              </div>
            ) : (
              sessions.map(sess => {
                const isSelected = activeSessionId === sess.id;
                return (
                  <div
                    key={sess.id}
                    className={`group w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all relative ${
                      isSelected
                        ? 'border-blue-150 bg-blue-50/45 dark:bg-blue-955/20 text-blue-900 dark:text-blue-300'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-750/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSession(sess.id, sess.mode)}
                      className="flex-1 text-left truncate flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{sess.title || 'Conversation'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(sess.id)}
                      className="text-gray-300 hover:text-rose-500 dark:text-gray-600 dark:hover:text-rose-400 transition-colors p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Chat Viewport */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden bg-gray-50/20 dark:bg-gray-900/5 h-full p-4 md:p-6 space-y-4">
        
        {/* Mode switcher tabs */}
        <div className="w-full pl-12 md:pl-0">
          <ModeSelector
            activeMode={activeMode}
            onChange={(mode) => {
              setActiveMode(mode);
              if (!activeSessionId) {
                toast(`Chat mode switched to ${mode.toUpperCase()} AI.`);
              }
            }}
            disabled={messages.length > 0} // Fix the active session's mode once messages are sent
          />
        </div>

        {/* Message logs view */}
        <div className="flex-1 overflow-y-auto border border-gray-200/50 dark:border-gray-800/50 bg-white dark:bg-gray-850 rounded-3xl p-4 md:p-6 shadow-inner space-y-4">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 border border-blue-100 dark:border-blue-900/20 mb-4 animate-bounce">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                AI Chat Hub
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-4 leading-relaxed font-semibold">
                Select a workspace module above (Study, Placement, Startup, Creator, General) and begin a dictation or text-based conversation session.
              </p>
              
              <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-750 text-[10px] text-gray-400 font-bold max-w-xs rounded-2xl flex items-center justify-center gap-2">
                <span>⚡ Voice dictation supported offline</span>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {messages.map(msg => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 pl-4 py-2">
                    <Spinner size="sm" />
                    <span>AI Study Buddy is formulating response...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>

        {/* Text Input console */}
        <div className="w-full">
          <ChatInput onSend={handleSend} disabled={loading} />
        </div>

      </div>

    </div>
  );
}
