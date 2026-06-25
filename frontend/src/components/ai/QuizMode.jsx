import React, { useState } from 'react';
import MCQCard from './MCQCard';
import { Award, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QuizMode({ mcqs, onRetake }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [index]: selectedKey }
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSelectAnswer = (selectedKey) => {
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: selectedKey
    }));
  };

  const currentQuestion = mcqs[currentIndex];
  const isAnswered = answers[currentIndex] !== undefined;

  // Calculate scores and weak topics upon completion
  const calculateResults = () => {
    let correctCount = 0;
    const weakTopicsMap = {};

    mcqs.forEach((q, idx) => {
      const selected = answers[idx];
      if (selected === q.correct) {
        correctCount++;
      } else {
        // Collect weak topics from wrong answers
        if (q.topic) {
          weakTopicsMap[q.topic] = (weakTopicsMap[q.topic] || 0) + 1;
        }
      }
    });

    const weakTopics = Object.keys(weakTopicsMap);
    return {
      score: correctCount,
      percentage: Math.round((correctCount / mcqs.length) * 100),
      weakTopics
    };
  };

  const handleNext = () => {
    if (currentIndex < mcqs.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < mcqs.length) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    setIsSubmitted(true);
    toast.success('Quiz submitted successfully! 🎉');
  };

  if (isSubmitted) {
    const { score, percentage, weakTopics } = calculateResults();

    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/60 p-8 shadow-sm space-y-6 max-w-xl mx-auto text-center transition-all duration-300">
        
        {/* Badge Banner */}
        <div className="inline-flex p-4 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mx-auto">
          <Award className="w-12 h-12 animate-pulse" />
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            Quiz Complete!
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Here is your personalized learning evaluation:
          </p>
        </div>

        {/* Score Ring Display */}
        <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
          <svg className="absolute w-full h-full transform -rotate-90">
            <circle
              cx="72"
              cy="72"
              r="60"
              className="stroke-gray-100 dark:stroke-gray-700 fill-none"
              strokeWidth="10"
            />
            <circle
              cx="72"
              cy="72"
              r="60"
              className="stroke-blue-600 dark:stroke-blue-400 fill-none transition-all duration-1000 ease-out"
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 60}
              strokeDashoffset={2 * Math.PI * 60 * (1 - percentage / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="text-center">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {score}
            </span>
            <span className="text-sm text-gray-400 font-bold"> / {mcqs.length}</span>
            <div className="text-xs text-blue-600 dark:text-blue-400 font-extrabold mt-0.5">
              {percentage}%
            </div>
          </div>
        </div>

        {/* Performance Message */}
        <p className="text-base font-bold text-gray-850 dark:text-gray-300">
          {percentage === 100
            ? 'Perfect score! Outstanding work! 🏆'
            : percentage >= 70
              ? 'Great job! Very strong grasp of the material! 🌟'
              : 'Keep studying! Review your notes and try again! 📚'}
        </p>

        {/* Weak Topic Detection */}
        {weakTopics.length > 0 ? (
          <div className="p-5 bg-rose-50/50 dark:bg-rose-950/15 border border-rose-100/50 dark:border-rose-900/30 rounded-2xl text-left space-y-2.5">
            <h3 className="text-sm font-bold text-rose-800 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Weak Topics Detected (Review Recommended)
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-350 leading-relaxed font-semibold">
              Based on your answers, you had some difficulty with the following sections. We suggest focusing your revision here:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {weakTopics.map((topic, i) => (
                <span
                  key={i}
                  className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-white dark:bg-rose-900/30 border border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-350 rounded-lg shadow-sm"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl text-left space-y-1.5">
            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
              <Award className="w-4 h-4 flex-shrink-0" />
              Perfect Concept Mastery!
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-350 leading-relaxed font-semibold">
              No weak topics detected. You have fully consolidated all concepts from these lecture notes!
            </p>
          </div>
        )}

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 py-3 px-4 border border-gray-250 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-750 dark:text-gray-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Generate New Quiz
          </button>
          
          <button
            type="button"
            onClick={() => {
              // Reset quiz state to retake same questions
              setAnswers({});
              setCurrentIndex(0);
              setIsSubmitted(false);
            }}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Same Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Quiz Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400">
          <span>Question {currentIndex + 1} of {mcqs.length}</span>
          <span>{Math.round(((currentIndex + 1) / mcqs.length) * 100)}% Complete</span>
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / mcqs.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question Card */}
      <MCQCard
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={mcqs.length}
        selectedAnswer={answers[currentIndex] || null}
        onSelectAnswer={handleSelectAnswer}
      />

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="py-3 px-4 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {currentIndex === mcqs.length - 1 ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all"
          >
            Submit Quiz
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!isAnswered}
            className="py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
