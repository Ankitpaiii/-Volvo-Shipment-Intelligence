import React, { useState, useEffect, useCallback } from 'react';
import GroupCard from '../components/studygroups/GroupCard';
import MatchResults from '../components/studygroups/MatchResults';
import Spinner from '../components/ui/Spinner';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Users, Plus, Sparkles, BookOpen, Calendar, ShieldAlert } from 'lucide-react';

export default function StudyGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchData, setMatchData] = useState(null);

  // Group Creation Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [maxMembers, setMaxMembers] = useState('5');
  const [selectedInvitees, setSelectedInvitees] = useState([]); // Array of studentIds
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Retrieve current student user info
  const userString = localStorage.getItem('campusflow_user');
  const currentUser = userString ? JSON.parse(userString) : null;

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/study-groups');
      setGroups(response.data.groups || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load study groups.');
    } finally {
      setLoading(false);
    }
  }, []);

  const runMatchmaker = async () => {
    setMatchingLoading(true);
    try {
      const response = await api.post('/api/study-groups/match');
      setMatchData(response.data);
      // Save classmates profiles from matches to select for invitations
      if (response.data.matches) {
        setClassmates(response.data.matches);
      }
      toast.success('AI matchmaking profiles compiled! 🧠');
    } catch (err) {
      console.error(err);
      toast.error('Failed to execute AI matchmaking.');
    } finally {
      setMatchingLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    // Pre-fetch matching profiles silently to populate classmates selector
    api.post('/api/study-groups/match')
      .then(res => {
        if (res.data.matches) {
          setClassmates(res.data.matches);
        }
      })
      .catch(console.error);
  }, [fetchGroups]);

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim()) {
      toast.error('Title and Subject are required.');
      return;
    }

    try {
      await api.post('/api/study-groups', {
        title: title.trim(),
        subject: subject.trim(),
        scheduled_at: scheduledAt || null,
        max_members: parseInt(maxMembers, 10),
        invitees: selectedInvitees
      });

      toast.success('Study group scheduled! WhatsApp invites sent 📲');
      // Reset form
      setTitle('');
      setSubject('');
      setScheduledAt('');
      setMaxMembers('5');
      setSelectedInvitees([]);
      setShowCreateForm(false);
      
      // Refresh list
      fetchGroups();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to schedule study group.');
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await api.post(`/api/study-groups/${groupId}/join`);
      toast.success('Joined study group session! 📅');
      fetchGroups();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to join group.');
    }
  };

  const handleAddInvitee = (studentId, name) => {
    if (selectedInvitees.includes(studentId)) {
      toast.error(`${name} is already in the invite list.`);
      return;
    }
    setSelectedInvitees(prev => [...prev, studentId]);
    setShowCreateForm(true);
    toast.success(`Added ${name} to invitation list in form! 📝`);
  };

  const toggleInviteeSelection = (studentId) => {
    setSelectedInvitees(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Study Group Scheduler
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Coordinate subject study blocks, invite classmates via WhatsApp prompts, and run AI matchmaker checks to find compatible partners.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Create form & Matchmaker widgets */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Create Group Form Card */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4.5 h-4.5 text-blue-600" />
                Schedule Session
              </h2>
              {!showCreateForm && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="text-xs text-blue-600 dark:text-blue-450 font-black hover:underline"
                >
                  Configure
                </button>
              )}
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Group Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Midterm Preparation"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Subject Topic
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Compiler Design"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Max Members
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(e.target.value)}
                      className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Multiselect invitees from loaded classmates */}
                {classmates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Invite Classmates (via WhatsApp)
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto border border-gray-150 dark:border-gray-750 p-2.5 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
                      {classmates.map(classmate => {
                        const isInvited = selectedInvitees.includes(classmate.studentId || classmate.id);
                        return (
                          <button
                            key={classmate.studentId || classmate.id}
                            type="button"
                            onClick={() => toggleInviteeSelection(classmate.studentId || classmate.id)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                              isInvited
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                          >
                            {classmate.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                  >
                    Save Group
                  </button>
                </div>
              </form>
            )}
            
            {!showCreateForm && (
              <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center bg-gray-50/50 dark:bg-gray-900/10">
                <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                  Click Configure above to schedule a new study group session and invite peers.
                </p>
              </div>
            )}
          </div>

          {/* AI Matchmaker Trigger widget */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI Matchmaker
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
              Find classmates from your year and branch who study matching subjects and share compatible schedules.
            </p>
            <button
              type="button"
              onClick={runMatchmaker}
              disabled={matchingLoading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              {matchingLoading ? (
                <>
                  <Spinner size="sm" />
                  Calculating matches...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Find Study Partners
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Side: Group lists / Matches display */}
        <div className="lg:col-span-2 space-y-6">
          {matchData && (
            <MatchResults
              matchData={matchData}
              onInvite={handleAddInvitee}
            />
          )}

          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-450 uppercase tracking-wider">
              Active Study Sessions
            </h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : groups.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center">
                <Users className="w-16 h-16 text-gray-300 dark:text-gray-650 mb-3" />
                <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                  No active study groups
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1 leading-relaxed font-semibold">
                  Be the first to schedule a session and coordinate study blocks with your classmates!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {groups.map(group => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    currentUserId={currentUser?.id}
                    onJoin={handleJoinGroup}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
