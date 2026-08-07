import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  User,
  X
} from "lucide-react";
import { toast } from "react-toastify";
import timeUtils from "../../utils/timeUtils";
import Sidebar from "../../components/dashboard/Sidebar";
import ManualAttendanceForm from "../../components/admin/ManualAttendanceForm";

const ManualAttendanceManagement = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);

  // Filters and search
  const [filters, setFilters] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    search: ""
  });

  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 20
  });

  // Selection
  const [selectedRecords, setSelectedRecords] = useState(new Set());

  useEffect(() => {
    fetchUsers();
    fetchRecords();
    // Refetch when the server-backed pagination or date filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, filters.userId, filters.startDate, filters.endDate]);

  // Listen for manual attendance updates
  useEffect(() => {
    const handleAttendanceUpdate = (event) => {
      console.log('🔄 Received attendance update event:', event.detail);
      // Refresh the records list
      fetchRecords();
    };

    window.addEventListener('manualAttendanceUpdated', handleAttendanceUpdate);
    window.addEventListener('attendanceDataUpdated', handleAttendanceUpdate);

    return () => {
      window.removeEventListener('manualAttendanceUpdated', handleAttendanceUpdate);
      window.removeEventListener('attendanceDataUpdated', handleAttendanceUpdate);
    };
    // The event listeners intentionally retain the page-level refresh function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Include employees, admins, and HR users
        setUsers(data.filter(user => ["employee", "admin", "hr", "super-admin"].includes(user.role)));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.recordsPerPage.toString(),
        sortBy: "date",
        sortOrder: "desc"
      });

      if (filters.userId) params.append("userId", filters.userId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(`${API_BASE}/api/admin/manual-attendance/?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRecords(data.data.records);
        setPagination(prev => ({
          ...prev,
          totalPages: data.data.pagination.totalPages,
          totalRecords: data.data.pagination.totalRecords
        }));
      } else {
        toast.error("Failed to load attendance records");
      }
    } catch (error) {
      console.error("Error fetching records:", error);
      toast.error("Error loading attendance records");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Are you sure you want to delete this attendance record?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const response = await fetch(`${API_BASE}/api/admin/manual-attendance/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success("Attendance record deleted successfully");
        fetchRecords();

        // Enhanced event dispatch for real-time sync
        setTimeout(() => {
          // Main event for legacy compatibility
          // Find the record being deleted to get employee info
          const deletedRecord = records.find(r => r._id === id);
          const employeeId = deletedRecord?.attendanceData?.userId || deletedRecord?.userId;

          window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
            detail: {
              timestamp: Date.now(),
              action: 'delete',
              recordId: id,
              employeeId: employeeId,
              userId: employeeId,
              forceRefresh: true,
              message: 'Attendance record deleted successfully'
            }
          }));

          // Additional events for specific components
          window.dispatchEvent(new CustomEvent('manualAttendanceUpdated', {
            detail: {
              type: 'DELETE',
              recordId: id,
              employeeId: employeeId,
              timestamp: Date.now(),
              source: 'ManualAttendanceManagement'
            }
          }));

          window.dispatchEvent(new CustomEvent('attendanceRecordModified', {
            detail: {
              operation: 'DELETE',
              recordId: id,
              employeeId: employeeId,
              timestamp: Date.now()
            }
          }));

          console.log('📢 Manual Attendance: Delete events dispatched for record:', id);
        }, 100); // Reduced delay for faster sync
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete record");
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Error deleting record");
    }
  };

  const handleFormSuccess = () => {
    // Reset to page 1 to show the new entry
    setPagination(prev => ({ ...prev, currentPage: 1 }));

    // Close form
    setShowForm(false);
    const wasEditing = editData !== null;
    setEditData(null);

    // Fetch records with slight delay to ensure backend has processed
    setTimeout(() => {
      fetchRecords();
    }, 200);

    // Enhanced event dispatch for real-time sync after form success
    setTimeout(() => {
      // Main event for legacy compatibility
      window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
        detail: {
          timestamp: Date.now(),
          action: 'form-success',
          employeeId: null, // Will be set by form if available
          forceRefresh: true,
          message: wasEditing ? 'Attendance record updated successfully' : 'Attendance record created successfully'
        }
      }));

      // Additional events for specific components
      window.dispatchEvent(new CustomEvent('manualAttendanceUpdated', {
        detail: {
          type: wasEditing ? 'UPDATE' : 'CREATE',
          operation: wasEditing ? 'EDIT' : 'ADD',
          timestamp: Date.now(),
          source: 'ManualAttendanceManagement',
          refreshAll: true
        }
      }));

      window.dispatchEvent(new CustomEvent('attendanceRecordModified', {
        detail: {
          operation: wasEditing ? 'UPDATE' : 'CREATE',
          timestamp: Date.now(),
          requiresFullRefresh: true
        }
      }));

      console.log('📢 Manual Attendance: Form success events dispatched');
    }, 300);
  };

  const handleEdit = (record) => {
    setEditData(record);
    setShowForm(true);
  };

  const handleDuplicate = (record) => {
    // Create a copy of the record with a new date (today)
    const duplicatedRecord = {
      ...record,
      date: new Date().toISOString().split('T')[0], // Set to today
      _id: undefined, // Remove the ID so it creates a new record
      overrideExisting: false
    };
    setEditData(duplicatedRecord);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditData(null);
    setShowForm(true);
  };

  // Use centralized time utilities for consistent timezone handling
  const formatDateTime = (dateTime) => {
    return timeUtils.formatDateTime(dateTime);
  };

  const formatDate = (date) => {
    return timeUtils.formatDate(date);
  };

  const getStatusBadge = (record) => {
    // Check leave info
    if (record.leave?.isOnLeave || record.metadata?.isOnLeave) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300">
          <User className="w-3 h-3" />
          On Leave
        </span>
      );
    }

    // Check holiday
    if (record.metadata?.isHoliday) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300">
          <Calendar className="w-3 h-3" />
          Holiday
        </span>
      );
    }

    // Check status from calculated field
    const status = record.calculated?.status;

    if (status === 'absent' || record.calculated?.isAbsent) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300">
          <XCircle className="w-3 h-3" />
          Absent
        </span>
      );
    }

    if (status === 'halfDay' || record.calculated?.isHalfDay) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
          <AlertCircle className="w-3 h-3" />
          Half Day
        </span>
      );
    }

    if (record.metadata?.isWFH) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
          <CheckCircle className="w-3 h-3" />
          WFH
        </span>
      );
    }

    // Default to present
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
        <CheckCircle className="w-3 h-3" />
        Present
      </span>
    );
  };

  const calculateWorkHours = (workDurationSeconds) => {
    if (!workDurationSeconds) return "0h 0m";
    const hours = Math.floor(workDurationSeconds / 3600);
    const minutes = Math.floor((workDurationSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const filteredRecords = records.filter(record => {
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      return (
        record.user?.name?.toLowerCase().includes(searchTerm) ||
        record.user?.employeeId?.toLowerCase().includes(searchTerm) ||
        record.user?.email?.toLowerCase().includes(searchTerm) ||
        record.notes?.toLowerCase().includes(searchTerm)
      );
    }
    return true;
  });

  // Get user role for sidebar
  const userStr = localStorage.getItem("user");
  const userRole = userStr ? JSON.parse(userStr).role : "admin";

  return (
    <div className="manual-attendance-theme relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole}
        onLogout={onLogout}
      />
      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
      <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
      {/* Header */}
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Attendance operations</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Manual attendance</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add, correct, and review employee attendance records.</p>
            </div>
          </div>

          <button
            onClick={handleAddNew}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add attendance
          </button>
        </div>
      </header>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Filter attendance records</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* User Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Employee</label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
            >
              <option value="">All Employees</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>
                  {user.name} ({user.employeeId})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Start date</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
              />
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFilters(prev => ({ ...prev, startDate: today }));
                }}
                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.05]"
                title="Set to today"
              >
                Today
              </button>
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">End date</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
              />
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFilters(prev => ({ ...prev, endDate: today }));
                }}
                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.05]"
                title="Set to today"
              >
                Today
              </button>
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search by name, ID..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-4">
            <button
              onClick={fetchRecords}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            {/* Quick Date Presets */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setFilters(prev => ({
                    ...prev,
                    startDate: lastWeek.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  }));
                }}
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.05]"
                title="Last 7 days"
              >
                Last 7d
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setFilters(prev => ({
                    ...prev,
                    startDate: lastMonth.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  }));
                }}
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.05]"
                title="Last 30 days"
              >
                Last 30d
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    startDate: "",
                    endDate: "",
                    userId: "",
                    search: ""
                  }));
                }}
                className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                title="Clear all filters"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
        {/* Table Header */}
        <div className="border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              Attendance records <span className="text-sm font-normal text-slate-400">({pagination.totalRecords})</span>
              {selectedRecords.size > 0 && (
                <span className="ml-2 text-sm text-blue-600 dark:text-blue-300">
                  ({selectedRecords.size} selected)
                </span>
              )}
            </h3>
            {selectedRecords.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${selectedRecords.size} selected records?`)) {
                      selectedRecords.forEach(id => handleDeleteRecord(id));
                      setSelectedRecords(new Set());
                    }
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedRecords(new Set())}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                >
                  <X className="w-4 h-4" />
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600 dark:text-blue-300" />
              <p className="text-slate-500 dark:text-slate-400">Loading attendance records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">No attendance records found</p>
              <p className="text-gray-500 text-sm">
                {Object.values(filters).some(f => f) ? "Try adjusting your filters" : "Create your first manual attendance record"}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[1180px]">
              <thead className="bg-slate-50 dark:bg-white/[0.025]">
                <tr>
                  <th className="w-12 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={filteredRecords.length > 0 && filteredRecords.every(record => selectedRecords.has(record._id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecords(new Set(filteredRecords.map(record => record._id)));
                        } else {
                          setSelectedRecords(new Set());
                        }
                      }}
                      className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                    />
                  </th>
                  {['Employee', 'Date', 'Punch in', 'Punch out', 'Work hours', 'Status', 'Created by', 'Actions'].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                {filteredRecords.map((record) => (
                  <tr key={record._id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.025]">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRecords.has(record._id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedRecords);
                          if (e.target.checked) {
                            newSelected.add(record._id);
                          } else {
                            newSelected.delete(record._id);
                          }
                          setSelectedRecords(newSelected);
                        }}
                        className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">{record.user?.name || 'Unknown'}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {record.user?.employeeId || record.user?.email || `ID: ${record.userId}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{formatDate(record.date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600 dark:text-slate-300">
                        {record.calculated?.arrivalTime ? formatDateTime(record.calculated.arrivalTime) : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600 dark:text-slate-300">
                        {record.calculated?.departureTime ? formatDateTime(record.calculated.departureTime) : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {record.calculated?.workDurationSeconds ? calculateWorkHours(record.calculated.workDurationSeconds) : '0h 0m'}
                      </div>
                      {record.calculated?.breakDurationSeconds > 0 && (
                        <div className="text-sm text-orange-400">
                          Break: {calculateWorkHours(record.calculated.breakDurationSeconds)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(record)}
                    </td>
                    <td className="px-6 py-4">
                      {record.approvedBy ? (
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">{record.approvedBy.name}</div>
                          <div className="text-sm capitalize text-slate-500 dark:text-slate-400">{record.approvedBy.role}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-2 hover:bg-blue-600/20 text-blue-400 rounded-lg transition-colors"
                          title="Edit Record"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(record)}
                          className="p-2 hover:bg-green-600/20 text-green-400 rounded-lg transition-colors"
                          title="Duplicate Record"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record._id)}
                          className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="border-t border-slate-200 p-5 dark:border-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing {((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)} of {pagination.totalRecords} records
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={pagination.currentPage === 1}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 dark:bg-white/[0.05] dark:text-slate-300">
                  {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Manual Attendance Form Modal */}
      <ManualAttendanceForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditData(null);
        }}
        onSuccess={handleFormSuccess}
        editData={editData}
      />
      </div>
      </main>
    </div>
  );
};

export default ManualAttendanceManagement;
