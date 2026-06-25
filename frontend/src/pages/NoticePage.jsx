import React, { useState } from 'react';
import { useAI } from '../hooks/useAI';
import SummaryResult from '../components/ai/SummaryResult';
import FlashcardDeck from '../components/ai/FlashcardDeck';
import QuizMode from '../components/ai/QuizMode';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import { Bell, Sparkles, Send, Library, AlertTriangle, FileText, CheckSquare } from 'lucide-react';
import { parsePhoneList } from '../utils/phone';

export default function NoticePage() {
  const [activeTab, setActiveTab] = useState('notice'); // 'notice' | 'flashcards' | 'quiz'
  const { loading, summarizeNotice, generateFlashcards, generateMCQs } = useAI();

  // Notice summarizer state
  const [noticeText, setNoticeText] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Flashcards state
  const [lectureNotes, setLectureNotes] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [notesError, setNotesError] = useState('');

  // Quiz Mode state
  const [quizNotes, setQuizNotes] = useState('');
  const [quizSubject, setQuizSubject] = useState('');
  const [quizTopic, setQuizTopic] = useState('');
  const [mcqs, setMcqs] = useState([]);
  const [quizError, setQuizError] = useState('');

  // Handle notice summarization
  const handleSummarize = async () => {
    if (!noticeText.trim()) {
      toast.error('Please enter college notice content.');
      return;
    }
    setPhoneError('');
    try {
      const result = await summarizeNotice(noticeText);
      setSummaryData(result);
      toast.success('AI summary generated successfully! ✨');
    } catch (err) {
      // toast shown inside useAI hook
    }
  };

  // Handle WhatsApp broadcast triggering
  const handleBroadcast = async () => {
    if (!summaryData) {
      toast.error('Generate summary first.');
      return;
    }
    if (!phoneInput.trim()) {
      toast.error('Please enter recipient phone numbers.');
      return;
    }

    const { valid, invalid } = parsePhoneList(phoneInput);

    if (invalid.length > 0) {
      setPhoneError(`Invalid numbers: ${invalid.join(', ')} — use format +91XXXXXXXXXX`);
      toast.error('Validation failed: Fix invalid phone number formats.');
      return;
    }

    setPhoneError('');
    try {
      await summarizeNotice(noticeText, valid);
      toast.success(`Sent to ${valid.length} students via WhatsApp! 📲`);
      setPhoneInput('');
    } catch (err) {
      // errors handled by api hooks
    }
  };

  // Handle flashcards generation
  const handleFlashcards = async () => {
    if (!lectureNotes.trim()) {
      setNotesError('Please enter your lecture notes before generating flashcards.');
      toast.error('Validation failed: Lecture notes input is empty.');
      return;
    }
    setNotesError('');
    try {
      const cards = await generateFlashcards(lectureNotes);
      setFlashcards(cards);
      toast.success('Generated study deck! 🧠');
    } catch (err) {
      // errors handled by api hooks
    }
  };

  // Handle Quiz generation
  const handleGenerateQuiz = async () => {
    if (!quizNotes.trim() || !quizSubject.trim() || !quizTopic.trim()) {
      setQuizError('All fields (notes, subject, and topic) are required.');
      toast.error('Validation failed: Fill out all inputs to generate a quiz.');
      return;
    }
    setQuizError('');
    try {
      const questions = await generateMCQs(quizNotes, quizSubject.trim(), quizTopic.trim(), 5);
      setMcqs(questions);
      toast.success('Quiz generated successfully! Go ahead and test yourself. 🎯');
    } catch (err) {
      // errors handled by api hooks
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-slide-up">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/25 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Learning Tools</h1>
          <p className="text-sm text-white/35">Summarize college updates or compile study aids from lecture content.</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-white/[0.03] p-1 rounded-xl max-w-xl border border-white/[0.07]">
        {[{id:'notice',label:'Notice',Icon:Bell},{id:'flashcards',label:'Flashcards',Icon:Library},{id:'quiz',label:'Quiz Mode',Icon:CheckSquare}].map(({id,label,Icon}) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === id
                ? 'bg-gradient-to-r from-blue-500/25 to-indigo-500/20 text-white border border-blue-500/25'
                : 'text-white/35 hover:text-white/55'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Input panel (Left side) */}
        <div className="glass-card p-6 space-y-4">
          
          {activeTab === 'notice' && (
            <>
              <div className="section-header">
                <FileText className="section-header-icon" />
                Raw Notice Text
              </div>
              <textarea
                placeholder="Paste the official notice received on email or notice board here..."
                rows={8}
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                className="input-premium resize-none"
              />
              <button
                type="button"
                onClick={handleSummarize}
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" /> : <><Sparkles className="w-4 h-4" /> Summarize Notice</>}
              </button>
            </>
          )}

          {activeTab === 'flashcards' && (
            <>
              <div className="section-header">
                <Library className="section-header-icon" />
                Lecture Study Notes
              </div>
              <textarea
                placeholder="Paste your lecture notes, slides text, or textbook reference sections here..."
                rows={8}
                value={lectureNotes}
                onChange={(e) => setLectureNotes(e.target.value)}
                className="input-premium resize-none"
              />
              {notesError && (
                <p className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {notesError}
                </p>
              )}
              <button
                type="button"
                onClick={handleFlashcards}
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" /> : <><Library className="w-4 h-4" /> Generate Flashcards</>}
              </button>
            </>
          )}

          {activeTab === 'quiz' && (
            <>
              <div className="section-header">
                <Sparkles className="section-header-icon" />
                AI Study Buddy Quiz
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-premium">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Compiler Design"
                    value={quizSubject}
                    onChange={(e) => setQuizSubject(e.target.value)}
                    className="input-premium"
                  />
                </div>
                <div>
                  <label className="label-premium">Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. LL(1) Parsers"
                    value={quizTopic}
                    onChange={(e) => setQuizTopic(e.target.value)}
                    className="input-premium"
                  />
                </div>
              </div>
              <div>
                <label className="label-premium">Lecture Notes</label>
                <textarea
                  placeholder="Paste lecture notes to be quizzed on..."
                  rows={6}
                  value={quizNotes}
                  onChange={(e) => setQuizNotes(e.target.value)}
                  className="input-premium resize-none"
                />
              </div>
              {quizError && (
                <p className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {quizError}
                </p>
              )}
              <button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" /> : <><Sparkles className="w-4 h-4" /> Generate MCQ Quiz</>}
              </button>
            </>
          )}

        </div>

        {/* Results viewport (Right side) */}
        <div className="space-y-6">
          
          {activeTab === 'notice' && (
            /* Notice Board Summaries / Broadcasts */
            summaryData ? (
              <div className="space-y-6">
                <SummaryResult 
                  summary={summaryData.summary}
                  eventTitle={summaryData.eventTitle}
                  eventDate={summaryData.eventDate}
                />

                {/* Broadcast panel */}
                <div className="glass-card p-5 space-y-4">
                  <div className="section-header">
                    <Send className="section-header-icon" />
                    Broadcast via WhatsApp
                  </div>
                  <div>
                    <label className="label-premium">Recipients (one per line, include country code)</label>
                    <textarea
                      placeholder="+919876543210&#10;+918765432109"
                      rows={4}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="input-premium resize-none text-xs"
                    />
                    <span className="text-[10px] text-white/25 mt-1.5 block">
                      Format: +91XXXXXXXXXX — one number per line
                    </span>
                    {phoneError && (
                      <p className="mt-1.5 text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {phoneError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleBroadcast}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    Broadcast WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card p-10 min-h-[300px] flex flex-col justify-center items-center text-center border-dashed">
                <Bell className="w-10 h-10 text-white/15 mb-3" />
                <p className="text-sm text-white/30 max-w-xs leading-relaxed">
                  Paste a college notice to get an AI summary and broadcast it via WhatsApp.
                </p>
              </div>
            )
          )}

          {activeTab === 'flashcards' && (
            flashcards.length > 0 ? (
              <FlashcardDeck flashcards={flashcards} />
            ) : (
              <div className="glass-card p-10 min-h-[300px] flex flex-col justify-center items-center text-center border-dashed">
                <Library className="w-10 h-10 text-white/15 mb-3" />
                <p className="text-sm text-white/30 max-w-xs leading-relaxed">
                  Generate concept cards from lecture slides to study and flip.
                </p>
              </div>
            )
          )}

          {activeTab === 'quiz' && (
            mcqs.length > 0 ? (
              <QuizMode mcqs={mcqs} onRetake={() => setMcqs([])} />
            ) : (
              loading ? (
                <div className="glass-card p-10 min-h-[300px] flex flex-col justify-center items-center text-center">
                  <Spinner size="lg" className="mb-4" />
                  <p className="text-sm text-white/35 leading-relaxed max-w-xs">
                    AI study buddy is analyzing notes and generating MCQs... 🎯
                  </p>
                </div>
              ) : (
                <div className="glass-card p-10 min-h-[300px] flex flex-col justify-center items-center text-center border-dashed">
                  <CheckSquare className="w-10 h-10 text-white/15 mb-3" />
                  <p className="text-sm text-white/30 max-w-xs leading-relaxed">
                    Fill out the quiz generator on the left to start an interactive MCQ session.
                  </p>
                </div>
              )
            )
          )}

        </div>

      </div>

    </div>
  );
}
