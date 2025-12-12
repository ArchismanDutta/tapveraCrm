import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  Plus,
  Eye,
  PhoneCall,
  User,
  Users,
  MapPin,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "../styles/custom-scrollbar.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const ViewLeads = ({ onLogout }) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("employee");
  const [userDepartment, setUserDepartment] = useState("");
  const [userPosition, setUserPosition] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [viewMode, setViewMode] = useState("team"); // "my" or "team"

  // View Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Super Admin Lookup
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
      setCurrentUser(user);
      setUserDepartment(user.department || "");
      setUserPosition(user.position || "");
    }
    fetchLeads();
    fetchStats();
    if (["admin", "super-admin", "hr"].includes(user?.role) ||
        (user?.position && (user.position.toLowerCase().includes("supervisor") ||
          user.position.toLowerCase().includes("team lead") ||
          user.position.toLowerCase().includes("manager")))) {
      fetchEmployees();
    }
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter, priorityFilter, sourceFilter, assignedToFilter, viewMode]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/leads?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setLeads(data.data);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/leads/stats`, {
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
      // Filter to only show Marketing & Sales employees
      const marketingSalesEmployees = data.filter(
        (emp) => emp.department === "marketingAndSales"
      );
      setEmployees(marketingSalesEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // View mode filter (for supervisors)
    if (viewMode === "my" && currentUser) {
      filtered = filtered.filter((lead) => lead.assignedTo?._id === currentUser._id);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.leadId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter) {
      filtered = filtered.filter((lead) => lead.priority === priorityFilter);
    }

    // Source filter
    if (sourceFilter) {
      filtered = filtered.filter((lead) => lead.source === sourceFilter);
    }

    // Assigned to filter
    if (assignedToFilter) {
      filtered = filtered.filter((lead) => lead.assignedTo?._id === assignedToFilter);
    }

    setFilteredLeads(filtered);
    setCurrentPage(1);
  };

  const handleDelete = async (leadId) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Lead deleted successfully");
        fetchLeads();
        fetchStats();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete lead");
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    }
  };

  const handleAddCallback = (leadId) => {
    navigate(`/callbacks/add?leadId=${leadId}`);
  };

  const handleViewLead = (lead) => {
    setSelectedLead(lead);
    setViewModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setPriorityFilter("");
    setSourceFilter("");
    setAssignedToFilter("");
    setViewMode("team");
  };

  // Super Admin Lookup Function
  const handleLookup = async () => {
    if (!lookupQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setLookupLoading(true);
    try {
      const token = localStorage.getItem("token");

      // Search for the lead
      const response = await fetch(
        `${API_BASE}/api/leads/lookup?query=${encodeURIComponent(lookupQuery)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Lead not found");
      }

      if (!data.success || !data.data) {
        toast.error("No lead found matching your search");
        return;
      }

      // Fetch callbacks for this lead
      const callbackResponse = await fetch(
        `${API_BASE}/api/callbacks?leadId=${data.data._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const callbackData = await callbackResponse.json();

      setLookupResults({
        lead: data.data,
        callbacks: callbackData.success ? callbackData.data : [],
      });
      setLookupModalOpen(true);
    } catch (error) {
      console.error("Error during lookup:", error);
      toast.error(error.message || "Failed to lookup lead");
    } finally {
      setLookupLoading(false);
    }
  };

  const closeLookupModal = () => {
    setLookupModalOpen(false);
    setLookupResults(null);
    setLookupQuery("");
  };

  // Export functions
  const exportToCSV = () => {
    const csvData = filteredLeads.map((lead) => ({
      "Lead ID": lead.leadId,
      "Client Name": lead.clientName,
      "Business Name": lead.businessName,
      Email: lead.email,
      Phone: lead.phone,
      Source: lead.source,
      Status: lead.status,
      Priority: lead.priority,
      "Assigned To": lead.assignedTo?.name || "",
      "Created Date": new Date(lead.createdAt).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const exportToExcel = () => {
    const excelData = filteredLeads.map((lead) => ({
      "Lead ID": lead.leadId,
      "Client Name": lead.clientName,
      "Business Name": lead.businessName,
      Email: lead.email,
      Phone: lead.phone,
      Source: lead.source,
      Status: lead.status,
      Priority: lead.priority,
      Industry: lead.industry || "",
      "Expected Revenue": lead.expectedRevenue || 0,
      "Assigned To": lead.assignedTo?.name || "",
      "Created Date": new Date(lead.createdAt).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Leads Report", 14, 15);

    const tableData = filteredLeads.map((lead) => [
      lead.leadId,
      lead.clientName,
      lead.businessName,
      lead.email,
      lead.phone,
      lead.status,
      lead.priority,
      lead.assignedTo?.name || "",
    ]);

    doc.autoTable({
      head: [["Lead ID", "Client", "Business", "Email", "Phone", "Status", "Priority", "Assigned To"]],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [6, 182, 212] },
    });

    doc.save(`leads_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const copyToClipboard = () => {
    const text = filteredLeads
      .map(
        (lead) =>
          `${lead.leadId}\t${lead.clientName}\t${lead.businessName}\t${lead.email}\t${lead.phone}\t${lead.status}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handlePrint = () => {
    window.print();
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

  const getStatusColor = (status) => {
    const colors = {
      New: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      Contacted: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
      Qualified: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      "Proposal Sent": "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
      Negotiation: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      Won: "bg-green-500/20 text-green-400 border-green-500/50",
      Lost: "bg-red-500/20 text-red-400 border-red-500/50",
      "On Hold": "bg-gray-500/20 text-gray-400 border-gray-500/50",
    };
    return colors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/50";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Low: "bg-green-500/20 text-green-400",
      Medium: "bg-yellow-500/20 text-yellow-400",
      High: "bg-orange-500/20 text-orange-400",
      Urgent: "bg-red-500/20 text-red-400",
    };
    return colors[priority] || "bg-gray-500/20 text-gray-400";
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-56"} p-8 max-w-full overflow-x-hidden`}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                {userPosition && (userPosition.toLowerCase().includes("supervisor") ||
                  userPosition.toLowerCase().includes("team lead") ||
                  userPosition.toLowerCase().includes("manager"))
                  ? "Team Lead Management"
                  : userRole === "admin" || userRole === "super-admin"
                  ? "Lead Management"
                  : "My Leads"}
              </h1>
              <p className="text-gray-400">
                {userPosition && (userPosition.toLowerCase().includes("supervisor") ||
                  userPosition.toLowerCase().includes("team lead") ||
                  userPosition.toLowerCase().includes("manager"))
                  ? "Track and manage your team's sales leads"
                  : "Track and manage your sales leads"}
              </p>
            </div>
            {(userRole === "super-admin" || userDepartment === "marketingAndSales") && (
              <button
                onClick={() => navigate("/leads/add")}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-cyan-500/50"
              >
                <Plus className="h-5 w-5" />
                Add New Lead
              </button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Leads</p>
                  <p className="text-3xl font-bold text-white">{stats.totalLeads}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Converted</p>
                  <p className="text-3xl font-bold text-white">{stats.convertedLeads}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Conversion Rate</p>
                  <p className="text-3xl font-bold text-white">{stats.conversionRate}%</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Filter for Supervisors */}
        {userPosition && (userPosition.toLowerCase().includes("supervisor") ||
          userPosition.toLowerCase().includes("team lead") ||
          userPosition.toLowerCase().includes("manager")) && (
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/30 mb-6">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <Filter className="h-5 w-5" />
              View Mode
            </h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setViewMode("my")}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all ${
                  viewMode === "my"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-105"
                    : "bg-slate-700/50 text-gray-300 hover:bg-slate-700 border border-slate-600"
                }`}
              >
                <User className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-sm">My Leads</div>
                  <div className="text-xs opacity-75">Show only my assigned leads</div>
                </div>
              </button>

              <button
                onClick={() => setViewMode("team")}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all ${
                  viewMode === "team"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-105"
                    : "bg-slate-700/50 text-gray-300 hover:bg-slate-700 border border-slate-600"
                }`}
              >
                <Users className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-sm">Team Leads</div>
                  <div className="text-xs opacity-75">Show all team members' leads</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Super Admin Lookup Section */}
        {userRole === "super-admin" && (
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl p-6 border border-indigo-500/30 mb-6">
            <div className="mb-3">
              <h2 className="text-xl font-semibold text-indigo-400 flex items-center gap-2">
                <Search className="h-5 w-5" />
                Advanced Lead Lookup
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Search by Lead ID, Client Name, Business Name, or Email to view complete lead details with all callbacks
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter Lead ID, Client Name, Business Name, or Email..."
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleLookup()}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={lookupLoading}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {lookupLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Lookup
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 mb-6 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700"
              >
                <option value="">📊 All Status</option>
                <option value="New">🆕 New</option>
                <option value="Contacted">📞 Contacted</option>
                <option value="Qualified">✅ Qualified</option>
                <option value="Proposal Sent">📄 Proposal Sent</option>
                <option value="Negotiation">🤝 Negotiation</option>
                <option value="Won">🎉 Won (Sold)</option>
                <option value="Lost">❌ Lost (Declined)</option>
                <option value="On Hold">⏸️ On Hold</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700"
              >
                <option value="">⚡ All Priority</option>
                <option value="Low">🟢 Low</option>
                <option value="Medium">🟡 Medium</option>
                <option value="High">🟠 High</option>
                <option value="Urgent">🔴 Urgent</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700"
              >
                <option value="">🌐 All Sources</option>
                <option value="Website">💻 Website</option>
                <option value="Referral">👥 Referral</option>
                <option value="Cold Call">📱 Cold Call</option>
                <option value="Social Media">📱 Social Media</option>
                <option value="Email Campaign">📧 Email Campaign</option>
                <option value="Other">📋 Other</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {(["admin", "super-admin", "hr"].includes(userRole) ||
              (userPosition && (userPosition.toLowerCase().includes("supervisor") ||
                userPosition.toLowerCase().includes("team lead") ||
                userPosition.toLowerCase().includes("manager")))) && (
              <div className="relative">
                <select
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700"
                >
                  <option value="">👥 All Team Members</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      👤 {emp.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              <Download className="h-4 w-4" />
              Copy
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              <Download className="h-4 w-4" />
              Print
            </button>
            {(searchTerm || statusFilter || priorityFilter || sourceFilter || assignedToFilter) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all ml-auto"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
          ) : currentLeads.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No leads found</p>
            </div>
          ) : (
            <>
              <div className="w-full">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="w-12 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        #
                      </th>
                      <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        ID
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Client & Business
                      </th>
                      <th className="w-20 px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                        Status
                      </th>
                      <th className="w-20 px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                        Priority
                      </th>
                      <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {currentLeads.map((lead, index) => (
                      <tr key={lead._id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-2 py-3 text-sm text-gray-300">
                          {indexOfFirstItem + index + 1}
                        </td>
                        <td className="px-2 py-3">
                          <span className="text-cyan-400 font-medium text-xs">{lead.leadId}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-medium text-sm truncate">{lead.clientName}</p>
                              {userPosition && (userPosition.toLowerCase().includes("supervisor") ||
                                userPosition.toLowerCase().includes("team lead") ||
                                userPosition.toLowerCase().includes("manager")) && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                  lead.assignedTo?._id === currentUser?._id
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                    : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                }`}>
                                  {lead.assignedTo?._id === currentUser?._id
                                    ? "👤 Me"
                                    : `👤 ${lead.assignedTo?.name || "Unassigned"}`}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs truncate">{lead.businessName}</p>
                            <p className="text-gray-500 text-xs truncate">{lead.phone}</p>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              lead.status
                            )}`}
                          >
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                              lead.priority
                            )}`}
                          >
                            {lead.priority}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleViewLead(lead)}
                              className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {userRole === "super-admin" && (
                              <>
                                <button
                                  onClick={() => navigate(`/leads/edit/${lead._id}`)}
                                  className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(lead._id)}
                                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}

                            {userRole !== "super-admin" && userDepartment === "marketingAndSales" && lead.assignedTo?._id === currentUser?._id && (
                              <button
                                onClick={() => navigate(`/leads/edit/${lead._id}`)}
                                className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-slate-900/50 px-3 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-700/50">
                <div className="text-sm text-gray-400">
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeads.length)} of{" "}
                  {filteredLeads.length} leads
                </div>
                <div className="flex gap-1 md:gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-600 text-white rounded-lg transition-all"
                  >
                    Prev
                  </button>
                  <div className="hidden sm:flex items-center gap-1 md:gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 text-sm rounded-lg transition-all ${
                            currentPage === pageNum
                              ? "bg-cyan-500 text-white"
                              : "bg-slate-700 hover:bg-slate-600 text-white"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <div className="sm:hidden text-white text-sm px-2 py-2">
                    {currentPage} / {totalPages}
                  </div>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-600 text-white rounded-lg transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* View Lead Modal */}
        {viewModalOpen && selectedLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-slate-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Lead Details</h2>
                    <p className="text-cyan-400 font-medium">{selectedLead.leadId}</p>
                  </div>
                  <button
                    onClick={() => setViewModalOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-all"
                  >
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <SimpleBar style={{ maxHeight: 'calc(90vh - 180px)' }} className="flex-1">
                <div className="p-6 space-y-6">
                {/* Status & Priority Badges */}
                <div className="flex flex-wrap gap-3">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(selectedLead.status)}`}>
                    {selectedLead.status}
                  </span>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getPriorityColor(selectedLead.priority)}`}>
                    Priority: {selectedLead.priority}
                  </span>
                  {selectedLead.convertedToCustomer && (
                    <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                      Converted to Customer
                    </span>
                  )}
                </div>

                {/* Client Information */}
                <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                  <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Client Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Client Name</p>
                      <p className="text-white font-medium">{selectedLead.clientName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Business Name</p>
                      <p className="text-white font-medium">{selectedLead.businessName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Email</p>
                      <p className="text-white font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-cyan-400" />
                        {selectedLead.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Phone</p>
                      <p className="text-white font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-cyan-400" />
                        {selectedLead.phone}
                      </p>
                    </div>
                    {selectedLead.alternatePhone && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Alternate Phone</p>
                        <p className="text-white font-medium">{selectedLead.alternatePhone}</p>
                      </div>
                    )}
                    {selectedLead.industry && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Industry</p>
                        <p className="text-white font-medium">{selectedLead.industry}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lead Details */}
                <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                  <h3 className="text-lg font-semibold text-cyan-400 mb-4">Lead Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Source</p>
                      <p className="text-white font-medium">{selectedLead.source}</p>
                    </div>
                    {selectedLead.websiteUrl && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Website</p>
                        <a
                          href={selectedLead.websiteUrl.startsWith('http') ? selectedLead.websiteUrl : `https://${selectedLead.websiteUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 font-medium hover:underline break-all"
                        >
                          {selectedLead.websiteUrl}
                        </a>
                      </div>
                    )}
                    {selectedLead.expectedRevenue && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Expected Revenue</p>
                        <p className="text-white font-medium">₹{selectedLead.expectedRevenue.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Assigned To</p>
                      <p className="text-white font-medium">{selectedLead.assignedTo?.name || "Unassigned"}</p>
                    </div>
                    {selectedLead.assignedBy && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Assigned By</p>
                        <p className="text-white font-medium">{selectedLead.assignedBy?.name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Created Date</p>
                      <p className="text-white font-medium">
                        {new Date(selectedLead.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedLead.nextFollowUpDate && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Next Follow-up</p>
                        <p className="text-white font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-cyan-400" />
                          {new Date(selectedLead.nextFollowUpDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {selectedLead.lastContactedDate && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Last Contacted</p>
                        <p className="text-white font-medium">
                          {new Date(selectedLead.lastContactedDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                {(selectedLead.address || selectedLead.city || selectedLead.state) && (
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                    <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Address Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedLead.address && (
                        <div className="md:col-span-2">
                          <p className="text-gray-400 text-sm mb-1">Address</p>
                          <p className="text-white font-medium">{selectedLead.address}</p>
                        </div>
                      )}
                      {selectedLead.city && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">City</p>
                          <p className="text-white font-medium">{selectedLead.city}</p>
                        </div>
                      )}
                      {selectedLead.state && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">State</p>
                          <p className="text-white font-medium">{selectedLead.state}</p>
                        </div>
                      )}
                      {selectedLead.country && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Country</p>
                          <p className="text-white font-medium">{selectedLead.country}</p>
                        </div>
                      )}
                      {selectedLead.zipCode && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Zip Code</p>
                          <p className="text-white font-medium">{selectedLead.zipCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {selectedLead.tags && selectedLead.tags.length > 0 && (
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                    <h3 className="text-lg font-semibold text-cyan-400 mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedLead.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedLead.notes && (
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                    <h3 className="text-lg font-semibold text-cyan-400 mb-3">Notes</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">{selectedLead.notes}</p>
                  </div>
                )}
                </div>
              </SimpleBar>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-end gap-3">
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  Close
                </button>
                {(userRole === "super-admin" ||
                  (userDepartment === "marketingAndSales" && selectedLead.assignedTo?._id === currentUser?._id)) && (
                  <button
                    onClick={() => {
                      setViewModalOpen(false);
                      navigate(`/leads/edit/${selectedLead._id}`);
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-all"
                  >
                    Edit Lead
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Super Admin Lookup Modal */}
        {lookupModalOpen && lookupResults && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-slate-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Complete Lead Information</h2>
                    <p className="text-indigo-400 font-medium">{lookupResults.lead.leadId}</p>
                  </div>
                  <button
                    onClick={closeLookupModal}
                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <SimpleBar style={{ maxHeight: 'calc(90vh - 180px)' }} className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Lead Details Section */}
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-6 border border-indigo-500/30">
                    <h3 className="text-xl font-semibold text-indigo-400 mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Lead Details
                    </h3>

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Client Name</p>
                        <p className="text-white font-medium">{lookupResults.lead.clientName}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Business Name</p>
                        <p className="text-white font-medium">{lookupResults.lead.businessName}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Email</p>
                        <p className="text-white font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4 text-indigo-400" />
                          {lookupResults.lead.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Phone</p>
                        <p className="text-white font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4 text-indigo-400" />
                          {lookupResults.lead.phone}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Status</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(lookupResults.lead.status)}`}>
                          {lookupResults.lead.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Priority</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(lookupResults.lead.priority)}`}>
                          {lookupResults.lead.priority}
                        </span>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-600/50">
                      {lookupResults.lead.source && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Source</p>
                          <p className="text-white font-medium">{lookupResults.lead.source}</p>
                        </div>
                      )}
                      {lookupResults.lead.industry && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Industry</p>
                          <p className="text-white font-medium">{lookupResults.lead.industry}</p>
                        </div>
                      )}
                      {lookupResults.lead.expectedRevenue && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Expected Revenue</p>
                          <p className="text-white font-medium">${lookupResults.lead.expectedRevenue.toLocaleString()}</p>
                        </div>
                      )}
                      {lookupResults.lead.assignedTo && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Assigned To</p>
                          <p className="text-white font-medium">{lookupResults.lead.assignedTo.name}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Created Date</p>
                        <p className="text-white font-medium">{new Date(lookupResults.lead.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Last Updated</p>
                        <p className="text-white font-medium">{new Date(lookupResults.lead.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Address */}
                    {(lookupResults.lead.address || lookupResults.lead.city) && (
                      <div className="pt-4 border-t border-slate-600/50 mt-4">
                        <p className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-indigo-400" />
                          Address
                        </p>
                        <p className="text-white font-medium">
                          {[lookupResults.lead.address, lookupResults.lead.city, lookupResults.lead.state, lookupResults.lead.country, lookupResults.lead.zipCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {lookupResults.lead.notes && (
                      <div className="pt-4 border-t border-slate-600/50 mt-4">
                        <p className="text-gray-400 text-sm mb-2">Notes</p>
                        <p className="text-gray-300 whitespace-pre-wrap">{lookupResults.lead.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Callbacks Section */}
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-6 border border-green-500/30">
                    <h3 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
                      <PhoneCall className="h-5 w-5" />
                      Associated Callbacks ({lookupResults.callbacks.length})
                    </h3>

                    {lookupResults.callbacks.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-400">No callbacks found for this lead</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {lookupResults.callbacks.map((callback, index) => (
                          <div
                            key={callback._id || index}
                            className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:border-green-500/30 transition-all"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="text-green-400 font-medium text-sm">{callback.callbackId}</p>
                                <p className="text-gray-400 text-xs mt-1">{callback.callbackType}</p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                callback.status === "Completed"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : callback.status === "Pending"
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  : callback.status === "Rescheduled"
                                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                  : callback.status === "Not Reachable"
                                  ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }`}>
                                {callback.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Callback Date</p>
                                <p className="text-white text-sm font-medium flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-green-400" />
                                  {new Date(callback.callbackDate).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Callback Time</p>
                                <p className="text-white text-sm font-medium">{callback.callbackTime}</p>
                              </div>
                              {callback.assignedTo && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Assigned To</p>
                                  <p className="text-white text-sm font-medium">{callback.assignedTo.name || callback.assignedTo}</p>
                                </div>
                              )}
                            </div>

                            {callback.remarks && (
                              <div className="mt-3 pt-3 border-t border-slate-600/30">
                                <p className="text-gray-400 text-xs mb-1">Remarks</p>
                                <p className="text-gray-300 text-sm">{callback.remarks}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SimpleBar>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-between items-center">
                <button
                  onClick={() => navigate(`/callbacks/add?leadId=${lookupResults.lead._id}`)}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all text-sm flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Callback
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={closeLookupModal}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      closeLookupModal();
                      navigate(`/leads/edit/${lookupResults.lead._id}`);
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg transition-all"
                  >
                    Edit Lead
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ViewLeads;