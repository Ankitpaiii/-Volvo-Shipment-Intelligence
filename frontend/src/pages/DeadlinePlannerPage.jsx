import React, { useState, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks';
import api from '../api/axios';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import { Calendar, Clock, AlertTriangle, Sparkles, CheckCircle2, ChevronRight, Phone, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function DeadlinePlannerPage() {
  const { tasks, fetchTasks, loading: tasksLoading } = useTasks();
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Form inputs
  const [difficulty, setDifficulty] = useState('medium');
  const [estimatedHours, setEstimatedHours] = useState('6');
  const [customSubject, setCustomSubject] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');
  
  // Results
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Pre-fill fields when task is selected
  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setCustomSubject(task.subject);
    // Format to yyyy-MM-dd
    const dateObj = new Date(task.deadline);
    setCustomDeadline(dateObj.toISOString().split('T')[0]);
    setStudyPlan(null);
    setSuccess(false);
  };

  const handleGeneratePlan = async (e) => {
    e.preventDefault();

    const subject = customSubject.trim();
    const deadline = customDeadline;

    if (!subject || !deadline || !difficulty || !estimatedHours) {
      toast.error('Please fill out all plan configurations.');
      return;
    }

    setLoading(true);
    setSuccess(false);
    try {
      const response = await api.post('/api/deadline-planner/study-plan', {
        subject,
        deadline,
        difficulty,
        estimatedHours: parseInt(estimatedHours, 10)
      });

      setStudyPlan(response.data);
      setSuccess(true);
      toast.success('Study plan generated and synchronized with WhatsApp + Calendar! 📲📅');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to generate study plan.');
    } finally {
      setLoading(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Smart Deadline Manager
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Automatically partition studying time, register calendar slots, and receive WhatsApp notifications before exams.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Step 1: Select Pending Task */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-black flex items-center justify-center">
                1
              </span>
              Select Pending Task
            </h2>

            {tasksLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/10">
                <p className="text-xs text-gray-400 font-bold">No pending tasks found.</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Create a task in Tasks page first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {pendingTasks.map(task => {
                  const isSelected = selectedTask?.id === task.id;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleSelectTask(task)}
                      className={`w-full p-3.5 text-left border rounded-2xl text-xs transition-all duration-200 flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/45 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 font-bold'
                          : 'border-gray-150 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-750/30 text-gray-700 dark:text-gray-400 font-semibold'
                      }`}
                    >
                      <div className="truncate">
                        <p className="truncate font-black">{task.title}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{task.subject}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        isSelected ? 'text-blue-500 translate-x-1' : 'text-gray-400'
                      }`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Plan Settings Configuration */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm">
            <form onSubmit={handleGeneratePlan} className="space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-black flex items-center justify-center">
                  2
                </span>
                Plan Parameters
              </h2>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Compiler Design"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Deadline Date
                </label>
                <input
                  type="date"
                  required
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Est. Hours
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Generating Study Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Partition Studying Hours
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Step 2: Visualization Viewport */}
        <div className="lg:col-span-2 space-y-6">
          {studyPlan ? (
            <div className="space-y-6">
              
              {/* Sync Banners */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3.5 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl">
                  <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/10">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-350">
                      WhatsApp Alerts Set
                    </h3>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      Daily reminders scheduled via n8n.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl">
                  <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-sm shadow-blue-500/10">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-blue-800 dark:text-blue-350">
                      Google Calendar Synced
                    </h3>
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">
                      Study blocks added via Google Calendar API.
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendation Card */}
              {studyPlan.recommendation && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-450">
                    AI Study Plan Insights
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                    {studyPlan.recommendation}
                  </p>
                  
                  {/* Summary row */}
                  <div className="flex flex-wrap gap-4 pt-2 text-[10px] text-gray-400 font-bold">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-300" />
                      <span>{studyPlan.totalSessions} Study Sessions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-300" />
                      <span>{studyPlan.revisionDays} Dedicated Revision Days</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline list */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Daily Study Schedule & Blocks
                </h3>
                
                <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3 pl-6 space-y-6 py-2">
                  {studyPlan.studyPlan?.map((session, idx) => {
                    const isRevision = session.type === 'revision';
                    const isPractice = session.type === 'practice';
                    
                    let badgeColor = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/40';
                    let dotColor = 'bg-blue-500 shadow-blue-500/25';
                    if (isRevision) {
                      badgeColor = 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40';
                      dotColor = 'bg-amber-500 shadow-amber-500/25';
                    } else if (isPractice) {
                      badgeColor = 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/40';
                      dotColor = 'bg-indigo-500 shadow-indigo-500/25';
                    }

                    return (
                      <div key={idx} className="relative">
                        {/* Timeline Node Dot */}
                        <span className={`absolute -left-[30px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-850 shadow-md ${dotColor}`}></span>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                              {session.date ? format(new Date(session.date), 'PPPP') : `Session ${idx + 1}`}
                            </span>
                            <h4 className="text-xs font-black text-gray-850 dark:text-white mt-0.5 leading-relaxed">
                              {session.focus}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 border rounded-lg uppercase tracking-wider bg-white dark:bg-gray-750 text-gray-500 dark:text-gray-400">
                              {session.durationHours} hrs
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 border rounded-lg uppercase tracking-wider ${badgeColor}`}>
                              {session.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            /* Empty State */
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-650 mb-4" />
              <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                Generate Study Strategy
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-5 leading-relaxed font-semibold">
                Select a pending task from the list or define a custom subject and deadline. AI study buddy will balance difficulty and hours to partition your roadmap.
              </p>
              
              <div className="flex items-center gap-2 p-3.5 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl text-[10px] text-blue-800 dark:text-blue-300 font-semibold text-left max-w-xs">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-blue-600" />
                This process synchronizes study prompts with WhatsApp reminders and bookable Google Calendar schedules automatically.
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
