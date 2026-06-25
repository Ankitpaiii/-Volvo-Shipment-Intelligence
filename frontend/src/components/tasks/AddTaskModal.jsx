import React from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { X, Calendar, MessageSquare, AlertTriangle, Plus } from 'lucide-react';

export default function AddTaskModal({ isOpen, onClose, onAdd }) {
  const { user } = useAuth();
  const subjects = user?.subjects || [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      title: '',
      subject: '',
      deadline: '',
      add_to_calendar: true,
      whatsapp_reminder_offset: '24'
    }
  });

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    try {
      const deadlineDate = new Date(data.deadline);
      const offsetHours = parseInt(data.whatsapp_reminder_offset, 10);
      const reminderDate = new Date(deadlineDate.getTime() - offsetHours * 60 * 60 * 1000);

      await onAdd({
        title: data.title,
        subject: data.subject,
        deadline: deadlineDate.toISOString(),
        reminder_time: reminderDate.toISOString(),
        add_to_calendar: data.add_to_calendar,
      });

      reset();
      onClose();
    } catch (err) {
      // Errors handled by parent hook via toast
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel animate-scale-in" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/25 flex items-center justify-center">
              <Plus className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Add Task / Deadline</h2>
              <p className="text-[10px] text-white/30">Triggers n8n calendar + WhatsApp automation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all border border-transparent hover:border-white/[0.08]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {subjects.length === 0 ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/80">No Subjects Configured</h3>
              <p className="text-xs text-white/40 mt-1 leading-relaxed">
                Your profile has no subjects. Please register with active B.Tech subjects.
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-secondary text-xs px-4 py-2">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

            {/* Title */}
            <div>
              <label className="label-premium">Task Title</label>
              <input
                type="text"
                placeholder="e.g. DBMS Lab Assignment 2"
                className="input-premium"
                {...register('title', { required: 'Task title is required' })}
              />
              {errors.title && (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-400">{errors.title.message}</p>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="label-premium">Subject</label>
              <select
                className="input-premium"
                style={{ colorScheme: 'dark' }}
                {...register('subject', { required: 'Please select a subject' })}
              >
                <option value="" style={{ background: '#0F1629' }}>Choose subject</option>
                {subjects.map((sub) => (
                  <option key={sub} value={sub} style={{ background: '#0F1629' }}>{sub}</option>
                ))}
              </select>
              {errors.subject && (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-400">{errors.subject.message}</p>
              )}
            </div>

            {/* Deadline */}
            <div>
              <label className="label-premium">Deadline Date &amp; Time</label>
              <input
                type="datetime-local"
                className="input-premium"
                style={{ colorScheme: 'dark' }}
                {...register('deadline', { required: 'Deadline is required' })}
              />
              {errors.deadline && (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-400">{errors.deadline.message}</p>
              )}
            </div>

            {/* WhatsApp Reminder */}
            <div>
              <label className="label-premium flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-emerald-400" />
                WhatsApp Reminder
              </label>
              <select
                className="input-premium"
                style={{ colorScheme: 'dark' }}
                {...register('whatsapp_reminder_offset', { required: true })}
              >
                <option value="24" style={{ background: '#0F1629' }}>24 hours before</option>
                <option value="12" style={{ background: '#0F1629' }}>12 hours before</option>
                <option value="6" style={{ background: '#0F1629' }}>6 hours before</option>
                <option value="1" style={{ background: '#0F1629' }}>1 hour before</option>
                <option value="0" style={{ background: '#0F1629' }}>At deadline time</option>
              </select>
            </div>

            {/* Calendar Toggle */}
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-blue-500"
                {...register('add_to_calendar')}
              />
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-white/70">Add to Google Calendar</span>
              </div>
            </label>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
