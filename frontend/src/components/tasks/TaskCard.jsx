import React from 'react';
import { Badge } from '../ui/Badge';
import { Trash2, Calendar, CheckSquare, Square, MessageCircle, AlertCircle } from 'lucide-react';
import { getDeadlineLabel } from '../../utils/deadline';

function getUrgencyAccent(label) {
  if (!label) return '';
  const l = label.toLowerCase();
  if (l.includes('overdue')) return 'border-rose-500/30 bg-rose-500/5';
  if (l.includes('today') || l.includes('hour')) return 'border-amber-500/25';
  return '';
}

export default function TaskCard({ task, onStatusToggle, onDelete }) {
  const isDone = task.status === 'done';
  const deadlineInfo = getDeadlineLabel(task.deadline);
  const isOverdue = deadlineInfo.label === 'OVERDUE';

  const handleDeleteClick = () => {
    if (window.confirm(`Delete "${task.title}"?`)) {
      onDelete(task.id);
    }
  };

  const urgencyClass = getUrgencyAccent(deadlineInfo.label);
  const deadlineColorClass = isOverdue
    ? 'text-rose-400'
    : deadlineInfo.label?.includes('Today') || deadlineInfo.label?.includes('hour')
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <div className={`task-card flex flex-col gap-4 h-full ${isDone ? 'opacity-55' : ''} ${urgencyClass}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <Badge subject={task.subject} />
        <div className="flex items-center gap-2">
          {task.add_to_calendar && (
            <Calendar
              className="w-3.5 h-3.5 text-blue-400/70"
              title="Google Calendar enabled"
            />
          )}
          <MessageCircle
            className={`w-3.5 h-3.5 ${task.n8n_triggered ? 'text-emerald-400/80' : 'text-white/15'}`}
            title={task.n8n_triggered ? 'WhatsApp reminder set' : 'WhatsApp pending'}
          />
        </div>
      </div>

      {/* Title */}
      <h3 className={`text-sm font-semibold leading-snug flex-1 ${
        isDone ? 'line-through text-white/30' : 'text-white/85'
      }`}>
        {task.title}
      </h3>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
        {/* Status + Deadline */}
        <div className="space-y-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            isDone ? 'text-emerald-400' : 'text-white/30'
          }`}>
            {isDone ? '✓ Completed' : 'Pending'}
          </span>
          <div className={`text-[11px] font-semibold flex items-center gap-1 ${deadlineColorClass}`}>
            {isOverdue && <AlertCircle className="w-3 h-3" />}
            {deadlineInfo.label}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Toggle status */}
          <button
            type="button"
            onClick={() => onStatusToggle(task.id, isDone ? 'pending' : 'done')}
            className={`p-2 rounded-lg border transition-all ${
              isDone
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-white/[0.04] border-white/[0.08] text-white/30 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10'
            }`}
            title={isDone ? 'Mark Pending' : 'Mark Done'}
          >
            {isDone
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4" />
            }
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDeleteClick}
            className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/25 hover:text-rose-400 hover:border-rose-500/25 hover:bg-rose-500/10 transition-all"
            title="Delete Task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
