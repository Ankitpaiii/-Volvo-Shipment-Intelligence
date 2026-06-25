import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
import { 
  CheckCircle2, Clock, Calendar, ChevronRight, BrainCircuit, 
  UploadCloud, Search, FileText, Users, BarChart3, Plus, Play,
  MoreVertical, RefreshCw, Sparkles, SearchCode, X
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const tabs = ['Tasks', 'Study', 'Attendance', 'Knowledge', 'Groups'];

const TasksTab = ({ tasks, onTaskAdded }) => {
  const todoTasks = tasks.filter(t => t.status === 'pending');
  const doneTasks = tasks.filter(t => t.status === 'done');

  const handleAddTask = async () => {
    const title = prompt('Enter task name (e.g., Complete UI):');
    if (!title) return;
    const subject = prompt('Enter subject name:');
    if (!subject) return;
    
    // Add 2 days for deadline
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);
    
    const promise = api.post('/api/tasks', {
      title,
      subject,
      deadline: deadline.toISOString(),
      add_to_calendar: true
    }).then(() => {
      if (onTaskAdded) onTaskAdded();
    });
    
    toast.promise(promise, {
      loading: 'Adding task and triggering n8n...',
      success: 'Task added! n8n workflow triggered 🚀',
      error: 'Failed to add task'
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
      {/* Kanban Columns */}
      {[
        { title: 'To Do', count: todoTasks.length, items: todoTasks },
        { title: 'In Progress', count: 0, items: [] },
        { title: 'Completed', count: doneTasks.length, items: doneTasks }
      ].map((column, i) => (
        <div key={column.title} className="bg-surface/30 backdrop-blur-md border border-borderColor rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold">{column.title}</h3>
            <span className="bg-surface border border-borderColor text-xs px-2 py-1 rounded-md">{column.count}</span>
          </div>
          
          <div className="space-y-4">
            {column.items.map((task, idx) => (
              <Tilt key={idx} tiltMaxAngleX={2} tiltMaxAngleY={2} className="w-full">
                <div className="bg-primary border border-borderColor p-4 rounded-2xl shadow-sm group hover:border-accentPrimary/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-accentPrimary bg-accentPrimary/10 px-2 py-0.5 rounded">{task.subject}</span>
                    <button className="text-textSecondary hover:text-primary"><MoreVertical size={14}/></button>
                  </div>
                  <h4 className="text-sm font-medium mb-3">{task.title}</h4>
                  <div className="flex items-center justify-between text-xs text-textSecondary">
                    <span className="flex items-center gap-1 text-red-400"><Clock size={12}/> {new Date(task.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
              </Tilt>
            ))}
            
            {i === 0 && (
              <button onClick={handleAddTask} className="w-full py-3 rounded-xl border border-dashed border-borderColor text-textSecondary text-sm font-medium hover:border-accentPrimary hover:text-accentPrimary transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Add Task
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const StudyTab = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 space-y-6">
      <div className="bg-surface/40 backdrop-blur-xl border border-borderColor rounded-3xl p-8 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
        <div className="absolute inset-0 bg-gradient-to-br from-accentPrimary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-duration-500" />
        <BrainCircuit size={48} className="text-accentPrimary mb-6 opacity-80" />
        <h3 className="text-2xl font-bold mb-2 tracking-tight">AI Flashcards</h3>
        <p className="text-textSecondary text-center max-w-sm mb-8">Generate smart flashcards from your syllabus or upload notes.</p>
        <div className="flex gap-4">
          <button className="bg-accentPrimary text-textOnAccent px-6 py-3 rounded-xl font-medium shadow-md hover:scale-105 transition-transform flex items-center gap-2">
            <Play size={18} /> Start Session
          </button>
          <button className="bg-surface border border-borderColor text-primary px-6 py-3 rounded-xl font-medium shadow-sm hover:bg-primary transition-colors flex items-center gap-2">
            <Plus size={18} /> Generate Deck
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-surface/40 backdrop-blur-xl border border-borderColor rounded-3xl p-6 shadow-sm">
          <h4 className="font-semibold mb-4">Upcoming Quizzes</h4>
          <div className="space-y-3">
            <div className="bg-primary p-3 rounded-xl border border-borderColor flex justify-between items-center group cursor-pointer hover:border-accentPrimary/50 transition-colors">
              <div>
                <p className="text-sm font-medium">DBMS Mid-Terms</p>
                <p className="text-xs text-textSecondary mt-0.5">20 MCQs • AI Generated</p>
              </div>
              <button className="text-accentPrimary bg-accentPrimary/10 group-hover:bg-accentPrimary group-hover:text-textOnAccent p-2 rounded-lg transition-colors"><Play size={14}/></button>
            </div>
            <div className="bg-primary p-3 rounded-xl border border-borderColor flex justify-between items-center group cursor-pointer hover:border-accentPrimary/50 transition-colors">
              <div>
                <p className="text-sm font-medium">OS Memory Mgmt</p>
                <p className="text-xs text-textSecondary mt-0.5">15 MCQs • Revision</p>
              </div>
              <button className="text-accentPrimary bg-accentPrimary/10 group-hover:bg-accentPrimary group-hover:text-textOnAccent p-2 rounded-lg transition-colors"><Play size={14}/></button>
            </div>
          </div>
        </div>
        <div className="bg-surface/40 backdrop-blur-xl border border-borderColor rounded-3xl p-6 shadow-sm">
          <h4 className="font-semibold mb-4">Weak Topics Detection</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5"><span className="text-textSecondary">B-Trees</span><span className="text-red-400 font-medium">45% Accuracy</span></div>
              <div className="w-full bg-primary h-2 rounded-full overflow-hidden"><div className="bg-red-400 h-full w-[45%]" /></div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5"><span className="text-textSecondary">Deadlocks</span><span className="text-yellow-500 font-medium">62% Accuracy</span></div>
              <div className="w-full bg-primary h-2 rounded-full overflow-hidden"><div className="bg-yellow-500 h-full w-[62%]" /></div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5"><span className="text-textSecondary">Normalization</span><span className="text-green-500 font-medium">88% Accuracy</span></div>
              <div className="w-full bg-primary h-2 rounded-full overflow-hidden"><div className="bg-green-500 h-full w-[88%]" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div className="bg-surface/40 backdrop-blur-xl border border-borderColor rounded-3xl p-6 shadow-sm flex flex-col">
      <h3 className="font-semibold text-lg mb-8 flex items-center gap-2"><BarChart3 size={18} className="text-accentPrimary"/> Study Analytics</h3>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-48 h-48 rounded-full border-8 border-primary relative flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--accent-primary)" strokeWidth="8" strokeDasharray="289" strokeDashoffset="72" strokeLinecap="round" opacity="0.8" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--accent-secondary)" strokeWidth="8" strokeDasharray="289" strokeDashoffset="220" strokeLinecap="round" opacity="0.6" />
          </svg>
          <div className="text-center">
            <span className="text-4xl font-bold tracking-tight">14h</span>
            <p className="text-xs text-textSecondary mt-1">This Week</p>
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-accentPrimary"/> Deep Work</span><span className="font-medium">10h 30m</span></div>
        <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-accentSecondary"/> Quizzes</span><span className="font-medium">3h 30m</span></div>
      </div>
    </div>
  </div>
);

const AttendanceTab = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
    {/* Subject Card */}
    {[
      { name: 'DBMS', percent: 78, attended: 35, total: 45, status: 'safe' },
      { name: 'Operating Systems', percent: 65, attended: 26, total: 40, status: 'danger' },
      { name: 'Computer Networks', percent: 82, attended: 41, total: 50, status: 'safe' },
    ].map(subject => (
      <Tilt key={subject.name} tiltMaxAngleX={3} tiltMaxAngleY={3} className="w-full">
        <div className="bg-surface/40 backdrop-blur-xl border border-borderColor rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.05)] relative overflow-hidden h-full flex flex-col justify-between">
          {subject.status === 'danger' && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />}
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h3 className="font-semibold text-lg">{subject.name}</h3>
              <p className="text-sm text-textSecondary mt-1">{subject.attended} / {subject.total} Classes</p>
            </div>
            <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center text-sm font-bold ${subject.status === 'danger' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-green-500 text-green-500 bg-green-500/10'}`}>
              {subject.percent}%
            </div>
          </div>
          
          {subject.status === 'danger' ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm relative z-10">
              <p className="text-red-400"><span className="font-bold">Risk Alert!</span> You need to attend the next <span className="font-bold">4 classes</span> continuously to reach 75%.</p>
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm relative z-10">
              <p className="text-green-500">You can safely bunk the next <span className="font-bold">2 classes</span> and stay above 75%.</p>
            </div>
          )}
        </div>
      </Tilt>
    ))}
  </div>
);

const KnowledgeTab = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 flex flex-col gap-6">
      {/* Search Bar */}
      <div className="bg-surface/60 backdrop-blur-xl border border-borderColor rounded-2xl p-2 flex items-center gap-2 shadow-sm">
        <div className="pl-4 text-textSecondary"><Search size={20} /></div>
        <input type="text" placeholder="Ask your Knowledge Base..." className="w-full bg-transparent border-none outline-none py-3 px-2 text-primary placeholder:text-textSecondary/70" />
        <button className="bg-accentPrimary text-textOnAccent px-6 py-3 rounded-xl font-medium shadow-md hover:opacity-90 transition-opacity">Search</button>
      </div>
      
      {/* Search Results / Content Area */}
      <div className="bg-surface/30 backdrop-blur-md border border-borderColor rounded-3xl p-8 flex-1 min-h-[400px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-accentPrimary/10 text-accentPrimary flex items-center justify-center mb-4">
          <SearchCode size={32} />
        </div>
        <h3 className="text-xl font-semibold mb-2">Semantic Search Active</h3>
        <p className="text-textSecondary max-w-md">Type a question above to instantly find answers from your uploaded syllabus, notes, and PDFs using RAG.</p>
      </div>
    </div>
    
    <div className="bg-surface/30 backdrop-blur-md border border-borderColor rounded-3xl p-6 flex flex-col gap-6">
      <h3 className="font-semibold text-lg flex items-center gap-2"><FileText size={18} className="text-accentPrimary" /> Your Documents</h3>
      
      <div className="border-2 border-dashed border-borderColor rounded-2xl p-8 flex flex-col items-center justify-center text-center group hover:border-accentPrimary/50 transition-colors cursor-pointer bg-primary/20">
        <UploadCloud size={32} className="text-textSecondary group-hover:text-accentPrimary mb-3 transition-colors" />
        <p className="font-medium text-sm mb-1">Drag & drop PDFs</p>
        <p className="text-xs text-textSecondary">or click to browse</p>
      </div>
      
      <div className="space-y-3 mt-auto">
        <div className="bg-primary border border-borderColor p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-red-500/10 text-red-500 rounded-lg"><FileText size={16}/></div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">DBMS_Chapter1_4.pdf</p>
            <p className="text-xs text-textSecondary">Indexed • 2.4 MB</p>
          </div>
          <button className="text-textSecondary hover:text-red-500"><X size={14}/></button>
        </div>
        <div className="bg-primary border border-borderColor p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><FileText size={16}/></div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">OS_Syllabus_2024.pdf</p>
            <p className="text-xs text-textSecondary">Indexed • 1.1 MB</p>
          </div>
          <button className="text-textSecondary hover:text-red-500"><X size={14}/></button>
        </div>
      </div>
    </div>
  </div>
);

const GroupsTab = () => (
  <div className="w-full flex flex-col items-center justify-center min-h-[500px] bg-surface/30 backdrop-blur-xl border border-borderColor rounded-[2rem] p-12 text-center relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
    <div className="absolute top-10 left-10 w-32 h-32 bg-accentPrimary/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute bottom-10 right-10 w-40 h-40 bg-accentSecondary/10 rounded-full blur-3xl pointer-events-none" />
    
    <div className="w-24 h-24 rounded-3xl bg-accentPrimary/10 border border-accentPrimary/20 flex items-center justify-center mb-8 shadow-inner relative z-10">
      <Users size={40} className="text-accentPrimary" />
    </div>
    <h3 className="text-3xl font-bold mb-4 tracking-tight relative z-10">Study Group Scheduler</h3>
    <p className="text-textSecondary text-lg max-w-xl font-light leading-relaxed mb-8 relative z-10">
      Let our AI analyze your schedule and match you with peers studying the same subjects at the same time. No more scheduling conflicts.
    </p>
    <button className="bg-accentPrimary text-textOnAccent px-8 py-4 rounded-2xl font-semibold shadow-xl shadow-accentPrimary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 relative z-10">
      <Sparkles size={20} /> Find AI Match
    </button>
  </div>
);

export default function AcademicsPage() {
  const [activeTab, setActiveTab] = useState('Tasks');
  const [tasks, setTasks] = useState([]);

  const fetchTasks = async () => {
    try {
      const response = await api.get('/api/tasks');
      setTasks(response.data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <AppLayout>
      <div className="pb-12 pt-4">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-semibold mb-2 tracking-tight">Academics</h2>
          <p className="text-textSecondary text-lg font-light">Your central hub for academic success.</p>
        </div>

        {/* Custom Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-surface/50 p-1.5 rounded-2xl w-max border border-borderColor backdrop-blur-md">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                activeTab === tab ? 'text-textOnAccent' : 'text-textSecondary hover:text-primary'
              }`}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="academics-tab"
                  className="absolute inset-0 bg-accentPrimary rounded-xl shadow-[0_4px_15px_var(--accent-primary)] shadow-opacity-40"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0 }}
            className="w-full"
          >
            {activeTab === 'Tasks' && <TasksTab tasks={tasks} onTaskAdded={fetchTasks} />}
            {activeTab === 'Study' && <StudyTab />}
            {activeTab === 'Attendance' && <AttendanceTab />}
            {activeTab === 'Knowledge' && <KnowledgeTab />}
            {activeTab === 'Groups' && <GroupsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
