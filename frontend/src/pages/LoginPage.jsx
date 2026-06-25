import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Spinner from '../components/ui/Spinner';
import { LogIn, UserPlus, Zap, MessageSquare, Calendar, Brain } from 'lucide-react';

const FEATURES = [
  { icon: MessageSquare, label: 'WhatsApp Reminders', desc: 'Automated deadline alerts', color: 'text-emerald-400' },
  { icon: Calendar, label: 'Google Calendar', desc: 'Auto event creation', color: 'text-blue-400' },
  { icon: Brain, label: 'AI Study Buddy', desc: 'MCQs & flashcards', color: 'text-violet-400' },
  { icon: Zap, label: 'n8n Automations', desc: 'Full pipeline control', color: 'text-amber-400' },
];

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('login');
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm();

  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    formState: { errors: signUpErrors },
  } = useForm();

  const onLoginSubmit = async (data) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back! 🎓');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check your credentials.');
    }
  };

  const onSignUpSubmit = async (data) => {
    const parsedSubjects = data.subjects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (parsedSubjects.length === 0) {
      toast.error('Please enter at least one subject.');
      return;
    }

    try {
      await register({
        name: data.name,
        branch: data.branch,
        year: parseInt(data.year, 10),
        phone: data.phone,
        subjects: parsedSubjects,
        email: data.email,
        password: data.password,
        google_email: data.google_email || null,
      });
      toast.success('Welcome to CampusFlow! 🚀');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed. Check your inputs.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex dot-bg">
      
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-col justify-center px-16 flex-1 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white font-black text-xl">CF</span>
            </div>
            <span className="text-2xl font-extrabold gradient-text">CampusFlow</span>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight tracking-tight mb-4">
            Your academic life,
            <br />
            <span className="gradient-text">automated.</span>
          </h1>
          <p className="text-base text-white/45 leading-relaxed mb-10">
            AI-powered student productivity platform for B.Tech students. Track deadlines, get WhatsApp reminders, and never miss a submission.
          </p>

          {/* Feature pills */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white/75">{label}</div>
                  <div className="text-[11px] text-white/30">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-[11px] text-white/20 font-medium">
            🎓 CampusAI Hackathon 2025 · Built for B.Tech Students
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 lg:max-w-md flex flex-col justify-center p-6 md:p-10 relative">
        <div className="absolute inset-0 bg-[#0D1117] lg:border-l lg:border-white/[0.06]" />
        
        <div className="relative z-10 w-full max-w-sm mx-auto">
          
          {/* Mobile Logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white font-black text-sm">CF</span>
            </div>
            <span className="text-xl font-extrabold gradient-text">CampusFlow</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {activeTab === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm text-white/40 mt-1">
              {activeTab === 'login'
                ? 'Access your academic productivity dashboard.'
                : 'Set up WhatsApp and Calendar automations.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/[0.07] mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-blue-500/25 to-indigo-500/20 text-white border border-blue-500/25'
                  : 'text-white/35 hover:text-white/55'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Log In
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'register'
                  ? 'bg-gradient-to-r from-blue-500/25 to-indigo-500/20 text-white border border-blue-500/25'
                  : 'text-white/35 hover:text-white/55'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register
            </button>
          </div>

          {/* Login Form */}
          {activeTab === 'login' && (
            <form className="space-y-4" onSubmit={handleLoginSubmit(onLoginSubmit)}>
              <div>
                <label className="label-premium">Email Address</label>
                <input
                  type="email"
                  placeholder="name@college.edu"
                  className="input-premium"
                  {...registerLogin('email', { required: 'Email is required' })}
                />
                {loginErrors.email && (
                  <p className="mt-1.5 text-[11px] font-semibold text-rose-400">{loginErrors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label-premium">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="input-premium"
                  {...registerLogin('password', { required: 'Password is required' })}
                />
                {loginErrors.password && (
                  <p className="mt-1.5 text-[11px] font-semibold text-rose-400">{loginErrors.password.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-sm mt-2 disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" /> : 'Access Dashboard'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form className="space-y-3" onSubmit={handleSignUpSubmit(onSignUpSubmit)}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-premium">Full Name</label>
                  <input
                    type="text"
                    placeholder="Rahul Sharma"
                    className="input-premium text-sm"
                    {...registerSignUp('name', { required: 'Name is required' })}
                  />
                  {signUpErrors.name && <p className="mt-1 text-[10px] text-rose-400">{signUpErrors.name.message}</p>}
                </div>
                <div>
                  <label className="label-premium">WhatsApp Phone</label>
                  <input
                    type="text"
                    placeholder="+919876543210"
                    className="input-premium text-sm"
                    {...registerSignUp('phone', {
                      required: 'Phone required',
                      pattern: { value: /^\+[1-9]\d{9,14}$/, message: 'Format: +91XXXXXXXXXX' },
                    })}
                  />
                  {signUpErrors.phone && <p className="mt-1 text-[10px] text-rose-400">{signUpErrors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-premium">Branch</label>
                  <select
                    className="input-premium text-sm"
                    style={{ colorScheme: 'dark' }}
                    {...registerSignUp('branch', { required: 'Branch required' })}
                  >
                    <option value="" style={{ background: '#0F1629' }}>Select</option>
                    <option value="CSE" style={{ background: '#0F1629' }}>CSE</option>
                    <option value="ECE" style={{ background: '#0F1629' }}>ECE</option>
                    <option value="EEE" style={{ background: '#0F1629' }}>EEE</option>
                    <option value="ME" style={{ background: '#0F1629' }}>Mechanical</option>
                    <option value="CE" style={{ background: '#0F1629' }}>Civil</option>
                    <option value="IT" style={{ background: '#0F1629' }}>IT</option>
                  </select>
                  {signUpErrors.branch && <p className="mt-1 text-[10px] text-rose-400">{signUpErrors.branch.message}</p>}
                </div>
                <div>
                  <label className="label-premium">Year</label>
                  <select
                    className="input-premium text-sm"
                    style={{ colorScheme: 'dark' }}
                    {...registerSignUp('year', { required: 'Year required' })}
                  >
                    <option value="" style={{ background: '#0F1629' }}>Select</option>
                    {[1,2,3,4].map(y => (
                      <option key={y} value={y} style={{ background: '#0F1629' }}>{y}{['st','nd','rd','th'][y-1]} Year</option>
                    ))}
                  </select>
                  {signUpErrors.year && <p className="mt-1 text-[10px] text-rose-400">{signUpErrors.year.message}</p>}
                </div>
              </div>

              <div>
                <label className="label-premium">Subjects (comma separated)</label>
                <input
                  type="text"
                  placeholder="DBMS, OS, CN, DSA"
                  className="input-premium text-sm"
                  {...registerSignUp('subjects', { required: 'Add subjects' })}
                />
                {signUpErrors.subjects && <p className="mt-1 text-[10px] text-rose-400">{signUpErrors.subjects.message}</p>}
              </div>

              <div>
                <label className="label-premium">Email</label>
                <input
                  type="email"
                  placeholder="name@college.edu"
                  className="input-premium text-sm"
                  {...registerSignUp('email', { required: 'Email required' })}
                />
                {signUpErrors.email && <p className="mt-1 text-[10px] text-rose-400">{signUpErrors.email.message}</p>}
              </div>

              <div>
                <label className="label-premium">Google Email (Optional — Calendar)</label>
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  className="input-premium text-sm"
                  {...registerSignUp('google_email')}
                />
              </div>

              <div>
                <label className="label-premium">Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  className="input-premium text-sm"
                  {...registerSignUp('password', {
                    required: 'Password required',
                    minLength: { value: 6, message: 'Min 6 characters' },
                  })}
                />
                {signUpErrors.password && <p className="mt-1 text-[10px] text-rose-400">{signUpErrors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-sm mt-1 disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" /> : 'Create Account & Register'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
