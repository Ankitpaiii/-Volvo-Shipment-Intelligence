import React from 'react';
import { BookOpen, Briefcase, Rocket, Palette, MessageSquare } from 'lucide-react';

export default function ModeSelector({ activeMode, onChange, disabled }) {
  const modes = [
    { id: 'study', label: 'Study AI', icon: <BookOpen className="w-4 h-4" />, desc: 'B.Tech concepts & prep' },
    { id: 'placement', label: 'Placement Coach', icon: <Briefcase className="w-4 h-4" />, desc: 'DSA, resume, mock tips' },
    { id: 'startup', label: 'Startup Mentor', icon: <Rocket className="w-4 h-4" />, desc: ' TAM, swot, business validator' },
    { id: 'creator', label: 'Creator Advisor', icon: <Palette className="w-4 h-4" />, desc: 'Creative engineering & writing' },
    { id: 'general', label: 'General Bot', icon: <MessageSquare className="w-4 h-4" />, desc: 'Daily college life assistant' }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full">
      {modes.map(mode => {
        const isSelected = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode.id)}
            className={`p-3.5 border rounded-2xl text-left transition-all relative flex flex-col justify-between gap-1.5 cursor-pointer select-none ${
              isSelected
                ? 'border-blue-500 bg-blue-50/45 dark:bg-blue-955/20 text-blue-900 dark:text-blue-300 font-bold'
                : 'border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-750/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-lg border ${
                isSelected 
                  ? 'bg-blue-600 border-blue-500 text-white' 
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-250/20 text-gray-400'
              }`}>
                {mode.icon}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider">{mode.label}</span>
            </div>
            <span className="text-[9px] text-gray-400 font-medium leading-tight line-clamp-1">
              {mode.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
