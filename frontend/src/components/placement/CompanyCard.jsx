import React, { useState } from 'react';
import { Calendar, Trash2, Edit2, Plus, Check, X, Clock, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function CompanyCard({ company, onUpdate, onDelete }) {
  const [isAddingRound, setIsAddingRound] = useState(false);
  const [roundName, setRoundName] = useState('');
  const [roundDate, setRoundDate] = useState('');
  const [roundStatus, setRoundStatus] = useState('scheduled');

  const statusColors = {
    applied: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30',
    oa: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
    interview: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/30',
    offered: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-350 border-emerald-200 dark:border-emerald-800/30',
    rejected: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-350 border-rose-200 dark:border-rose-800/30'
  };

  const handleStatusChange = (newStatus) => {
    onUpdate(company.id, { status: newStatus });
  };

  const handleAddRoundSubmit = (e) => {
    e.preventDefault();
    if (!roundName.trim() || !roundDate) return;

    const newRound = {
      name: roundName.trim(),
      date: roundDate,
      status: roundStatus // 'scheduled' | 'passed' | 'failed'
    };

    const updatedRounds = [...(company.interview_rounds || []), newRound];
    onUpdate(company.id, { interview_rounds: updatedRounds });

    // Reset form
    setRoundName('');
    setRoundDate('');
    setRoundStatus('scheduled');
    setIsAddingRound(false);
  };

  const toggleRoundStatus = (index) => {
    const rounds = [...(company.interview_rounds || [])];
    const current = rounds[index].status;
    const nextStatus = current === 'scheduled' ? 'passed' : current === 'passed' ? 'failed' : 'scheduled';
    rounds[index].status = nextStatus;
    onUpdate(company.id, { interview_rounds: rounds });
  };

  const deleteRound = (index) => {
    const rounds = (company.interview_rounds || []).filter((_, i) => i !== index);
    onUpdate(company.id, { interview_rounds: rounds });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm space-y-4 transition-all">
      
      {/* Name and Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
            {company.company_name}
          </h3>
          <p className="text-xs text-gray-400 font-bold mt-0.5">
            {company.role || 'Software Engineering Intern'}
          </p>
        </div>
        <button
          onClick={() => onDelete(company.id)}
          className="text-gray-300 dark:text-gray-600 hover:text-rose-600 dark:hover:text-rose-500 transition-colors p-1"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Status Picker Selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.keys(statusColors).map(statusKey => {
          const isSelected = company.status === statusKey;
          return (
            <button
              key={statusKey}
              type="button"
              onClick={() => handleStatusChange(statusKey)}
              className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
                isSelected
                  ? statusColors[statusKey]
                  : 'border-gray-150 dark:border-gray-700/50 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              {statusKey}
            </button>
          );
        })}
      </div>

      {/* Notes */}
      {company.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-450 leading-relaxed font-semibold bg-gray-50/50 dark:bg-gray-900/10 p-3 rounded-xl border border-gray-150 dark:border-gray-750">
          {company.notes}
        </p>
      )}

      {/* Interview Rounds List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Interview Timeline
          </h4>
          {!isAddingRound && (
            <button
              type="button"
              onClick={() => setIsAddingRound(true)}
              className="text-[10px] text-blue-600 dark:text-blue-450 font-black flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add Round
            </button>
          )}
        </div>

        {/* List of active rounds */}
        {(!company.interview_rounds || company.interview_rounds.length === 0) ? (
          <p className="text-[10px] text-gray-400 font-bold italic">No rounds added yet.</p>
        ) : (
          <div className="space-y-1.5">
            {company.interview_rounds.map((round, idx) => {
              let badgeColor = 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400';
              let statusIcon = <Clock className="w-3.5 h-3.5 text-gray-400" />;
              
              if (round.status === 'passed') {
                badgeColor = 'bg-emerald-500 text-white';
                statusIcon = <Check className="w-3.5 h-3.5 text-emerald-600" />;
              } else if (round.status === 'failed') {
                badgeColor = 'bg-rose-500 text-white';
                statusIcon = <X className="w-3.5 h-3.5 text-rose-600" />;
              }

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-2 border border-gray-150 dark:border-gray-750 rounded-xl text-[10px] font-semibold bg-gray-50/50 dark:bg-gray-900/5 hover:border-gray-250 dark:hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <button
                      type="button"
                      onClick={() => toggleRoundStatus(idx)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-black ${
                        round.status === 'passed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-350'
                          : round.status === 'failed'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-350'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-350'
                      }`}
                      title="Click to toggle status"
                    >
                      {round.status === 'passed' ? 'P' : round.status === 'failed' ? 'F' : 'S'}
                    </button>
                    <span className="truncate text-gray-800 dark:text-gray-300 font-bold">{round.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(round.date), 'MMM d, yyyy')}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteRound(idx)}
                      className="text-gray-300 dark:text-gray-600 hover:text-rose-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Round Form inline */}
        {isAddingRound && (
          <form onSubmit={handleAddRoundSubmit} className="p-3.5 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/10 rounded-2xl space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Round Name (e.g. Technical Round 1)"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                className="col-span-2 w-full p-2.5 border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-[10px] placeholder-gray-400 focus:border-blue-500 font-semibold"
              />
              <input
                type="date"
                required
                value={roundDate}
                onChange={(e) => setRoundDate(e.target.value)}
                className="w-full p-2.5 border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-[10px] focus:border-blue-500 font-semibold"
              />
              <select
                value={roundStatus}
                onChange={(e) => setRoundStatus(e.target.value)}
                className="w-full p-2.5 border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-[10px] focus:border-blue-500 font-semibold"
              >
                <option value="scheduled">Scheduled</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsAddingRound(false)}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-[10px] font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
