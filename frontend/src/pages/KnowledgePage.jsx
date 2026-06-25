import React, { useState, useEffect } from 'react';
import { useKnowledge } from '../hooks/useKnowledge';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import { FileText, Search, UploadCloud, Trash2, Sparkles, BookOpen, AlertCircle, Quote } from 'lucide-react';
import { format } from 'date-fns';

export default function KnowledgePage() {
  const {
    documents,
    loading,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    searchKnowledge
  } = useKnowledge();

  // Upload form state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('academic');
  const [isUploading, setIsUploading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast.error('Only PDF documents are supported.');
      setSelectedFile(null);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a PDF document first.');
      return;
    }

    setIsUploading(true);
    try {
      await uploadDocument(selectedFile, uploadCategory);
      setSelectedFile(null);
      // Re-fetch documents
      fetchDocuments();
    } catch (err) {
      // error handled in hook
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a query to search.');
      return;
    }

    setSearchLoading(true);
    setHasSearched(true);
    try {
      const categoryFilter = searchCategory === 'all' ? null : searchCategory;
      const results = await searchKnowledge(searchQuery.trim(), categoryFilter);
      setSearchResults(results);
      toast.success(`Retrieved ${results.length} semantic citations! 📑`);
    } catch (err) {
      // errors handled by hooks
    } finally {
      setSearchLoading(false);
    }
  };

  const categoryLabels = {
    academic: 'Academic Notes',
    placement: 'Placement Prep',
    startup: 'BrainSpace Startup'
  };

  const categoryBadgeColors = {
    academic: 'bg-blue-50 dark:bg-blue-900/20 text-blue-750 dark:text-blue-300 border-blue-150',
    placement: 'bg-purple-50 dark:bg-purple-900/20 text-purple-750 dark:text-purple-300 border-purple-150',
    startup: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-750 dark:text-cyan-300 border-cyan-150'
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          RAG Knowledge Base
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Upload reference text files (PDF format) and query them semantically to retrieve source-grounded answers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Upload Panel & Document Directory */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Upload Widget */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-600" />
              Index PDF Document
            </h2>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Target Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs focus:border-blue-500 font-semibold text-gray-800 dark:text-white"
                >
                  <option value="academic">Academic Notes</option>
                  <option value="placement">Placement Material</option>
                  <option value="startup">BrainSpace / Startup Ideas</option>
                </select>
              </div>

              {/* Custom File picker styling */}
              <div className="border-2 border-dashed border-gray-250 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-900/40 rounded-2xl p-5 text-center transition-all bg-gray-50/30 dark:bg-gray-900/5 relative cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileText className="w-8 h-8 text-gray-300 dark:text-gray-650 mx-auto mb-2" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-450 block truncate">
                  {selectedFile ? selectedFile.name : 'Choose PDF file or drop here'}
                </span>
                <span className="text-[9px] text-gray-400 block mt-0.5">
                  PDF format (max size 10MB)
                </span>
              </div>

              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isUploading ? (
                  <>
                    <Spinner size="sm" /> Indexing Document...
                  </>
                ) : (
                  'Index Document & Create Chunks'
                )}
              </button>
            </form>
          </div>

          {/* Document Directory */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Indexed Documents ({documents.length})
            </h2>

            {loading && documents.length === 0 ? (
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center bg-gray-50/50 dark:bg-gray-900/10">
                <p className="text-[10px] text-gray-400 font-semibold italic">No documents indexed yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 border border-gray-150 dark:border-gray-750 rounded-2xl flex items-start justify-between gap-3 text-[10px] font-semibold bg-gray-50/20 dark:bg-gray-900/5 hover:border-gray-250 dark:hover:border-gray-700 transition-colors"
                  >
                    <div className="truncate space-y-1">
                      <p className="truncate font-black text-gray-800 dark:text-gray-300">
                        {doc.filename}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${categoryBadgeColors[doc.category]}`}>
                          {categoryLabels[doc.category] || doc.category}
                        </span>
                        <span className="text-[8px] text-gray-400 font-bold">
                          {doc.chunk_count} chunks
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id)}
                      className="text-gray-300 dark:text-gray-600 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Semantic Query Viewport */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Query Bar */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700/60 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Ask a question from your indexed reference files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 border border-gray-250 dark:border-gray-705 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs placeholder-gray-400 focus:border-blue-500 font-semibold focus:outline-none text-gray-850 dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="p-3 border border-gray-250 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl text-xs focus:border-blue-500 font-semibold text-gray-850 dark:text-white"
                >
                  <option value="all">All Files</option>
                  <option value="academic">Academic Notes</option>
                  <option value="placement">Placement Docs</option>
                  <option value="startup">BrainSpace Docs</option>
                </select>

                <button
                  type="submit"
                  disabled={searchLoading}
                  className="py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {searchLoading ? <Spinner size="sm" /> : 'Search'}
                </button>
              </div>
            </form>
          </div>

          {/* Search results mapping list */}
          <div className="space-y-4">
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white/50 dark:bg-gray-800/10">
                <Spinner size="lg" className="mb-3" />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                  Semantic index query active: comparing vectors locally... 🔎
                </p>
              </div>
            ) : hasSearched && searchResults.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 rounded-3xl min-h-[300px] flex flex-col justify-center items-center">
                <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-650 mb-3" />
                <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                  No matching citations found
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1 leading-relaxed font-semibold">
                  Your search query returned 0 semantically relevant matches. Try broadening your keywords or index more documents.
                </p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-450 uppercase tracking-wider pl-1">
                  Semantic Citations Found ({searchResults.length})
                </h3>
                
                <div className="space-y-4">
                  {searchResults.map((result, idx) => {
                    const matchPercent = Math.round(result.similarity * 100);
                    return (
                      <div
                        key={idx}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-3xl p-5 shadow-sm space-y-3"
                      >
                        {/* Meta info */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-150 text-blue-700 dark:text-blue-300 rounded-lg">
                              Citation {idx + 1}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${categoryBadgeColors[result.category]}`}>
                              {categoryLabels[result.category] || result.category}
                            </span>
                          </div>
                          
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                            {matchPercent}% Match Similarity
                          </span>
                        </div>

                        {/* Chunk snippet */}
                        <div className="flex gap-2">
                          <Quote className="w-5 h-5 text-gray-300 dark:text-gray-650 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold whitespace-pre-line">
                            {result.content}
                          </p>
                        </div>

                        {/* File origin citation footer */}
                        <div className="text-[10px] text-gray-400 font-bold border-t border-gray-150 dark:border-gray-750 pt-2 flex items-center gap-1">
                          <span>Source file:</span>
                          <span className="text-gray-600 dark:text-gray-350">{result.filename}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Canvas Empty state */
              <div className="h-full min-h-[360px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 p-8 text-center">
                <Search className="w-16 h-16 text-gray-300 dark:text-gray-655 mb-4" />
                <h3 className="text-sm font-bold text-gray-750 dark:text-gray-350">
                  Semantic Search Console
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-5 leading-relaxed font-semibold">
                  Index lecture notes, syllabus drafts, or interview materials, then write inquiries in plain English to pull matched snippets along with document origins.
                </p>
                
                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl text-[10px] text-blue-800 dark:text-blue-300 font-semibold text-left max-w-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0 text-blue-600" />
                  Offline matching enabled: query calculations executed locally without API delays.
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
