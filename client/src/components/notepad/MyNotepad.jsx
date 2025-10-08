// src/components/notepad/MyNotepad.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Search, X, Clock, Download, Maximize2, Minimize2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const MyNotepad = () => {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    characterCount: 0,
    wordCount: 0,
    lineCount: 0,
    lastModified: null
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "saving", "saved", ""
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [noteHistory, setNoteHistory] = useState([]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const autoSaveTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  const token = localStorage.getItem("token");

  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  // Fetch notepad content
  const fetchNotepad = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${API_BASE}/api/notepad/my-notepad`,
        getAxiosConfig()
      );

      if (response.data.success) {
        const notepadContent = response.data.data.content || "";
        setContent(notepadContent);
        setSavedContent(notepadContent);
        setHasUnsavedChanges(false);

        // Load history if available
        if (response.data.data.history) {
          setNoteHistory(response.data.data.history.slice(0, 5));
        }
      }
    } catch (error) {
      console.error("Error fetching notepad:", error);
      toast.error("Failed to load notepad");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Fetch notepad stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/notepad/stats`,
        getAxiosConfig()
      );

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchNotepad();
    fetchStats();
  }, [fetchNotepad, fetchStats]);

  // Save notepad function
  const saveNotepad = async (silent = false) => {
    if (content === savedContent) {
      if (!silent) toast.info("No changes to save");
      return;
    }

    try {
      setIsSaving(true);
      if (silent) setAutoSaveStatus("saving");

      const response = await axios.put(
        `${API_BASE}/api/notepad/my-notepad`,
        { content },
        getAxiosConfig()
      );

      if (response.data.success) {
        setSavedContent(content);
        setHasUnsavedChanges(false);

        if (silent) {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus(""), 2000);
        } else {
          toast.success("Notepad saved successfully");
        }

        fetchStats(); // Update stats after save

        // Refresh history
        fetchNotepad();
      }
    } catch (error) {
      console.error("Error saving notepad:", error);
      if (!silent) {
        toast.error(error.response?.data?.error || "Failed to save notepad");
      }
      setAutoSaveStatus("");
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced auto-save - saves 2 seconds after user stops typing
  useEffect(() => {
    if (hasUnsavedChanges && content !== savedContent) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new timeout for 2 seconds
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveNotepad(true);
      }, 2000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, savedContent, hasUnsavedChanges]);

  // Handle content change
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasUnsavedChanges(newContent !== savedContent);
  };

  // Clear notepad
  const clearNotepad = () => {
    if (window.confirm("Are you sure you want to clear all content? This cannot be undone.")) {
      setContent("");
      setHasUnsavedChanges(true);
    }
  };

  // Search functionality
  const performSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const regex = new RegExp(searchTerm, 'gi');
    const matches = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      matches.push({
        index: match.index,
        text: match[0]
      });
    }

    setSearchResults(matches);
    setCurrentSearchIndex(0);
  }, [searchTerm, content]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Navigate search results
  const goToNextResult = () => {
    if (searchResults.length > 0) {
      const nextIndex = (currentSearchIndex + 1) % searchResults.length;
      setCurrentSearchIndex(nextIndex);
      highlightSearchResult(nextIndex);
    }
  };

  const goToPrevResult = () => {
    if (searchResults.length > 0) {
      const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentSearchIndex(prevIndex);
      highlightSearchResult(prevIndex);
    }
  };

  const highlightSearchResult = (index) => {
    if (textareaRef.current && searchResults[index]) {
      const result = searchResults[index];
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(result.index, result.index + result.text.length);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNotepad();
      }
      // Ctrl+F or Cmd+F to search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(!showSearch);
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchTerm("");
        setSearchResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, content, savedContent]);

  // Export functionality
  const exportNotepad = (format = 'txt') => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notepad_${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  // Load history note
  const loadHistoryNote = (historyContent) => {
    if (hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Load this version anyway?")) {
        return;
      }
    }
    setContent(historyContent);
    setHasUnsavedChanges(true);
    setShowHistory(false);
    toast.info("Previous version loaded. Save to keep these changes.");
  };

  // Calculate live stats
  const liveStats = {
    characterCount: content.length,
    wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
    lineCount: content.split('\n').length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading notepad...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#161c2c] rounded-xl shadow-lg border border-[#232945] p-6 ${isFullScreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">My Notepad</h3>
            <p className="text-sm text-gray-400">
              {isSaving || autoSaveStatus === "saving" ? (
                <span className="text-blue-400">● Saving...</span>
              ) : autoSaveStatus === "saved" ? (
                <span className="text-green-400">● Auto-saved</span>
              ) : hasUnsavedChanges ? (
                <span className="text-yellow-400">● Unsaved changes</span>
              ) : (
                <span className="text-green-400">● All changes saved</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            title="Search (Ctrl+F)"
          >
            <Search className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all relative"
            title="View History"
          >
            <Clock className="w-5 h-5 text-gray-400" />
            {noteHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {noteHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => exportNotepad('txt')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            title="Download"
          >
            <Download className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            title="Fullscreen"
          >
            {isFullScreen ? (
              <Minimize2 className="w-5 h-5 text-gray-400" />
            ) : (
              <Maximize2 className="w-5 h-5 text-gray-400" />
            )}
          </button>

          <button
            onClick={() => saveNotepad()}
            disabled={isSaving || !hasUnsavedChanges}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              hasUnsavedChanges && !isSaving
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </>
            )}
          </button>

          <button
            onClick={clearNotepad}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="mb-4 bg-[#0f1419] rounded-lg p-3 border border-[#232945]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in notepad..."
              className="flex-1 bg-transparent text-gray-100 outline-none text-sm"
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {currentSearchIndex + 1} / {searchResults.length}
                </span>
                <button
                  onClick={goToPrevResult}
                  className="p-1 hover:bg-gray-700 rounded"
                  title="Previous"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextResult}
                  className="p-1 hover:bg-gray-700 rounded"
                  title="Next"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchTerm("");
                setSearchResults([]);
              }}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="mb-4 bg-[#0f1419] rounded-lg p-4 border border-[#232945] max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Recent Versions (Last 5 saves)</h4>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          {noteHistory.length > 0 ? (
            <div className="space-y-2">
              {noteHistory.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-[#161c2c] rounded-lg hover:bg-[#1a2332] cursor-pointer transition-all border border-[#232945]"
                  onClick={() => loadHistoryNote(item.content)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.content.length} chars
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 truncate">
                    {item.content.substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No previous versions available</p>
          )}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-[#0f1419] rounded-lg p-3 border border-[#232945]">
          <div className="text-xs text-gray-400 mb-1">Characters</div>
          <div className="text-lg font-bold text-white">{liveStats.characterCount.toLocaleString()}</div>
          <div className="text-xs text-gray-500">/ 50,000</div>
        </div>
        <div className="bg-[#0f1419] rounded-lg p-3 border border-[#232945]">
          <div className="text-xs text-gray-400 mb-1">Words</div>
          <div className="text-lg font-bold text-white">{liveStats.wordCount.toLocaleString()}</div>
        </div>
        <div className="bg-[#0f1419] rounded-lg p-3 border border-[#232945]">
          <div className="text-xs text-gray-400 mb-1">Lines</div>
          <div className="text-lg font-bold text-white">{liveStats.lineCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Notepad Textarea */}
      <div className="mb-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          className={`w-full bg-[#0f1419] text-gray-100 rounded-lg p-4 border border-[#232945] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none ${
            isFullScreen ? 'h-[calc(100vh-300px)]' : 'h-96'
          }`}
          placeholder="Start typing your notes here...

✨ Features:
- Auto-saves 2 seconds after you stop typing
- Press Ctrl+S (Cmd+S on Mac) to save manually
- Press Ctrl+F to search within your notes
- Click History icon to view last 5 saved versions
- Click Download to export as .txt file
- Your notes are private and only you can see them"
          spellCheck="false"
        />
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ctrl+S to save • Ctrl+F to search
          </span>
          {stats.lastModified && (
            <span>
              Last saved: {new Date(stats.lastModified).toLocaleString()}
            </span>
          )}
        </div>
        <div>
          {hasUnsavedChanges && !isSaving && autoSaveStatus !== "saving" && (
            <span className="text-yellow-400">Unsaved changes • Auto-save in progress...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyNotepad;
