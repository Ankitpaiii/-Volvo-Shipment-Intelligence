import React, { useEffect, useState } from 'react';
import { useAuth, supabase } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';
import { Zap, ListFilter, PlayCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_LABELS = {
  deadline_reminder:  'Deadline',
  notice_broadcast:   'Notice',
  quiz_ready:         'Quiz',
  study_reminder:     'Study',
  attendance_alert:   'Attendance',
  placement_reminder: 'Placement',
  study_group_invite: 'Group Invite',
  startup_report:     'Startup',
};

const TYPE_COLORS = {
  deadline_reminder:  'bg-blue-500/15 text-blue-300 border-blue-500/25',
  notice_broadcast:   'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  quiz_ready:         'bg-amber-500/15 text-amber-300 border-amber-500/25',
  study_reminder:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  attendance_alert:   'bg-rose-500/15 text-rose-300 border-rose-500/25',
  placement_reminder: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  study_group_invite: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
  startup_report:     'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
};

function renderDetails(log) {
  const p = log.payload || {};
  switch (log.type) {
    case 'deadline_reminder':
      return `"${p.taskTitle}" · ${p.subject} · ${p.phone}`;
    case 'notice_broadcast':
      return `"${p.eventTitle || 'Update'}" → ${p.phoneList?.length || 0} students`;
    case 'quiz_ready':
      return `${p.subject} · ${p.topic} · ${p.mcqCount} MCQs`;
    case 'study_reminder':
      return `${p.subject} · ${p.difficulty} · ${p.estimatedHours}h`;
    case 'attendance_alert':
      return `${p.subject} · ${p.currentAttendance}% · ${p.riskLevel} risk`;
    case 'placement_reminder':
      return `${p.companyName} · ${p.role} · ${p.interviewDate ? format(new Date(p.interviewDate), 'PP') : 'N/A'}`;
    case 'study_group_invite':
      return `"${p.groupTitle}" · ${p.subject} · ${p.inviteesCount} invitees`;
    case 'startup_report':
      return `"${p.ideaTitle}" · Score: ${p.feasibilityScore || 0}`;
    default:
      return '—';
  }
}

export default function AutomationsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadLogs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('automation_logs')
          .select('*')
          .eq('student_id', user.id)
          .order('triggered_at', { ascending: false });
        if (!error && active) setLogs(data || []);
      } catch (err) {
        console.error('Failed to load automation logs:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadLogs();
    return () => { active = false; };
  }, [user]);

  const uniqueTypes = ['all', ...new Set(logs.map(l => l.type))];
  const filteredLogs = logs.filter(l => filterType === 'all' || l.type === filterType);
  const hasNoLogs = logs.length === 0;

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-slide-up">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/25 flex items-center justify-center">
          <Zap className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Automations</h1>
          <p className="text-sm text-white/35">n8n pipeline execution history — WhatsApp &amp; Google Calendar</p>
        </div>
      </div>

      {/* Filter Tabs */}
      {!hasNoLogs && (
        <div className="flex items-center gap-2 flex-wrap">
          <ListFilter className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
          {uniqueTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`filter-tab ${filterType === type ? 'active' : ''}`}
            >
              {type === 'all' ? 'All Logs' : (TYPE_LABELS[type] || type)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-white/30">Retrieving pipeline logs...</p>
        </div>
      ) : hasNoLogs ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 border border-dashed border-white/[0.07] rounded-2xl bg-white/[0.02] text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-600/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <Zap className="w-7 h-7 text-blue-400/60" />
          </div>
          <h3 className="text-base font-bold text-white/50 mb-2">No automation logs yet</h3>
          <p className="text-sm text-white/30 max-w-sm leading-relaxed">
            Add a task to trigger your first WhatsApp reminder and Google Calendar event via n8n.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-white/30 font-medium text-sm">No logs match this filter.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-widest text-white/25">
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Triggered At</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => {
                  const isSuccess = log.status === 'success';
                  return (
                    <tr
                      key={log.id}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors ${
                        idx === filteredLogs.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      {/* Type */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`badge ${TYPE_COLORS[log.type] || 'bg-white/10 text-white/50 border-white/15'}`}>
                          {TYPE_LABELS[log.type] || log.type}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/40">
                          <Clock className="w-3 h-3" />
                          {new Date(log.triggered_at).toLocaleString()}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`badge ${
                          isSuccess
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                        }`}>
                          {isSuccess
                            ? <><PlayCircle className="w-3 h-3" /> Success</>
                            : <><XCircle className="w-3 h-3" /> Failed</>
                          }
                        </span>
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3.5 max-w-sm">
                        <span className="text-[11px] text-white/45 font-medium truncate block">
                          {renderDetails(log)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
