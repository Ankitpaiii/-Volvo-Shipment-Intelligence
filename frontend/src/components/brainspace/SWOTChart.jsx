import React from 'react';
import { Shield, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';

export default function SWOTChart({ swot }) {
  if (!swot) return null;

  const { strengths = [], weaknesses = [], opportunities = [], threats = [] } = swot;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      
      {/* Strengths */}
      <div className="p-5 bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-100/50 dark:border-emerald-900/30 rounded-3xl space-y-2">
        <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-450 flex items-center gap-1.5 uppercase tracking-wider">
          <Shield className="w-4 h-4 text-emerald-500" />
          Strengths
        </h4>
        <ul className="list-disc list-inside text-[11px] text-emerald-700 dark:text-emerald-350 pl-1 space-y-1 font-semibold leading-relaxed">
          {strengths.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Weaknesses */}
      <div className="p-5 bg-rose-50/20 dark:bg-rose-955/5 border border-rose-100/50 dark:border-rose-900/30 rounded-3xl space-y-2">
        <h4 className="text-xs font-black text-rose-800 dark:text-rose-450 flex items-center gap-1.5 uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Weaknesses
        </h4>
        <ul className="list-disc list-inside text-[11px] text-rose-700 dark:text-rose-350 pl-1 space-y-1 font-semibold leading-relaxed">
          {weaknesses.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Opportunities */}
      <div className="p-5 bg-amber-50/20 dark:bg-amber-955/5 border border-amber-100/50 dark:border-amber-900/30 rounded-3xl space-y-2">
        <h4 className="text-xs font-black text-amber-800 dark:text-amber-450 flex items-center gap-1.5 uppercase tracking-wider">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          Opportunities
        </h4>
        <ul className="list-disc list-inside text-[11px] text-amber-700 dark:text-amber-350 pl-1 space-y-1 font-semibold leading-relaxed">
          {opportunities.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Threats */}
      <div className="p-5 bg-blue-50/20 dark:bg-blue-955/5 border border-blue-100/50 dark:border-blue-900/30 rounded-3xl space-y-2">
        <h4 className="text-xs font-black text-blue-800 dark:text-blue-450 flex items-center gap-1.5 uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4 text-blue-500" />
          Threats
        </h4>
        <ul className="list-disc list-inside text-[11px] text-blue-700 dark:text-blue-350 pl-1 space-y-1 font-semibold leading-relaxed">
          {threats.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

    </div>
  );
}
