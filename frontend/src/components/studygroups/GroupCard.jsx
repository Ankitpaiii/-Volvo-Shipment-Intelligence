import React from 'react';
import { Calendar, Users, Check, Sparkles, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

export default function GroupCard({ group, currentUserId, onJoin }) {
  const {
    id,
    title,
    subject,
    scheduled_at,
    max_members,
    creator,
    members = []
  } = group;

  const isCreator = group.creator_id === currentUserId;
  const isMember = members.some(m => m.student_id === currentUserId);
  const isFull = members.length >= max_members;

  const formattedDate = scheduled_at
    ? format(new Date(scheduled_at), 'PPP p')
    : 'Not scheduled yet';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm space-y-4 hover:border-blue-100 dark:hover:border-blue-900/30 transition-all">
      
      {/* Title */}
      <div>
        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg">
          {subject}
        </span>
        <h3 className="text-base font-black text-gray-900 dark:text-white mt-2 leading-snug">
          {title}
        </h3>
        <p className="text-[10px] text-gray-400 font-bold mt-0.5">
          Organized by: {isCreator ? 'You' : creator?.name || 'Classmate'}
        </p>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
        <Calendar className="w-3.5 h-3.5 text-gray-400" />
        <span>{formattedDate}</span>
      </div>

      {/* Members list */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span>Active Members</span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {members.length} / {max_members}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
          {members.map((m, idx) => {
            const isMe = m.student_id === currentUserId;
            return (
              <span
                key={idx}
                className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                  isMe
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-350'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-150 dark:border-gray-750 text-gray-600 dark:text-gray-400'
                }`}
              >
                {m.student?.name || 'Classmate'} {isMe && '(You)'}
              </span>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2">
        {isMember ? (
          <div className="w-full py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-350 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 shadow-sm">
            <Check className="w-4 h-4" />
            Joined Study Group
          </div>
        ) : isFull ? (
          <div className="w-full py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-850 text-gray-400 dark:text-gray-500 rounded-xl text-[10px] font-black text-center shadow-sm">
            Group is full
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onJoin(id)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Join Study Session
          </button>
        )}
      </div>

    </div>
  );
}
