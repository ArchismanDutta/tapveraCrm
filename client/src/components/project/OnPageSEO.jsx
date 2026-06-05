import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Edit2,
  Trash2,
  BarChart3,
  Search,
  X,
  Calendar,
  User,
  MapPin,
  Globe,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Undo2,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import KeywordCalendarHeatmap from "./KeywordCalendarHeatmap";
import VelocityMetrics from "./VelocityMetrics";
import BlogUpdates from "./BlogUpdates";
import SectionRemarks from "./SectionRemarks";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const OnPageSEO = ({ projectId, userRole, userId }) => {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showVelocityMetrics, setShowVelocityMetrics] = useState(true);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [fetchingRankId, setFetchingRankId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form states
  const [formData, setFormData] = useState({
    keyword: "",
    initialRank: "",
    targetUrl: "",
    keywordLink: "",
    searchEngine: "Google",
    location: "Global",
    city: "",
    country: "Global",
    countryCode: "",
    priority: "normal",
    device: "desktop",
    fetchFrequency: "weekly",
    category: "SEO",
    notes: "",
  });

  const [updateFormData, setUpdateFormData] = useState({
    rank: "",
    notes: "",
  });

  const [editFormData, setEditFormData] = useState({
    keyword: "",
    targetUrl: "",
    keywordLink: "",
    searchEngine: "Google",
    location: "Global",
    city: "",
    country: "Global",
    countryCode: "",
    priority: "normal",
    device: "desktop",
    fetchFrequency: "weekly",
    category: "SEO",
  });

  const canEdit = ["admin", "super-admin", "superadmin", "employee"].includes(userRole);

  useEffect(() => {
    if (projectId) {
      fetchKeywords();
      fetchStats();
    }
  }, [projectId]);

  const fetchKeywords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/keywords`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setKeywords(response.data.data || []);
    } catch (error) {
      console.error("Error fetching keywords:", error);
      showNotification("Error fetching keywords", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/keywords/stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setStats(response.data.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/api/projects/${projectId}/keywords`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Keyword added successfully!", "success");
      setShowAddModal(false);
      resetForm();
      fetchKeywords();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error adding keyword",
        "error"
      );
    }
  };

  const handleUpdateRank = async (e) => {
    e.preventDefault();
    if (!selectedKeyword) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/api/projects/${projectId}/keywords/${selectedKeyword._id}/rank`,
        updateFormData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Rank updated successfully!", "success");
      setShowUpdateModal(false);
      setSelectedKeyword(null);
      setUpdateFormData({ rank: "", notes: "" });
      fetchKeywords();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error updating rank",
        "error"
      );
    }
  };

  const handleDeleteKeyword = async (keywordId) => {
    if (!window.confirm("Are you sure you want to deactivate this keyword?"))
      return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE}/api/projects/${projectId}/keywords/${keywordId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Keyword deactivated successfully!", "success");
      fetchKeywords();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error deleting keyword",
        "error"
      );
    }
  };

  const handleSelectKeyword = (keywordId) => {
    setSelectedKeywords((prev) => {
      if (prev.includes(keywordId)) {
        return prev.filter((id) => id !== keywordId);
      }
      return [...prev, keywordId];
    });
  };

  const handleSelectAll = () => {
    if (selectedKeywords.length === keywords.length) {
      setSelectedKeywords([]);
    } else {
      setSelectedKeywords(keywords.map((k) => k._id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedKeywords.length === 0) {
      showNotification("No keywords selected", "error");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to deactivate ${selectedKeywords.length} keyword(s)?`
      )
    )
      return;

    try {
      const token = localStorage.getItem("token");
      const deletedKeywords = keywords.filter((k) =>
        selectedKeywords.includes(k._id)
      );

      // Save to undo stack
      setUndoStack((prev) => [
        ...prev,
        { items: deletedKeywords, timestamp: Date.now() },
      ]);

      // Delete all selected keywords
      await Promise.all(
        selectedKeywords.map((keywordId) =>
          axios.delete(
            `${API_BASE}/api/projects/${projectId}/keywords/${keywordId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        )
      );

      showNotification(
        `${selectedKeywords.length} keyword(s) deactivated successfully!`,
        "success"
      );
      setSelectedKeywords([]);
      fetchKeywords();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error deleting keywords",
        "error"
      );
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) {
      showNotification("No actions to undo", "error");
      return;
    }

    const lastAction = undoStack[undoStack.length - 1];
    try {
      const token = localStorage.getItem("token");

      // Restore deleted keywords by re-adding them
      await Promise.all(
        lastAction.items.map((keyword) =>
          axios.post(
            `${API_BASE}/api/projects/${projectId}/keywords`,
            {
              keyword:        keyword.keyword,
              initialRank:    keyword.currentRank?.rank || 0,
              targetUrl:      keyword.targetUrl      || "",
              keywordLink:    keyword.keywordLink    || "",
              searchEngine:   keyword.searchEngine   || "Google",
              location:       keyword.location       || "Global",
              city:           keyword.city           || "",
              country:        keyword.country        || "Global",
              countryCode:    keyword.countryCode    || "",
              priority:       keyword.priority       || "normal",
              device:         keyword.device         || "desktop",
              fetchFrequency: keyword.fetchFrequency || "weekly",
              category:       keyword.category       || "SEO",
              notes: "Restored via undo",
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        )
      );

      showNotification(
        `${lastAction.items.length} keyword(s) restored!`,
        "success"
      );
      setUndoStack((prev) => prev.slice(0, -1));
      fetchKeywords();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error restoring keywords",
        "error"
      );
    }
  };

  const openEditModal = (keyword) => {
    setSelectedKeyword(keyword);
    setEditFormData({
      keyword:        keyword.keyword        || "",
      targetUrl:      keyword.targetUrl      || "",
      keywordLink:    keyword.keywordLink    || "",
      searchEngine:   keyword.searchEngine   || "Google",
      location:       keyword.location       || "Global",
      city:           keyword.city           || "",
      country:        keyword.country        || "Global",
      countryCode:    keyword.countryCode    || "",
      priority:       keyword.priority       || "normal",
      device:         keyword.device         || "desktop",
      fetchFrequency: keyword.fetchFrequency || "weekly",
      category:       keyword.category       || "SEO",
    });
    setShowEditModal(true);
  };

  const handleEditKeyword = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/projects/${projectId}/keywords/${selectedKeyword._id}`,
        editFormData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Keyword updated successfully!", "success");
      setShowEditModal(false);
      fetchKeywords();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error updating keyword",
        "error"
      );
    }
  };

  const handleFetchRank = async (keyword) => {
    if (!keyword.targetUrl) {
      showNotification("No Target URL set on this keyword. Edit it to add one first.", "error");
      return;
    }
    setFetchingRankId(keyword._id);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/api/projects/${projectId}/keywords/${keyword._id}/fetch-rank`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification(response.data.message || "Rank fetched successfully!", "success");
      fetchKeywords();
      fetchStats();
    } catch (error) {
      showNotification(error.response?.data?.message || "Error fetching rank", "error");
    } finally {
      setFetchingRankId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      keyword: "",
      initialRank: "",
      targetUrl: "",
      keywordLink: "",
      searchEngine: "Google",
      location: "Global",
      city: "",
      country: "Global",
      countryCode: "",
      priority: "normal",
      device: "desktop",
      fetchFrequency: "weekly",
      category: "SEO",
      notes: "",
    });
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getTrendIcon = (trend) => {
    if (trend === "improved")
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === "declined")
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (trend) => {
    if (trend === "improved") return "text-green-400";
    if (trend === "declined") return "text-red-400";
    return "text-gray-400";
  };

  const getRankBadge = (rankObj) => {
    if (!rankObj) return <span className="text-gray-600 text-sm">—</span>;
    const r = rankObj.rank;
    if (r === 0 || r >= 101) {
      return (
        <span className="inline-flex items-center justify-center w-12 h-8 rounded-md bg-gray-800 border border-gray-700 text-gray-500 text-xs font-bold">N/R</span>
      );
    }
    let colorClass = "bg-red-500/20 border-red-500/50 text-red-300";
    if (r <= 3)        colorClass = "bg-emerald-500/20 border-emerald-500/60 text-emerald-300";
    else if (r <= 10)  colorClass = "bg-green-500/20 border-green-500/50 text-green-300";
    else if (r <= 30)  colorClass = "bg-yellow-500/20 border-yellow-500/50 text-yellow-300";
    else if (r <= 50)  colorClass = "bg-orange-500/20 border-orange-500/50 text-orange-300";
    return (
      <span className={`inline-flex items-center justify-center w-12 h-8 rounded-md border text-sm font-bold ${colorClass}`}>
        #{r}
      </span>
    );
  };

  const filteredKeywords = keywords.filter(kw => {
    const matchesSearch = kw.keyword.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || kw.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getChartData = (keyword) => {
    const history = keyword.rankHistory || [];
    const labels = history.map((h) =>
      new Date(h.recordedAt).toLocaleDateString()
    );
    // Map rank 0 or >= 101 to null so Chart.js renders a gap instead of a misleading spike
    const data = history.map((h) =>
      h.rank === 0 || h.rank >= 101 ? null : h.rank
    );

    return {
      labels,
      datasets: [
        {
          label: keyword.keyword,
          data,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
          tension: 0.4,
          spanGaps: false, // show gap when null (not ranked)
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        reverse: true, // Lower rank number is better
        ticks: { color: "#9ca3af" },
        grid: { color: "#374151" },
      },
      x: {
        ticks: { color: "#9ca3af" },
        grid: { color: "#374151" },
      },
    },
    plugins: {
      legend: {
        labels: { color: "#e5e7eb" },
      },
      tooltip: {
        backgroundColor: "#1f2937",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
        borderColor: "#374151",
        borderWidth: 1,
      },
    },
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            notification.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Keyword Tracker
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {keywords.length} keyword{keywords.length !== 1 ? "s" : ""} tracked
            {selectedKeywords.length > 0 && (
              <span className="ml-2 text-blue-400">· {selectedKeywords.length} selected</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && selectedKeywords.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-400 rounded-lg transition-all text-sm font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedKeywords.length})
            </button>
          )}
          {canEdit && undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1f2e] hover:bg-[#232945] border border-[#232945] text-gray-400 rounded-lg transition-all text-sm"
              title="Undo last deletion"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm font-medium shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Keyword
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#0f1419] border border-[#232945] rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/60 rounded-t-xl" />
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.totalKeywords}</p>
            <p className="text-xs text-gray-600 mt-1">keywords tracked</p>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500/60 rounded-t-xl" />
            <p className="text-xs text-gray-500 uppercase tracking-wider">Improved</p>
            <p className="text-3xl font-bold text-green-400 mt-1">{stats.improved}</p>
            <p className="text-xs text-gray-600 mt-1">ranking higher</p>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500/60 rounded-t-xl" />
            <p className="text-xs text-gray-500 uppercase tracking-wider">Declined</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{stats.declined}</p>
            <p className="text-xs text-gray-600 mt-1">ranking lower</p>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500/60 rounded-t-xl" />
            <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Change</p>
            <p className={`text-3xl font-bold mt-1 ${stats.averageRankChange > 0 ? "text-green-400" : stats.averageRankChange < 0 ? "text-red-400" : "text-gray-400"}`}>
              {stats.averageRankChange > 0 ? "+" : ""}{stats.averageRankChange}
            </p>
            <p className="text-xs text-gray-600 mt-1">positions</p>
          </div>
        </div>
      )}

      {/* Velocity Metrics */}
      {keywords.length > 0 && (
        <div className="bg-[#0f1419] border border-[#232945] rounded-xl overflow-hidden">
          {/* Collapsible Header */}
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1f2e] transition-colors"
            onClick={() => setShowVelocityMetrics(!showVelocityMetrics)}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              <h4 className="text-lg font-bold text-white">Velocity Metrics</h4>
              <span className="text-xs text-gray-400 ml-2">
                (Click to {showVelocityMetrics ? 'collapse' : 'expand'})
              </span>
            </div>
            <button
              type="button"
              className="p-2 hover:bg-[#232945] rounded-lg transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowVelocityMetrics(!showVelocityMetrics);
              }}
            >
              {showVelocityMetrics ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>

          {/* Collapsible Content */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              showVelocityMetrics ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-6 pt-0 border-t border-[#232945]">
              <VelocityMetrics projectId={projectId} />
            </div>
          </div>
        </div>
      )}

      {/* Calendar Heatmap */}
      {keywords.length > 0 && (
        <KeywordCalendarHeatmap
          keywords={keywords}
          onDateClick={(dateKey, data) => {
            setSelectedDate({ dateKey, data });
          }}
        />
      )}

      {/* Date Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {new Date(selectedDate.dateKey).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Keyword updates on this day
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-400 mb-1">Total Updates</div>
                  <div className="text-2xl font-bold text-white">{selectedDate.data.updates}</div>
                </div>
                <div className="bg-[#0f1419] border border-green-500/30 rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-400 mb-1">Improved</div>
                  <div className="text-2xl font-bold text-green-400">{selectedDate.data.improvements}</div>
                </div>
                <div className="bg-[#0f1419] border border-red-500/30 rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-400 mb-1">Declined</div>
                  <div className="text-2xl font-bold text-red-400">{selectedDate.data.declines}</div>
                </div>
              </div>

              {/* Keywords List */}
              <div className="space-y-2">
                {selectedDate.data.keywords.map((kw, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0f1419] border border-[#232945] rounded-lg p-4 hover:border-purple-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">{kw.keyword}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Rank change: {kw.prevRank} → {kw.rank}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          kw.change > 0 ? 'text-green-400' :
                          kw.change < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {kw.change > 0 ? '+' : ''}{kw.change}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                          {kw.change > 0 ? (
                            <><TrendingUp className="w-3 h-3" /> Improved</>
                          ) : kw.change < 0 ? (
                            <><TrendingDown className="w-3 h-3" /> Declined</>
                          ) : (
                            <><Minus className="w-3 h-3" /> No change</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keywords Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading keywords...</p>
        </div>
      ) : keywords.length === 0 ? (
        <div className="bg-[#0f1419] border border-dashed border-[#232945] rounded-xl p-12 text-center">
          <Search className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No keywords tracked yet</p>
          {canEdit && (
            <p className="text-sm text-gray-600 mt-1">Click "Add Keyword" to start tracking</p>
          )}
        </div>
      ) : (
        <div className="bg-[#0f1419] border border-[#232945] rounded-xl overflow-hidden">
          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-4 py-3 border-b border-[#232945] bg-[#0c1117]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keywords..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#141a21] border border-[#232945] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-center gap-1 bg-[#141a21] border border-[#232945] rounded-lg p-1">
              {["all", "SEO", "GMB"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    categoryFilter === cat
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-600 px-1 whitespace-nowrap">
              {filteredKeywords.length} of {keywords.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0c1117] border-b border-[#232945]">
                <tr>
                  {canEdit && (
                    <th className="pl-4 py-3 w-10">
                      <button
                        onClick={handleSelectAll}
                        className="p-1 hover:bg-[#232945] rounded transition-colors"
                        title={selectedKeywords.length === keywords.length ? "Deselect All" : "Select All"}
                      >
                        {selectedKeywords.length === keywords.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Keyword</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Past</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Prev</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Current</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Link</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1f2e]">
                {filteredKeywords.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="text-center py-10 text-sm text-gray-600">
                      No keywords match your search
                    </td>
                  </tr>
                ) : filteredKeywords.map((keyword) => (
                  <tr
                    key={keyword._id}
                    className={`hover:bg-[#0f1623] transition-colors ${selectedKeywords.includes(keyword._id) ? "bg-blue-500/5" : ""}`}
                  >
                    {canEdit && (
                      <td className="pl-4 py-3">
                        <button
                          onClick={() => handleSelectKeyword(keyword._id)}
                          className="p-1 hover:bg-[#232945] rounded transition-colors"
                        >
                          {selectedKeywords.includes(keyword._id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </td>
                    )}

                    {/* Keyword name + meta */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {keyword.priority === "high" && (
                          <span className="mt-0.5 text-yellow-400 text-xs" title="High priority">★</span>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white text-sm">{keyword.keyword}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                              keyword.category === "SEO"
                                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                            }`}>
                              {keyword.category || "SEO"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-600 flex-wrap">
                            <Globe className="w-3 h-3" />
                            <span>{keyword.searchEngine}</span>
                            <span className="text-gray-700">·</span>
                            <MapPin className="w-3 h-3" />
                            <span>{keyword.city ? `${keyword.city}, ` : ""}{keyword.country || keyword.location}</span>
                            {keyword.device === "mobile" && (
                              <span className="px-1 bg-cyan-500/15 text-cyan-500 rounded text-xs border border-cyan-500/20">mob</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Past Rank */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {getRankBadge(keyword.pastRank)}
                        {keyword.pastRank && (
                          <span className="text-xs text-gray-700">
                            {new Date(keyword.pastRank.recordedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Previous Rank */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {getRankBadge(keyword.previousRank)}
                        {keyword.previousRank && (
                          <span className="text-xs text-gray-700">
                            {new Date(keyword.previousRank.recordedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Current Rank */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {getRankBadge(keyword.currentRank)}
                        {keyword.currentRank && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-700">
                              {new Date(keyword.currentRank.recordedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}
                            </span>
                            <span className={`text-xs px-1 rounded ${
                              keyword.currentRank.source === "auto"   ? "text-purple-400" :
                              keyword.currentRank.source === "fetch"  ? "text-blue-400"   :
                              keyword.currentRank.source === "scrape" ? "text-orange-400" :
                                                                        "text-gray-600"
                            }`}>
                              {keyword.currentRank.source === "auto" ? "⚡" :
                               keyword.currentRank.source === "fetch" ? "🔗" :
                               keyword.currentRank.source === "scrape" ? "🕷" : "✏"}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Change / Trend */}
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const change = keyword.rankChange;
                        const trend = keyword.rankTrend;
                        if (!keyword.previousRank) return <span className="text-gray-700 text-xs">—</span>;
                        return (
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            trend === "improved" ? "bg-green-500/15 text-green-400 border-green-500/30" :
                            trend === "declined" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                            "bg-gray-500/15 text-gray-500 border-gray-600/30"
                          }`}>
                            {trend === "improved" ? "↑" : trend === "declined" ? "↓" : "—"}
                            {trend !== "stable" && Math.abs(change)}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Keyword Link */}
                    <td className="px-4 py-3 max-w-[140px]">
                      {keyword.keywordLink ? (
                        <a
                          href={keyword.keywordLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs truncate block"
                          title={keyword.keywordLink}
                        >
                          {keyword.keywordLink.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setSelectedKeyword(keyword); setShowChartModal(true); }}
                          className="p-1.5 text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          title="View history chart"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEditModal(keyword)}
                              className="p-1.5 text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                              title="Edit keyword"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleFetchRank(keyword)}
                              disabled={fetchingRankId === keyword._id || keyword.searchEngine !== "Google" || !keyword.targetUrl}
                              className={`p-1.5 rounded transition-colors ${
                                fetchingRankId === keyword._id || keyword.searchEngine !== "Google" || !keyword.targetUrl
                                  ? "text-gray-700 cursor-not-allowed"
                                  : "text-gray-500 hover:text-purple-400 hover:bg-purple-500/10"
                              }`}
                              title={
                                keyword.searchEngine !== "Google" ? "Google only" :
                                !keyword.targetUrl ? "Add Target URL first" :
                                `Fetch rank (${keyword.device || "desktop"})`
                              }
                            >
                              {fetchingRankId === keyword._id ? (
                                <div className="w-3.5 h-3.5 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                              ) : (
                                <Globe className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => { setSelectedKeyword(keyword); setShowUpdateModal(true); }}
                              className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                              title="Update rank manually"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteKeyword(keyword._id)}
                              className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete keyword"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Keyword Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Add Keyword</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleAddKeyword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Keyword *
                  </label>
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={(e) =>
                      setFormData({ ...formData, keyword: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Initial Rank *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.initialRank}
                    onChange={(e) =>
                      setFormData({ ...formData, initialRank: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target URL <span className="text-purple-400 text-xs font-normal">(required for auto-fetch)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.targetUrl}
                    onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. mysite.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Domain to find in Google results</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Keyword Link
                  </label>
                  <input
                    type="url"
                    value={formData.keywordLink}
                    onChange={(e) =>
                      setFormData({ ...formData, keywordLink: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="https://example.com/keyword"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Search Engine
                    </label>
                    <select
                      value={formData.searchEngine}
                      onChange={(e) => setFormData({ ...formData, searchEngine: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Google">Google</option>
                      <option value="Bing">Bing</option>
                      <option value="Yahoo">Yahoo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Australia"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City <span className="text-gray-500 text-xs font-normal">(for local SEO)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Sydney"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Device
                    </label>
                    <select
                      value={formData.device}
                      onChange={(e) => setFormData({ ...formData, device: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Auto-fetch Frequency
                    </label>
                    <select
                      value={formData.fetchFrequency}
                      onChange={(e) => setFormData({ ...formData, fetchFrequency: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High ★</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="SEO">SEO</option>
                    <option value="GMB">GMB</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] text-white rounded-lg hover:bg-[#141a21] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium"
                  >
                    Add Keyword
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Update Rank Modal */}
      {showUpdateModal && selectedKeyword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  Update Rank: {selectedKeyword.keyword}
                </h3>
                <button
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedKeyword(null);
                    setUpdateFormData({ rank: "", notes: "" });
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateRank} className="space-y-4">
                <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Past</div>
                      <div className="text-lg text-gray-400 font-semibold mt-1">
                        {selectedKeyword.pastRank?.rank || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Previous</div>
                      <div className="text-lg text-gray-300 font-semibold mt-1">
                        {selectedKeyword.previousRank?.rank || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Current</div>
                      <div className="text-lg text-white font-bold mt-1">
                        {selectedKeyword.currentRank?.rank || "-"}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Rank *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={updateFormData.rank}
                    onChange={(e) =>
                      setUpdateFormData({
                        ...updateFormData,
                        rank: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={updateFormData.notes}
                    onChange={(e) =>
                      setUpdateFormData({
                        ...updateFormData,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUpdateModal(false);
                      setSelectedKeyword(null);
                      setUpdateFormData({ rank: "", notes: "" });
                    }}
                    className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] text-white rounded-lg hover:bg-[#141a21] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all font-medium"
                  >
                    Update Rank
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Keyword Modal */}
      {showEditModal && selectedKeyword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Edit Keyword</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedKeyword(null);
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleEditKeyword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Keyword *
                  </label>
                  <input
                    type="text"
                    value={editFormData.keyword}
                    onChange={(e) => setEditFormData({ ...editFormData, keyword: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target URL <span className="text-purple-400 text-xs font-normal">(required for auto-fetch)</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.targetUrl}
                    onChange={(e) => setEditFormData({ ...editFormData, targetUrl: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. mysite.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Keyword Link
                  </label>
                  <input
                    type="url"
                    value={editFormData.keywordLink}
                    onChange={(e) => setEditFormData({ ...editFormData, keywordLink: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="https://example.com/keyword"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Search Engine
                    </label>
                    <select
                      value={editFormData.searchEngine}
                      onChange={(e) => setEditFormData({ ...editFormData, searchEngine: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Google">Google</option>
                      <option value="Bing">Bing</option>
                      <option value="Yahoo">Yahoo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={editFormData.country}
                      onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Australia"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Sydney"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Device
                    </label>
                    <select
                      value={editFormData.device}
                      onChange={(e) => setEditFormData({ ...editFormData, device: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Fetch Frequency
                    </label>
                    <select
                      value={editFormData.fetchFrequency}
                      onChange={(e) => setEditFormData({ ...editFormData, fetchFrequency: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={editFormData.priority}
                      onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High ★</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="SEO">SEO</option>
                    <option value="GMB">GMB</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedKeyword(null);
                    }}
                    className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] text-white rounded-lg hover:bg-[#141a21] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-all font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Chart Modal */}
      {showChartModal && selectedKeyword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedKeyword.keyword}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Rank Performance Over Time
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowChartModal(false);
                    setSelectedKeyword(null);
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4" style={{ height: "400px" }}>
                <Line data={getChartData(selectedKeyword)} options={chartOptions} />
              </div>

              <div className="mt-6 bg-[#0f1419] border border-[#232945] rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Rank History
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {[...selectedKeyword.rankHistory].reverse().map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 bg-[#141a21] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl font-bold ${record.rank >= 101 || record.rank === 0 ? "text-red-400 text-base" : "text-white"}`}>
                          {record.rank >= 101 || record.rank === 0 ? "N/R" : `#${record.rank}`}
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            {new Date(record.recordedAt).toLocaleString()}
                          </div>
                          {record.notes && (
                            <div className="text-xs text-gray-400 mt-0.5">{record.notes}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          record.source === "auto"   ? "bg-purple-500/20 text-purple-300" :
                          record.source === "fetch"  ? "bg-blue-500/20   text-blue-300"   :
                          record.source === "scrape" ? "bg-orange-500/20 text-orange-300" :
                                                       "bg-gray-500/20   text-gray-500"
                        }`}>
                          {record.source === "auto"   ? "auto"    :
                           record.source === "fetch"  ? "api"     :
                           record.source === "scrape" ? "scraped" : "manual"}
                        </span>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          {record.source === "auto" || record.source === "scrape" || record.source === "fetch" ? (
                            <Globe className="w-3 h-3" />
                          ) : (
                            <User className="w-3 h-3" />
                          )}
                          {record.source === "auto"
                            ? "Auto-fetched"
                            : record.recordedBy?.name || "System"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Feedback for Keywords */}
      <SectionRemarks
        projectId={projectId}
        section="keywords"
        userRole={userRole}
        userId={userId}
        title="Client Feedback on Keywords"
      />

      {/* Blog Updates Section */}
      <div className="mt-12 pt-8 border-t border-[#232945]">
        <BlogUpdates
          projectId={projectId}
          userRole={userRole}
          userId={userId}
        />
      </div>

      {/* Client Feedback for Blogs */}
      <SectionRemarks
        projectId={projectId}
        section="blogs"
        userRole={userRole}
        userId={userId}
        title="Client Feedback on Blog Posts"
      />
    </div>
  );
};

export default OnPageSEO;
