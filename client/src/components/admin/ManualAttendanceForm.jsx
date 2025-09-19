import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  Plus,
  Minus,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Coffee,
  Home,
  CalendarDays
} from "lucide-react";
import { toast } from "react-toastify";

const ManualAttendanceForm = ({
  isOpen,
  onClose,
  onSuccess,
  selectedUser = null,
  selectedDate = null,
  editData = null
}) => {
  const [formData, setFormData] = useState({
    userId: "",
    date: "",
    punchInTime: "",
    punchOutTime: "",
    breakSessions: [],
    notes: "",
    isOnLeave: false,
    isHoliday: false,
    overrideExisting: false
  });

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errors, setErrors] = useState({});

  // Load users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Set initial form data when props change
  useEffect(() => {
    if (selectedUser) {
      setFormData(prev => ({ ...prev, userId: selectedUser._id || selectedUser }));
    }
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
    if (editData) {
      setFormData({
        userId: editData.userId._id || editData.userId,
        date: editData.date.split('T')[0], // Convert to YYYY-MM-DD format
        punchInTime: editData.arrivalTime ? new Date(editData.arrivalTime).toISOString().slice(0, 16) : "",
        punchOutTime: editData.departureTime ? new Date(editData.departureTime).toISOString().slice(0, 16) : "",
        breakSessions: editData.breakSessions?.map(session => ({
          start: new Date(session.start).toISOString().slice(0, 16),
          end: new Date(session.end).toISOString().slice(0, 16),
          type: session.type || "break"
        })) || [],
        notes: editData.notes || "",
        isOnLeave: editData.isOnLeave || false,
        isHoliday: editData.isHoliday || false,
        overrideExisting: true
      });
    }
  }, [selectedUser, selectedDate, editData]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.filter(user => ["employee", "admin", "hr"].includes(user.role)));
      } else {
        toast.error("Failed to load users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error loading users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.userId) {
      newErrors.userId = "Please select a user";
    }

    if (!formData.date) {
      newErrors.date = "Please select a date";
    }

    if (!formData.isOnLeave && !formData.isHoliday) {
      if (!formData.punchInTime && !formData.punchOutTime) {
        newErrors.punchInTime = "Please provide at least punch in or punch out time";
      }

      if (formData.punchInTime && formData.punchOutTime) {
        const punchIn = new Date(formData.punchInTime);
        const punchOut = new Date(formData.punchOutTime);

        if (punchOut <= punchIn) {
          newErrors.punchOutTime = "Punch out time must be after punch in time";
        }
      }

      // Validate break sessions
      formData.breakSessions.forEach((session, index) => {
        if (!session.start || !session.end) {
          newErrors[`break_${index}`] = "Both start and end times are required for break sessions";
        } else {
          const start = new Date(session.start);
          const end = new Date(session.end);

          if (end <= start) {
            newErrors[`break_${index}`] = "Break end time must be after start time";
          }

          // Check if break is within work hours
          if (formData.punchInTime && formData.punchOutTime) {
            const punchIn = new Date(formData.punchInTime);
            const punchOut = new Date(formData.punchOutTime);

            if (start < punchIn || end > punchOut) {
              newErrors[`break_${index}`] = "Break sessions must be within punch in/out times";
            }
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const url = editData
        ? `/api/admin/manual-attendance/${editData._id}`
        : "/api/admin/manual-attendance";

      const method = editData ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          editData
            ? "Attendance record updated successfully"
            : "Manual attendance record created successfully"
        );
        onSuccess?.(result.data);
        handleClose();
      } else {
        toast.error(result.error || "Failed to save attendance record");

        if (response.status === 409) {
          // Conflict - record exists
          setFormData(prev => ({ ...prev, overrideExisting: true }));
          toast.warn("Record exists. Check 'Override Existing' to replace it.");
        }
      }
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      userId: "",
      date: "",
      punchInTime: "",
      punchOutTime: "",
      breakSessions: [],
      notes: "",
      isOnLeave: false,
      isHoliday: false,
      overrideExisting: false
    });
    setErrors({});
    onClose();
  };

  const addBreakSession = () => {
    setFormData(prev => ({
      ...prev,
      breakSessions: [...prev.breakSessions, { start: "", end: "", type: "break" }]
    }));
  };

  const removeBreakSession = (index) => {
    setFormData(prev => ({
      ...prev,
      breakSessions: prev.breakSessions.filter((_, i) => i !== index)
    }));

    // Clear any errors for this break session
    const newErrors = { ...errors };
    delete newErrors[`break_${index}`];
    setErrors(newErrors);
  };

  const updateBreakSession = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      breakSessions: prev.breakSessions.map((session, i) =>
        i === index ? { ...session, [field]: value } : session
      )
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/30">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-600/30">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-semibold text-white">
                {editData ? "Edit" : "Add"} Manual Attendance
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Employee *
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  disabled={loadingUsers || editData}
                >
                  <option value="">Select Employee</option>
                  {users.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name} ({user.employeeId}) - {user.role}
                    </option>
                  ))}
                </select>
                {errors.userId && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.userId}
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  disabled={editData}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.date}
                  </p>
                )}
              </div>
            </div>

            {/* Special Day Options */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isOnLeave}
                  onChange={(e) => setFormData(prev => ({ ...prev, isOnLeave: e.target.checked }))}
                  className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                />
                <Home className="w-4 h-4 text-purple-400" />
                <span className="text-gray-300">On Leave</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isHoliday}
                  onChange={(e) => setFormData(prev => ({ ...prev, isHoliday: e.target.checked }))}
                  className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                />
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">Holiday</span>
              </label>

              {!editData && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.overrideExisting}
                    onChange={(e) => setFormData(prev => ({ ...prev, overrideExisting: e.target.checked }))}
                    className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                  />
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <span className="text-gray-300">Override Existing Record</span>
                </label>
              )}
            </div>

            {/* Work Hours - Only show if not on leave or holiday */}
            {!formData.isOnLeave && !formData.isHoliday && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Work Hours
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Punch In Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Punch In Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.punchInTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, punchInTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    />
                    {errors.punchInTime && (
                      <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.punchInTime}
                      </p>
                    )}
                  </div>

                  {/* Punch Out Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Punch Out Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.punchOutTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, punchOutTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    />
                    {errors.punchOutTime && (
                      <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.punchOutTime}
                      </p>
                    )}
                  </div>
                </div>

                {/* Break Sessions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-white flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-orange-400" />
                      Break Sessions
                    </h4>
                    <button
                      type="button"
                      onClick={addBreakSession}
                      className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Break
                    </button>
                  </div>

                  {formData.breakSessions.map((session, index) => (
                    <div key={index} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-300">Break {index + 1}</h5>
                        <button
                          type="button"
                          onClick={() => removeBreakSession(index)}
                          className="p-1 hover:bg-red-600/20 text-red-400 rounded"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Start Time
                          </label>
                          <input
                            type="datetime-local"
                            value={session.start}
                            onChange={(e) => updateBreakSession(index, "start", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            End Time
                          </label>
                          <input
                            type="datetime-local"
                            value={session.end}
                            onChange={(e) => updateBreakSession(index, "end", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Type
                          </label>
                          <select
                            value={session.type}
                            onChange={(e) => updateBreakSession(index, "type", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="break">Break</option>
                            <option value="lunch">Lunch</option>
                            <option value="meeting">Meeting</option>
                            <option value="personal">Personal</option>
                          </select>
                        </div>
                      </div>

                      {errors[`break_${index}`] && (
                        <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors[`break_${index}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
                placeholder="Add any additional notes or comments..."
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-600/30">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 bg-slate-600/50 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {loading ? "Saving..." : editData ? "Update" : "Save"} Attendance
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ManualAttendanceForm;