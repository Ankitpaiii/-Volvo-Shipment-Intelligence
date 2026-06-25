import React from 'react';
import { useAuth } from '../../context/AuthContext';
import DarkModeToggle from '../ui/DarkModeToggle';
import { LogOut, Bell } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="navbar-glass h-14 sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 gap-4 flex-shrink-0">
      
      {/* Mobile Logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow shadow-blue-500/25">
          <span className="text-white font-black text-xs">CF</span>
        </div>
        <span className="gradient-text font-extrabold text-base tracking-tight">
          CampusFlow
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto">
        
        {/* Notification bell (decorative indicator) */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all border border-transparent hover:border-white/[0.08]"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
        </button>

        <div className="w-px h-5 bg-white/[0.08]" />

        <DarkModeToggle />

        <div className="w-px h-5 bg-white/[0.08]" />

        {/* User chip */}
        {user && (
          <div className="hidden sm:flex items-center gap-2.5 pl-1">
            <div className="text-right">
              <div className="text-xs font-semibold text-white/80 leading-tight">{user.name}</div>
              <div className="text-[10px] text-white/30">{user.branch} · Yr {user.year}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow shadow-indigo-500/20">
              {user.name ? user.name.charAt(0).toUpperCase() : '?'}
            </div>
          </div>
        )}

        <div className="w-px h-5 bg-white/[0.08]" />

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
