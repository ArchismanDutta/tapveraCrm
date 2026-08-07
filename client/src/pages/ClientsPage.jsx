import React, { useState, useEffect, useMemo } from "react";
import API from "../api";
import { motion } from "framer-motion";
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
  Filter,
  Download,
  AlertCircle,
  TrendingUp,
  Activity,
  Send
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";

// Keep the animation namespace visible to ESLint's JSX usage analysis.
void motion;

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
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [bulkEmailForm, setBulkEmailForm] = useState({
    subject: "",
    body: "",
  });
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState({}); // Track status: 'pending' | 'sending' | 'success' | 'failed'
  const [currentSendingIndex, setCurrentSendingIndex] = useState(-1);
  const [form, setForm] = useState({
    clientName: "",
    businessName: "",
    email: "",
    password: "",
    region: "Global",
  });

  // Robust copy to clipboard function that works with HTTP (non-secure contexts)
  const copyToClipboard = (text, label = "Text") => {
    try {
      // Use textarea method (works in both HTTP and HTTPS)
      const textArea = document.createElement("textarea");
      textArea.value = text;

      // Make textarea invisible but still functional
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        // Execute copy command
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          showNotification(`${label} copied to clipboard!`, "success");
        } else {
          throw new Error('Copy command was unsuccessful');
        }
      } catch (err) {
        document.body.removeChild(textArea);
        throw err;
      }
    } catch (err) {
      console.error("Failed to copy:", err);
      showNotification(`Failed to copy ${label}. Please select and copy manually.`, "error");
    }
  };

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
    // Fetch only once when the management page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleOpenBulkEmail = () => {
    // Select all filtered clients by default
    const allClientIds = filteredAndSortedClients.map(c => c._id);
    setSelectedClientIds(allClientIds);
    setShowBulkEmailModal(true);
  };

  const toggleClientSelection = (clientId) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedClientIds.length === filteredAndSortedClients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(filteredAndSortedClients.map(c => c._id));
    }
  };

  const handleSendBulkEmail = async () => {
    if (selectedClientIds.length === 0) {
      showNotification("Please select at least one client", "error");
      return;
    }

    if (!bulkEmailForm.subject.trim() || !bulkEmailForm.body.trim()) {
      showNotification("Please enter both subject and body", "error");
      return;
    }

    setSendingBulkEmail(true);

    // Initialize all selected clients as pending
    const initialStatus = {};
    selectedClientIds.forEach(id => {
      initialStatus[id] = 'pending';
    });
    setEmailStatus(initialStatus);

    let successCount = 0;
    let failedCount = 0;

    // Send emails one by one with real-time status updates
    for (let i = 0; i < selectedClientIds.length; i++) {
      const clientId = selectedClientIds[i];
      setCurrentSendingIndex(i);

      // Mark current client as sending
      setEmailStatus(prev => ({ ...prev, [clientId]: 'sending' }));

      try {
        await API.post(`/api/clients/send-email/${clientId}`, {
          subject: bulkEmailForm.subject,
          body: bulkEmailForm.body,
        });

        // Mark as success
        setEmailStatus(prev => ({ ...prev, [clientId]: 'success' }));
        successCount++;
      } catch (error) {
        console.error(`Failed to send email to client ${clientId}:`, error);
        // Mark as failed
        setEmailStatus(prev => ({ ...prev, [clientId]: 'failed' }));
        failedCount++;
      }

      // Small delay between emails to avoid rate limiting
      if (i < selectedClientIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setCurrentSendingIndex(-1);
    setSendingBulkEmail(false);

    // Show final notification
    if (failedCount === 0) {
      showNotification(
        `All ${successCount} emails sent successfully!`,
        "success"
      );
    } else {
      showNotification(
        `Sent ${successCount} emails, ${failedCount} failed`,
        failedCount > successCount ? "error" : "success"
      );
    }
  };

  const closeBulkEmailModal = () => {
    setShowBulkEmailModal(false);
    setBulkEmailForm({ subject: "", body: "" });
    setSelectedClientIds([]);
    setEmailStatus({});
    setCurrentSendingIndex(-1);
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
    <div className="app-shell clients-theme h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      {/* Main Content */}
      <main
        className={`app-main h-[100dvh] overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "app-offset app-offset-collapsed" : "app-offset"
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

        <div className="app-page space-y-5 pb-8">
        {/* Header */}
        <section className="app-header flex flex-col gap-4 rounded-2xl px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="app-eyebrow">Business operations</p>
              <h1 className="app-title">Client management</h1>
              <p className="app-description">
                Manage client accounts, credentials, regions, and email communication.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exportToCSV}
              className="app-secondary-button inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={fetchClients}
              className="app-secondary-button inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </section>

        {/* Enhanced Statistics Cards */}
        <motion.div
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={cardVariants}
            className="app-panel rounded-2xl p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total clients</p>
                <motion.p
                  key={stats.total}
                  variants={statCounterVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white"
                >
                  {stats.total}
                </motion.p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">All registered clients</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={cardVariants}
            className="app-panel rounded-2xl p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active clients</p>
                <motion.p
                  key={stats.active}
                  variants={statCounterVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-2 text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-300"
                >
                  {stats.active}
                </motion.p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={cardVariants}
            className="app-panel rounded-2xl p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Inactive clients</p>
                <motion.p
                  key={stats.inactive}
                  variants={statCounterVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-2 text-3xl font-semibold tracking-tight text-rose-600 dark:text-rose-300"
                >
                  {stats.inactive}
                </motion.p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Require attention</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Add Client Form */}
        <section className="app-panel rounded-2xl p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Add new client</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create a client account and assign a region.</p>
            </div>
          </div>

          <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Client name *</label>
              <input
                type="text"
                placeholder="Enter client name"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="app-control h-11 w-full rounded-xl px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Business name *</label>
              <input
                type="text"
                placeholder="Enter business name"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="app-control h-11 w-full rounded-xl px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email address *</label>
              <input
                type="email"
                placeholder="client@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="app-control h-11 w-full rounded-xl px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="app-control h-11 w-full rounded-xl px-3 pr-10 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Region *</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="app-control h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                required
              >
                <option value="Global">Global</option>
                <option value="USA">USA</option>
                <option value="AUS">Australia</option>
                <option value="CANADA">Canada</option>
                <option value="IND">India</option>
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Admins assigned to this region will see this client.</p>
            </div>

            <button
              type="submit"
              className="client-blue-button inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold md:col-span-2"
            >
              <UserPlus size={18} />
              Add Client
            </button>
          </form>
        </section>

        {/* Clients Table with Filters */}
        <section className="app-panel rounded-2xl p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">All clients</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing {filteredAndSortedClients.length} of {clients.length} clients
                </p>
              </div>
              {loading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-600" />
              )}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(220px,280px)_auto_auto_auto]">
              {/* Search Bar */}
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search clients"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="app-control h-10 w-full rounded-xl pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
              </div>

              {/* Bulk Email Button */}
              <button
                type="button"
                onClick={handleOpenBulkEmail}
                disabled={clients.length === 0}
                className="client-blue-button inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                title="Send bulk email to clients"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk Email</span>
              </button>

              {/* Filter Dropdown */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="app-control h-10 rounded-xl px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="app-control h-10 rounded-xl px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="name">Sort by Name</option>
                <option value="business">Sort by Business</option>
                <option value="email">Sort by Email</option>
                <option value="date">Sort by Date</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.03]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Client name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Business name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Region</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                {filteredAndSortedClients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
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
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-slate-950 dark:text-white">{c.clientName}</td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{c.businessName}</td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{c.email}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
                          {c.region || 'Global'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              c.status === "Active"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
                                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full ${
                              c.status === "Active" ? "bg-emerald-500" : "bg-rose-500"
                            }`}></div>
                            {c.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setShowCredentialsModal(true);
                            }}
                            className="app-icon-button inline-flex h-8 w-8 items-center justify-center rounded-lg"
                            title="View credentials"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStatus(c._id)}
                            className="app-icon-button inline-flex h-8 w-8 items-center justify-center rounded-lg"
                            title={`Toggle to ${c.status === "Active" ? "Inactive" : "Active"}`}
                          >
                            {c.status === "Active" ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setShowEditModal(true);
                            }}
                            className="app-icon-button inline-flex h-8 w-8 items-center justify-center rounded-lg"
                            title="Edit client"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setShowDeleteConfirm(true);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300 dark:hover:bg-rose-400/15"
                            title="Delete client"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>
              Showing {filteredAndSortedClients.length} of {clients.length} clients
            </span>
            {(searchTerm || filterStatus !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setFilterStatus("all");
                }}
                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="app-panel max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5 shadow-xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="app-eyebrow">Client details</p>
                <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Edit Client</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedClient(null);
                  setShowEditPassword(false);
                }}
                className="app-icon-button h-9 w-9"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditClient} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Client Name</label>
                <input
                  type="text"
                  value={selectedClient.clientName}
                  onChange={(e) => setSelectedClient({ ...selectedClient, clientName: e.target.value })}
                  className="app-control w-full px-4 py-3"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Business Name</label>
                <input
                  type="text"
                  value={selectedClient.businessName}
                  onChange={(e) => setSelectedClient({ ...selectedClient, businessName: e.target.value })}
                  className="app-control w-full px-4 py-3"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  value={selectedClient.email}
                  onChange={(e) => setSelectedClient({ ...selectedClient, email: e.target.value })}
                  className="app-control w-full px-4 py-3"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Region *</label>
                <select
                  value={selectedClient.region || 'Global'}
                  onChange={(e) => setSelectedClient({ ...selectedClient, region: e.target.value })}
                  className="app-control w-full px-4 py-3"
                  required
                >
                  <option value="Global">Global</option>
                  <option value="USA">USA</option>
                  <option value="AUS">Australia</option>
                  <option value="CANADA">Canada</option>
                  <option value="IND">India</option>
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Admins assigned to this region will see this client</p>
              </div>

              {/* Password field only for super-admin */}
              {(userRole === 'super-admin' || userRole === 'superadmin') && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">New Password (Optional)</label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      placeholder="Leave empty to keep current password"
                      value={selectedClient.newPassword || ''}
                      onChange={(e) => setSelectedClient({ ...selectedClient, newPassword: e.target.value })}
                      className="app-control w-full px-4 py-3 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-white"
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only super-admin can change client passwords</p>
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
                  className="app-secondary-button flex-1 px-4 py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="client-blue-button flex-1 px-4 py-3"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="app-panel w-full max-w-md rounded-2xl border-red-200 p-5 shadow-xl dark:border-red-500/30 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-red-100 p-3 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Delete Client</h3>
            </div>

            <p className="mb-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>{selectedClient.clientName}</strong>?
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedClient(null);
                }}
                className="app-secondary-button flex-1 px-4 py-3"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                className="flex-1 rounded-xl border border-red-500/20 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Credentials Modal */}
      {showCredentialsModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="app-panel w-full max-w-md rounded-2xl p-5 shadow-xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <p className="app-eyebrow">Secure access</p>
                  <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Client Credentials</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCredentialsModal(false);
                  setSelectedClient(null);
                }}
                className="app-icon-button h-9 w-9"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Client Name</p>
                <p className="font-semibold text-slate-950 dark:text-white">{selectedClient.clientName}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Business Name</p>
                <p className="font-semibold text-slate-950 dark:text-white">{selectedClient.businessName}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Email Address</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedClient.email, "Email")}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    <Mail className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <p className="break-all font-mono text-sm text-slate-900 dark:text-slate-100">{selectedClient.email}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Password</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedClient.password, "Password")}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    <Eye className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <p className="break-all font-mono text-sm text-slate-900 dark:text-slate-100">{selectedClient.password}</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-300" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
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
              className="client-blue-button mt-6 w-full px-4 py-3"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Bulk Email Modal */}
      {showBulkEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="app-panel max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl p-5 shadow-xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <p className="app-eyebrow">Client broadcast</p>
                  <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Send Bulk Email</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedClientIds.length} of {filteredAndSortedClients.length} clients selected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBulkEmailModal}
                disabled={sendingBulkEmail}
                className="app-icon-button h-9 w-9 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Client Selection Panel */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-950 dark:text-white">Select Recipients</h4>
                    {!sendingBulkEmail && (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        {selectedClientIds.length === filteredAndSortedClients.length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredAndSortedClients.map((client) => {
                      const status = emailStatus[client._id];
                      const isSelected = selectedClientIds.includes(client._id);

                      return (
                        <label
                          key={client._id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                            status === 'success'
                              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                              : status === 'failed'
                              ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                              : status === 'sending'
                              ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10'
                              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-400/30 dark:hover:bg-blue-500/10'
                          }`}
                        >
                          {/* Show checkbox only when not sending */}
                          {!sendingBulkEmail ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleClientSelection(client._id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20 dark:bg-slate-900"
                            />
                          ) : (
                            /* Show status icon when sending */
                            <div className="w-5 h-5 flex items-center justify-center">
                              {status === 'success' && (
                                <Check className="w-5 h-5 text-green-400" />
                              )}
                              {status === 'failed' && (
                                <X className="w-5 h-5 text-red-400" />
                              )}
                              {status === 'sending' && (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                              )}
                              {status === 'pending' && (
                                <div className="h-3 w-3 rounded-full bg-slate-400" />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-slate-950 dark:text-white">
                              {client.clientName}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{client.email}</p>
                          </div>
                          {/* Status badge */}
                          {sendingBulkEmail && status && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              status === 'success'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                : status === 'failed'
                                ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                                : status === 'sending'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                            }`}>
                              {status === 'success' && 'Sent'}
                              {status === 'failed' && 'Failed'}
                              {status === 'sending' && 'Sending...'}
                              {status === 'pending' && 'Waiting'}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Email Composition Panel */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Subject *</label>
                  <input
                    type="text"
                    placeholder="Enter email subject..."
                    value={bulkEmailForm.subject}
                    onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, subject: e.target.value })}
                    disabled={sendingBulkEmail}
                    className="app-control w-full px-4 py-3 disabled:opacity-50"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Message Body *</label>
                  <textarea
                    placeholder="Enter your message here..."
                    value={bulkEmailForm.body}
                    onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, body: e.target.value })}
                    disabled={sendingBulkEmail}
                    rows={12}
                    className="app-control w-full resize-none px-4 py-3 disabled:opacity-50"
                    required
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Tip: You can use HTML tags for formatting (e.g., &lt;b&gt;bold&lt;/b&gt;, &lt;br/&gt; for line breaks)
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500 dark:text-blue-300" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-semibold mb-1">Email Preview</p>
                      <p>
                        This email will be sent to {selectedClientIds.length} client{selectedClientIds.length !== 1 ? 's' : ''}.
                        Each client will receive an individual email.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress summary when sending */}
                {sendingBulkEmail && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Sending emails...
                      </span>
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        {Object.values(emailStatus).filter(s => s === 'success' || s === 'failed').length} / {selectedClientIds.length}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-blue-100 dark:bg-blue-950/60">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                        style={{
                          width: `${(Object.values(emailStatus).filter(s => s === 'success' || s === 'failed').length / selectedClientIds.length) * 100}%`
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-green-400">
                        <Check className="w-3 h-3 inline mr-1" />
                        {Object.values(emailStatus).filter(s => s === 'success').length} sent
                      </span>
                      <span className="text-red-400">
                        <X className="w-3 h-3 inline mr-1" />
                        {Object.values(emailStatus).filter(s => s === 'failed').length} failed
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeBulkEmailModal}
                    disabled={sendingBulkEmail}
                    className="app-secondary-button flex-1 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingBulkEmail ? 'Please wait...' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleSendBulkEmail}
                    disabled={sendingBulkEmail || selectedClientIds.length === 0}
                    className="client-blue-button flex flex-1 items-center justify-center gap-2 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingBulkEmail ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Sending {currentSendingIndex + 1} of {selectedClientIds.length}...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send to {selectedClientIds.length} Client{selectedClientIds.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
