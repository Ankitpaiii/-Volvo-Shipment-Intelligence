import React, { useState, useEffect } from 'react';
import SWOTChart from '../components/brainspace/SWOTChart';
import MarketAnalysis from '../components/brainspace/MarketAnalysis';
import ScoreCard from '../components/brainspace/ScoreCard';
import Spinner from '../components/ui/Spinner';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Rocket, Sparkles, Printer, Trash2, ChevronRight, FileText, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function BrainSpacePage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Active selected report
  const [selectedReport, setSelectedReport] = useState(null);

  // Form input state
  const [idea, setIdea] = useState('');
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [showForm, setShowForm] = useState(false);

  // AI loading status
  const [aiLoading, setAiLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/brainspace/reports');
      setReports(response.data.reports || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load startup validation history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleValidateSubmit = async (e) => {
    e.preventDefault();
    if (!idea.trim() || !problem.trim() || !solution.trim() || !targetAudience.trim()) {
      toast.error('All fields are required to validate your idea.');
      return;
    }

    setAiLoading(true);
    setSelectedReport(null);
    try {
      const response = await api.post('/api/brainspace/startup-validate', {
        idea: idea.trim(),
        problem: problem.trim(),
        solution: solution.trim(),
        targetAudience: targetAudience.trim()
      });

      const newReport = response.data.report;
      setSelectedReport(newReport);
      
      // Reset form
      setIdea('');
      setProblem('');
      setSolution('');
      setTargetAudience('');
      setShowForm(false);
      
      toast.success('Startup idea validated successfully! 🚀');
      fetchReports();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'AI validation failed. Please check inputs.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.stopPropagation(); // Prevent opening the report
    try {
      await api.delete(`/api/brainspace/reports/${reportId}`);
      setReports(prev => prev.filter(r => r.id !== reportId));
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
      toast.success('Report deleted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete report.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 print:p-0 print:pb-0">
      
      {/* Header (Hidden on Print) */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Rocket className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            BrainSpace Startup Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Validate B.Tech startup ideas, run TAM/SAM market research, construct SWOT maps, and export pitch documents.
          </p>
        </div>

        {selectedReport ? (
          <button
            type="button"
            onClick={() => setSelectedReport(null)}
            className="py-2.5 px-4 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to List
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="py-2.5 px-4 bg-blue-650 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Validate Idea
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: List & Form (Hidden on Print) */}
        {!selectedReport && (
          <div className="lg:col-span-1 space-y-6 print:hidden">
            
            {/* Validation Form */}
            {showForm && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-gray-950 dark:text-white">
                  Validate New Idea
                </h3>
                
                <form onSubmit={handleValidateSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Startup Concept Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PeerGrading Marketplace"
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Problem Statement
                    </label>
                    <textarea
                      required
                      placeholder="Describe the target problem clearly..."
                      rows={3}
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      className="w-full p-3 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 leading-relaxed font-semibold text-gray-800 dark:text-white"
                    ></textarea>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Your Solution
                    </label>
                    <textarea
                      required
                      placeholder="Describe how your solution solves it..."
                      rows={3}
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      className="w-full p-3 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 leading-relaxed font-semibold text-gray-800 dark:text-white"
                    ></textarea>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. B.Tech Students & Colleges"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                    >
                      Audit Idea
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Validate Ideas list history */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Validation History
              </h2>

              {loading && reports.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Spinner size="md" />
                </div>
              ) : reports.length === 0 ? (
                <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center bg-gray-50/50 dark:bg-gray-900/10">
                  <p className="text-[10px] text-gray-400 font-semibold italic">No audits generated yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {reports.map(report => {
                    const analysis = report.analysis || {};
                    return (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => setSelectedReport(report)}
                        className="w-full text-left p-3.5 border border-gray-150 dark:border-gray-750 hover:border-blue-150 dark:hover:border-blue-900/30 rounded-2xl flex items-center justify-between gap-3 text-xs bg-gray-50/20 dark:bg-gray-900/5 transition-all group"
                      >
                        <div className="truncate space-y-1">
                          <p className="truncate font-black text-gray-850 dark:text-gray-300 group-hover:text-blue-600">
                            {report.idea}
                          </p>
                          <div className="flex items-center gap-2 text-[9px] text-gray-400 font-bold">
                            <span>Score: {analysis.feasibilityScore || 0}%</span>
                            <span>•</span>
                            <span>{report.created_at ? format(new Date(report.created_at), 'MMM d, yyyy') : ''}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteReport(report.id, e)}
                          className="text-gray-300 dark:text-gray-600 hover:text-rose-500 transition-colors p-1 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* RIGHT COLUMN: Validated Report Viewport */}
        <div className={`lg:col-span-2 ${selectedReport ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          {aiLoading ? (
            <div className="min-h-[380px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center print:hidden">
              <Spinner size="lg" className="mb-3" />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">
                AI Startup Validator is conducting competitive analysis, TAM scoping, SWOT mapping, and computing viability index... 📈
              </p>
            </div>
          ) : selectedReport ? {
            // Destructure active report elements
            ...(() => {
              const analysis = selectedReport.analysis || {};
              return (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
                  
                  {/* Action row (Hidden on Print) */}
                  <div className="flex justify-between items-center border-b border-gray-150 dark:border-gray-700/60 pb-4 print:hidden">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg flex items-center gap-1 w-max">
                      <Rocket className="w-3.5 h-3.5" /> Idea validation report
                    </span>
                    
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="py-2 px-4 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Export Report (PDF)
                    </button>
                  </div>

                  {/* Header Title block */}
                  <div className="space-y-1.5">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                      Startup Concept Audit: <span className="text-blue-600 dark:text-blue-450">"{selectedReport.idea}"</span>
                    </h2>
                    <p className="text-xs text-gray-450 font-bold uppercase tracking-wider">
                      viability scorecard & recommendations
                    </p>
                  </div>

                  {/* Verdict Block */}
                  {analysis.overallVerdict && (
                    <div className="p-5 bg-blue-50/20 dark:bg-blue-950/10 border border-blue-150/40 dark:border-blue-900/30 rounded-3xl space-y-1.5">
                      <h3 className="text-xs font-black uppercase text-blue-800 dark:text-blue-400 tracking-wider">
                        VIABILITY VERDICT & FEASIBILITY INDEX
                      </h3>
                      <p className="text-xs text-blue-900 dark:text-blue-300 font-semibold leading-relaxed">
                        {analysis.overallVerdict}
                      </p>
                    </div>
                  )}

                  {/* Rating progress indicators */}
                  <ScoreCard
                    riskScore={analysis.riskScore || 0}
                    feasibilityScore={analysis.feasibilityScore || 0}
                    scalabilityScore={analysis.scalabilityScore || 0}
                  />

                  {/* SWOT quadrant */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-450 uppercase tracking-wider pl-1">
                      SWOT Strategic Analysis
                    </h3>
                    <SWOTChart swot={analysis.swot} />
                  </div>

                  {/* Market Scoping TAM/SAM */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-450 uppercase tracking-wider pl-1">
                      Market Sizing & Revenue Models
                    </h3>
                    <MarketAnalysis
                      tam={analysis.tam}
                      sam={analysis.sam}
                      som={analysis.som}
                      revenueModel={analysis.revenueModel}
                    />
                  </div>

                  {/* Recommendations */}
                  {analysis.recommendations && analysis.recommendations.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-450 uppercase tracking-wider pl-1">
                        Execution Roadmap & Recommendations
                      </h3>
                      
                      <div className="space-y-2">
                        {analysis.recommendations.map((rec, i) => (
                          <div
                            key={i}
                            className="p-3 border border-gray-150 dark:border-gray-750 bg-gray-50/20 dark:bg-gray-900/5 rounded-2xl text-[10px] font-semibold text-gray-650 dark:text-gray-400 flex items-start gap-2.5"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="leading-normal font-semibold text-gray-700 dark:text-gray-300">
                              {rec}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()
          } : (
            /* Canvas Empty state */
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center print:hidden">
              <Rocket className="w-16 h-16 text-gray-300 dark:text-gray-655 mb-4" />
              <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                Startup Viability Report Board
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-5 leading-relaxed font-semibold">
                Submit details of your B.Tech startup idea on the left or select an audit from history. The validator will score market dimensions, SWOT characteristics, and TAM sizes.
              </p>
              
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl text-[10px] text-blue-800 dark:text-blue-300 font-semibold text-left max-w-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0 text-blue-600" />
                Audits are persistent: generate a feasibility scorecard, then download it as a print-formatted PDF.
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
