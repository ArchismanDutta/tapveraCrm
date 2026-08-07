import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Eye,
  X,
} from "lucide-react";
import Sidebar from "../../components/dashboard/Sidebar";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "../../styles/custom-scrollbar.css";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const getStatusColor = (status) => {
  switch (status) {
    case "Transferred":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300";
    case "Accepted":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300";
    case "Rejected":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300";
    case "Completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300";
  }
};

const TransferManagement = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [stats, setStats] = useState({});
  const [transfersByUser, setTransfersByUser] = useState([]);
  const [transfersToUser, setTransfersToUser] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("super-admin");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchAllTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/transfers/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setTransfers(Array.isArray(data.data) ? data.data : []);
        setStats(data.stats || {});
        setTransfersByUser(Array.isArray(data.transfersByUser) ? data.transfersByUser : []);
        setTransfersToUser(Array.isArray(data.transfersToUser) ? data.transfersToUser : []);
      }
    } catch (error) {
      console.error("Error fetching transfers:", error);
      toast.error("Failed to fetch transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user) {
        setUserRole(user.role);
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }

    fetchAllTransfers();
  }, [fetchAllTransfers]);

  const uniqueTransferUsers = useMemo(
    () =>
      Array.from(
        new Map(
          [...transfersByUser, ...transfersToUser]
            .map((item) => item.user)
            .filter(Boolean)
            .map((user) => [user._id, user])
        ).values()
      ),
    [transfersByUser, transfersToUser]
  );

  const filteredTransfers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return transfers.filter((transfer) => {
      if (normalizedSearch) {
        const matchesSearch =
          transfer.callbackId?.toLowerCase().includes(normalizedSearch) ||
          transfer.clientName?.toLowerCase().includes(normalizedSearch) ||
          transfer.businessName?.toLowerCase().includes(normalizedSearch) ||
          transfer.transferredBy?.name?.toLowerCase().includes(normalizedSearch) ||
          transfer.transferredTo?.name?.toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) return false;
      }

      if (statusFilter && transfer.transferStatus !== statusFilter) return false;

      if (
        userFilter &&
        transfer.transferredBy?._id !== userFilter &&
        transfer.transferredTo?._id !== userFilter
      ) {
        return false;
      }

      if (dateFrom && new Date(transfer.transferredAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(transfer.transferredAt) > new Date(dateTo)) return false;

      return true;
    });
  }, [dateFrom, dateTo, searchTerm, statusFilter, transfers, userFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, searchTerm, statusFilter, userFilter]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter || userFilter || dateFrom || dateTo);

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
      Position: transfer.transferredBy?.position || "",
      "Transferred To": transfer.transferredTo?.name || "",
      "Recipient Position": transfer.transferredTo?.position || "",
      Status: transfer.transferStatus,
      "Transferred At": new Date(transfer.transferredAt).toLocaleString(),
      Remarks: transfer.transferRemarks || "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transfers");
    XLSX.writeFile(wb, `transfers_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported to Excel successfully");
  };

  const handleViewTransfer = (transfer) => {
    setSelectedTransfer(transfer);
    setViewModalOpen(true);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransfers = filteredTransfers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const summaryCards = [
    {
      label: "Total transfers",
      value: stats.totalTransfers || 0,
      icon: ArrowRightLeft,
      tone: "text-blue-600 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-400/10",
    },
    {
      label: "Pending",
      value: stats.pending || 0,
      icon: Clock,
      tone: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-400/10",
    },
    {
      label: "Accepted",
      value: stats.accepted || 0,
      icon: CheckCircle,
      tone: "text-indigo-600 dark:text-indigo-300",
      bg: "bg-indigo-50 dark:bg-indigo-400/10",
    },
    {
      label: "Completed",
      value: stats.completed || 0,
      icon: CheckCircle,
      tone: "text-emerald-600 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-400/10",
    },
    {
      label: "Rejected",
      value: stats.rejected || 0,
      icon: XCircle,
      tone: "text-rose-600 dark:text-rose-300",
      bg: "bg-rose-50 dark:bg-rose-400/10",
    },
  ];

  return (
    <div className="app-shell transfer-management-theme h-[100dvh] overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main
        className={`app-main h-[100dvh] overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="app-page space-y-5 pb-8">
          <section className="app-header flex flex-col gap-4 rounded-2xl px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <p className="app-eyebrow">Callback operations</p>
                <h1 className="app-title">Transfer management</h1>
                <p className="app-description">
                  Monitor callback transfers, ownership handoffs, and status movement across the organization.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={exportToExcel}
              className="transfer-export-button inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="app-panel rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {card.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        {card.value}
                      </p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.bg} ${card.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <article className="app-panel rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Top transfer senders</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">People handing off the most callbacks</p>
                </div>
              </div>

              <div className="space-y-2">
                {transfersByUser.slice(0, 5).map((item, index) => (
                  <div key={item.user?._id || index} className="transfer-rank-row">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.user?.name || "Unknown user"}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.user?.position || "No position"}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                      {item.count}
                    </span>
                  </div>
                ))}
                {transfersByUser.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No sender data available
                  </p>
                )}
              </div>
            </article>

            <article className="app-panel rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Top transfer receivers</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">People receiving the most callbacks</p>
                </div>
              </div>

              <div className="space-y-2">
                {transfersToUser.slice(0, 5).map((item, index) => (
                  <div key={item.user?._id || index} className="transfer-rank-row">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.user?.name || "Unknown user"}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.user?.position || "No position"}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                      {item.count}
                    </span>
                  </div>
                ))}
                {transfersToUser.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No receiver data available
                  </p>
                )}
              </div>
            </article>
          </section>

          <section className="app-panel rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Transfer records</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Showing {filteredTransfers.length} of {transfers.length} transfers
                  </p>
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="app-secondary-button inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="relative sm:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search transfers"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="app-control h-10 w-full rounded-xl pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  aria-label="Search transfer records"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="app-control h-10 rounded-xl px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                aria-label="Filter by transfer status"
              >
                <option value="">All statuses</option>
                <option value="Transferred">Pending</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Completed">Completed</option>
              </select>

              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="app-control h-10 rounded-xl px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                aria-label="Filter by transfer user"
              >
                <option value="">All people</option>
                {uniqueTransferUsers.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="app-control h-10 rounded-xl px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                aria-label="Filter from date"
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="app-control h-10 rounded-xl px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                aria-label="Filter to date"
              />
            </div>
          </section>

          <section className="app-panel overflow-hidden rounded-2xl">
            <SimpleBar style={{ maxHeight: "600px" }}>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-600" />
                </div>
              ) : filteredTransfers.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]">
                    <ArrowRightLeft className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">No transfers found</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {hasActiveFilters ? "Try clearing or adjusting your filters." : "Transfer records will appear here when available."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[980px]">
                      <thead className="bg-slate-50/80 dark:bg-white/[0.03]">
                        <tr className="border-b border-slate-200 dark:border-white/10">
                          {["Callback ID", "Client details", "Transferred by", "Transferred to", "Status", "Date", "Actions"].map((heading) => (
                            <th
                              key={heading}
                              className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${
                                heading === "Status" ? "text-center" : "text-left"
                              }`}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                        {currentTransfers.map((transfer) => (
                          <tr key={transfer._id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                            <td className="px-5 py-4">
                              <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">{transfer.callbackId}</span>
                            </td>
                            <td className="px-5 py-4">
                              <p className="max-w-[220px] truncate text-sm font-semibold text-slate-950 dark:text-white">{transfer.clientName}</p>
                              <p className="max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">{transfer.businessName}</p>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{transfer.transferredBy?.name || "Unknown"}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{transfer.transferredBy?.position || "No position"}</p>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{transfer.transferredTo?.name || "Unknown"}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{transfer.transferredTo?.position || "No position"}</p>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(transfer.transferStatus)}`}>
                                {transfer.transferStatus}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {new Date(transfer.transferredAt).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(transfer.transferredAt).toLocaleTimeString()}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => handleViewTransfer(transfer)}
                                className="app-icon-button inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                title="View details"
                                aria-label="View transfer details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-slate-500 dark:text-slate-400">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredTransfers.length)} of {filteredTransfers.length} transfers
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="app-secondary-button h-9 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {[...Array(Math.min(5, totalPages))].map((_, index) => {
                          const pageNum = currentPage <= 3 ? index + 1 : currentPage - 2 + index;
                          if (pageNum > totalPages) return null;
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => paginate(pageNum)}
                              className={`h-9 min-w-9 rounded-lg px-3 text-xs font-semibold transition ${
                                currentPage === pageNum ? "bg-blue-600 text-white" : "app-secondary-button"
                              }`}
                              aria-current={currentPage === pageNum ? "page" : undefined}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="app-secondary-button h-9 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </SimpleBar>
          </section>
        </div>
      </main>

      {viewModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="transfer-modal app-panel w-full max-w-2xl overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <p className="app-eyebrow">Transfer details</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {selectedTransfer.callbackId}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="app-icon-button inline-flex h-9 w-9 items-center justify-center rounded-lg"
                aria-label="Close transfer details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="transfer-detail-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(selectedTransfer.transferStatus)}`}>
                    {selectedTransfer.transferStatus}
                  </span>
                </div>
                <div className="transfer-detail-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Transferred at</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {new Date(selectedTransfer.transferredAt).toLocaleString()}
                  </p>
                </div>
                <div className="transfer-detail-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Client</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedTransfer.clientName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedTransfer.businessName}</p>
                </div>
                <div className="transfer-detail-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Completed at</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {selectedTransfer.transferCompletedAt
                      ? new Date(selectedTransfer.transferCompletedAt).toLocaleString()
                      : "Not completed"}
                  </p>
                </div>
                <div className="transfer-detail-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Transferred by</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {selectedTransfer.transferredBy?.name || "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedTransfer.transferredBy?.position || "No position"} · {selectedTransfer.transferredBy?.department || "No department"}
                  </p>
                </div>
                <div className="transfer-detail-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Transferred to</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {selectedTransfer.transferredTo?.name || "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedTransfer.transferredTo?.position || "No position"} · {selectedTransfer.transferredTo?.department || "No department"}
                  </p>
                </div>
              </div>

              {selectedTransfer.transferRemarks && (
                <div className="transfer-detail-card mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Transfer remarks</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedTransfer.transferRemarks}</p>
                </div>
              )}

              {selectedTransfer.remarks && (
                <div className="transfer-detail-card mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Callback remarks</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedTransfer.remarks}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="app-secondary-button inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferManagement;
