import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  Phone,
  Mail,
  Building2,
  Calendar,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Plus,
  Filter,
  Search,
  ArrowRight,
  Star,
  Tag,
  Globe,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Pipeline stages configuration - Refined 5-stage pipeline
const PIPELINE_STAGES = [
  {
    id: "New",
    label: "New Leads",
    color: "bg-blue-500",
    lightBg: "bg-blue-50",
    darkBg: "bg-blue-900/20",
    borderColor: "border-blue-500",
    icon: Star,
    description: "Fresh leads to be contacted",
  },
  {
    id: "Contacted",
    label: "Contacted",
    color: "bg-purple-500",
    lightBg: "bg-purple-50",
    darkBg: "bg-purple-900/20",
    borderColor: "border-purple-500",
    icon: Phone,
    description: "Initial contact made",
  },
  {
    id: "Qualified",
    label: "Qualified",
    color: "bg-indigo-500",
    lightBg: "bg-indigo-50",
    darkBg: "bg-indigo-900/20",
    borderColor: "border-indigo-500",
    icon: CheckCircle,
    description: "Potential verified",
  },
  {
    id: "Negotiation",
    label: "Negotiation",
    color: "bg-orange-500",
    lightBg: "bg-orange-50",
    darkBg: "bg-orange-900/20",
    borderColor: "border-orange-500",
    icon: TrendingUp,
    description: "Discussing terms & pricing",
  },
  {
    id: "Won",
    label: "Closed Won",
    color: "bg-green-500",
    lightBg: "bg-green-50",
    darkBg: "bg-green-900/20",
    borderColor: "border-green-500",
    icon: CheckCircle,
    description: "Successfully converted",
    isClosed: true,
  },
  {
    id: "Lost",
    label: "Closed Lost",
    color: "bg-red-500",
    lightBg: "bg-red-50",
    darkBg: "bg-red-900/20",
    borderColor: "border-red-500",
    icon: XCircle,
    description: "Did not convert",
    isClosed: true,
  },
];

