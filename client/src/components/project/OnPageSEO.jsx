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
} from "lucide-react";
import { Line } from "react-chartjs-2";
import KeywordCalendarHeatmap from "./KeywordCalendarHeatmap";
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
  const [showChartModal, setShowChartModal] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    keyword: "",
    initialRank: "",
    targetUrl: "",
    searchEngine: "Google",
    location: "Global",
    notes: "",
  });

  const [updateFormData, setUpdateFormData] = useState({
    rank: "",
    notes: "",
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

  const resetForm = () => {
    setFormData({
      keyword: "",
      initialRank: "",
      targetUrl: "",
      searchEngine: "Google",
      location: "Global",
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

  const getChartData = (keyword) => {
    const history = keyword.rankHistory || [];
    const labels = history.map((h) =>
      new Date(h.recordedAt).toLocaleDateString()
    );
    const data = history.map((h) => h.rank);

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
            <Search className="w-6 h-6 text-blue-400" />
            Keyword Analysis
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Track keyword rankings and performance
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Keyword
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Keywords</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.totalKeywords}
                </p>
              </div>
              <Search className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Improved</p>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  {stats.improved}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Declined</p>
                <p className="text-2xl font-bold text-red-400 mt-1">
                  {stats.declined}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg Change</p>
                <p className={`text-2xl font-bold mt-1 ${stats.averageRankChange > 0 ? 'text-green-400' : stats.averageRankChange < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {stats.averageRankChange > 0 ? '+' : ''}{stats.averageRankChange}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-400" />
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
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : keywords.length === 0 ? (
        <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-8 text-center">
          <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No keywords tracked yet</p>
          {canEdit && (
            <p className="text-sm text-gray-500 mt-2">
              Click "Add Keyword" to start tracking keyword rankings
            </p>
          )}
        </div>
      ) : (
        <div className="bg-[#0f1419] border border-[#232945] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#141a21] border-b border-[#232945]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Keyword
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Past Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Previous Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Current Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232945]">
                {keywords.map((keyword) => (
                  <tr
                    key={keyword._id}
                    className="hover:bg-[#141a21] transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-white">
                          {keyword.keyword}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <Globe className="w-3 h-3" />
                          {keyword.searchEngine}
                          <MapPin className="w-3 h-3 ml-2" />
                          {keyword.location}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-400">
                        {keyword.pastRank?.rank || "-"}
                      </span>
                      {keyword.pastRank && (
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(
                            keyword.pastRank.recordedAt
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-300">
                        {keyword.previousRank?.rank || "-"}
                      </span>
                      {keyword.previousRank && (
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(
                            keyword.previousRank.recordedAt
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-white font-semibold text-lg">
                        {keyword.currentRank?.rank || "-"}
                      </span>
                      {keyword.currentRank && (
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(
                            keyword.currentRank.recordedAt
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {getTrendIcon(keyword.rankTrend)}
                        <span className={`font-medium ${getTrendColor(keyword.rankTrend)}`}>
                          {keyword.rankChange > 0 ? `+${keyword.rankChange}` : keyword.rankChange || '0'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedKeyword(keyword);
                            setShowChartModal(true);
                          }}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="View Chart"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedKeyword(keyword);
                                setShowUpdateModal(true);
                              }}
                              className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                              title="Update Rank"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteKeyword(keyword._id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
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
                    Target URL
                  </label>
                  <input
                    type="url"
                    value={formData.targetUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, targetUrl: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Search Engine
                    </label>
                    <select
                      value={formData.searchEngine}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          searchEngine: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Google">Google</option>
                      <option value="Bing">Bing</option>
                      <option value="Yahoo">Yahoo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
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
                  {selectedKeyword.rankHistory.map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 bg-[#141a21] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-white">
                          #{record.rank}
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            {new Date(record.recordedAt).toLocaleString()}
                          </div>
                          {record.notes && (
                            <div className="text-xs text-gray-400 mt-1">
                              {record.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {record.recordedBy?.name || "Unknown"}
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
