import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Search,
  Filter,
  PhoneCall,
  Eye,
  RotateCcw,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Activity,
  X,
  ChevronLeft,
  ChevronRight,
  Phone,
  Calendar,
  Timer,
  Target,
  ThumbsUp,
  ThumbsDown,
  Minus,
  MessageSquare,
  ListChecks,
  Star,
  Link,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "../styles/custom-scrollbar.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const CallIntelligence = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [filteredRecordings, setFilteredRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("employee");
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({
    totalRecordings: 0,
    analyzedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    avgPerformanceScore: null,
    avgSentimentScore: null,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  // Detail Modal
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [transcriptionExpanded, setTranscriptionExpanded] = useState(false);

  // Syncing
  const [syncing, setSyncing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
      setCurrentUser(user);
    }
    fetchRecordings();
    fetchStats();
    if (["admin", "super-admin"].includes(user?.role)) {
      fetchEmployees();
    }
  }, []);

  useEffect(() => {
    filterRecordings();
  }, [recordings, searchTerm, statusFilter, outcomeFilter, sentimentFilter, agentFilter]);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/call-intelligence?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setRecordings(data.data);
      }
    } catch (error) {
      console.error("Error fetching recordings:", error);
      toast.error("Failed to fetch call recordings");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/call-intelligence/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const marketingSalesEmployees = data.filter(
        (emp) => emp.department === "marketingAndSales"
      );
      setEmployees(marketingSalesEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const filterRecordings = () => {
    let filtered = [...recordings];

    if (searchTerm) {
      filtered = filtered.filter(
        (rec) =>
          rec.callRecordingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rec.phoneNumber?.includes(searchTerm) ||
          rec.summary?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter) {
      filtered = filtered.filter((rec) => rec.analysisStatus === statusFilter);
    }
    if (outcomeFilter) {
      filtered = filtered.filter((rec) => rec.callOutcome === outcomeFilter);
    }
    if (sentimentFilter) {
      filtered = filtered.filter((rec) => rec.clientSentiment === sentimentFilter);
    }
    if (agentFilter) {
      filtered = filtered.filter((rec) => rec.agentUser?._id === agentFilter);
    }

    setFilteredRecordings(filtered);
    setCurrentPage(1);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/call-intelligence/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        fetchRecordings();
        fetchStats();
      } else {
        toast.error(data.message || "Sync failed");
      }
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error("Failed to sync recordings");
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryAnalysis = async (recordingId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/call-intelligence/${recordingId}/retry-analysis`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success) {
        toast.success("Analysis completed successfully");
        fetchRecordings();
        fetchStats();
      } else {
        toast.error(data.message || "Analysis failed");
      }
    } catch (error) {
      console.error("Error retrying analysis:", error);
      toast.error("Failed to retry analysis");
    }
  };

  const handleViewRecording = async (recordingId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/call-intelligence/${recordingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setSelectedRecording(data.data);
        setDetailModalOpen(true);
        setTranscriptionExpanded(false);
      }
    } catch (error) {
      console.error("Error fetching recording details:", error);
      toast.error("Failed to load recording details");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setOutcomeFilter("");
    setSentimentFilter("");
    setAgentFilter("");
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case "Very Positive":
      case "Positive":
        return <ThumbsUp size={14} className="text-green-400" />;
      case "Negative":
      case "Very Negative":
        return <ThumbsDown size={14} className="text-red-400" />;
      default:
        return <Minus size={14} className="text-gray-400" />;
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case "Very Positive": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Positive": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "Neutral": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "Negative": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "Very Negative": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case "Interested":
      case "Deal Closed": return "bg-green-500/20 text-green-400";
      case "Follow Up Required":
      case "Callback Scheduled": return "bg-blue-500/20 text-blue-400";
      case "Not Interested":
      case "Wrong Number": return "bg-red-500/20 text-red-400";
      case "Information Provided": return "bg-purple-500/20 text-purple-400";
      case "Voicemail":
      case "No Answer": return "bg-yellow-500/20 text-yellow-400";
      case "Complaint": return "bg-orange-500/20 text-orange-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed": return "bg-green-500/20 text-green-400";
      case "Processing": return "bg-blue-500/20 text-blue-400";
      case "Pending": return "bg-yellow-500/20 text-yellow-400";
      case "Failed": return "bg-red-500/20 text-red-400";
      case "Skipped": return "bg-gray-500/20 text-gray-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getPerformanceColor = (score) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High": return "bg-red-500/20 text-red-400";
      case "Medium": return "bg-yellow-500/20 text-yellow-400";
      case "Low": return "bg-green-500/20 text-green-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRecordings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRecordings.length / itemsPerPage);

  const isAdmin = userRole === "super-admin" || userRole === "admin";

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-72"
        } overflow-hidden`}
      >
        <SimpleBar style={{ maxHeight: "100vh" }} className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Call Intelligence
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                AI-powered analysis of Vicidial call recordings
              </p>
            </div>
            <div className="flex gap-3">
              {isAdmin && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Total Recordings</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats.totalRecordings}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <PhoneCall size={20} className="text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Analyzed</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">
                    {stats.analyzedCount}
                  </p>
                  {stats.pendingCount > 0 && (
                    <p className="text-yellow-400 text-xs mt-1">
                      {stats.pendingCount} pending
                    </p>
                  )}
                </div>
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle size={20} className="text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Avg Sentiment</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats.avgSentimentScore !== null
                      ? (stats.avgSentimentScore > 0 ? "+" : "") + stats.avgSentimentScore
                      : "-"}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-purple-400" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Avg Performance</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    stats.avgPerformanceScore !== null
                      ? getPerformanceColor(stats.avgPerformanceScore)
                      : "text-gray-400"
                  }`}>
                    {stats.avgPerformanceScore !== null
                      ? `${stats.avgPerformanceScore}%`
                      : "-"}
                  </p>
                </div>
                <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 size={20} className="text-cyan-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ID, phone, or summary..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Status</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Failed">Failed</option>
              </select>

              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Outcomes</option>
                <option value="Interested">Interested</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Follow Up Required">Follow Up Required</option>
                <option value="Deal Closed">Deal Closed</option>
                <option value="Callback Scheduled">Callback Scheduled</option>
                <option value="Information Provided">Information Provided</option>
                <option value="Voicemail">Voicemail</option>
                <option value="No Answer">No Answer</option>
                <option value="Complaint">Complaint</option>
              </select>

              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Sentiments</option>
                <option value="Very Positive">Very Positive</option>
                <option value="Positive">Positive</option>
                <option value="Neutral">Neutral</option>
                <option value="Negative">Negative</option>
                <option value="Very Negative">Very Negative</option>
              </select>

              {isAdmin && (
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Agents</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={clearFilters}
                className="text-gray-400 hover:text-white text-sm px-3 py-2 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              </div>
            ) : currentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <PhoneCall size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">No call recordings found</p>
                <p className="text-sm mt-1">
                  {recordings.length === 0
                    ? "Sync recordings from Vicidial to get started"
                    : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 text-gray-400 text-xs uppercase">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">ID</th>
                      <th className="text-left px-4 py-3">Agent</th>
                      <th className="text-left px-4 py-3">Phone</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Duration</th>
                      <th className="text-left px-4 py-3">Outcome</th>
                      <th className="text-left px-4 py-3">Sentiment</th>
                      <th className="text-left px-4 py-3">Score</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((rec, index) => (
                      <tr
                        key={rec._id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {indexOfFirstItem + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-cyan-400">
                          {rec.callRecordingId}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {rec.agentUser?.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-gray-500" />
                            {rec.phoneNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {formatDate(rec.callDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {formatDuration(rec.callDurationSeconds)}
                        </td>
                        <td className="px-4 py-3">
                          {rec.callOutcome ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${getOutcomeColor(rec.callOutcome)}`}>
                              {rec.callOutcome}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rec.clientSentiment ? (
                            <div className="flex items-center gap-1.5">
                              {getSentimentIcon(rec.clientSentiment)}
                              <span className="text-xs text-gray-300">
                                {rec.clientSentiment}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rec.agentPerformanceScore !== null &&
                          rec.agentPerformanceScore !== undefined ? (
                            <span className={`text-sm font-medium ${getPerformanceColor(rec.agentPerformanceScore)}`}>
                              {rec.agentPerformanceScore}%
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(rec.analysisStatus)}`}>
                            {rec.analysisStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewRecording(rec._id)}
                              className="text-cyan-400 hover:text-cyan-300 transition-colors"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            {isAdmin && rec.analysisStatus === "Failed" && (
                              <button
                                onClick={() => handleRetryAnalysis(rec._id)}
                                className="text-yellow-400 hover:text-yellow-300 transition-colors"
                                title="Retry Analysis"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
                <p className="text-sm text-gray-400">
                  Showing {indexOfFirstItem + 1} to{" "}
                  {Math.min(indexOfLastItem, filteredRecordings.length)} of{" "}
                  {filteredRecordings.length} recordings
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-700 text-gray-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-700 text-gray-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail Modal */}
          {detailModalOpen && selectedRecording && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                <SimpleBar style={{ maxHeight: "90vh" }}>
                  <div className="p-6">
                    {/* Modal Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          {selectedRecording.callRecordingId}
                        </h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Phone size={14} />
                            {selectedRecording.phoneNumber}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {formatDate(selectedRecording.callDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer size={14} />
                            {formatDuration(selectedRecording.callDurationSeconds)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          Agent: <span className="text-white">{selectedRecording.agentUser?.name || "-"}</span>
                          {" | "}
                          Direction: <span className="text-white">{selectedRecording.callDirection}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setDetailModalOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {selectedRecording.analysisStatus !== "Completed" ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <AlertCircle size={48} className="mb-4 opacity-50" />
                        <p className="text-lg">
                          Analysis {selectedRecording.analysisStatus.toLowerCase()}
                        </p>
                        {selectedRecording.analysisError && (
                          <p className="text-sm text-red-400 mt-2">
                            Error: {selectedRecording.analysisError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Sentiment & Outcome Row */}
                        <div className="flex flex-wrap gap-3 mb-6">
                          <span className={`px-3 py-1.5 rounded-full text-sm border ${getSentimentColor(selectedRecording.clientSentiment)}`}>
                            {getSentimentIcon(selectedRecording.clientSentiment)}
                            <span className="ml-1.5">{selectedRecording.clientSentiment}</span>
                            {selectedRecording.sentimentScore !== null && (
                              <span className="ml-1 opacity-70">
                                ({selectedRecording.sentimentScore > 0 ? "+" : ""}
                                {selectedRecording.sentimentScore})
                              </span>
                            )}
                          </span>
                          {selectedRecording.callOutcome && (
                            <span className={`px-3 py-1.5 rounded-full text-sm ${getOutcomeColor(selectedRecording.callOutcome)}`}>
                              <Target size={14} className="inline mr-1" />
                              {selectedRecording.callOutcome}
                            </span>
                          )}
                          {selectedRecording.agentPerformanceScore !== null && (
                            <span className={`px-3 py-1.5 rounded-full text-sm bg-slate-800 ${getPerformanceColor(selectedRecording.agentPerformanceScore)}`}>
                              <Star size={14} className="inline mr-1" />
                              Performance: {selectedRecording.agentPerformanceScore}%
                            </span>
                          )}
                        </div>

                        {/* Summary */}
                        <div className="mb-6">
                          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <MessageSquare size={14} /> Summary
                          </h3>
                          <p className="text-gray-200 text-sm leading-relaxed bg-slate-800/50 p-4 rounded-lg">
                            {selectedRecording.summary || "No summary available"}
                          </p>
                        </div>

                        {/* Agent Performance Notes */}
                        {selectedRecording.agentPerformanceNotes && (
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <Star size={14} /> Agent Performance Notes
                            </h3>
                            <p className="text-gray-300 text-sm bg-slate-800/50 p-4 rounded-lg">
                              {selectedRecording.agentPerformanceNotes}
                            </p>
                          </div>
                        )}

                        {/* Promises Made */}
                        {selectedRecording.promisesMade?.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <ListChecks size={14} /> Promises Made ({selectedRecording.promisesMade.length})
                            </h3>
                            <div className="space-y-2">
                              {selectedRecording.promisesMade.map((promise, i) => (
                                <div
                                  key={i}
                                  className="bg-slate-800/50 p-3 rounded-lg border-l-2 border-yellow-500"
                                >
                                  <p className="text-sm text-gray-200">{promise.description}</p>
                                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                                    <span>By: {promise.promisedBy}</span>
                                    {promise.deadline && <span>Deadline: {promise.deadline}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Items */}
                        {selectedRecording.actionItems?.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <Target size={14} /> Action Items ({selectedRecording.actionItems.length})
                            </h3>
                            <div className="space-y-2">
                              {selectedRecording.actionItems.map((item, i) => (
                                <div
                                  key={i}
                                  className="bg-slate-800/50 p-3 rounded-lg flex items-start justify-between"
                                >
                                  <div>
                                    <p className="text-sm text-gray-200">{item.description}</p>
                                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                                      <span>Assigned: {item.assignedTo}</span>
                                      {item.dueDate && <span>Due: {item.dueDate}</span>}
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(item.priority)}`}>
                                    {item.priority}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Key Topics */}
                        {selectedRecording.keyTopics?.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              Key Topics
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {selectedRecording.keyTopics.map((topic, i) => (
                                <span
                                  key={i}
                                  className="px-3 py-1 bg-slate-800 text-gray-300 rounded-full text-xs border border-slate-700"
                                >
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Linked Entities */}
                        {(selectedRecording.linkedLead || selectedRecording.linkedCallback) && (
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <Link size={14} /> Linked Entities
                            </h3>
                            <div className="flex flex-wrap gap-3">
                              {selectedRecording.linkedLead && (
                                <div className="bg-slate-800/50 px-4 py-2 rounded-lg text-sm">
                                  <span className="text-gray-400">Lead: </span>
                                  <span className="text-cyan-400">
                                    {selectedRecording.linkedLead.leadId} - {selectedRecording.linkedLead.clientName}
                                  </span>
                                </div>
                              )}
                              {selectedRecording.linkedCallback && (
                                <div className="bg-slate-800/50 px-4 py-2 rounded-lg text-sm">
                                  <span className="text-gray-400">Callback: </span>
                                  <span className="text-cyan-400">
                                    {selectedRecording.linkedCallback.callbackId}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Transcription */}
                        {selectedRecording.transcription && (
                          <div className="mb-6">
                            <button
                              onClick={() => setTranscriptionExpanded(!transcriptionExpanded)}
                              className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-300 transition-colors"
                            >
                              <MessageSquare size={14} />
                              Full Transcription
                              {transcriptionExpanded ? (
                                <ChevronUp size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </button>
                            {transcriptionExpanded && (
                              <div className="bg-slate-800/50 p-4 rounded-lg max-h-80 overflow-y-auto">
                                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                                  {selectedRecording.transcription}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Audio Player */}
                        {selectedRecording.recordingFileUrl && (
                          <div className="mb-4">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <Play size={14} /> Audio Recording
                            </h3>
                            <audio
                              controls
                              className="w-full"
                              src={selectedRecording.recordingFileUrl}
                            >
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </SimpleBar>
              </div>
            </div>
          )}
        </SimpleBar>
      </div>
    </div>
  );
};

export default CallIntelligence;
