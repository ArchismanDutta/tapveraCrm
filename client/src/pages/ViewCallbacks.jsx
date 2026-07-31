import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Calendar,
  Plus,
  PhoneCall,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  User,
  Building2,
  ChevronDown,
  X,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import CallSummaryCard from "../components/callIntelligence/CallSummaryCard";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "../styles/custom-scrollbar.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const ViewCallbacks = ({ onLogout }) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("employee");
  const [userDepartment, setUserDepartment] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [stats, setStats] = useState({
    totalCallbacks: 0,
    pendingCallbacks: 0,
    completedCallbacks: 0,
    overdueCallbacks: 0,
    todayCallbacks: 0,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [callbackTypeFilter, setCallbackTypeFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // View Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedCallback, setSelectedCallback] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Transfer dropdown state
  const [openTransferDropdown, setOpenTransferDropdown] = useState(null);
  const [transferSearchTerm, setTransferSearchTerm] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
      setCurrentUserId(user._id);
      setUserDepartment(user.department || "");
    }
    fetchCallbacks();
    fetchStats();
    if (["admin", "super-admin", "hr"].includes(user?.role)) {
      fetchEmployees();
    }
    // Fetch supervisors for web consultants to enable transfers
    if (user?.department === "marketingAndSales") {
      fetchSupervisors();
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [callbacks, searchTerm, statusFilter, callbackTypeFilter, assignedToFilter, dateFilter]);

  const fetchCallbacks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/callbacks?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setCallbacks(data.data);
      }
    } catch (error) {
      console.error("Error fetching callbacks:", error);
      toast.error("Failed to fetch callbacks");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/callbacks/stats`, {
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

  const fetchSupervisors = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users/directory?department=marketingAndSales`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        console.error("Failed to fetch supervisors:", response.status);
        setSupervisors([]);
        return;
      }

      const users = await response.json();

      // The directory endpoint returns an array directly
      if (!Array.isArray(users)) {
        console.warn("Unexpected response structure:", users);
        setSupervisors([]);
        return;
      }

      // Filter to supervisors and team leads in Marketing & Sales
      const supervisorList = users.filter(
        (emp) =>
          emp.position &&
          (emp.position.toLowerCase().includes("supervisor") ||
           emp.position.toLowerCase().includes("team lead") ||
           emp.position.toLowerCase().includes("manager"))
      );

      setSupervisors(supervisorList);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      setSupervisors([]);
    }
  };

  const filteredCallbacks = useMemo(() => {
    let filtered = [...callbacks];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (callback) =>
          callback.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          callback.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          callback.callbackId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          callback.leadId?.leadId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((callback) => callback.status === statusFilter);
    }

    // Callback type filter
    if (callbackTypeFilter) {
      filtered = filtered.filter((callback) => callback.callbackType === callbackTypeFilter);
    }

    // Assigned to filter
    if (assignedToFilter) {
      filtered = filtered.filter((callback) => callback.assignedTo?._id === assignedToFilter);
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter((callback) => {
        const callbackDate = new Date(callback.callbackDate).toISOString().split("T")[0];
        return callbackDate === dateFilter;
      });
    }

    return filtered;
  }, [callbacks, searchTerm, statusFilter, callbackTypeFilter, assignedToFilter, dateFilter]);

  const handleDelete = async (callbackId) => {
    if (!window.confirm("Are you sure you want to delete this callback?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/callbacks/${callbackId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Callback deleted successfully");
        fetchCallbacks();
        fetchStats();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete callback");
      }
    } catch (error) {
      console.error("Error deleting callback:", error);
      toast.error("Failed to delete callback");
    }
  };

  const handleUpdateStatus = async (callbackId, newStatus) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/callbacks/${callbackId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success("Status updated successfully");
        fetchCallbacks();
        fetchStats();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleViewCallback = (callback) => {
    setSelectedCallback(callback);
    setViewModalOpen(true);
  };

  const handleTransfer = async (callbackId, transferredTo) => {
    if (!transferredTo || transferredTo === "self" || transferredTo === "not-transferred") {
      // Reset transfer if selecting "Not Transferred"
      if (transferredTo === "not-transferred") {
        try {
          const token = localStorage.getItem("token");
          const response = await fetch(`${API_BASE}/api/transfers/${callbackId}/cancel`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            toast.success("Transfer cancelled successfully");
            fetchCallbacks();
            fetchStats();
          } else {
            const data = await response.json();
            toast.error(data.message || "Failed to cancel transfer");
          }
        } catch (error) {
          console.error("Error cancelling transfer:", error);
          toast.error("Failed to cancel transfer");
        }
      }
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/transfers/callback/${callbackId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transferredTo }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Callback transferred successfully");
        fetchCallbacks();
        fetchStats();
      } else {
        toast.error(data.message || "Failed to transfer callback");
      }
    } catch (error) {
      console.error("Error transferring callback:", error);
      toast.error("Failed to transfer callback");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setCallbackTypeFilter("");
    setAssignedToFilter("");
    setDateFilter("");
  };

  // Export functions
  const exportToCSV = () => {
    const csvData = filteredCallbacks.map((callback) => ({
      "Callback ID": callback.callbackId,
      "Lead ID": callback.leadId?.leadId || "",
      "Client Name": callback.clientName,
      "Business Name": callback.businessName,
      "Callback Date": new Date(callback.callbackDate).toLocaleDateString(),
      "Callback Time": callback.callbackTime,
      Type: callback.callbackType,
      Status: callback.status,
      Priority: callback.priority,
      "Assigned To": callback.assignedTo?.name || "",
      Remarks: callback.remarks || "",
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Callbacks");
    XLSX.writeFile(wb, `callbacks_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const exportToExcel = () => {
    const excelData = filteredCallbacks.map((callback) => ({
      "Callback ID": callback.callbackId,
      "Lead ID": callback.leadId?.leadId || "",
      "Client Name": callback.clientName,
      "Business Name": callback.businessName,
      "Callback Date": new Date(callback.callbackDate).toLocaleDateString(),
      "Callback Time": callback.callbackTime,
      Type: callback.callbackType,
      Status: callback.status,
      Priority: callback.priority,
      "Assigned To": callback.assignedTo?.name || "",
      Remarks: callback.remarks || "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Callbacks");
    XLSX.writeFile(wb, `callbacks_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Callbacks Report", 14, 15);

    const tableData = filteredCallbacks.map((callback) => [
      callback.callbackId,
      callback.clientName,
      callback.businessName,
      new Date(callback.callbackDate).toLocaleDateString(),
      callback.callbackTime,
      callback.callbackType,
      callback.status,
      callback.assignedTo?.name || "",
    ]);

    doc.autoTable({
      head: [
        [
          "Callback ID",
          "Client",
          "Business",
          "Date",
          "Time",
          "Type",
          "Status",
          "Assigned To",
        ],
      ],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`callbacks_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const copyToClipboard = () => {
    const text = filteredCallbacks
      .map(
        (callback) =>
          `${callback.callbackId}\t${callback.clientName}\t${callback.businessName}\t${new Date(
            callback.callbackDate
          ).toLocaleDateString()}\t${callback.callbackTime}\t${callback.status}`
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
  const currentCallbacks = filteredCallbacks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCallbacks.length / itemsPerPage);

  const getStatusColor = (status) => {
    const colors = {
      Pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      Completed: "bg-green-500/20 text-green-400 border-green-500/50",
      Rescheduled: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      "Not Reachable": "bg-red-500/20 text-red-400 border-red-500/50",
      Cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/50",
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

  const isOverdue = (callback) => {
    if (callback.status === "Completed" || callback.status === "Cancelled") {
      return false;
    }
    const now = new Date();
    const callbackDateTime = new Date(callback.callbackDate);
    const [hours, minutes] = callback.callbackTime.split(":").map(Number);
    callbackDateTime.setHours(hours, minutes, 0, 0);
    return now > callbackDateTime;
  };

  return (
    <div className="app-shell callbacks-theme h-[100dvh] overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className={`app-main h-[100dvh] overflow-y-auto px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${sidebarCollapsed ? "ml-16" : "ml-16 sm:ml-56"}`}>
        {/* Header */}
        <div className="app-page mx-auto max-w-[1600px] pb-8">
        <div className="app-header mb-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <p className="app-eyebrow">Sales follow-up</p>
                <h1 className="app-title">Callback management</h1>
                <p className="app-description">Track schedules, ownership, and follow-up outcomes in one place.</p>
              </div>
            </div>
            {(userRole === "super-admin" || userDepartment === "marketingAndSales") && (
              <button
                onClick={() => navigate("/callbacks/add")}
                className="app-primary-button flex h-10 items-center gap-2 px-4 text-sm font-semibold"
              >
                <Plus className="h-5 w-5" />
                Add callback
              </button>
            )}
          </div>
        </div>

          {/* Stats Cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
            <div className="app-panel p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total callbacks</p>
                  <p className="text-2xl font-bold text-white">{stats.totalCallbacks}</p>
                </div>
                <div className="rounded-xl bg-blue-500/10 p-2.5"><PhoneCall className="h-5 w-5 text-blue-400" /></div>
              </div>
            </div>

            <div className="app-panel p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Pending</p>
                  <p className="text-2xl font-bold text-white">{stats.pendingCallbacks}</p>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-2.5"><Clock className="h-5 w-5 text-yellow-400" /></div>
              </div>
            </div>

            <div className="app-panel p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Completed</p>
                  <p className="text-2xl font-bold text-white">{stats.completedCallbacks}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-2.5"><CheckCircle className="h-5 w-5 text-green-400" /></div>
              </div>
            </div>

            <div className="app-panel p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Overdue</p>
                  <p className="text-2xl font-bold text-white">{stats.overdueCallbacks}</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-2.5"><AlertCircle className="h-5 w-5 text-red-400" /></div>
              </div>
            </div>

            <div className="app-panel col-span-2 p-4 sm:col-span-1 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Today</p>
                  <p className="text-2xl font-bold text-white">{stats.todayCallbacks}</p>
                </div>
                <div className="rounded-xl bg-violet-500/10 p-2.5"><Calendar className="h-5 w-5 text-purple-400" /></div>
              </div>
            </div>
          </div>
        {/* Filters and Search */}
        <div className="app-panel mb-5 overflow-hidden p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Find callbacks</h2>
              <p className="mt-0.5 text-xs text-gray-400">Narrow the list by status, type, date, or owner.</p>
            </div>
            <Filter className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search callbacks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="app-control w-full pl-10 pr-4"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="app-control w-full cursor-pointer appearance-none px-4"
              >
                <option value="">📊 All Status</option>
                <option value="Pending">⏳ Pending</option>
                <option value="Completed">✅ Completed</option>
                <option value="Rescheduled">🔄 Rescheduled</option>
                <option value="Not Reachable">📵 Not Reachable</option>
                <option value="Cancelled">❌ Cancelled</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="relative">
              <select
                value={callbackTypeFilter}
                onChange={(e) => setCallbackTypeFilter(e.target.value)}
                className="app-control w-full cursor-pointer appearance-none px-4"
              >
                <option value="">📞 All Types</option>
                <option value="Call">📞 Call</option>
                <option value="Email">📧 Email</option>
                <option value="WhatsApp">💬 WhatsApp</option>
                <option value="Zoom">🎥 Zoom</option>
                <option value="In-Person Meeting">🤝 In-Person Meeting</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="relative">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="app-control w-full cursor-pointer px-4"
              />
            </div>

            {["admin", "super-admin", "hr"].includes(userRole) && (
              <div className="relative">
                <select
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                  className="app-control w-full cursor-pointer appearance-none px-4"
                >
                  <option value="">👥 All Sales</option>
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
          <div className="flex flex-wrap gap-2 border-t border-slate-700/50 pt-4">
            <button
              onClick={copyToClipboard}
              className="app-secondary-button flex h-9 items-center gap-2 px-3 text-xs font-medium"
            >
              <Download className="h-4 w-4" />
              Copy
            </button>
            <button
              onClick={exportToCSV}
              className="app-secondary-button flex h-9 items-center gap-2 px-3 text-xs font-medium"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={exportToExcel}
              className="app-secondary-button flex h-9 items-center gap-2 px-3 text-xs font-medium"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="app-secondary-button flex h-9 items-center gap-2 px-3 text-xs font-medium"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={handlePrint}
              className="app-secondary-button flex h-9 items-center gap-2 px-3 text-xs font-medium"
            >
              <Download className="h-4 w-4" />
              Print
            </button>
            {(searchTerm ||
              statusFilter ||
              callbackTypeFilter ||
              assignedToFilter ||
              dateFilter) && (
              <button
                onClick={clearFilters}
                className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-medium text-red-400 transition-all hover:bg-red-500/15"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="app-panel" style={{ overflow: "visible" }}>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          ) : currentCallbacks.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No callbacks found</p>
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-t-2xl">
                <table className="w-full min-w-[720px] table-fixed">
                  <thead className="bg-slate-900/40">
                    <tr>
                      <th className="w-12 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        #
                      </th>
                      <th className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        ID
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Client & Schedule
                      </th>
                      <th className="w-24 px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                        Status
                      </th>
                      {userDepartment === "marketingAndSales" && (
                        <th className="w-48 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                          Transfer To
                        </th>
                      )}
                      <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {currentCallbacks.map((callback, index) => (
                      <tr
                        key={callback._id}
                        className={`transition-colors hover:bg-slate-700/30 ${
                          isOverdue(callback) ? "bg-red-500/5" : ""
                        }`}
                      >
                        <td className="px-2 py-3 text-sm text-gray-300">
                          {indexOfFirstItem + index + 1}
                        </td>
                        <td className="px-2 py-3">
                          <span className="font-medium text-blue-400 text-xs">{callback.callbackId}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <p className="text-white font-medium text-sm truncate">{callback.clientName}</p>
                            <p className="text-gray-400 text-xs truncate">{callback.businessName}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">
                                {new Date(callback.callbackDate).toLocaleDateString()}
                              </span>
                              <span className="text-gray-500">{callback.callbackTime}</span>
                              {isOverdue(callback) && (
                                <span className="text-red-400 text-xs">⚠ Overdue</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              callback.status
                            )}`}
                          >
                            {callback.status}
                          </span>
                        </td>
                        {userDepartment === "marketingAndSales" && (
                          <td className="px-2 py-3">
                            <div className="relative">
                              {/* Searchable Transfer Dropdown Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (callback.assignedTo?._id === currentUserId) {
                                    setOpenTransferDropdown(openTransferDropdown === callback._id ? null : callback._id);
                                    setTransferSearchTerm("");
                                  }
                                }}
                                disabled={callback.assignedTo?._id !== currentUserId}
                                className={`w-full px-2 py-1.5 text-xs rounded-lg border transition-all text-left flex items-center justify-between ${
                                  callback.transferStatus !== "Not Transferred"
                                    ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                                    : "bg-slate-700/50 border-slate-600 text-gray-300"
                                } ${
                                  callback.assignedTo?._id === currentUserId
                                    ? "cursor-pointer hover:border-green-500/50"
                                    : "cursor-not-allowed opacity-50"
                                }`}
                                title={
                                  callback.assignedTo?._id !== currentUserId
                                    ? "Can only transfer your own callbacks"
                                    : "Transfer this callback"
                                }
                              >
                                <span className="truncate">
                                  {callback.transferStatus === "Not Transferred"
                                    ? "Not Transferred"
                                    : callback.transferredTo
                                      ? `${callback.transferredTo.name} (${callback.transferredTo.position})`
                                      : "Select..."}
                                </span>
                                <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                              </button>

                              {/* Dropdown Menu */}
                              {openTransferDropdown === callback._id && (
                                <div className="absolute z-[9999] mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl">
                                  {/* Search Input */}
                                  <div className="p-2 border-b border-slate-600">
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                                      <input
                                        type="text"
                                        placeholder="Search by name..."
                                        value={transferSearchTerm}
                                        onChange={(e) => setTransferSearchTerm(e.target.value)}
                                        className="w-full pl-7 pr-7 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-gray-300 focus:outline-none focus:border-green-500"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      {transferSearchTerm && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTransferSearchTerm("");
                                          }}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Options List */}
                                  <div className="max-h-60 overflow-y-auto">
                                    {/* Not Transferred Option */}
                                    <button
                                      onClick={() => {
                                        handleTransfer(callback._id, "not-transferred");
                                        setOpenTransferDropdown(null);
                                        setTransferSearchTerm("");
                                      }}
                                      className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-slate-700 transition-colors"
                                    >
                                      Not Transferred
                                    </button>

                                    {/* Self Option (Disabled) */}
                                    <div className="px-3 py-2 text-xs text-gray-500 cursor-not-allowed opacity-50">
                                      Self
                                    </div>

                                    {/* Filtered Supervisors & Team Leads */}
                                    {supervisors
                                      .filter((sup) =>
                                        sup.name.toLowerCase().includes(transferSearchTerm.toLowerCase()) ||
                                        sup.position.toLowerCase().includes(transferSearchTerm.toLowerCase())
                                      )
                                      .map((sup) => (
                                        <button
                                          key={sup._id}
                                          onClick={() => {
                                            handleTransfer(callback._id, sup._id);
                                            setOpenTransferDropdown(null);
                                            setTransferSearchTerm("");
                                          }}
                                          className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-slate-700 transition-colors"
                                        >
                                          <div className="font-medium">{sup.name}</div>
                                          <div className="text-[10px] text-gray-500">({sup.position})</div>
                                        </button>
                                      ))}

                                    {/* No Results */}
                                    {transferSearchTerm &&
                                      supervisors.filter((sup) =>
                                        sup.name.toLowerCase().includes(transferSearchTerm.toLowerCase()) ||
                                        sup.position.toLowerCase().includes(transferSearchTerm.toLowerCase())
                                      ).length === 0 && (
                                        <div className="px-3 py-4 text-xs text-gray-500 text-center">
                                          No results found
                                        </div>
                                      )}
                                  </div>
                                </div>
                              )}

                              {/* Transfer Status Badge */}
                              {callback.transferStatus !== "Not Transferred" && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className="text-[10px] text-orange-400">
                                    {callback.transferStatus === "Transferred" && "⏳ Pending"}
                                    {callback.transferStatus === "Accepted" && "✓ Accepted"}
                                    {callback.transferStatus === "Rejected" && "✗ Rejected"}
                                    {callback.transferStatus === "Completed" && "✓ Completed"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleViewCallback(callback)}
                              className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {userRole === "super-admin" && (
                              <>
                                {callback.status !== "Completed" && (
                                  <button
                                    onClick={() => handleUpdateStatus(callback._id, "Completed")}
                                    className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all"
                                    title="Complete"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => navigate(`/callbacks/edit/${callback._id}`)}
                                  className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(callback._id)}
                                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}

                            {userRole !== "super-admin" && userDepartment === "marketingAndSales" && callback.assignedTo?._id === currentUserId && (
                              <>
                                {callback.status !== "Completed" && (
                                  <button
                                    onClick={() => handleUpdateStatus(callback._id, "Completed")}
                                    className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all"
                                    title="Complete"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => navigate(`/callbacks/edit/${callback._id}`)}
                                  className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
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

              {/* Pagination */}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-700/50 bg-slate-900/30 px-3 py-4 sm:flex-row md:px-6">
                <div className="text-sm text-gray-400">
                  Showing {indexOfFirstItem + 1} to{" "}
                  {Math.min(indexOfLastItem, filteredCallbacks.length)} of{" "}
                  {filteredCallbacks.length} callbacks
                </div>
                <div className="flex gap-1 md:gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="app-secondary-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
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
                              ? "bg-blue-600 text-white"
                              : "app-secondary-button"
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
                    className="app-secondary-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* View Callback Modal */}
        {viewModalOpen && selectedCallback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4">
            <div className="callback-modal flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl">
              {/* Modal Header */}
              <div className="callback-modal-header sticky top-0 border-b p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <PhoneCall className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white sm:text-2xl">Callback details</h2>
                      <p className="font-medium text-blue-400">{selectedCallback.callbackId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewModalOpen(false)}
                    className="app-secondary-button p-2"
                  >
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <SimpleBar style={{ maxHeight: 'calc(90vh - 180px)' }} className="flex-1 callback-scrollbar">
                <div className="space-y-4 p-4 sm:p-6">
                {/* Status & Priority Badges */}
                <div className="flex flex-wrap gap-3">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(selectedCallback.status)}`}>
                    {selectedCallback.status}
                  </span>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getPriorityColor(selectedCallback.priority)}`}>
                    Priority: {selectedCallback.priority}
                  </span>
                  {isOverdue(selectedCallback) && (
                    <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-sm font-medium border border-red-500/50">
                      ⚠️ Overdue
                    </span>
                  )}
                </div>

                {/* Lead Information */}
                {selectedCallback.leadId && (
                  <div className="callback-detail-section">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-blue-400">
                      <Building2 className="h-5 w-5" />
                      Associated Lead
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Lead ID</p>
                        <p className="text-cyan-400 font-medium">{selectedCallback.leadId?.leadId || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Lead Status</p>
                        <p className="text-white font-medium">{selectedCallback.leadId?.status || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Client Information */}
                <div className="callback-detail-section">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-blue-400">
                    <User className="h-5 w-5" />
                    Client Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Client Name</p>
                      <p className="text-white font-medium">{selectedCallback.clientName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Business Name</p>
                      <p className="text-white font-medium">{selectedCallback.businessName}</p>
                    </div>
                  </div>
                </div>

                {/* Callback Schedule */}
                <div className="callback-detail-section">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-blue-400">
                    <Calendar className="h-5 w-5" />
                    Callback Schedule
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Callback Date</p>
                      <p className="text-white font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-green-400" />
                        {new Date(selectedCallback.callbackDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Callback Time</p>
                      <p className="text-white font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-400" />
                        {selectedCallback.callbackTime}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Type</p>
                      <p className="text-white font-medium">{selectedCallback.callbackType}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Created Date</p>
                      <p className="text-white font-medium">
                        {new Date(selectedCallback.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Assignment Details */}
                <div className="callback-detail-section">
                  <h3 className="mb-4 text-base font-semibold text-blue-400">Assignment details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Assigned To</p>
                      <p className="text-white font-medium">{selectedCallback.assignedTo?.name || "Unassigned"}</p>
                    </div>
                    {selectedCallback.assignedBy && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Assigned By</p>
                        <p className="text-white font-medium">{selectedCallback.assignedBy?.name}</p>
                      </div>
                    )}
                    {selectedCallback.completedBy && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Completed By</p>
                        <p className="text-white font-medium">{selectedCallback.completedBy?.name}</p>
                      </div>
                    )}
                    {selectedCallback.completedDate && (
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Completed Date</p>
                        <p className="text-white font-medium">
                          {new Date(selectedCallback.completedDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rescheduling Info */}
                {selectedCallback.rescheduledCount > 0 && (
                  <div className="bg-blue-500/10 rounded-xl p-5 border border-blue-500/30">
                    <h3 className="text-lg font-semibold text-blue-400 mb-3">Rescheduling History</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Times Rescheduled</p>
                        <p className="text-white font-medium">{selectedCallback.rescheduledCount}</p>
                      </div>
                      {selectedCallback.rescheduledFrom && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Originally Scheduled</p>
                          <p className="text-white font-medium">
                            {new Date(selectedCallback.rescheduledFrom).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                {selectedCallback.remarks && (
                  <div className="callback-detail-section">
                    <h3 className="mb-3 text-base font-semibold text-blue-400">Remarks and notes</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">{selectedCallback.remarks}</p>
                  </div>
                )}

                {/* Call Intelligence */}
                <div className="callback-detail-section">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-blue-400">
                    <PhoneCall className="h-5 w-5" />
                    Recent Call Intelligence
                  </h3>
                  <CallSummaryCard
                    phoneNumber={selectedCallback?.leadId?.phone}
                    callbackId={selectedCallback?._id}
                  />
                </div>
                </div>
              </SimpleBar>

              {/* Modal Footer */}
              <div className="callback-modal-footer sticky bottom-0 flex justify-end gap-3 border-t p-4 sm:p-6">
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="app-secondary-button px-5 py-2 text-sm font-medium"
                >
                  Close
                </button>
                {(userRole === "super-admin" ||
                  (userDepartment === "marketingAndSales" && selectedCallback.assignedTo?._id === currentUserId)) && (
                  <button
                    onClick={() => {
                      setViewModalOpen(false);
                      navigate(`/callbacks/edit/${selectedCallback._id}`);
                    }}
                    className="app-primary-button px-5 py-2 text-sm font-medium"
                  >
                    Edit Callback
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default ViewCallbacks;
