import React from 'react';

// Premium badge colors — dark-mode first, harmonious palette
const COLORS = [
  'bg-blue-500/15 text-blue-300 border-blue-500/25',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  'bg-violet-500/15 text-violet-300 border-violet-500/25',
  'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'bg-rose-500/15 text-rose-300 border-rose-500/25',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  'bg-pink-500/15 text-pink-300 border-pink-500/25',
];

export function getSubjectColor(subject) {
  if (!subject) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Badge({ subject }) {
  return (
    <span
      className={`badge ${getSubjectColor(subject)}`}
    >
      {subject}
    </span>
  );
}
