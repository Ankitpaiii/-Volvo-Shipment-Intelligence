import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, Sparkles } from 'lucide-react';

export default function ResumeResult({ analysis }) {
  if (!analysis) return null;

  const {
    atsScore,
    missingKeywords,
    improvements,
    strengths,
    weaknesses,
    overallFeedback
  } = analysis;

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500';
    if (score >= 60) return 'text-amber-500 border-amber-500';
    return 'text-rose-500 border-rose-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* Score Header */}
      <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-gray-150 dark:border-gray-700/60">
        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center flex-shrink-0 ${getScoreColor(atsScore)}`}>
          <div className="text-center">
            <span className="text-2xl font-black">{atsScore}</span>
            <span className="text-[10px] font-bold block -mt-1">ATS Score</span>
          </div>
        </div>
        
        <div className="text-center sm:text-left space-y-1">
          <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg">
            ATS Score Report
          </span>
          <h3 className="text-sm font-black text-gray-900 dark:text-white pt-1">
            Resume Compatibility Evaluation
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">
            {overallFeedback}
          </p>
        </div>
      </div>

      {/* Missing Keywords tags */}
      {missingKeywords && missingKeywords.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Missing Keywords (Recommended additions)
          </h4>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {missingKeywords.map((word, i) => (
              <span
                key={i}
                className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-blue-50/50 dark:bg-blue-900/25 border border-blue-100 dark:border-blue-900/30 text-blue-800 dark:text-blue-350 rounded-lg"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Strengths */}
        {strengths && strengths.length > 0 && (
          <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-100/50 dark:border-emerald-900/20 rounded-2xl space-y-2">
            <h4 className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Strengths
            </h4>
            <ul className="list-disc list-inside text-[10px] text-emerald-700 dark:text-emerald-350 pl-1 space-y-1 font-semibold">
              {strengths.map((str, i) => (
                <li key={i}>{str}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {weaknesses && weaknesses.length > 0 && (
          <div className="p-4 bg-rose-50/20 dark:bg-rose-950/5 border border-rose-100/50 dark:border-rose-900/20 rounded-2xl space-y-2">
            <h4 className="text-[10px] font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Areas of Concern
            </h4>
            <ul className="list-disc list-inside text-[10px] text-rose-700 dark:text-rose-350 pl-1 space-y-1 font-semibold">
              {weaknesses.map((weak, i) => (
                <li key={i}>{weak}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Section-by-section improvements list */}
      {improvements && improvements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-purple-500" />
            Section Improvements Checklist
          </h4>
          
          <div className="space-y-2">
            {improvements.map((item, i) => (
              <div
                key={i}
                className="p-3 border border-gray-150 dark:border-gray-750 rounded-xl text-[10px] font-semibold flex items-start gap-2.5 bg-gray-50/20 dark:bg-gray-900/5"
              >
                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-black text-[8px] uppercase tracking-wider mt-0.5">
                  {item.section || 'General'}
                </span>
                <span className="text-gray-600 dark:text-gray-400 leading-relaxed font-semibold">
                  {item.suggestion}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
