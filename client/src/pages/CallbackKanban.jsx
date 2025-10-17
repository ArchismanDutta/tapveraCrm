import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Phone,
  Mail,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Search,
  Filter,
  User,
  MessageSquare,
  Video,
  CalendarClock,
  ArrowRight,
  Tag,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Time-based pipeline stages configuration
const TIME_STAGES = [
  {
    id: "overdue",
    label: "Overdue",
    color: "bg-red-500",
    lightBg: "bg-red-50",
    darkBg: "bg-red-900/20",
    borderColor: "border-red-500",
    icon: AlertCircle,
    description: "Past due callbacks",
  },
  {
    id: "today",
    label: "Today",
    color: "bg-orange-500",
    lightBg: "bg-orange-50",
    darkBg: "bg-orange-900/20",
    borderColor: "border-orange-500",
    icon: Clock,
    description: "Due today",
  },
  {
    id: "tomorrow",
    label: "Tomorrow",
    color: "bg-yellow-500",
    lightBg: "bg-yellow-50",
    darkBg: "bg-yellow-900/20",
    borderColor: "border-yellow-500",
    icon: Calendar,
    description: "Due tomorrow",
  },
  {
    id: "thisWeek",
    label: "This Week",
    color: "bg-blue-500",
    lightBg: "bg-blue-50",
    darkBg: "bg-blue-900/20",
    borderColor: "border-blue-500",
    icon: CalendarClock,
    description: "Due this week",
  },
  {
    id: "future",
    label: "Future",
    color: "bg-purple-500",
    lightBg: "bg-purple-50",
    darkBg: "bg-purple-900/20",
    borderColor: "border-purple-500",
    icon: ArrowRight,
    description: "Future callbacks",
  },
  {
    id: "completed",
    label: "Completed",
    color: "bg-green-500",
    lightBg: "bg-green-50",
    darkBg: "bg-green-900/20",
    borderColor: "border-green-500",
    icon: CheckCircle,
    description: "Completed callbacks",
  },
];

