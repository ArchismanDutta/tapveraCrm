import React, { useState, useEffect, useMemo } from "react";
import API from "../api";
import { motion, AnimatePresence } from "framer-motion";
import {
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Search,
  RefreshCw,
  Users,
  Building2,
  Mail,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Check,
  Calendar,
  Filter,
  Download,
  Upload,
  MoreVertical,
  AlertCircle,
  TrendingUp,
  Activity
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  }),
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.2 },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const statCounterVariants = {
  hidden: { scale: 0.5, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15,
    },
  },
};

const ClientsPage = ({ onLogout }) => {
  const [clients, setClients] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all"); // all, active, inactive
  const [sortBy, setSortBy] = useState("name"); // name, email, date, business
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [notification, setNotification] = useState(null);
  const [userRole, setUserRole] = useState("admin"); // Default to admin
  const [form, setForm] = useState({
    clientName: "",
    businessName: "",
    email: "",
    password: "",
    region: "Global",
  });

  useEffect(() => {
    // Get user role from localStorage
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role || "admin");
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }

    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await API.get("/api/clients");
      setClients(res.data);
    } catch (error) {
      showNotification("Error fetching clients", "error");
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    try {
      await API.post("/api/clients", {
        ...form,
        region: form.region?.trim() || 'Global'
      });
      setForm({ clientName: "", businessName: "", email: "", password: "", region: "Global" });
      fetchClients();
      showNotification("Client added successfully!", "success");
    } catch (error) {
      showNotification(error.response?.data?.message || "Error adding client", "error");
      console.error("Error adding client:", error);
    }
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        clientName: selectedClient.clientName,
        businessName: selectedClient.businessName,
        email: selectedClient.email,
        region: selectedClient.region?.trim() || 'Global',
      };

      // Only include password if it has been changed and user is super-admin
      if (selectedClient.newPassword && selectedClient.newPassword.trim()) {
        const normalizedRole = userRole.toLowerCase();
        if (normalizedRole === 'super-admin' || normalizedRole === 'superadmin') {
          updateData.password = selectedClient.newPassword;
        } else {
          showNotification("Only super-admin can change client passwords", "error");
          return;
        }
      }

      await API.put(`/api/clients/${selectedClient._id}`, updateData);
      setShowEditModal(false);
      setSelectedClient(null);
      setShowEditPassword(false);
      fetchClients();
      showNotification("Client updated successfully!", "success");
    } catch (error) {
      showNotification(error.response?.data?.error || error.response?.data?.message || "Error updating client", "error");
      console.error("Error updating client:", error);
    }
  };

  const handleDeleteClient = async () => {
    try {
      await API.delete(`/api/clients/${selectedClient._id}`);
      setShowDeleteConfirm(false);
      setSelectedClient(null);
      fetchClients();
      showNotification("Client deleted successfully!", "success");
    } catch (error) {
      showNotification(error.response?.data?.message || "Error deleting client", "error");
      console.error("Error deleting client:", error);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await API.patch(`/api/clients/${id}/status`);
      fetchClients();
      showNotification("Client status updated!", "success");
    } catch (error) {
      showNotification("Error toggling status", "error");
      console.error("Error toggling status:", error);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Client Name", "Business Name", "Email", "Status", "Created Date"],
      ...filteredAndSortedClients.map(c => [
        c.clientName,
        c.businessName,
        c.email,
        c.status,
        c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "N/A"
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showNotification("Clients exported successfully!", "success");
  };

  // Filter and sort clients
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clients.filter(
      (c) =>
        c.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply status filter
    if (filterStatus === "active") {
      filtered = filtered.filter(c => c.status === "Active");
    } else if (filterStatus === "inactive") {
      filtered = filtered.filter(c => c.status !== "Active");
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.clientName || "").localeCompare(b.clientName || "");
        case "business":
          return (a.businessName || "").localeCompare(b.businessName || "");
        case "email":
          return (a.email || "").localeCompare(b.email || "");
        case "date":
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [clients, searchTerm, filterStatus, sortBy]);

  // Statistics with trends
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "Active").length;
    const inactive = total - active;

    return { total, active, inactive };
  }, [clients]);

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      {/* Main Content */}
      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-in ${
            notification.type === "success"
              ? "bg-green-600/90 border-green-500 text-white"
              : "bg-red-600/90 border-red-500 text-white"
          }`}>
            {notification.type === "success" ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              Client Management
            </h1>
            <p className="text-blue-300">
              Manage your clients and their account status
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={fetchClients}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Enhanced Statistics Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 10 } }}
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 hover:border-blue-500/50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-blue-600/20">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-sm text-gray-400 mb-1">Total Clients</p>
            <motion.p
              key={stats.total}
              variants={statCounterVariants}
              initial="hidden"
              animate="visible"
              className="text-3xl font-bold text-white"
            >
              {stats.total}
            </motion.p>
            <p className="text-xs text-gray-500 mt-2">All registered clients</p>
          </motion.div>

          <motion.div
            variants={cardVariants}
            whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 10 } }}
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 hover:border-green-500/50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-green-600/20">
                <Building2 className="w-6 h-6 text-green-400" />
              </div>
              <Activity className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-sm text-gray-400 mb-1">Active Clients</p>
            <motion.p
              key={stats.active}
              variants={statCounterVariants}
              initial="hidden"
              animate="visible"
              className="text-3xl font-bold text-green-400"
            >
              {stats.active}
            </motion.p>
            <p className="text-xs text-gray-500 mt-2">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total
            </p>
          </motion.div>

          <motion.div
            variants={cardVariants}
            whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 10 } }}
            className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 hover:border-red-500/50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-lg bg-red-600/20">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Inactive Clients</p>
            <motion.p
              key={stats.inactive}
              variants={statCounterVariants}
              initial="hidden"
              animate="visible"
              className="text-3xl font-bold text-red-400"
            >
              {stats.inactive}
            </motion.p>
            <p className="text-xs text-gray-500 mt-2">Require attention</p>
          </motion.div>
        </motion.div>

        {/* Add Client Form */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Add New Client</h3>
          </div>

          <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Client Name *</label>
              <input
                type="text"
                placeholder="Enter client name"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Business Name *</label>
              <input
                type="text"
                placeholder="Enter business name"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Email Address *</label>
              <input
                type="email"
                placeholder="client@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Region *</label>
              <input
                type="text"
                placeholder="e.g., USA, Australia, Canada"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Admins assigned to this region will see this client</p>
            </div>

            <button
              type="submit"
              className="md:col-span-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02]"
            >
              <UserPlus size={18} />
              Add Client
            </button>
          </form>
        </div>

        {/* Clients Table with Filters */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">All Clients</h3>
              {loading && (
                <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Search Bar */}
              <div className="relative flex-1 lg:flex-initial lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Filter Dropdown */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="name">Sort by Name</option>
                <option value="business">Sort by Business</option>
                <option value="email">Sort by Email</option>
                <option value="date">Sort by Date</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b-2 border-[#232945]">
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[18%]">Client Name</th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[18%]">Business Name</th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[22%]">Email</th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[14%]">Region</th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[14%]">Status</th>
                  <th className="text-left pl-6 pr-4 py-4 text-base font-semibold text-gray-400 w-[14%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedClients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-base">
                        {searchTerm || filterStatus !== "all"
                          ? "No clients found matching your filters"
                          : "No clients added yet"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedClients.map((c) => (
                    <tr
                      key={c._id}
                      className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors"
                    >
                      <td className="pl-6 pr-4 py-5 text-white font-semibold text-base w-[18%]">{c.clientName}</td>
                      <td className="pl-6 pr-4 py-5 text-gray-300 text-base w-[18%]">{c.businessName}</td>
                      <td className="pl-6 pr-4 py-5 text-gray-300 text-base w-[22%]">{c.email}</td>
                      <td className="pl-6 pr-4 py-5 w-[14%]">
                        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/50 inline-flex items-center gap-1.5">
                          <span>🌍</span>
                          {c.region || 'Global'}
                        </span>
                      </td>
                      <td className="pl-6 pr-4 py-5 w-[14%]">
                        <div className="flex items-center">
                          <span
                            className={`px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2 ${
                              c.status === "Active"
                                ? "bg-green-500/20 text-green-400 border border-green-500/50"
                                : "bg-red-500/20 text-red-400 border border-red-500/50"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full ${
                              c.status === "Active" ? "bg-green-400" : "bg-red-400"
                            }`}></div>
                            {c.status}
                          </span>
                        </div>
                      </td>
                      <td className="pl-6 pr-4 py-5 w-[14%]">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setSelectedClient(c);
                              setShowCredentialsModal(true);
                            }}
                            className="p-2.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all duration-200"
                            title="View credentials"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => toggleStatus(c._id)}
                            className="p-2.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all duration-200"
                            title={`Toggle to ${c.status === "Active" ? "Inactive" : "Active"}`}
                          >
                            {c.status === "Active" ? (
                              <ToggleRight className="w-6 h-6" />
                            ) : (
                              <ToggleLeft className="w-6 h-6" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedClient(c);
                              setShowEditModal(true);
                            }}
                            className="p-2.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all duration-200"
                            title="Edit client"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedClient(c);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
                            title="Delete client"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Results Summary */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
            <span>
              Showing {filteredAndSortedClients.length} of {clients.length} clients
            </span>
            {(searchTerm || filterStatus !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterStatus("all");
                }}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Edit Client</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedClient(null);
                  setShowEditPassword(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditClient} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Client Name</label>
                <input
                  type="text"
                  value={selectedClient.clientName}
                  onChange={(e) => setSelectedClient({ ...selectedClient, clientName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Business Name</label>
                <input
                  type="text"
                  value={selectedClient.businessName}
                  onChange={(e) => setSelectedClient({ ...selectedClient, businessName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Email</label>
                <input
                  type="email"
                  value={selectedClient.email}
                  onChange={(e) => setSelectedClient({ ...selectedClient, email: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Region</label>
                <input
                  type="text"
                  placeholder="e.g., USA, Australia, Canada, Global"
                  value={selectedClient.region || ''}
                  onChange={(e) => setSelectedClient({ ...selectedClient, region: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Enter region name (defaults to 'Global' if empty)</p>
              </div>

              {/* Password field only for super-admin */}
              {(userRole === 'super-admin' || userRole === 'superadmin') && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">New Password (Optional)</label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      placeholder="Leave empty to keep current password"
                      value={selectedClient.newPassword || ''}
                      onChange={(e) => setSelectedClient({ ...selectedClient, newPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Only super-admin can change client passwords</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedClient(null);
                    setShowEditPassword(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedClient && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-red-500/50 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-500/20">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Delete Client</h3>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>{selectedClient.clientName}</strong>?
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedClient(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Credentials Modal */}
      {showCredentialsModal && selectedClient && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-cyan-500/50 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-cyan-500/20">
                  <Eye className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Client Credentials</h3>
              </div>
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setSelectedClient(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                <p className="text-sm text-gray-400 mb-2">Client Name</p>
                <p className="text-white font-semibold">{selectedClient.clientName}</p>
              </div>

              <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                <p className="text-sm text-gray-400 mb-2">Business Name</p>
                <p className="text-white font-semibold">{selectedClient.businessName}</p>
              </div>

              <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Email Address</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedClient.email);
                      showNotification("Email copied to clipboard!", "success");
                    }}
                    className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <p className="text-white font-mono text-sm break-all">{selectedClient.email}</p>
              </div>

              <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Password</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedClient.password);
                      showNotification("Password copied to clipboard!", "success");
                    }}
                    className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <p className="text-white font-mono text-sm break-all">{selectedClient.password}</p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-300 text-sm">
                    Keep these credentials secure. Share them only through secure channels.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowCredentialsModal(false);
                setSelectedClient(null);
              }}
              className="w-full mt-6 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;