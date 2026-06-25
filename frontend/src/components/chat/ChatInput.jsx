import React, { useState } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  // Dictation handler (Web Speech API)
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input (Speech Recognition) is not supported in this browser.');
      return;
    }

    if (isListening) {
      if (recognitionInstance) recognitionInstance.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast('Dictation active: Speak now... 🎙️');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setText(prev => prev + (prev ? ' ' : '') + transcript);
      };

      recognition.onerror = (err) => {
        console.error('Speech recognition error:', err);
        if (err.error !== 'no-speech') {
          toast.error('Failed to dictate speech. Please try again.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognitionInstance(recognition);
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      
      {/* Voice mic dictation */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleListening}
        className={`p-3.5 rounded-2xl border transition-all flex-shrink-0 cursor-pointer ${
          isListening
            ? 'bg-rose-50 dark:bg-rose-955/20 border-rose-400 text-rose-600 animate-pulse'
            : 'bg-gray-50/50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 hover:border-blue-300'
        }`}
      >
        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {/* Input textbox */}
      <input
        type="text"
        disabled={disabled}
        placeholder={isListening ? "Listening... speak now" : "Ask your AI Study Buddy anything..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 p-3.5 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold focus:outline-none text-gray-850 dark:text-white"
      />

      {/* Send message button */}
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
      >
        <Send className="w-5 h-5" />
      </button>

    </form>
  );
}
