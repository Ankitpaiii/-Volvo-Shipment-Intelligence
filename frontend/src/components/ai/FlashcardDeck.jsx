import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, HelpCircle, CheckCircle } from 'lucide-react';

export default function FlashcardDeck({ flashcards = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) return null;

  const currentCard = flashcards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150); // Small delay to let card unflip before loading next content
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const handleReset = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(0);
    }, 150);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* 3D Transform Styles */}
      <style>{`
        .flashcard-perspective {
          perspective: 1000px;
        }
        .flashcard-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        .flashcard-inner.flipped {
          transform: rotateY(180deg);
        }
        .flashcard-front, .flashcard-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 1.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        .flashcard-back {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Counter */}
      <div className="flex items-center justify-between text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        <span>Concept Deck</span>
        <span>{currentIndex + 1} of {flashcards.length}</span>
      </div>

      {/* Flip Card Container */}
      <div 
        className="flashcard-perspective h-64 w-full cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
          
          {/* Front (Question) */}
          <div className="flashcard-front bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex flex-col justify-between p-6">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="text-center font-bold text-lg md:text-xl py-4 flex-1 flex items-center justify-center">
              {currentCard?.question}
            </div>
            <div className="text-[10px] text-blue-100 uppercase tracking-widest text-center font-bold bg-white/10 py-1.5 rounded-xl">
              Click Card to Reveal Answer
            </div>
          </div>

          {/* Back (Answer) */}
          <div className="flashcard-back bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-150 flex flex-col justify-between p-6">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="text-center font-semibold text-base py-4 flex-1 flex items-center justify-center overflow-y-auto leading-relaxed">
              {currentCard?.answer}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center font-bold bg-emerald-50 dark:bg-emerald-950/10 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-950/30">
              Answer Checked
            </div>
          </div>

        </div>
      </div>

      {/* Progress Dots Indicator */}
      <div className="flex justify-center gap-1.5">
        {flashcards.map((_, idx) => (
          <div
            key={idx}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-6 bg-blue-600 dark:bg-blue-450' : 'w-2 bg-gray-200 dark:bg-gray-700'
            }`}
          ></div>
        ))}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handlePrev}
          className="flex-1 py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="p-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-750 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl transition"
          title="Restart Deck"
        >
          <RotateCcw className="w-4.5 h-4.5" />
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex-1 py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
        >
          Next
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
