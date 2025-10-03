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
  User
} from "lucide-react";
import { toast } from "react-toastify";
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
  }, [pagination.currentPage, filters.userId, filters.startDate, filters.endDate]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.filter(user => ["employee", "admin", "hr"].includes(user.role)));
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
    fetchRecords();
    setShowForm(false);
    setEditData(null);

    // Enhanced event dispatch for real-time sync after form success
    setTimeout(() => {
      // Main event for legacy compatibility
      window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
        detail: {
          timestamp: Date.now(),
          action: 'form-success',
          employeeId: null, // Will be set by form if available
          forceRefresh: true,
          message: editData ? 'Attendance record updated successfully' : 'Attendance record created successfully'
        }
      }));

      // Additional events for specific components
      window.dispatchEvent(new CustomEvent('manualAttendanceUpdated', {
        detail: {
          type: editData ? 'UPDATE' : 'CREATE',
          operation: editData ? 'EDIT' : 'ADD',
          timestamp: Date.now(),
          source: 'ManualAttendanceManagement',
          refreshAll: true
        }
      }));

      window.dispatchEvent(new CustomEvent('attendanceRecordModified', {
        detail: {
          operation: editData ? 'UPDATE' : 'CREATE',
          timestamp: Date.now(),
          requiresFullRefresh: true
        }
      }));

      console.log('📢 Manual Attendance: Form success events dispatched');
    }, 100); // Reduced delay for faster sync
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

  const formatDateTime = (dateTime) => {
    if (!dateTime) return "—";
    return new Date(dateTime).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getStatusBadge = (record) => {
    if (record.isOnLeave) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900/30 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium">
          <User className="w-3 h-3" />
          On Leave
        </span>
      );
    }

    if (record.isHoliday) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium">
          <Calendar className="w-3 h-3" />
          Holiday
        </span>
      );
    }

    if (record.isAbsent) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Absent
        </span>
      );
    }

    if (record.isHalfDay) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          Half Day
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium">
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
        record.userId?.name?.toLowerCase().includes(searchTerm) ||
        record.userId?.employeeId?.toLowerCase().includes(searchTerm) ||
        record.notes?.toLowerCase().includes(searchTerm)
      );
    }
    return true;
  });

  // Get user role for sidebar
  const userStr = localStorage.getItem("user");
  const userRole = userStr ? JSON.parse(userStr).role : "admin";

  return (
    <div className="flex bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 min-h-screen text-white">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole}
        onLogout={onLogout}
      />
      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-24" : "ml-72"
        } p-6`}
      >
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-cyan-400" />
              Manual Attendance Management
            </h1>
            <p className="text-gray-400 mt-2">
              Add, edit, or manage employee attendance records manually
            </p>
          </div>

          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-cyan-500/25"
          >
            <Plus className="w-5 h-5" />
            Add Manual Attendance
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Employee</label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFilters(prev => ({ ...prev, startDate: today }));
                }}
                className="px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs rounded-lg transition-colors"
                title="Set to today"
              >
                Today
              </button>
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFilters(prev => ({ ...prev, endDate: today }));
                }}
                className="px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs rounded-lg transition-colors"
                title="Set to today"
              >
                Today
              </button>
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search by name, ID..."
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={fetchRecords}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600/50 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            {/* Quick Date Presets */}
            <div className="grid grid-cols-2 gap-1">
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
                className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs rounded transition-colors"
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
                className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded transition-colors"
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
                className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded transition-colors col-span-2"
                title="Clear all filters"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="p-6 border-b border-slate-600/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Attendance Records ({pagination.totalRecords})
              {selectedRecords.size > 0 && (
                <span className="text-sm text-cyan-400 ml-2">
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
                  className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedRecords(new Set())}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-600/50 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors text-sm"
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
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
              <p className="text-gray-400">Loading attendance records...</p>
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
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 w-12">
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Employee</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Punch In</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Punch Out</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Work Hours</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-600/20">
                {filteredRecords.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-700/30 transition-colors">
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
                        <div className="font-medium text-white">{record.userId?.name}</div>
                        <div className="text-sm text-gray-400">ID: {record.userId?.employeeId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{formatDate(record.date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-300">{formatDateTime(record.arrivalTime)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-300">{formatDateTime(record.departureTime)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">
                        {calculateWorkHours(record.workDurationSeconds)}
                      </div>
                      {record.breakDurationSeconds > 0 && (
                        <div className="text-sm text-orange-400">
                          Break: {calculateWorkHours(record.breakDurationSeconds)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(record)}
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
          <div className="p-6 border-t border-slate-600/30">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Showing {((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)} of {pagination.totalRecords} records
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={pagination.currentPage === 1}
                  className="p-2 bg-slate-600/50 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 bg-slate-700/50 text-white rounded-lg">
                  {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="p-2 bg-slate-600/50 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
      </main>
    </div>
  );
};

export default ManualAttendanceManagement;