// components/sheets/AccessHistoryModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Clock, User, Eye, Edit3, Activity, TrendingUp } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const AccessHistoryModal = ({ sheet, onClose }) => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("history"); // "history" or "stats"

  useEffect(() => {
    fetchData();
  }, [sheet._id, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (activeTab === "history") {
        // Fetch access history
        const response = await axios.get(
          `${API_BASE}/api/sheets/${sheet._id}/access-history?limit=100`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setHistory(response.data.data || []);
      } else {
        // Fetch access statistics
        const response = await axios.get(
          `${API_BASE}/api/sheets/${sheet._id}/access-stats`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setStats(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching access data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#232945]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-400" />
                Access History
              </h3>
              <p className="text-sm text-gray-400 mt-1">{sheet.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#0f1419] rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-blue-600 text-white"
                  : "bg-[#0f1419] text-gray-400 hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Recent Activity
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "stats"
                  ? "bg-blue-600 text-white"
                  : "bg-[#0f1419] text-gray-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              User Statistics
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400 text-sm">Loading access data...</p>
              </div>
            </div>
          ) : activeTab === "history" ? (
            // History Tab
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No access history yet</p>
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center gap-4 p-4 bg-[#0f1419] rounded-lg border border-[#232945] hover:border-blue-500/30 transition-colors"
                  >
                    {/* User Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
                      {entry.user?.name?.charAt(0).toUpperCase() || "?"}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium truncate">
                          {entry.user?.name || "Unknown User"}
                        </p>
                        {entry.permissionLevel === "edit" ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/50">
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/50">
                            <Eye className="w-3 h-3" />
                            View
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {entry.user?.email} • {entry.user?.employeeId}
                      </p>
                    </div>

                    {/* Time */}
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        {formatDate(entry.accessedAt)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(entry.accessedAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            // Stats Tab
            <div className="space-y-4">
              {stats.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No statistics available yet</p>
                </div>
              ) : (
                stats.map((stat) => (
                  <div
                    key={stat._id}
                    className="p-4 bg-[#0f1419] rounded-lg border border-[#232945]"
                  >
                    <div className="flex items-center gap-4">
                      {/* User Avatar */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-lg flex-shrink-0">
                        {stat.user?.name?.charAt(0).toUpperCase() || "?"}
                      </div>

                      {/* User Info */}
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {stat.user?.name || "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {stat.user?.email} • {stat.user?.employeeId}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-400">
                          {stat.accessCount}
                        </p>
                        <p className="text-xs text-gray-500">
                          {stat.accessCount === 1 ? "access" : "accesses"}
                        </p>
                      </div>
                    </div>

                    {/* Access Range */}
                    <div className="mt-3 pt-3 border-t border-[#232945] flex justify-between text-xs text-gray-500">
                      <div>
                        <span className="text-gray-400">First: </span>
                        {formatDate(stat.firstAccess)}
                      </div>
                      <div>
                        <span className="text-gray-400">Latest: </span>
                        {formatDate(stat.lastAccess)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#232945] bg-[#0f1419]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-[#1a1f2e] border border-[#232945] text-white rounded-lg hover:bg-[#232945] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessHistoryModal;
