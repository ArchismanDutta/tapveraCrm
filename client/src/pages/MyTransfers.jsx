import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "../styles/custom-scrollbar.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const MyTransfers = ({ onLogout }) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [filteredTransfers, setFilteredTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("employee");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [remarks, setRemarks] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
    }
    fetchTransfers();
  }, []);

  useEffect(() => {
    filterTransfers();
  }, [transfers, searchTerm, statusFilter]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/transfers/my-transfers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setTransfers(data.data);
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
          transfer.transferredBy?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((transfer) => transfer.transferStatus === statusFilter);
    }

    setFilteredTransfers(filtered);
    setCurrentPage(1);
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) {
      toast.error("Please select a status");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/transfers/${selectedTransfer._id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transferStatus: newStatus,
          transferRemarks: remarks,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Transfer status updated successfully");
        setStatusModalOpen(false);
        setSelectedTransfer(null);
        setNewStatus("");
        setRemarks("");
        fetchTransfers();
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const openStatusModal = (transfer) => {
    setSelectedTransfer(transfer);
    setNewStatus(transfer.transferStatus);
    setRemarks(transfer.transferRemarks || "");
    setStatusModalOpen(true);
  };

  const handleViewTransfer = (transfer) => {
    setSelectedTransfer(transfer);
    setViewModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
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

  const getStatusIcon = (status) => {
    switch (status) {
      case "Transferred":
        return <Clock className="h-4 w-4" />;
      case "Accepted":
        return <CheckCircle className="h-4 w-4" />;
      case "Rejected":
        return <XCircle className="h-4 w-4" />;
      case "Completed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                My Transfers
              </h1>
              <p className="text-gray-400">Manage callbacks transferred to you</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Pending</p>
                  <p className="text-3xl font-bold text-white">
                    {transfers.filter(t => t.transferStatus === "Transferred").length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Accepted</p>
                  <p className="text-3xl font-bold text-white">
                    {transfers.filter(t => t.transferStatus === "Accepted").length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Completed</p>
                  <p className="text-3xl font-bold text-white">
                    {transfers.filter(t => t.transferStatus === "Completed").length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Rejected</p>
                  <p className="text-3xl font-bold text-white">
                    {transfers.filter(t => t.transferStatus === "Rejected").length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transfers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700"
              >
                <option value="">📊 All Status</option>
                <option value="Transferred">⏳ Pending</option>
                <option value="Accepted">✓ Accepted</option>
                <option value="Rejected">✗ Rejected</option>
                <option value="Completed">✓ Completed</option>
              </select>
            </div>

            {(searchTerm || statusFilter) && (
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No transfers found</p>
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
                          Callback ID
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                          Client Details
                        </th>
                        <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                          Transferred By
                        </th>
                        <th className="w-24 px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                          Status
                        </th>
                        <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {currentTransfers.map((transfer, index) => (
                        <tr key={transfer._id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-2 py-3 text-sm text-gray-300">
                            {indexOfFirstItem + index + 1}
                          </td>
                          <td className="px-2 py-3">
                            <span className="text-orange-400 font-medium text-xs">{transfer.callbackId}</span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-1">
                              <p className="text-white font-medium text-sm truncate">{transfer.clientName}</p>
                              <p className="text-gray-400 text-xs truncate">{transfer.businessName}</p>
                              <div className="flex items-center gap-2 text-xs">
                                <Calendar className="h-3 w-3 text-gray-500" />
                                <span className="text-gray-500">
                                  {new Date(transfer.callbackDate).toLocaleDateString()}
                                </span>
                                <span className="text-gray-500">{transfer.callbackTime}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-300">{transfer.transferredBy?.name}</p>
                                <p className="text-[10px] text-gray-500">{transfer.transferredBy?.position}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(transfer.transferStatus)}`}>
                              {getStatusIcon(transfer.transferStatus)}
                              {transfer.transferStatus}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleViewTransfer(transfer)}
                                className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openStatusModal(transfer)}
                                className="p-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-all"
                                title="Update Status"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            </div>
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
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => paginate(i + 1)}
                          className={`px-3 py-1 rounded-lg transition-all text-sm ${
                            currentPage === i + 1
                              ? "bg-orange-600 text-white"
                              : "bg-slate-700 hover:bg-slate-600 text-gray-300"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
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
                <h2 className="text-2xl font-bold text-orange-400">Transfer Details</h2>
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
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedTransfer.transferStatus)}`}>
                      {getStatusIcon(selectedTransfer.transferStatus)}
                      {selectedTransfer.transferStatus}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-sm mb-1">Client Name</p>
                  <p className="text-white font-medium">{selectedTransfer.clientName}</p>
                </div>

                <div>
                  <p className="text-gray-400 text-sm mb-1">Business Name</p>
                  <p className="text-white font-medium">{selectedTransfer.businessName}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Callback Date</p>
                    <p className="text-white font-medium">{new Date(selectedTransfer.callbackDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Callback Time</p>
                    <p className="text-white font-medium">{selectedTransfer.callbackTime}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-sm mb-1">Transferred By</p>
                  <p className="text-white font-medium">
                    {selectedTransfer.transferredBy?.name} ({selectedTransfer.transferredBy?.position})
                  </p>
                </div>

                <div>
                  <p className="text-gray-400 text-sm mb-1">Transferred At</p>
                  <p className="text-white font-medium">
                    {new Date(selectedTransfer.transferredAt).toLocaleString()}
                  </p>
                </div>

                {selectedTransfer.transferRemarks && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Remarks</p>
                    <p className="text-white font-medium">{selectedTransfer.transferRemarks}</p>
                  </div>
                )}

                {selectedTransfer.remarks && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Callback Remarks</p>
                    <p className="text-white font-medium">{selectedTransfer.remarks}</p>
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

      {/* Status Update Modal */}
      {statusModalOpen && selectedTransfer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-orange-400">Update Transfer Status</h2>
                <button
                  onClick={() => setStatusModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Transfer Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="Transferred">Pending</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Remarks (Optional)
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows="4"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Add any remarks about this transfer..."
                  ></textarea>
                </div>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all"
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTransfers;
