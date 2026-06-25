import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import { useTasks } from '../hooks/useTasks';
import { useAI } from '../hooks/useAI';
import { Badge } from '../components/ui/Badge';
import { getDeadlineLabel } from '../utils/deadline';
import Spinner from '../components/ui/Spinner';
import {
  Calendar, CheckCircle, Clock, BookOpen, Brain, Activity,
  ArrowRight, User, Link2, Zap, TrendingUp, Sparkles, ChevronRight,
  AlertCircle, Target
} from 'lucide-react';

function getRelativeTimeAgo(dateString) {
  const diffMs = new Date() - new Date(dateString);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getGreeting() {
  const hrs = new Date().getHours();
  if (hrs < 12) return 'Good morning';
  if (hrs < 18) return 'Good afternoon';
  return 'Good evening';
}

function getDeadlineUrgencyClass(label) {
  if (!label) return 'text-white/40';
  const l = label.toLowerCase();
  if (l.includes('overdue')) return 'text-rose-400';
  if (l.includes('today') || l.includes('hour')) return 'text-amber-400';
  if (l.includes('tomorrow')) return 'text-yellow-400';
  return 'text-emerald-400';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { tasks, loading: tasksLoading, fetchTasks } = useTasks();
  const { fetchStudyTip } = useAI();

  const [aiTip, setAiTip] = useState('');
  const [tipLoading, setTipLoading] = useState(true);
  const [lastLog, setLastLog] = useState(null);
  const [logsLoading, setLogsLoading] = useState(true);

  // 1. Fetch tasks on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 2. Fetch AI study tip
  useEffect(() => {
    let active = true;
    const loadTip = async () => {
      setTipLoading(true);
      const tipText = await fetchStudyTip();
      if (active && tipText) setAiTip(tipText);
      setTipLoading(false);
    };
    loadTip();
    return () => { active = false; };
  }, []);

  // 3. Fetch automation logs
  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchLogs = async () => {
      setLogsLoading(true);
      try {
        const { data: logs, error } = await supabase
          .from('automation_logs')
          .select('triggered_at')
          .eq('student_id', user.id)
          .order('triggered_at', { ascending: false })
          .limit(1);
        if (!error && active && logs?.length > 0) {
          setLastLog(logs[0]);
        }
      } catch (err) {
        console.error('Automation logs dashboard query failed:', err);
      } finally {
        if (active) setLogsLoading(false);
      }
    };
    fetchLogs();
    return () => { active = false; };
  }, [user]);

  const isToday = (d) => new Date().toDateString() === new Date(d).toDateString();
  const isUpcoming = (d) => {
    const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
    return diff > 0 && diff <= 7;
  };

  const todayTasks     = tasks.filter((t) => isToday(t.deadline) && t.status === 'pending');
  const pendingDeadlines = tasks.filter((t) => t.status === 'pending');
  const doneTasks      = tasks.filter((t) => t.status === 'done');
  const subjectsCount  = user?.subjects?.length || 0;
  const upcomingTasks  = tasks
    .filter((t) => isUpcoming(t.deadline) && t.status === 'pending')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const completionRate = tasks.length > 0
    ? Math.round((doneTasks.length / tasks.length) * 100)
    : 0;

  const getAutomationStatus = () => {
    if (logsLoading) return { text: 'Checking...', active: false };
    if (!lastLog) return { text: 'No automations triggered yet', active: false };
    const diff = new Date() - new Date(lastLog.triggered_at);
    const isRecent = diff < 24 * 60 * 60 * 1000;
    return {
      text: isRecent
        ? `Active · last run ${getRelativeTimeAgo(lastLog.triggered_at)}`
        : `Last run ${getRelativeTimeAgo(lastLog.triggered_at)}`,
      active: isRecent,
    };
  };

  const automationStatus = getAutomationStatus();

  const STAT_CARDS = [
    {
      icon: Clock,
      value: todayTasks.length,
      label: 'Due Today',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
      iconColor: 'text-amber-400',
      glow: 'hover:border-amber-500/30',
    },
    {
      icon: Target,
      value: pendingDeadlines.length,
      label: 'Total Pending',
      iconBg: 'bg-blue-500/10 border-blue-500/20',
      iconColor: 'text-blue-400',
      glow: 'hover:border-blue-500/30',
    },
    {
      icon: BookOpen,
      value: subjectsCount,
      label: 'Subjects Tracked',
      iconBg: 'bg-violet-500/10 border-violet-500/20',
      iconColor: 'text-violet-400',
      glow: 'hover:border-violet-500/30',
    },
    {
      icon: TrendingUp,
      value: `${completionRate}%`,
      label: 'Completion Rate',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      iconColor: 'text-emerald-400',
      glow: 'hover:border-emerald-500/30',
    },
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-slide-up">

      {/* ── Welcome Banner ─────────────────────────── */}
      <div className="welcome-banner p-6 md:p-8 dot-bg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-blue-400/80 uppercase tracking-widest border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 rounded-md">
              🎓 CampusAI 2025
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {getGreeting()},{' '}
            <span className="gradient-text">{user?.name || 'Student'}</span>
          </h1>
          <p className="text-sm text-white/50 mt-2 max-w-xl leading-relaxed">
            {todayTasks.length > 0
              ? `You have ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today and ${pendingDeadlines.length} pending deadlines.`
              : `All clear for today! You have ${pendingDeadlines.length} upcoming deadline${pendingDeadlines.length !== 1 ? 's' : ''} this week.`
            }
          </p>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-5">
            <Link
              to="/tasks"
              className="btn-primary text-sm px-4 py-2"
            >
              <CheckCircle className="w-4 h-4" />
              View Tasks
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/notice"
              className="btn-secondary text-sm px-4 py-2"
            >
              <Brain className="w-4 h-4" />
              AI Study Buddy
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ icon: Icon, value, label, iconBg, iconColor, glow }) => (
          <div key={label} className={`stat-card ${glow}`}>
            <div className={`stat-icon ${iconBg}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-black text-white tracking-tight">{value}</div>
              <div className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mt-0.5 truncate">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Content Grid ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Today's Tasks + Upcoming */}
        <div className="lg:col-span-2 space-y-6">

          {/* Today's Schedule */}
          <div className="glass-card p-6">
            <div className="section-header">
              <CheckCircle className="section-header-icon" />
              Today's Schedule
              <span className="ml-auto text-[11px] text-white/20 font-medium">
                {tasksLoading ? '–' : `${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {tasksLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : todayTasks.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-white/40 mb-4">No tasks due today</p>
                <Link to="/tasks" className="btn-primary text-xs px-4 py-2 inline-flex">
                  Add a Task
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => {
                  const dl = getDeadlineLabel(task.deadline);
                  return (
                    <div key={task.id} className="task-card pl-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white/90 truncate">{task.title}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge subject={task.subject} />
                            <span className={`text-[11px] font-bold ${getDeadlineUrgencyClass(dl.label)}`}>
                              {dl.label}
                            </span>
                          </div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1 shadow-sm shadow-amber-400/50" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="glass-card p-6">
            <div className="section-header">
              <Calendar className="section-header-icon" />
              Upcoming Deadlines
              <span className="text-[11px] text-white/20 ml-1">(Next 7 Days)</span>
              <span className="ml-auto text-[11px] text-white/20 font-medium">
                {tasksLoading ? '–' : `${upcomingTasks.length} pending`}
              </span>
            </div>

            {tasksLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : upcomingTasks.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02]">
                <p className="text-sm font-semibold text-white/40">
                  🎉 No upcoming deadlines this week!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((task) => {
                  const dl = getDeadlineLabel(task.deadline);
                  return (
                    <div key={task.id} className="task-card pl-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white/90 truncate">{task.title}</h4>
                          <div className="mt-1.5">
                            <Badge subject={task.subject} />
                          </div>
                        </div>
                        <span className={`text-[11px] font-bold flex-shrink-0 ${getDeadlineUrgencyClass(dl.label)}`}>
                          {dl.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Tip + Profile + Automation */}
        <div className="space-y-5">

          {/* AI Tip */}
          <div className="glass-card p-5 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="section-header relative z-10">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              <span>AI Tip of the Day</span>
              <span className="ml-auto">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              </span>
            </div>

            {tipLoading ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <Spinner size="sm" />
                <p className="text-xs text-white/30">Generating insight...</p>
              </div>
            ) : aiTip ? (
              <div className="relative z-10 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/15">
                <p className="text-sm text-blue-200/80 font-medium leading-relaxed">
                  "{aiTip}"
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <p className="text-sm text-amber-300/70 font-medium leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Could not load today's tip. Check your connection.
                </p>
              </div>
            )}
          </div>

          {/* Profile Card */}
          <div className="glass-card p-5">
            <div className="section-header">
              <User className="section-header-icon" />
              Student Profile
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                <span className="label-premium mb-0">Branch &amp; Year</span>
                <span className="text-xs font-bold text-white/70">
                  {user?.branch || '—'} · Yr {user?.year || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                <span className="label-premium mb-0">WhatsApp</span>
                <span className="text-xs font-bold text-white/70">
                  {user?.phone || <span className="italic text-white/25">Not set</span>}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                <span className="label-premium mb-0">Google</span>
                {user?.google_email ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Linked
                  </span>
                ) : (
                  <span className="text-xs italic text-white/25">Not linked</span>
                )}
              </div>
              <div className="pt-1">
                <span className="label-premium">Subjects</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {user?.subjects?.length > 0
                    ? user.subjects.map((sub) => <Badge key={sub} subject={sub} />)
                    : <span className="text-xs text-white/25 italic">No subjects configured</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Automation Status */}
          <div className="glass-card p-5">
            <div className="section-header">
              <Activity className="section-header-icon" />
              Automation Pipeline
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                logsLoading
                  ? 'bg-amber-400 animate-pulse'
                  : automationStatus.active
                    ? 'bg-emerald-400 animate-pulse shadow shadow-emerald-400/50'
                    : 'bg-white/15'
              }`} />
              <span className="text-xs font-semibold text-white/60">
                {automationStatus.text}
              </span>
            </div>

            <p className="text-[11px] text-white/30 leading-relaxed">
              Every task triggers a pipeline that creates a Google Calendar event and schedules WhatsApp reminders via n8n.
            </p>

            <Link
              to="/automations"
              className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-blue-400/60 hover:text-blue-400 transition-colors"
            >
              <Zap className="w-3 h-3" />
              View Automations
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
