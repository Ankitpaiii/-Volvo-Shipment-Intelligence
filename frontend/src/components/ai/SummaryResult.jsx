import React from 'react';
import { Calendar, FileText, Sparkles } from 'lucide-react';

export default function SummaryResult({ summary = [], eventTitle, eventDate }) {
  if (!summary || summary.length === 0) return null;

  return (
    <div className="glass-card p-6 space-y-4 animate-slide-up">

      {/* Header */}
      <div className="section-header border-b border-white/[0.05] pb-3">
        <FileText className="section-header-icon" />
        Notice Summary
        <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-1" />
      </div>

      {/* Bullet Points */}
      <ul className="space-y-2.5">
        {summary.map((point, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">
              {idx + 1}
            </span>
            <span className="text-sm text-white/65 font-medium leading-relaxed pt-0.5">
              {point}
            </span>
          </li>
        ))}
      </ul>

      {/* Calendar Event Detection */}
      {(eventTitle || eventDate) && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider">
              Detected Calendar Event
            </span>
          </div>
          <div className="text-sm font-bold text-indigo-200">
            {eventTitle || 'College Event'}
          </div>
          {eventDate && (
            <div className="text-xs text-indigo-300/50">
              {new Date(eventDate).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
