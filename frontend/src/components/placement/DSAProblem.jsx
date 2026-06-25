import React, { useState } from 'react';
import { Lightbulb, BookOpen, AlertCircle, Terminal, HelpCircle, Eye, EyeOff } from 'lucide-react';

export default function DSAProblem({ problem }) {
  const [showSolution, setShowSolution] = useState(false);
  const [activeHintIdx, setActiveHintIdx] = useState(null);

  if (!problem) return null;

  const {
    title,
    description,
    constraints,
    sampleInput,
    sampleOutput,
    hints,
    editorial,
    solution,
    timeComplexity,
    spaceComplexity
  } = problem;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* Title */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg">
          Original DSA Problem
        </span>
        <h3 className="text-lg font-black text-gray-900 dark:text-white mt-2">
          {title}
        </h3>
      </div>

      {/* Description */}
      <div className="text-xs text-gray-750 dark:text-gray-300 leading-relaxed font-semibold whitespace-pre-wrap">
        {description}
      </div>

      {/* Constraints */}
      {constraints && constraints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Constraints
          </h4>
          <ul className="list-disc list-inside pl-1 text-[10px] text-gray-500 dark:text-gray-400 space-y-1 font-semibold">
            {constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sample Cases */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sampleInput && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Sample Input
            </h4>
            <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl text-[10px] font-mono border border-gray-150 dark:border-gray-750 overflow-x-auto text-gray-750 dark:text-gray-300">
              {sampleInput}
            </pre>
          </div>
        )}
        
        {sampleOutput && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Sample Output
            </h4>
            <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl text-[10px] font-mono border border-gray-150 dark:border-gray-750 overflow-x-auto text-gray-750 dark:text-gray-300">
              {sampleOutput}
            </pre>
          </div>
        )}
      </div>

      {/* Hints Accordion */}
      {hints && hints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            Hints
          </h4>
          <div className="space-y-1.5">
            {hints.map((hint, idx) => {
              const isActive = activeHintIdx === idx;
              return (
                <div key={idx} className="border border-gray-150 dark:border-gray-750 rounded-xl overflow-hidden text-[10px] font-semibold bg-gray-50/20 dark:bg-gray-900/5">
                  <button
                    type="button"
                    onClick={() => setActiveHintIdx(isActive ? null : idx)}
                    className="w-full p-3 text-left font-bold text-gray-700 dark:text-gray-300 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-750/30"
                  >
                    <span>Hint {idx + 1}</span>
                    <span className="text-gray-400">{isActive ? 'Hide' : 'Reveal'}</span>
                  </button>
                  {isActive && (
                    <div className="p-3.5 border-t border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 leading-relaxed">
                      {hint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Editorial Solution block */}
      <div className="border border-purple-100 dark:border-purple-900/30 bg-purple-50/10 dark:bg-purple-950/5 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-purple-800 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            Editorial & Solution
          </h4>
          <button
            type="button"
            onClick={() => setShowSolution(!showSolution)}
            className="text-[10px] font-black text-purple-700 dark:text-purple-400 flex items-center gap-1.5 hover:underline"
          >
            {showSolution ? (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Hide Code
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Reveal Code
              </>
            )}
          </button>
        </div>

        {showSolution && (
          <div className="space-y-4 pt-1 transition-all duration-300">
            {/* Complexity Badges */}
            <div className="flex gap-2 text-[9px] font-black">
              <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 border border-purple-150 dark:border-purple-800/40 text-purple-800 dark:text-purple-350 rounded-lg">
                Time Complexity: {timeComplexity || 'O(N)'}
              </span>
              <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 border border-purple-150 dark:border-purple-800/40 text-purple-800 dark:text-purple-350 rounded-lg">
                Space Complexity: {spaceComplexity || 'O(1)'}
              </span>
            </div>

            {/* Editorial explanation */}
            {editorial && (
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                {editorial}
              </p>
            )}

            {/* Code Solution box */}
            {solution && (
              <div className="space-y-1.5">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Reference Implementation (C++)
                </h5>
                <pre className="p-4 bg-gray-950 text-emerald-400 rounded-2xl text-[10px] font-mono overflow-x-auto shadow-md">
                  {solution}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
