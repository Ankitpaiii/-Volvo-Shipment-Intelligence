import React from 'react';
import { Sparkles, Star, Calendar, UserPlus } from 'lucide-react';

export default function MatchResults({ matchData, onInvite }) {
  if (!matchData) return null;

  const { matches = [], suggestedGroupName, suggestedSchedule } = matchData;

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/30';
    if (score >= 60) return 'text-amber-500 bg-amber-50/50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/30';
    return 'text-blue-500 bg-blue-50/50 dark:bg-blue-950/20 border-blue-250 dark:border-blue-900/30';
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* AI Suggestion Header */}
      <div className="space-y-1.5 border-b border-gray-150 dark:border-gray-700/60 pb-4">
        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg flex items-center gap-1 w-max">
          <Sparkles className="w-3.5 h-3.5" /> AI study buddy matching
        </span>
        
        {suggestedGroupName && (
          <h3 className="text-sm font-black text-gray-900 dark:text-white pt-1">
            Suggested Group Name: <span className="text-blue-600 dark:text-blue-450">"{suggestedGroupName}"</span>
          </h3>
        )}

        {suggestedSchedule && (
          <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5 mt-1">
            <Calendar className="w-3.5 h-3.5 text-gray-300" />
            Suggested Timing: {suggestedSchedule}
          </p>
        )}
      </div>

      {/* Partners List */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Suggested Classmate Partners
        </h4>

        {matches.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">No matching partners found at this time.</p>
        ) : (
          <div className="space-y-2.5">
            {matches.map((partner, idx) => {
              return (
                <div
                  key={idx}
                  className="p-4 border border-gray-150 dark:border-gray-755 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/20 dark:bg-gray-900/5 hover:border-blue-150 dark:hover:border-blue-900/30 transition-all"
                >
                  <div className="space-y-1 truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {partner.name}
                      </span>
                      <span className="text-[9px] text-gray-400 font-bold">
                        Yr {partner.year} {partner.branch}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                      {partner.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0 self-end sm:self-center">
                    {/* Compatibility Score badge */}
                    <span className={`text-[10px] font-black px-2.5 py-1 border rounded-lg flex items-center gap-1 ${getScoreColor(partner.compatibilityScore)}`}>
                      <Star className="w-3 h-3 fill-current" />
                      {partner.compatibilityScore}% Match
                    </span>

                    {onInvite && (
                      <button
                        type="button"
                        onClick={() => onInvite(partner.studentId, partner.name)}
                        className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-105 dark:border-blue-900/40 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Add to invite list"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