const LeadKanban = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [selectedLeadForCallback, setSelectedLeadForCallback] = useState(null);
  const [conversionMetrics, setConversionMetrics] = useState({});

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    setUserRole(storedRole);
    fetchLeads();
    fetchEmployees();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/api/leads`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit: 1000, // Get all leads for Kanban view
        },
      });

      // Ensure we always get an array
      let leadsData = [];
      if (Array.isArray(response.data)) {
        leadsData = response.data;
      } else if (Array.isArray(response.data.leads)) {
        leadsData = response.data.leads;
      } else if (response.data && typeof response.data === 'object') {
        console.warn("API returned unexpected format:", response.data);
        leadsData = [];
      }

      setLeads(leadsData);
      calculateStats(leadsData);
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]); // Set empty array on error
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

  const calculateStats = (leadsData) => {
    // Safety check: ensure leadsData is an array
    if (!Array.isArray(leadsData)) {
      console.error("calculateStats called with non-array:", leadsData);
      setStats({});
      setConversionMetrics({
        conversionRate: 0,
        winRate: 0,
        totalRevenue: 0,
        avgDealSize: 0
      });
      return;
    }

    const statsData = {};
    const metricsData = {};

    PIPELINE_STAGES.forEach((stage) => {
      const stageLeads = leadsData.filter((lead) => lead.status === stage.id);
      statsData[stage.id] = {
        count: stageLeads.length,
        totalValue: stageLeads.reduce((sum, lead) => sum + (lead.expectedRevenue || 0), 0),
      };
    });

    // Calculate conversion metrics
    const totalLeads = leadsData.length;
    const wonLeads = leadsData.filter(l => l.status === "Won").length;
    const lostLeads = leadsData.filter(l => l.status === "Lost").length;

    metricsData.conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;
    metricsData.winRate = (wonLeads + lostLeads) > 0 ? ((wonLeads / (wonLeads + lostLeads)) * 100).toFixed(1) : 0;
    metricsData.totalRevenue = wonLeads > 0 ? leadsData
      .filter(l => l.status === "Won")
      .reduce((sum, lead) => sum + (lead.expectedRevenue || 0), 0) : 0;
    metricsData.avgDealSize = wonLeads > 0 ? (metricsData.totalRevenue / wonLeads) : 0;

    setStats(statsData);
    setConversionMetrics(metricsData);
  };

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedLead || draggedLead.status === targetStage) {
      setDraggedLead(null);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/leads/${draggedLead._id}`,
        { status: targetStage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setLeads((prevLeads) =>
        prevLeads.map((lead) =>
          lead._id === draggedLead._id ? { ...lead, status: targetStage } : lead
        )
      );

      // Recalculate stats
      const updatedLeads = leads.map((lead) =>
        lead._id === draggedLead._id ? { ...lead, status: targetStage } : lead
      );
      calculateStats(updatedLeads);
    } catch (error) {
      console.error("Error updating lead status:", error);
      alert("Failed to update lead status");
    }

    setDraggedLead(null);
  };

  const getLeadsByStage = (stageId) => {
    // Safety check: ensure leads is an array
    if (!Array.isArray(leads)) {
      console.error("getLeadsByStage: leads is not an array:", leads);
      return [];
    }

    return leads.filter((lead) => {
      const matchesStage = lead.status === stageId;
      const matchesSearch =
        !searchTerm ||
        lead.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority =
        selectedPriority === "all" || lead.priority === selectedPriority;
      const matchesAssignee =
        selectedAssignee === "all" ||
        lead.assignedTo?._id === selectedAssignee ||
        lead.assignedTo === selectedAssignee;

      return matchesStage && matchesSearch && matchesPriority && matchesAssignee;
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const openLeadDetails = (lead) => {
    setSelectedLead(lead);
    setShowDetailsModal(true);
  };

  const openCallbackModal = (lead, e) => {
    e.stopPropagation(); // Prevent card click
    setSelectedLeadForCallback(lead);
    setShowCallbackModal(true);
  };

  const scheduleCallback = () => {
    // Redirect to add callback page with lead ID
    window.location.href = `/add-callback?leadId=${selectedLeadForCallback._id}`;
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
                <TrendingUp className="w-7 h-7 text-blue-400" />
                Sales Pipeline
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Drag and drop leads between stages
              </p>
            </div>
            <button
              onClick={() => (window.location.href = "/add-lead")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Lead
            </button>
          </div>

          {/* Conversion Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">Conversion Rate</span>
              </div>
              <p className="text-xl font-bold text-green-400">{conversionMetrics.conversionRate}%</p>
            </div>
            <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Win Rate</span>
              </div>
              <p className="text-xl font-bold text-blue-400">{conversionMetrics.winRate}%</p>
            </div>
            <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400">Total Revenue</span>
              </div>
              <p className="text-xl font-bold text-purple-400">{formatCurrency(conversionMetrics.totalRevenue)}</p>
            </div>
            <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-400">Avg Deal Size</span>
              </div>
              <p className="text-xl font-bold text-orange-400">{formatCurrency(conversionMetrics.avgDealSize)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
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
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Loading pipeline...</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 h-full min-w-max">
              {PIPELINE_STAGES.map((stage) => {
                const stageLeads = getLeadsByStage(stage.id);
                const StageIcon = stage.icon;

                return (
                  <div
                    key={stage.id}
                    className="flex-shrink-0 w-80 flex flex-col"
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.id)}
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
                          <h3 className="font-semibold text-white">
                            {stage.label}
                          </h3>
                        </div>
                        <span
                          className={`${stage.color} text-white px-2.5 py-1 rounded-full text-sm font-bold`}
                        >
                          {stageLeads.length}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatCurrency(stats[stage.id]?.totalValue || 0)}
                      </div>
                    </div>

                    {/* Stage Cards */}
                    <div
                      className={`flex-1 overflow-y-auto space-y-3 p-2 rounded-lg transition-all ${
                        dragOverStage === stage.id
                          ? `${stage.darkBg} border-2 border-dashed ${stage.borderColor}`
                          : "border-2 border-transparent"
                      }`}
                    >
                      {stageLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
                          <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                          <p>No leads</p>
                        </div>
                      ) : (
                        stageLeads.map((lead) => (
                          <div
                            key={lead._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead)}
                            className="bg-[#191f2b] border border-[#232945] rounded-lg p-4 cursor-move hover:shadow-xl hover:border-blue-500/50 transition-all group"
                          >
                            {/* Lead Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0" onClick={() => openLeadDetails(lead)}>
                                <h4 className="font-semibold text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                                  {lead.clientName}
                                </h4>
                                <p className="text-xs text-gray-400 truncate">
                                  {lead.businessName}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                                  lead.priority
                                )}`}
                              >
                                {lead.priority}
                              </span>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex gap-2 mb-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `tel:${lead.phone}`;
                                }}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded text-green-400 text-xs transition-colors"
                                title="Call"
                              >
                                <Phone className="w-3 h-3" />
                                <span className="hidden sm:inline">Call</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `mailto:${lead.email}`;
                                }}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded text-blue-400 text-xs transition-colors"
                                title="Email"
                              >
                                <Mail className="w-3 h-3" />
                                <span className="hidden sm:inline">Email</span>
                              </button>
                              <button
                                onClick={(e) => openCallbackModal(lead, e)}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded text-purple-400 text-xs transition-colors"
                                title="Schedule Callback"
                              >
                                <Calendar className="w-3 h-3" />
                                <span className="hidden sm:inline">Schedule</span>
                              </button>
                            </div>

                            {/* Lead Details */}
                            <div className="space-y-2 mb-3">
                              {lead.email && (
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">{lead.email}</span>
                                </div>
                              )}
                              {lead.phone && (
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{lead.phone}</span>
                                </div>
                              )}
                              {lead.expectedRevenue && (
                                <div className="flex items-center gap-2 text-xs text-green-400 font-medium">
                                  <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>
                                    {formatCurrency(lead.expectedRevenue)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Lead Footer */}
                            <div className="flex items-center justify-between pt-3 border-t border-[#232945]">
                              {lead.assignedTo && (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                                    {(lead.assignedTo.name || "U")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                  <span className="text-xs text-gray-400 truncate max-w-[100px]">
                                    {lead.assignedTo.name}
                                  </span>
                                </div>
                              )}
                              {lead.nextFollowUpDate && (
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>
                                    {new Date(
                                      lead.nextFollowUpDate
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Tags */}
                            {lead.tags && lead.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {lead.tags.slice(0, 2).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-500/30"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {lead.tags.length > 2 && (
                                  <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                                    +{lead.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Lead Details Modal */}
      {showDetailsModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#191f2b] border border-[#232945] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#191f2b] border-b border-[#232945] px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Lead Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-[#0f1419] rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
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
                      {selectedLead.clientName}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Business Name
                    </label>
                    <p className="text-white font-medium">
                      {selectedLead.businessName}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Email</label>
                    <p className="text-white">{selectedLead.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Phone</label>
                    <p className="text-white">{selectedLead.phone}</p>
                  </div>
                </div>
              </div>

              {/* Lead Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                  Lead Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <p className="text-white font-medium">
                      {selectedLead.status}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Priority</label>
                    <p className="text-white font-medium">
                      {selectedLead.priority}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Source</label>
                    <p className="text-white">{selectedLead.source}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Expected Revenue
                    </label>
                    <p className="text-green-400 font-semibold">
                      {formatCurrency(selectedLead.expectedRevenue)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Assignment */}
              {selectedLead.assignedTo && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                    Assignment
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                      {selectedLead.assignedTo.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {selectedLead.assignedTo.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {selectedLead.assignedTo.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedLead.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                    Notes
                  </h3>
                  <p className="text-white text-sm leading-relaxed">
                    {selectedLead.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#232945]">
                <button
                  onClick={() => {
                    window.location.href = `/view-leads?edit=${selectedLead._id}`;
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Edit Lead
                </button>
                <button
                  onClick={() => {
                    window.location.href = `/add-callback?leadId=${selectedLead._id}`;
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Schedule Callback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Callback Scheduling Modal */}
      {showCallbackModal && selectedLeadForCallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#191f2b] border border-[#232945] rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Schedule Callback
                </h2>
                <p className="text-sm text-purple-100 mt-1">
                  {selectedLeadForCallback.clientName}
                </p>
              </div>
              <button
                onClick={() => setShowCallbackModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-semibold">
                    {selectedLeadForCallback.clientName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selectedLeadForCallback.clientName}</p>
                    <p className="text-sm text-gray-400">{selectedLeadForCallback.businessName}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {selectedLeadForCallback.email && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="w-4 h-4 text-blue-400" />
                      <span>{selectedLeadForCallback.email}</span>
                    </div>
                  )}
                  {selectedLeadForCallback.phone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="w-4 h-4 text-green-400" />
                      <span>{selectedLeadForCallback.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-2">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  You'll be redirected to the callback scheduling form
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCallbackModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={scheduleCallback}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all shadow-lg"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadKanban;
