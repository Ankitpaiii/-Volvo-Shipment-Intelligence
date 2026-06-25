import React, { useEffect, useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import TaskCard from '../components/tasks/TaskCard';
import AddTaskModal from '../components/tasks/AddTaskModal';
import Spinner from '../components/ui/Spinner';
import { Plus, ClipboardCheck, Sparkles, ListFilter } from 'lucide-react';

const FILTERS = [
  { id: 'all',   label: 'All Active' },
  { id: 'today', label: 'Due Today' },
  { id: 'week',  label: 'This Week' },
  { id: 'done',  label: 'Completed' },
];

export default function TasksPage() {
  const { tasks, loading, fetchTasks, createTask, updateTaskStatus, deleteTask } = useTasks();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const isToday = (d) => {
    const today = new Date();
    const date = new Date(d);
    return today.getDate() === date.getDate() &&
           today.getMonth() === date.getMonth() &&
           today.getFullYear() === date.getFullYear();
  };

  const isThisWeek = (d) => {
    const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 3600 * 24));
    return diff >= 0 && diff <= 7;
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === 'done') return t.status === 'done';
    if (t.status === 'done') return false;
    if (activeFilter === 'today') return isToday(t.deadline);
    if (activeFilter === 'week') return isThisWeek(t.deadline);
    return true;
  });

  const hasNoTasks = tasks.length === 0;

  // Counts per filter for badges
  const counts = {
    all:   tasks.filter(t => t.status !== 'done').length,
    today: tasks.filter(t => isToday(t.deadline) && t.status !== 'done').length,
    week:  tasks.filter(t => isThisWeek(t.deadline) && t.status !== 'done').length,
    done:  tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-slide-up">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/25 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Tasks &amp; Deadlines
            </h1>
          </div>
          <p className="text-sm text-white/35 ml-12">
            Track assignments, lab submissions, and semester events.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="btn-primary self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Filter Tabs — only show when there are tasks */}
      {!hasNoTasks && (
        <div className="flex items-center gap-2 flex-wrap">
          <ListFilter className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`filter-tab flex items-center gap-1.5 ${activeFilter === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  activeFilter === tab.id
                    ? 'bg-blue-500/25 text-blue-300'
                    : 'bg-white/[0.06] text-white/30'
                }`}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      {loading && tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-white/30 font-medium">Syncing with Supabase...</p>
        </div>
      ) : hasNoTasks ? (
        /* Empty state — no tasks at all */
        <div className="flex flex-col items-center justify-center py-24 px-4 border border-dashed border-white/[0.07] rounded-2xl bg-white/[0.02] text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-600/10 border border-blue-500/20 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/10">
            <Sparkles className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-white/70 mb-2">No tasks yet</h3>
          <p className="text-sm text-white/35 max-w-sm leading-relaxed mb-6">
            Add your first deadline to get started. Every task triggers an n8n automation for calendar &amp; WhatsApp.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add your first task
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        /* Empty filter match */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-white/30 font-semibold text-sm">
            No tasks match this filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusToggle={updateTaskStatus}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={createTask}
      />
    </div>
  );
}
