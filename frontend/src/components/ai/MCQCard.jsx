import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function MCQCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer
}) {
  const { question: qText, options, correct, explanation, topic } = question;

  const handleOptionClick = (key) => {
    if (selectedAnswer) return; // Prevent changing answer once selected
    onSelectAnswer(key);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/60 p-6 shadow-sm space-y-5 transition-all duration-300">
      
      {/* Meta indicators */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg">
          Question {questionNumber} of {totalQuestions}
        </span>
        {topic && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-gray-150/70 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg">
            Topic: {topic}
          </span>
        )}
      </div>

      {/* Question text */}
      <h3 className="text-base font-bold text-gray-900 dark:text-white leading-relaxed">
        {qText}
      </h3>

      {/* Options list */}
      <div className="space-y-3">
        {Object.entries(options).map(([key, value]) => {
          const isSelected = selectedAnswer === key;
          const isCorrect = key === correct;
          const showAnswerStates = selectedAnswer !== null;

          let btnClass = 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750/30 text-gray-750 dark:text-gray-300';
          let icon = null;

          if (showAnswerStates) {
            if (isCorrect) {
              btnClass = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300';
              icon = <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
            } else if (isSelected) {
              btnClass = 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300';
              icon = <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />;
            } else {
              btnClass = 'border-gray-150 dark:border-gray-750/50 text-gray-400 dark:text-gray-500 opacity-60';
            }
          } else if (isSelected) {
            btnClass = 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300';
          }

          return (
            <button
              key={key}
              type="button"
              disabled={showAnswerStates}
              onClick={() => handleOptionClick(key)}
              className={`w-full p-4 border text-left rounded-2xl text-sm font-semibold flex items-center justify-between gap-3 transition-all duration-200 ${btnClass}`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black transition-all ${
                  showAnswerStates
                    ? isCorrect
                      ? 'bg-emerald-500 text-white'
                      : isSelected
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-blue-500 group-hover:text-white'
                }`}>
                  {key}
                </span>
                <span className="leading-relaxed">{value}</span>
              </div>
              {icon}
            </button>
          );
        })}
      </div>

      {/* Explanation section */}
      {selectedAnswer && explanation && (
        <div className="p-4 bg-blue-50/30 dark:bg-blue-950/10 border border-blue-150/45 dark:border-blue-900/25 rounded-2xl space-y-1 transition-all duration-300">
          <h4 className="text-xs font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider">
            Explanation
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-semibold">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
