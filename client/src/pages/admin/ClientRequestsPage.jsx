import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  FileText,
  HelpCircle,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  Tag,
  MessageCircle,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../../components/dashboard/Sidebar";
import API from "../../api";
import RequestChatModal from "../../components/client/RequestChatModal";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const ClientRequestsPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "all",
    priority: "all",
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    quotes: 0,
    support: 0,
    urgent: 0,
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, requestId: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type !== "all") params.append("type", filters.type);
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.priority !== "all") params.append("priority", filters.priority);

      const response = await API.get(`/api/client-requests?${params.toString()}`);
      setRequests(response.data.data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await API.get("/api/client-requests/stats/overview");
      setStats(response.data.data || {});
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleOpenChat = (request) => {
    setSelectedRequest(request);
    setShowChatModal(true);
  };

  const handleCloseChat = () => {
    setShowChatModal(false);
    setSelectedRequest(null);
    fetchRequests(); // Refresh to get updated unread counts
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      await API.put(`/api/client-requests/${requestId}`, { status: newStatus });
      toast.success("Status updated successfully");
      fetchRequests();
      fetchStats();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteClick = (requestId) => {
    setDeleteConfirm({ show: true, requestId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.requestId) return;

    setDeleting(true);
    try {
      await API.delete(`/api/client-requests/${deleteConfirm.requestId}`);
      toast.success("Request deleted successfully");
      fetchRequests();
      fetchStats();
      setDeleteConfirm({ show: false, requestId: null });
    } catch (error) {
      console.error("Error deleting request:", error);
      toast.error(error.response?.data?.message || "Failed to delete request");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false, requestId: null });
  };

  const filteredRequests = requests.filter((request) => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch =
      request.title?.toLowerCase().includes(searchLower) ||
      request.description?.toLowerCase().includes(searchLower) ||
      request.client?.clientName?.toLowerCase().includes(searchLower) ||
      request.client?.businessName?.toLowerCase().includes(searchLower);

    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "in-progress":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      case "resolved":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "closed":
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "low":
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  const getTypeIcon = (type) => {
    return type === "quote" ? FileText : HelpCircle;
  };

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-[#0a0f16]">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} />

      <main
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Client Requests
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage quote requests and support tickets from clients
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <StatCard
              title="Total"
              value={stats.total}
              icon={MessageSquare}
              color="blue"
            />
            <StatCard
              title="Pending"
              value={stats.pending}
              icon={Clock}
              color="yellow"
            />
            <StatCard
              title="In Progress"
              value={stats.inProgress}
              icon={AlertCircle}
              color="blue"
            />
            <StatCard
              title="Resolved"
              value={stats.resolved}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              title="Quotes"
              value={stats.quotes}
              icon={FileText}
              color="purple"
            />
            <StatCard
              title="Support"
              value={stats.support}
              icon={HelpCircle}
              color="orange"
            />
            <StatCard
              title="Urgent"
              value={stats.urgent}
              icon={AlertCircle}
              color="red"
            />
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-[#1a1f2e] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#0f1419] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="px-4 py-2 bg-gray-50 dark:bg-[#0f1419] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="quote">Quote Requests</option>
                <option value="support">Support Tickets</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-4 py-2 bg-gray-50 dark:bg-[#0f1419] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="px-4 py-2 bg-gray-50 dark:bg-[#0f1419] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={fetchRequests}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white dark:bg-[#1a1f2e] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No requests found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRequests.map((request) => {
                  const TypeIcon = getTypeIcon(request.type);
                  return (
                    <div
                      key={request._id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-[#0f1419] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="p-3 bg-gray-100 dark:bg-[#0f1419] rounded-lg">
                            <TypeIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                {request.title}
                              </h3>
                              {request.unreadCount?.admin > 0 && (
                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-600 text-white text-xs font-bold rounded-full">
                                  {request.unreadCount.admin}
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                              {request.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                  request.status
                                )}`}
                              >
                                {request.status}
                              </span>

                              {request.type === "support" && (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                                    request.priority
                                  )}`}
                                >
                                  {request.priority}
                                </span>
                              )}

                              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <User className="w-3 h-3" />
                                {request.client?.clientName || request.client?.businessName}
                              </span>

                              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <Calendar className="w-3 h-3" />
                                {new Date(request.createdAt).toLocaleDateString()}
                              </span>

                              {request.type === "quote" && request.projectType && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Tag className="w-3 h-3" />
                                  {request.projectType}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleOpenChat(request)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Chat
                          </button>

                          <select
                            value={request.status}
                            onChange={(e) => handleStatusChange(request._id, e.target.value)}
                            className="px-3 py-2 bg-gray-50 dark:bg-[#0f1419] border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>

                          <button
                            onClick={() => handleDeleteClick(request._id)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Chat Modal */}
      {showChatModal && selectedRequest && (
        <RequestChatModal
          request={selectedRequest}
          onClose={handleCloseChat}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Request"
        message="Are you sure you want to delete this request? This action cannot be undone and all associated messages will be permanently deleted."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: "bg-blue-600/20 text-blue-400 border-blue-500/50",
    yellow: "bg-yellow-600/20 text-yellow-400 border-yellow-500/50",
    green: "bg-green-600/20 text-green-400 border-green-500/50",
    purple: "bg-purple-600/20 text-purple-400 border-purple-500/50",
    orange: "bg-orange-600/20 text-orange-400 border-orange-500/50",
    red: "bg-red-600/20 text-red-400 border-red-500/50",
  };

  return (
    <div className="bg-white dark:bg-[#1a1f2e] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
};

export default ClientRequestsPage;
