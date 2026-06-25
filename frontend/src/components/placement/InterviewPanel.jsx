import React, { useState } from 'react';
import { Mic, MicOff, ChevronRight, ChevronLeft, Award, HelpCircle, AlertCircle, MessageSquare } from 'lucide-react';
import Spinner from '../ui/Spinner';
import toast from 'react-hot-toast';

export default function InterviewPanel({ interview, onSubmitAnswers }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [index]: answerText }
  const [currentAnswerInput, setCurrentAnswerInput] = useState('');
  
  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState(null);

  // Evaluation states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  const { questions, interviewType, overallAdvice } = interview;

  // Handle Speech Recognition Input (Web Speech API)
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
        toast('Listening... Speak your answer now! 🎙️');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setCurrentAnswerInput(prev => prev + (prev ? ' ' : '') + transcript);
      };

      recognition.onerror = (err) => {
        console.error('Speech error:', err);
        if (err.error !== 'no-speech') {
          toast.error('Voice input failed. Please speak clearly or write your response.');
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

  const handleNext = () => {
    // Save current answer
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: currentAnswerInput
    }));

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentAnswerInput(answers[nextIndex] || '');
    }
  };

  const handlePrev = () => {
    // Save current answer
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: currentAnswerInput
    }));

    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setCurrentAnswerInput(answers[prevIndex] || '');
    }
  };

  const handleSubmit = async () => {
    // Save current answer first
    const finalAnswers = {
      ...answers,
      [currentIndex]: currentAnswerInput
    };
    setAnswers(finalAnswers);

    const questionsList = questions.map(q => q.question);
    const answersList = questions.map((_, idx) => finalAnswers[idx] || 'No answer provided');

    setIsSubmitting(true);
    try {
      const evalData = await onSubmitAnswers(questionsList, answersList);
      setEvaluation(evalData);
      toast.success('Interview evaluation complete! Review your scores below. 📝');
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit interview answers for grading.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  if (evaluation) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Results Banner Header */}
        <div className="text-center space-y-2 border-b border-gray-150 dark:border-gray-700/60 pb-5">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg">
            Evaluation Result
          </span>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            Grade report for {interviewType || 'Mock Interview'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
            {evaluation.overallFeedback}
          </p>
        </div>

        {/* Global Grades Breakdown Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-4 border border-gray-150 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-900/10 rounded-2xl">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Overall</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">{evaluation.overallScore}%</span>
          </div>
          <div className="p-4 border border-gray-150 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-900/10 rounded-2xl">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Technical</span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-450">{evaluation.technicalScore}%</span>
          </div>
          <div className="p-4 border border-gray-150 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-900/10 rounded-2xl">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Comm.</span>
            <span className="text-lg font-black text-purple-600 dark:text-purple-450">{evaluation.communicationScore}%</span>
          </div>
        </div>

        {/* Detailed questions responses feedback */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Detailed Review
          </h4>
          
          <div className="space-y-3">
            {evaluation.evaluations?.map((item, idx) => {
              const qNum = item.questionIndex || idx + 1;
              const qText = questions[qNum - 1]?.question || 'Question';
              const isLowScore = item.score < 60;

              return (
                <div
                  key={idx}
                  className={`p-4 border rounded-2xl space-y-2.5 transition-all bg-gray-50/30 dark:bg-gray-900/5 ${
                    isLowScore
                      ? 'border-rose-150 dark:border-rose-950/20'
                      : 'border-gray-150 dark:border-gray-750'
                  }`}
                >
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs font-black text-gray-900 dark:text-white">
                      Q{qNum}: {qText}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                      isLowScore 
                        ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-350'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-350'
                    }`}>
                      Score: {item.score}%
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-600 dark:text-gray-400 font-semibold leading-relaxed">
                    <strong className="text-gray-800 dark:text-gray-300">Feedback: </strong> {item.feedback}
                  </p>

                  {item.improvementAreas && item.improvementAreas.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-purple-700 dark:text-purple-400 tracking-wider">
                        Suggested Improvements
                      </span>
                      <ul className="list-disc list-inside text-[10px] text-purple-800 dark:text-purple-350 pl-1 space-y-0.5 font-semibold">
                        {item.improvementAreas.map((imp, i) => (
                          <li key={i}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Recommendations list */}
        {evaluation.improvementAreas && evaluation.improvementAreas.length > 0 && (
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/15 border border-amber-100/50 dark:border-amber-900/30 rounded-2xl space-y-2">
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              General Improvement Plan
            </h4>
            <ul className="list-disc list-inside text-[10px] text-amber-700 dark:text-amber-350 pl-1 space-y-1 font-semibold leading-relaxed">
              {evaluation.improvementAreas.map((area, i) => (
                <li key={i}>{area}</li>
              ))}
            </ul>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm space-y-5">
      
      {/* Progress Header */}
      <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-150 dark:border-gray-700 pb-3">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <span>{interviewType || 'Placement Mock Practice'}</span>
      </div>

      {/* Question prompt */}
      <div className="space-y-1">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
          Interviewer Prompt
        </h4>
        <p className="text-sm font-bold text-gray-850 dark:text-white leading-relaxed">
          {currentQuestion.question}
        </p>
      </div>

      {/* Answer Area */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Your Response
          </label>
          
          {/* Micro Web Speech Input trigger */}
          <button
            type="button"
            onClick={toggleListening}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
              isListening
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-400 text-rose-600 animate-pulse'
                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5" /> Stop Mic
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" /> Speak Answer
              </>
            )}
          </button>
        </div>

        <textarea
          rows={6}
          placeholder="Type or dictate your response to this interview question..."
          value={currentAnswerInput}
          onChange={(e) => setCurrentAnswerInput(e.target.value)}
          className="w-full p-4 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 leading-relaxed font-semibold"
        ></textarea>
      </div>

      {/* Accordion Tip block */}
      {currentQuestion.tips && (
        <div className="p-3 bg-blue-50/30 dark:bg-blue-950/10 border border-blue-150/40 dark:border-blue-900/30 rounded-xl space-y-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
            Tip for this question
          </span>
          <p className="text-[10px] text-blue-800 dark:text-blue-300 font-semibold leading-relaxed">
            {currentQuestion.tips}
          </p>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between gap-4 border-t border-gray-150 dark:border-gray-700 pt-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="py-2.5 px-4 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        {currentIndex === questions.length - 1 ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" /> Evaluating...
              </>
            ) : (
              'Submit Interview'
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all"
          >
            Next Question
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

    </div>
  );
}
