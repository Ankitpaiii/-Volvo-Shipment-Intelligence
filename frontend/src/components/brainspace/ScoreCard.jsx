import React from 'react';
import { AlertCircle, Gauge, Cpu } from 'lucide-react';

export default function ScoreCard({ riskScore, feasibilityScore, scalabilityScore }) {
  const getProgressColor = (score, isRisk = false) => {
    if (isRisk) {
      if (score >= 70) return 'bg-rose-500';
      if (score >= 40) return 'bg-amber-500';
      return 'bg-emerald-500';
    }
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 50) return 'bg-blue-500';
    return 'bg-rose-500';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      
      {/* Feasibility score */}
      <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-750 p-5 rounded-3xl shadow-sm space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-gray-800 dark:text-gray-200">
          <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-gray-400">
            <Gauge className="w-4 h-4 text-emerald-500" />
            Feasibility Score
          </span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{feasibilityScore}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${getProgressColor(feasibilityScore)}`}
            style={{ width: `${feasibilityScore}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-gray-400 font-bold leading-normal">
          {feasibilityScore >= 75
            ? 'High probability of implementation. Low dependency risks.'
            : feasibilityScore >= 50
              ? 'Moderate build challenges. Requires dedicated resources.'
              : 'Complex technical requirements or strict regulation barriers.'}
        </p>
      </div>

      {/* Scalability score */}
      <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-750 p-5 rounded-3xl shadow-sm space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-gray-800 dark:text-gray-200">
          <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-gray-400">
            <Cpu className="w-4 h-4 text-purple-500" />
            Scalability Score
          </span>
          <span className="text-sm font-black text-purple-600 dark:text-purple-400">{scalabilityScore}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${getProgressColor(scalabilityScore)}`}
            style={{ width: `${scalabilityScore}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-gray-400 font-bold leading-normal">
          {scalabilityScore >= 75
            ? 'Viral potential. Low marginal cost of customer acquisition.'
            : scalabilityScore >= 50
              ? 'Steady local margins. Expanding requires standard resources.'
              : 'Consulting-heavy or linear growth model. High support overhead.'}
        </p>
      </div>

      {/* Risk score */}
      <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-750 p-5 rounded-3xl shadow-sm space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-gray-800 dark:text-gray-200">
          <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-gray-400">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            Market Risk Score
          </span>
          <span className="text-sm font-black text-rose-600 dark:text-rose-400">{riskScore}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${getProgressColor(riskScore, true)}`}
            style={{ width: `${riskScore}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-gray-400 font-bold leading-normal">
          {riskScore >= 70
            ? 'High market competition or replacement alternatives exist.'
            : riskScore >= 40
              ? 'Standard market validation risk. Focus on unique value.'
              : 'First-mover potential or highly specialized domain validation.'}
        </p>
      </div>

    </div>
  );
}