// Callback type configuration
const CALLBACK_TYPES = {
  Call: { icon: Phone, color: "text-green-400", bg: "bg-green-600/20" },
  Email: { icon: Mail, color: "text-blue-400", bg: "bg-blue-600/20" },
  WhatsApp: { icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-600/20" },
  Zoom: { icon: Video, color: "text-purple-400", bg: "bg-purple-600/20" },
  "In-Person Meeting": { icon: User, color: "text-orange-400", bg: "bg-orange-600/20" },
};

const CallbackKanban = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedCallback, setDraggedCallback] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedCallback, setSelectedCallback] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showQuickUpdateModal, setShowQuickUpdateModal] = useState(false);
  const [quickUpdateAction, setQuickUpdateAction] = useState(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    setUserRole(storedRole);
    fetchCallbacks();
    fetchEmployees();
  }, []);

  const fetchCallbacks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/api/callbacks`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit: 1000,
        },
      });

      // Ensure we always get an array
      let callbacksData = [];
      if (Array.isArray(response.data)) {
        callbacksData = response.data;
      } else if (Array.isArray(response.data.callbacks)) {
        callbacksData = response.data.callbacks;
      } else if (response.data && typeof response.data === 'object') {
        console.warn("API returned unexpected format:", response.data);
        callbacksData = [];
      }

      setCallbacks(callbacksData);
      calculateStats(callbacksData);
    } catch (error) {
      console.error("Error fetching callbacks:", error);
      setCallbacks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployees(response.data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const getTimeStage = (callback) => {
    if (callback.status === "Completed") return "completed";

    const callbackDate = new Date(callback.callbackDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

    callbackDate.setHours(0, 0, 0, 0);

    if (callbackDate < today) return "overdue";
    if (callbackDate.getTime() === today.getTime()) return "today";
    if (callbackDate.getTime() === tomorrow.getTime()) return "tomorrow";
    if (callbackDate <= endOfWeek) return "thisWeek";
    return "future";
  };

  const calculateStats = (callbacksData) => {
    // Safety check: ensure callbacksData is an array
    if (!Array.isArray(callbacksData)) {
      console.error("calculateStats called with non-array:", callbacksData);
      setStats({});
      return;
    }

    const statsData = {};

    TIME_STAGES.forEach((stage) => {
      const stageCallbacks = callbacksData.filter((cb) => getTimeStage(cb) === stage.id);
      statsData[stage.id] = {
        count: stageCallbacks.length,
      };
    });

    setStats(statsData);
  };

  const getCallbacksByStage = (stageId) => {
    // Safety check: ensure callbacks is an array
    if (!Array.isArray(callbacks)) {
      console.error("getCallbacksByStage: callbacks is not an array:", callbacks);
      return [];
    }

    return callbacks.filter((callback) => {
      const matchesStage = getTimeStage(callback) === stageId;
      const matchesSearch =
        !searchTerm ||
        callback.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        callback.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        callback.leadId?.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType =
        selectedType === "all" || callback.callbackType === selectedType;
      const matchesAssignee =
        selectedAssignee === "all" ||
        callback.assignedTo?._id === selectedAssignee ||
        callback.assignedTo === selectedAssignee;

      return matchesStage && matchesSearch && matchesType && matchesAssignee;
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "Urgent":
        return "bg-red-100 text-red-800 border-red-300";
      case "High":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const openCallbackDetails = (callback) => {
    setSelectedCallback(callback);
    setShowDetailsModal(true);
  };

  const openQuickUpdate = (callback, action, e) => {
    e.stopPropagation();
    setSelectedCallback(callback);
    setQuickUpdateAction(action);
    setShowQuickUpdateModal(true);
  };

  const handleQuickUpdate = async () => {
    try {
      const token = localStorage.getItem("token");
      let updateData = {};

      switch (quickUpdateAction) {
        case "complete":
          updateData = { status: "Completed", completedDate: new Date() };
          break;
        case "reschedule":
          // In a real app, you'd show a date picker here
          const newDate = new Date();
          newDate.setDate(newDate.getDate() + 1);
          updateData = {
            callbackDate: newDate,
            status: "Rescheduled",
            rescheduledCount: (selectedCallback.rescheduledCount || 0) + 1
          };
          break;
        case "cancel":
          updateData = { status: "Cancelled" };
          break;
      }

      await axios.put(
        `${API_BASE}/api/callbacks/${selectedCallback._id}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowQuickUpdateModal(false);
      setSelectedCallback(null);
      setQuickUpdateAction(null);
      fetchCallbacks();
    } catch (error) {
      console.error("Error updating callback:", error);
      alert("Failed to update callback");
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] text-gray-100">
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole || "employee"}
      />

      <main
        className={`flex-1 overflow-hidden transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Header */}
        <div className="bg-[#191f2b]/70 border-b border-[#232945] px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-7 h-7 text-purple-400" />
                Callback Pipeline
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Time-based callback management
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchCallbacks}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={() => (window.location.href = "/add-callback")}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Add Callback
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            {TIME_STAGES.map((stage) => {
              const StageIcon = stage.icon;
              return (
                <div
                  key={stage.id}
                  className={`${stage.darkBg} border ${stage.borderColor} rounded-lg p-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StageIcon className={`w-4 h-4 ${stage.color.replace("bg-", "text-")}`} />
                      <span className="text-xs text-gray-400">{stage.label}</span>
                    </div>
                    <span className={`${stage.color} text-white px-2 py-0.5 rounded-full text-xs font-bold`}>
                      {stats[stage.id]?.count || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search callbacks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Types</option>
              <option value="Call">Call</option>
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Zoom">Zoom</option>
              <option value="In-Person Meeting">In-Person Meeting</option>
            </select>

            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Assignees</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="h-[calc(100vh-280px)] overflow-x-auto overflow-y-hidden p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Loading callbacks...</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 h-full min-w-max">
              {TIME_STAGES.map((stage) => {
                const stageCallbacks = getCallbacksByStage(stage.id);
                const StageIcon = stage.icon;

                return (
                  <div
                    key={stage.id}
                    className="flex-shrink-0 w-80 flex flex-col"
                  >
                    {/* Stage Header */}
                    <div
                      className={`${stage.darkBg} border-2 ${stage.borderColor} rounded-lg p-4 mb-3`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`${stage.color} p-2 rounded-lg`}>
                            <StageIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm">
                              {stage.label}
                            </h3>
                            <p className="text-xs text-gray-400">{stage.description}</p>
                          </div>
                        </div>
                        <span
                          className={`${stage.color} text-white px-2.5 py-1 rounded-full text-sm font-bold`}
                        >
                          {stageCallbacks.length}
                        </span>
                      </div>
                    </div>

                    {/* Stage Cards */}
                    <div className="flex-1 overflow-y-auto space-y-3 p-2 rounded-lg">
                      {stageCallbacks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
                          <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                          <p>No callbacks</p>
                        </div>
                      ) : (
                        stageCallbacks.map((callback) => {
                          const TypeIcon = CALLBACK_TYPES[callback.callbackType]?.icon || Phone;
                          const typeColor = CALLBACK_TYPES[callback.callbackType]?.color || "text-gray-400";
                          const typeBg = CALLBACK_TYPES[callback.callbackType]?.bg || "bg-gray-600/20";

                          return (
                            <div
                              key={callback._id}
                              onClick={() => openCallbackDetails(callback)}
                              className="bg-[#191f2b] border border-[#232945] rounded-lg p-4 cursor-pointer hover:shadow-xl hover:border-purple-500/50 transition-all group"
                            >
                              {/* Callback Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-white text-sm truncate group-hover:text-purple-400 transition-colors">
                                    {callback.clientName || callback.leadId?.clientName || "Unknown"}
                                  </h4>
                                  <p className="text-xs text-gray-400 truncate">
                                    {callback.businessName || callback.leadId?.businessName || "N/A"}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                                    callback.priority
                                  )}`}
                                >
                                  {callback.priority}
                                </span>
                              </div>

                              {/* Quick Action Buttons - Only show for non-completed */}
                              {callback.status !== "Completed" && (
                                <div className="flex gap-2 mb-3">
                                  <button
                                    onClick={(e) => openQuickUpdate(callback, "complete", e)}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded text-green-400 text-xs transition-colors"
                                    title="Mark Complete"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    <span className="hidden sm:inline">Complete</span>
                                  </button>
                                  <button
                                    onClick={(e) => openQuickUpdate(callback, "reschedule", e)}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-500/30 rounded text-orange-400 text-xs transition-colors"
                                    title="Reschedule"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span className="hidden sm:inline">Reschedule</span>
                                  </button>
                                  <button
                                    onClick={(e) => openQuickUpdate(callback, "cancel", e)}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded text-red-400 text-xs transition-colors"
                                    title="Cancel"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span className="hidden sm:inline">Cancel</span>
                                  </button>
                                </div>
                              )}

                              {/* Callback Details */}
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2 text-xs">
                                  <div className={`${typeBg} border border-${typeColor.replace("text-", "")}/30 rounded px-2 py-1 flex items-center gap-1`}>
                                    <TypeIcon className={`w-3.5 h-3.5 ${typeColor}`} />
                                    <span className={typeColor}>{callback.callbackType}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>
                                    {new Date(callback.callbackDate).toLocaleDateString()} at {callback.callbackTime}
                                  </span>
                                </div>

                                {callback.remarks && (
                                  <div className="text-xs text-gray-400 line-clamp-2">
                                    {callback.remarks}
                                  </div>
                                )}
                              </div>

                              {/* Callback Footer */}
                              <div className="flex items-center justify-between pt-3 border-t border-[#232945]">
                                {callback.assignedTo && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                                      {(callback.assignedTo.name || "U")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <span className="text-xs text-gray-400 truncate max-w-[100px]">
                                      {callback.assignedTo.name}
                                    </span>
                                  </div>
                                )}

                                {callback.status && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    callback.status === "Completed" ? "bg-green-600/20 text-green-400" :
                                    callback.status === "Rescheduled" ? "bg-orange-600/20 text-orange-400" :
                                    callback.status === "Cancelled" ? "bg-red-600/20 text-red-400" :
                                    "bg-blue-600/20 text-blue-400"
                                  }`}>
                                    {callback.status}
                                  </span>
                                )}
                              </div>

                              {/* Reschedule indicator */}
                              {callback.rescheduledCount > 0 && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-orange-400">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Rescheduled {callback.rescheduledCount}x</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Callback Details Modal */}
      {showDetailsModal && selectedCallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#191f2b] border border-[#232945] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Callback Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Client Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                  Client Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Client Name</label>
                    <p className="text-white font-medium">
                      {selectedCallback.clientName || selectedCallback.leadId?.clientName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Business Name</label>
                    <p className="text-white font-medium">
                      {selectedCallback.businessName || selectedCallback.leadId?.businessName || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Callback Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                  Callback Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Type</label>
                    <p className="text-white font-medium">{selectedCallback.callbackType}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Priority</label>
                    <p className="text-white font-medium">{selectedCallback.priority}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Date</label>
                    <p className="text-white">
                      {new Date(selectedCallback.callbackDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Time</label>
                    <p className="text-white">{selectedCallback.callbackTime}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <p className="text-white font-medium">{selectedCallback.status}</p>
                  </div>
                  {selectedCallback.rescheduledCount > 0 && (
                    <div>
                      <label className="text-xs text-gray-500">Rescheduled</label>
                      <p className="text-orange-400 font-medium">
                        {selectedCallback.rescheduledCount} times
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment */}
              {selectedCallback.assignedTo && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                    Assignment
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                      {selectedCallback.assignedTo.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {selectedCallback.assignedTo.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {selectedCallback.assignedTo.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedCallback.remarks && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                    Remarks
                  </h3>
                  <p className="text-white text-sm leading-relaxed">
                    {selectedCallback.remarks}
                  </p>
                </div>
              )}

              {/* Outcome (if completed) */}
              {selectedCallback.outcome && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                    Outcome
                  </h3>
                  <p className="text-white text-sm leading-relaxed">
                    {selectedCallback.outcome}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#232945]">
                <button
                  onClick={() => {
                    window.location.href = `/view-callbacks?edit=${selectedCallback._id}`;
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Edit Callback
                </button>
                {selectedCallback.leadId && (
                  <button
                    onClick={() => {
                      window.location.href = `/view-leads?view=${selectedCallback.leadId._id || selectedCallback.leadId}`;
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    View Lead
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Update Modal */}
      {showQuickUpdateModal && selectedCallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#191f2b] border border-[#232945] rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">
                {quickUpdateAction === "complete" && "Mark as Completed"}
                {quickUpdateAction === "reschedule" && "Reschedule Callback"}
                {quickUpdateAction === "cancel" && "Cancel Callback"}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-300">
                {quickUpdateAction === "complete" && "Mark this callback as completed?"}
                {quickUpdateAction === "reschedule" && "Reschedule this callback to tomorrow?"}
                {quickUpdateAction === "cancel" && "Are you sure you want to cancel this callback?"}
              </p>

              <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-3">
                <p className="text-sm text-gray-400">Client</p>
                <p className="text-white font-medium">
                  {selectedCallback.clientName || selectedCallback.leadId?.clientName}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowQuickUpdateModal(false);
                    setSelectedCallback(null);
                    setQuickUpdateAction(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickUpdate}
                  className={`flex-1 px-4 py-3 text-white rounded-lg transition-all shadow-lg ${
                    quickUpdateAction === "complete" ? "bg-green-600 hover:bg-green-700" :
                    quickUpdateAction === "reschedule" ? "bg-orange-600 hover:bg-orange-700" :
                    "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallbackKanban;
