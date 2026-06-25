import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, Bell, CalendarCheck, Zap, 
  MessageSquare, Calendar, FolderOpen, Briefcase, Users, Rocket,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_GROUPS = [
  {
    label: 'Core',
    links: [
      { to: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard, mobile: true },
      { to: '/tasks',           label: 'Tasks',           icon: ClipboardList,   mobile: true },
      { to: '/notice',          label: 'AI Study Buddy',  icon: Bell,            mobile: true },
    ]
  },
  {
    label: 'Productivity',
    links: [
      { to: '/chat',            label: 'Chat Hub',        icon: MessageSquare,   mobile: true },
      { to: '/deadline-planner',label: 'Deadline Planner',icon: Calendar },
      { to: '/attendance',      label: 'Attendance',      icon: CalendarCheck },
    ]
  },
  {
    label: 'Career & Study',
    links: [
      { to: '/placement',       label: 'Placement Prep',  icon: Briefcase },
      { to: '/study-groups',    label: 'Study Groups',    icon: Users },
      { to: '/brainspace',      label: 'BrainSpace',      icon: Rocket },
      { to: '/knowledge',       label: 'RAG Library',     icon: FolderOpen },
    ]
  },
  {
    label: 'Automation',
    links: [
      { to: '/automations',     label: 'Automations',     icon: Zap,             mobile: true },
    ]
  },
];

const ALL_MOBILE_LINKS = NAV_GROUPS.flatMap(g => g.links).filter(l => l.mobile);

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <aside className="sidebar-glass w-64 hidden md:flex flex-col min-h-screen sticky top-0 flex-shrink-0">
        
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white font-black text-sm">CF</span>
            </div>
            <span className="gradient-text font-extrabold text-lg tracking-tight">
              CampusFlow
            </span>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/20">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <Icon className="sidebar-icon" />
                      <span className="flex-1">{link.label}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/[0.06]">
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-10 bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-all cursor-default">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow shadow-indigo-500/20">
                {user.name ? user.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white/80 truncate">{user.name}</div>
                <div className="text-[10px] text-white/30 truncate">{user.branch} · Year {user.year}</div>
              </div>
            </div>
          )}
          <div className="mt-2 text-center">
            <span className="text-[9px] text-white/15 font-bold tracking-widest uppercase">
              CampusAI Hackathon 2025
            </span>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0D1117]/95 backdrop-blur-xl border-t border-white/[0.08] flex justify-around items-center z-50 px-2 pb-safe">
        {ALL_MOBILE_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                  isActive
                    ? 'text-blue-400'
                    : 'text-white/30 hover:text-white/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-blue-500/15' : ''}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="mt-0.5">{link.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
