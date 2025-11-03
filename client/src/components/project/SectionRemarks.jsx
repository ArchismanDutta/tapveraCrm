import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  MessageSquare,
  Send,
  Trash2,
  Calendar,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const SectionRemarks = ({ projectId, section, userRole, userId, title }) => {
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [newRemark, setNewRemark] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Only clients can add remarks (this is specifically for client feedback)
  const canAdd = userRole === "client";

  useEffect(() => {
    if (projectId && section) {
      fetchRemarks();
    }
  }, [projectId, section]);

  const fetchRemarks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/client-remarks?section=${section}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setRemarks(response.data.data || []);
    } catch (error) {
      console.error("Error fetching remarks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRemark = async (e) => {
    e.preventDefault();
    if (!newRemark.trim()) {
      showNotification("Please enter a remark", "error");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/api/projects/${projectId}/client-remarks`,
        { remark: newRemark, section },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showNotification("Remark added successfully!", "success");
      setNewRemark("");
      fetchRemarks();
    } catch (error) {
      console.error("Error adding remark:", error);
      showNotification(
        error.response?.data?.message || "Error adding remark",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRemark = async (remarkId) => {
    if (!window.confirm("Are you sure you want to delete this remark?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE}/api/projects/${projectId}/client-remarks/${remarkId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showNotification("Remark deleted successfully!", "success");
      fetchRemarks();
    } catch (error) {
      console.error("Error deleting remark:", error);
      showNotification(
        error.response?.data?.message || "Error deleting remark",
        "error"
      );
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getRoleBadgeColor = (role) => {
    if (role === "client") return "bg-purple-600/20 text-purple-400 border-purple-500/30";
    if (["admin", "super-admin", "superadmin"].includes(role))
      return "bg-blue-600/20 text-blue-400 border-blue-500/30";
    return "bg-gray-600/20 text-gray-400 border-gray-500/30";
  };

  const getRoleLabel = (role) => {
    if (role === "client") return "Client";
    if (role === "super-admin" || role === "superadmin") return "Super Admin";
    if (role === "admin") return "Admin";
    return role;
  };

  return (
    <div className="mt-8 border-t border-[#232945] pt-6">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            notification.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between bg-[#0f1419] border border-[#232945] rounded-lg p-4 hover:border-purple-500/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg">
            <MessageSquare className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-white">
              {title || "Client Feedback"}
            </h3>
            <p className="text-sm text-gray-400">
              {remarks.length} {remarks.length === 1 ? "feedback" : "feedbacks"} from client
              {remarks.length > 0 && !isExpanded && " - Click to view"}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Add Remark Form */}
          {canAdd && (
            <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
              <form onSubmit={handleAddRemark} className="space-y-3">
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Share your feedback or suggestions about this section..."
                  rows="3"
                  className="w-full px-3 py-2 bg-[#141a21] border border-[#232945] rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  disabled={submitting}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !newRemark.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Add Remark
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Remarks List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : remarks.length === 0 ? (
            <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-6 text-center">
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {canAdd
                  ? "No feedback yet. Share your thoughts about this section!"
                  : "No client feedback yet for this section."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {remarks.map((remark) => {
                const isOwner = remark.addedBy?._id === userId;
                // Clients can delete their own remarks, admins can delete any (for moderation)
                const canDelete =
                  (isOwner && userRole === "client") ||
                  ["admin", "super-admin", "superadmin"].includes(userRole);

                return (
                  <div
                    key={remark._id}
                    className="bg-[#0f1419] border border-[#232945] rounded-lg p-4 hover:border-purple-500/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        {/* Header */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-white text-sm font-medium">
                              {remark.addedBy?.name ||
                                remark.addedBy?.clientName ||
                                "Unknown"}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(
                              remark.addedByRole
                            )}`}
                          >
                            {getRoleLabel(remark.addedByRole)}
                          </span>
                          <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <Calendar className="w-3 h-3" />
                            {new Date(remark.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>

                        {/* Remark Text */}
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {remark.remark}
                        </p>
                      </div>

                      {/* Delete Button */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteRemark(remark._id)}
                          className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                          title="Delete remark"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionRemarks;
