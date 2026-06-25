import React, { useState, useEffect } from 'react';
import { usePlacement } from '../hooks/usePlacement';
import CompanyCard from '../components/placement/CompanyCard';
import DSAProblem from '../components/placement/DSAProblem';
import InterviewPanel from '../components/placement/InterviewPanel';
import ResumeResult from '../components/placement/ResumeResult';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import { Briefcase, Target, HelpCircle, FileText, Plus, Sparkles, AlertCircle, BookOpen } from 'lucide-react';

export default function PlacementPage() {
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' | 'dsa' | 'mock' | 'resume'
  const {
    companies,
    loading,
    fetchCompanies,
    addCompany,
    updateCompany,
    deleteCompany,
    generateDSA,
    startMockInterview,
    submitInterviewAnswers,
    analyzeResumeATS
  } = usePlacement();

  // Company tracker form state
  const [compName, setCompName] = useState('');
  const [compRole, setCompRole] = useState('');
  const [compStatus, setCompStatus] = useState('applied');
  const [compNotes, setCompNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // DSA Dojo state
  const [dsaTopic, setDsaTopic] = useState('Arrays');
  const [dsaDiff, setDsaDiff] = useState('medium');
  const [dsaProblem, setDsaProblem] = useState(null);

  // Mock Interview state
  const [mockType, setMockType] = useState('Technical');
  const [studentContext, setStudentContext] = useState('');
  const [interviewData, setInterviewData] = useState(null);

  // Resume ATS state
  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [atsResult, setAtsResult] = useState(null);

  // AI actions loading states
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'tracker') {
      fetchCompanies();
    }
  }, [activeTab, fetchCompanies]);

  const handleAddCompanySubmit = async (e) => {
    e.preventDefault();
    if (!compName.trim()) {
      toast.error('Company name is required.');
      return;
    }
    try {
      await addCompany({
        company_name: compName.trim(),
        role: compRole.trim(),
        status: compStatus,
        notes: compNotes.trim(),
        interview_rounds: []
      });
      // Reset form
      setCompName('');
      setCompRole('');
      setCompStatus('applied');
      setCompNotes('');
      setShowAddForm(false);
    } catch (err) {
      // error handled in hook
    }
  };

  const handleGenerateDSA = async () => {
    setAiLoading(true);
    setDsaProblem(null);
    try {
      const problem = await generateDSA(dsaTopic, dsaDiff);
      setDsaProblem(problem);
      toast.success('Original DSA problem loaded! 🎯');
    } catch (err) {
      // errors handled by hooks
    } finally {
      setAiLoading(false);
    }
  };

  const handleStartInterview = async () => {
    setAiLoading(true);
    setInterviewData(null);
    try {
      const interview = await startMockInterview(mockType, studentContext.trim());
      setInterviewData(interview);
      toast.success('Mock interview questions prepared! Speak clearly. 🎙️');
    } catch (err) {
      // errors handled by hooks
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnalyzeResume = async (e) => {
    e.preventDefault();
    if (!resumeText.trim()) {
      toast.error('Please paste your resume content.');
      return;
    }
    setAiLoading(true);
    setAtsResult(null);
    try {
      const analysis = await analyzeResumeATS(resumeText.trim(), targetRole.trim());
      setAtsResult(analysis);
      toast.success('ATS resume scan complete! 🔎');
    } catch (err) {
      // errors handled by hooks
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Briefcase className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Placement Prep Tracker
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Log interview schedules, generate custom mock Q&As, practice coding, and verify resume ATS standards.
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex bg-gray-150/70 dark:bg-gray-800 p-1 rounded-2xl max-w-2xl border border-gray-200/50 dark:border-gray-700/50 flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'tracker'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Company Tracker
        </button>
        
        <button
          onClick={() => setActiveTab('dsa')}
          className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'dsa'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Target className="w-4 h-4" />
          DSA Dojo
        </button>

        <button
          onClick={() => setActiveTab('mock')}
          className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'mock'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Mock Interview
        </button>

        <button
          onClick={() => setActiveTab('resume')}
          className={`flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'resume'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Resume Checker
        </button>
      </div>

      {/* Main Tab Content Viewport */}
      <div>
        
        {/* TABS 1: Company tracker */}
        {activeTab === 'tracker' && (
          <div className="space-y-6">
            
            {/* Header + Add button */}
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Tracked Applications
              </h2>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Track Company
              </button>
            </div>

            {/* Add Company Form Panel */}
            {showAddForm && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm max-w-xl mx-auto">
                <form onSubmit={handleAddCompanySubmit} className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-950 dark:text-white">
                    Track New Company Application
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Company Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Google"
                        value={compName}
                        onChange={(e) => setCompName(e.target.value)}
                        className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Target Role
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Software Engineer Intern"
                        value={compRole}
                        onChange={(e) => setCompRole(e.target.value)}
                        className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Initial Status
                    </label>
                    <select
                      value={compStatus}
                      onChange={(e) => setCompStatus(e.target.value)}
                      className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                    >
                      <option value="applied">Applied</option>
                      <option value="oa">Online Assessment (OA)</option>
                      <option value="interview">Interview Scheduled</option>
                      <option value="offered">Offer Received</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Application Notes
                    </label>
                    <textarea
                      placeholder="Add notes, links to job posts, key details..."
                      rows={4}
                      value={compNotes}
                      onChange={(e) => setCompNotes(e.target.value)}
                      className="w-full p-4 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 leading-relaxed font-semibold text-gray-800 dark:text-white"
                    ></textarea>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                    >
                      Save Track
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* List grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : companies.length === 0 ? (
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 dark:text-gray-650 mb-3" />
                <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                  Track job search roadmap
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1 leading-relaxed font-semibold">
                  Register applications here to schedule WhatsApp reminder tasks and block slots on your calendar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.map(company => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    onUpdate={updateCompany}
                    onDelete={deleteCompany}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TABS 2: DSA Dojo */}
        {activeTab === 'dsa' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Generator parameters */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                DSA Problem Generator
              </h2>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Data Structure / Topic
                </label>
                <select
                  value={dsaTopic}
                  onChange={(e) => setDsaTopic(e.target.value)}
                  className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                >
                  <option value="Arrays">Arrays</option>
                  <option value="Strings">Strings</option>
                  <option value="Linked Lists">Linked Lists</option>
                  <option value="Trees & Binary Search Trees">Trees & BST</option>
                  <option value="Graphs & Traversal">Graphs</option>
                  <option value="Dynamic Programming">Dynamic Programming (DP)</option>
                  <option value="Recursion & Backtracking">Recursion & Backtracking</option>
                  <option value="Sorting & Searching">Sorting & Searching</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Difficulty Level
                </label>
                <select
                  value={dsaDiff}
                  onChange={(e) => setDsaDiff(e.target.value)}
                  className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateDSA}
                disabled={aiLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                {aiLoading ? (
                  <>
                    <Spinner size="sm" /> Creating DSA problem...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Propose Original Problem
                  </>
                )}
              </button>
            </div>

            {/* Display problem results */}
            <div className="lg:col-span-2">
              {dsaProblem ? (
                <DSAProblem problem={dsaProblem} />
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center">
                  <Target className="w-12 h-12 text-gray-300 dark:text-gray-650 mb-3" />
                  <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                    DSA Problem Canvas
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1 leading-relaxed font-semibold">
                    Generate unique, non-Leetcode coding prompts complete with reference implementations and hints.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TABS 3: Mock Interview */}
        {activeTab === 'mock' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Configure Interview parameters */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Mock Interviewer
              </h2>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Focus Type
                </label>
                <select
                  value={mockType}
                  onChange={(e) => setMockType(e.target.value)}
                  className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                >
                  <option value="Technical">Technical (DSA, Systems, Languages)</option>
                  <option value="HR / General">HR & Culture Fit</option>
                  <option value="Behavioral">Behavioral (STAR method prep)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Candidate Context (Resume / Projects)
                </label>
                <textarea
                  placeholder="Paste details of projects, internships, coding languages, or resume highlights to tailor questions..."
                  rows={6}
                  value={studentContext}
                  onChange={(e) => setStudentContext(e.target.value)}
                  className="w-full p-3 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 leading-relaxed font-semibold text-gray-800 dark:text-white"
                ></textarea>
              </div>

              <button
                type="button"
                onClick={handleStartInterview}
                disabled={aiLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                {aiLoading ? (
                  <>
                    <Spinner size="sm" /> Preparing session...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Start Interview Prep
                  </>
                )}
              </button>
            </div>

            {/* Display interview panel */}
            <div className="lg:col-span-2">
              {interviewData ? (
                <InterviewPanel
                  interview={interviewData}
                  onSubmitAnswers={submitInterviewAnswers}
                />
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center">
                  <HelpCircle className="w-12 h-12 text-gray-300 dark:text-gray-655 mb-3" />
                  <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                    Interview Practice Panel
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1 leading-relaxed font-semibold">
                    Complete 5 tailored mock questions, record responses using voice input, and review a complete graded ATS scorecard.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TABS 4: Resume Checker */}
        {activeTab === 'resume' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Input resume text */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm">
              <form onSubmit={handleAnalyzeResume} className="space-y-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  ATS Scanner
                </h2>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Target Job Role
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Frontend Engineer"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Resume Plain Text
                  </label>
                  <textarea
                    required
                    placeholder="Copy and paste the entire plain text content of your resume/CV here..."
                    rows={8}
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    className="w-full p-3.5 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 leading-relaxed font-semibold text-gray-800 dark:text-white"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={aiLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {aiLoading ? (
                    <>
                      <Spinner size="sm" /> Auditing resume text...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Scan ATS Score
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Display ATS results */}
            <div className="lg:col-span-2">
              {atsResult ? (
                <ResumeResult analysis={atsResult} />
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-300 dark:text-gray-655 mb-3" />
                  <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                    ATS Audit Results
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1 leading-relaxed font-semibold">
                    Paste plain text content to scan matching keywords, identify strengths/weaknesses, and receive section-specific ATS updates.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
