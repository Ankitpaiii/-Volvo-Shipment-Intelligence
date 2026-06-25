import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function AttendanceAlert({ alerts = [], overallTip }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-4 animate-slide-up">
      <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Analysis Results</h3>

      {/* Subject Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {alerts.map((alert, idx) => {
          const { subject, currentPercent, classesNeeded, isAtRisk } = alert;
          const pct = typeof currentPercent === 'number' ? currentPercent.toFixed(1) : '—';
          const fillWidth = Math.min(currentPercent || 0, 100);

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                isAtRisk
                  ? 'bg-rose-500/10 border-rose-500/25'
                  : 'bg-emerald-500/10 border-emerald-500/25'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isAtRisk ? 'bg-rose-500/15' : 'bg-emerald-500/15'
                }`}>
                  {isAtRisk
                    ? <AlertCircle className="w-4 h-4 text-rose-400" />
                    : <CheckCircle className="w-4 h-4 text-emerald-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-xs font-bold truncate ${
                    isAtRisk ? 'text-rose-300' : 'text-emerald-300'
                  }`}>{subject}</h4>
                  <div className={`text-xl font-black mt-0.5 ${
                    isAtRisk ? 'text-rose-200' : 'text-emerald-200'
                  }`}>{pct}%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-track mt-3">
                <div
                  className="progress-fill"
                  style={{
                    width: `${fillWidth}%`,
                    background: isAtRisk
                      ? 'linear-gradient(90deg, #F87171, #FB923C)'
                      : 'linear-gradient(90deg, #34D399, #6EE7B7)',
                  }}
                />
              </div>

              <p className={`text-[10px] font-medium mt-2 leading-relaxed ${
                isAtRisk ? 'text-rose-400/70' : 'text-emerald-400/70'
              }`}>
                {isAtRisk
                  ? `⚠️ Need ${classesNeeded} more classes to reach 75%`
                  : '✅ Safe — keep attending regularly'
                }
              </p>
            </div>
          );
        })}
      </div>

      {/* AI Advisor Tip */}
      {overallTip && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Info className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-blue-300/80 uppercase tracking-wider mb-1.5">
                AI Academic Advisor
              </h4>
              <p className="text-xs text-blue-200/65 font-medium leading-relaxed">
                "{overallTip}"
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
