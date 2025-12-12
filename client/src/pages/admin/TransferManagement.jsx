import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Search,
  Filter,
  Download,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  User,
  ArrowRightLeft,
  Calendar,
  Eye,
} from "lucide-react";
import Sidebar from "../../components/dashboard/Sidebar";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "../../styles/custom-scrollbar.css";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const TransferManagement = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [filteredTransfers, setFilteredTransfers] = useState([]);
  const [stats, setStats] = useState({});
  const [transfersByUser, setTransfersByUser] = useState([]);
  const [transfersToUser, setTransfersToUser] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("super-admin");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // View mode
  const [viewMode, setViewMode] = useState("all"); // "all", "by-sender", "by-receiver"

  // Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
    }
    fetchAllTransfers();
  }, []);

  useEffect(() => {
    filterTransfers();
  }, [transfers, searchTerm, statusFilter, userFilter, dateFrom, dateTo]);

  const fetchAllTransfers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/transfers/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setTransfers(data.data);
        setStats(data.stats);
        setTransfersByUser(data.transfersByUser);
        setTransfersToUser(data.transfersToUser);
      }
    } catch (error) {
      console.error("Error fetching transfers:", error);
      toast.error("Failed to fetch transfers");
    } finally {
      setLoading(false);
    }
  };

  const filterTransfers = () => {
    let filtered = [...transfers];

    if (searchTerm) {
      filtered = filtered.filter(
        (transfer) =>
          transfer.callbackId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transfer.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transfer.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transfer.transferredBy?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transfer.transferredTo?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((transfer) => transfer.transferStatus === statusFilter);
    }

    if (userFilter) {
      filtered = filtered.filter(
        (transfer) =>
          transfer.transferredBy?._id === userFilter || transfer.transferredTo?._id === userFilter
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(
        (transfer) => new Date(transfer.transferredAt) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      filtered = filtered.filter(
        (transfer) => new Date(transfer.transferredAt) <= new Date(dateTo)
      );
    }

    setFilteredTransfers(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setUserFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const exportToExcel = () => {
    const excelData = filteredTransfers.map((transfer) => ({
      "Callback ID": transfer.callbackId,
      "Client Name": transfer.clientName,
      "Business Name": transfer.businessName,
      "Transferred By": transfer.transferredBy?.name || "",
      "Position": transfer.transferredBy?.position || "",
      "Transferred To": transfer.transferredTo?.name || "",
      "Recipient Position": transfer.transferredTo?.position || "",
      "Status": transfer.transferStatus,
      "Transferred At": new Date(transfer.transferredAt).toLocaleString(),
      "Remarks": transfer.transferRemarks || "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transfers");
    XLSX.writeFile(wb, `transfers_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported to Excel successfully");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Transferred":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "Accepted":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "Rejected":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "Completed":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const handleViewTransfer = (transfer) => {
    setSelectedTransfer(transfer);
    setViewModalOpen(true);
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransfers = filteredTransfers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex">
      <Sidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-56"} p-8 max-w-full overflow-x-hidden`}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Transfer Management
              </h1>
              <p className="text-gray-400">Monitor and analyze callback transfers across the organization</p>
            </div>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-purple-500/50"
            >
              <Download className="h-5 w-5" />
              Export to Excel
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Transfers</p>
                  <p className="text-3xl font-bold text-white">{stats.totalTransfers || 0}</p>
                </div>
                <ArrowRightLeft className="h-8 w-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Pending</p>
                  <p className="text-3xl font-bold text-white">{stats.pending || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Accepted</p>
                  <p className="text-3xl font-bold text-white">{stats.accepted || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Completed</p>
                  <p className="text-3xl font-bold text-white">{stats.completed || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Rejected</p>
                  <p className="text-3xl font-bold text-white">{stats.rejected || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Senders */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Transfer Senders
              </h3>
              <div className="space-y-3">
                {transfersByUser.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{item.user?.name}</p>
                        <p className="text-gray-400 text-xs">{item.user?.position}</p>
                      </div>
                    </div>
                    <span className="text-purple-400 font-bold">{item.count}</span>
                  </div>
                ))}
                {transfersByUser.length === 0 && (
                  <p className="text-gray-400 text-sm">No data available</p>
                )}
              </div>
            </div>

            {/* Top Receivers */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Transfer Receivers
              </h3>
              <div className="space-y-3">
                {transfersToUser.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{item.user?.name}</p>
                        <p className="text-gray-400 text-xs">{item.user?.position}</p>
                      </div>
                    </div>
                    <span className="text-cyan-400 font-bold">{item.count}</span>
                  </div>
                ))}
                {transfersToUser.length === 0 && (
                  <p className="text-gray-400 text-sm">No data available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transfers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700"
              >
                <option value="">📊 All Status</option>
                <option value="Transferred">⏳ Pending</option>
                <option value="Accepted">✓ Accepted</option>
                <option value="Rejected">✗ Rejected</option>
                <option value="Completed">✓ Completed</option>
              </select>
            </div>

            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="From Date"
              />
            </div>

            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="To Date"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {(searchTerm || statusFilter || userFilter || dateFrom || dateTo) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Transfers Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
          <SimpleBar style={{ maxHeight: "600px" }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No transfers found</p>
              </div>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                          Callback ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                          Client Details
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                          Transferred By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                          Transferred To
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {currentTransfers.map((transfer) => (
                        <tr key={transfer._id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-purple-400 font-medium text-sm">{transfer.callbackId}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white text-sm font-medium">{transfer.clientName}</p>
                              <p className="text-gray-400 text-xs">{transfer.businessName}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white text-sm">{transfer.transferredBy?.name}</p>
                              <p className="text-gray-400 text-xs">{transfer.transferredBy?.position}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white text-sm">{transfer.transferredTo?.name}</p>
                              <p className="text-gray-400 text-xs">{transfer.transferredTo?.position}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(transfer.transferStatus)}`}>
                              {transfer.transferStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-300">
                              {new Date(transfer.transferredAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(transfer.transferredAt).toLocaleTimeString()}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleViewTransfer(transfer)}
                              className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50">
                    <p className="text-sm text-gray-400">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredTransfers.length)} of {filteredTransfers.length} transfers
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all text-sm"
                      >
                        Previous
                      </button>
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                        if (pageNum > totalPages) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => paginate(pageNum)}
                            className={`px-3 py-1 rounded-lg transition-all text-sm ${
                              currentPage === pageNum
                                ? "bg-purple-600 text-white"
                                : "bg-slate-700 hover:bg-slate-600 text-gray-300"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all text-sm"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </SimpleBar>
        </div>
      </main>

      {/* View Modal */}
      {viewModalOpen && selectedTransfer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-purple-400">Transfer Details</h2>
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Callback ID</p>
                    <p className="text-white font-medium">{selectedTransfer.callbackId}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Transfer Status</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedTransfer.transferStatus)}`}>
                      {selectedTransfer.transferStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Client Name</p>
                    <p className="text-white font-medium">{selectedTransfer.clientName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Business Name</p>
                    <p className="text-white font-medium">{selectedTransfer.businessName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Transferred By</p>
                    <p className="text-white font-medium">
                      {selectedTransfer.transferredBy?.name} ({selectedTransfer.transferredBy?.position})
                    </p>
                    <p className="text-gray-400 text-xs">{selectedTransfer.transferredBy?.department}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Transferred To</p>
                    <p className="text-white font-medium">
                      {selectedTransfer.transferredTo?.name} ({selectedTransfer.transferredTo?.position})
                    </p>
                    <p className="text-gray-400 text-xs">{selectedTransfer.transferredTo?.department}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Transferred At</p>
                    <p className="text-white font-medium">
                      {new Date(selectedTransfer.transferredAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedTransfer.transferCompletedAt && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Completed At</p>
                      <p className="text-white font-medium">
                        {new Date(selectedTransfer.transferCompletedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {selectedTransfer.transferRemarks && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Remarks</p>
                    <p className="text-white bg-slate-700/50 p-3 rounded-lg">{selectedTransfer.transferRemarks}</p>
                  </div>
                )}

                {selectedTransfer.remarks && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Callback Remarks</p>
                    <p className="text-white bg-slate-700/50 p-3 rounded-lg">{selectedTransfer.remarks}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferManagement;
