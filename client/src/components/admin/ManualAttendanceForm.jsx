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
import timeUtils from "../../utils/timeUtils";

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
    isWFH: false,  // ⭐ Work From Home flag
    isPaidLeave: false,  // ⭐ Paid Leave flag
    leaveType: "",  // Leave type (paid, unpaid, sick, etc.)
    overrideExisting: false,
    // Multi-date functionality
    isMultiDate: false,
    selectedDates: [],
    dateRange: {
      startDate: "",
      endDate: ""
    }
  });

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errors, setErrors] = useState({});
  const [multiDateProgress, setMultiDateProgress] = useState({ current: 0, total: 0 });

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
      // Helper function to convert UTC datetime to datetime-local format in user's timezone
      const utcToDateTimeLocal = (utcDateTime) => {
        if (!utcDateTime) return "";
        try {
          const date = new Date(utcDateTime);
          if (isNaN(date.getTime())) return "";

          // Convert UTC to local time (browser automatically handles timezone)
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
          console.error('Error converting UTC to datetime-local:', error);
          return "";
        }
      };

      setFormData({
        userId: editData.userId._id || editData.userId,
        date: editData.date.split('T')[0], // Convert to YYYY-MM-DD format
        // Extract UTC components - they represent local times stored as UTC
        punchInTime: editData.arrivalTime ? utcToDateTimeLocal(editData.arrivalTime) : "",
        punchOutTime: editData.departureTime ? utcToDateTimeLocal(editData.departureTime) : "",
        breakSessions: editData.breakSessions?.map(session => ({
          start: session.start ? utcToDateTimeLocal(session.start) : "",
          end: session.end ? utcToDateTimeLocal(session.end) : "",
          type: session.type || "break"
        })) || [],
        notes: editData.notes || "",
        isOnLeave: editData.isOnLeave || false,
        isHoliday: editData.isHoliday || false,
        isWFH: editData.isWFH || false,
        isPaidLeave: editData.isPaidLeave || false,
        leaveType: editData.leaveType || "",
        overrideExisting: true
      });
    }
  }, [selectedUser, selectedDate, editData]);

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

    if (!formData.isMultiDate && !formData.date) {
      newErrors.date = "Please select a date";
    }

    if (formData.isMultiDate && formData.selectedDates.length === 0) {
      newErrors.selectedDates = "Please select at least one date";
    }

    // WFH requires punch times (it's a working day), but regular leaves don't
    const requiresPunchTimes = !formData.isOnLeave && !formData.isHoliday;

    if (requiresPunchTimes) {
      if (!formData.punchInTime && !formData.punchOutTime) {
        newErrors.punchInTime = "Please provide at least punch in or punch out time";
      }

      if (formData.punchInTime && formData.punchOutTime) {
        if (formData.isMultiDate) {
          // For multi-date, compare time values
          const punchInTime = formData.punchInTime.includes('T') ? formData.punchInTime.split('T')[1] : formData.punchInTime;
          const punchOutTime = formData.punchOutTime.includes('T') ? formData.punchOutTime.split('T')[1] : formData.punchOutTime;

          if (punchOutTime <= punchInTime) {
            newErrors.punchOutTime = "Punch out time must be after punch in time";
          }
        } else {
          // For single date, compare full datetime
          const punchIn = new Date(formData.punchInTime);
          const punchOut = new Date(formData.punchOutTime);

          if (punchOut <= punchIn) {
            newErrors.punchOutTime = "Punch out time must be after punch in time";
          }
        }
      }

      // Validate break sessions
      formData.breakSessions.forEach((session, index) => {
        if (!session.start || !session.end) {
          newErrors[`break_${index}`] = "Both start and end times are required for break sessions";
        } else {
          if (formData.isMultiDate) {
            // For multi-date, compare time values only
            const startTime = session.start.includes('T') ? session.start.split('T')[1] : session.start;
            const endTime = session.end.includes('T') ? session.end.split('T')[1] : session.end;

            if (endTime <= startTime) {
              newErrors[`break_${index}`] = "Break end time must be after start time";
            }

            // Check if break is within work hours for multi-date
            if (formData.punchInTime && formData.punchOutTime) {
              const punchInTime = formData.punchInTime.includes('T') ? formData.punchInTime.split('T')[1] : formData.punchInTime;
              const punchOutTime = formData.punchOutTime.includes('T') ? formData.punchOutTime.split('T')[1] : formData.punchOutTime;

              if (startTime < punchInTime || endTime > punchOutTime) {
                newErrors[`break_${index}`] = "Break sessions must be within punch in/out times";
              }
            }
          } else {
            // For single date, compare full datetime
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
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("🔍 Form submission started with formData:", {
      isMultiDate: formData.isMultiDate,
      overrideExisting: formData.overrideExisting,
      selectedDatesCount: formData.selectedDates.length,
      userId: formData.userId,
      date: formData.date
    });

    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const isEdit = editData && editData._id;

      if (formData.isMultiDate) {
        // Handle multiple dates - create/update multiple records
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        setMultiDateProgress({ current: 0, total: formData.selectedDates.length });

        for (let i = 0; i < formData.selectedDates.length; i++) {
          const date = formData.selectedDates[i];
          setMultiDateProgress({ current: i + 1, total: formData.selectedDates.length });
          try {
            // Combine date with time and convert to proper UTC
            const combineDateTime = (date, time) => {
              if (!time) return "";
              // Extract time part if it's a full datetime
              const timeOnly = time.includes('T') ? time.split('T')[1] : time;
              // Create date in local timezone, then convert to UTC
              const localDateTime = new Date(`${date}T${timeOnly}`);
              return localDateTime.toISOString();
            };

            const recordData = {
              userId: formData.userId,
              date: date,
              // Combine selected date with time values as UTC (no conversion)
              punchInTime: formData.punchInTime ? combineDateTime(date, formData.punchInTime) : "",
              punchOutTime: formData.punchOutTime ? combineDateTime(date, formData.punchOutTime) : "",
              // Update break sessions with combined date-time as UTC
              breakSessions: formData.breakSessions.map(session => ({
                ...session,
                start: session.start ? combineDateTime(date, session.start) : "",
                end: session.end ? combineDateTime(date, session.end) : ""
              })),
              notes: formData.notes || "",
              isOnLeave: formData.isOnLeave || false,
              isHoliday: formData.isHoliday || false,
              overrideExisting: true // Always override for multi-date to avoid conflicts
            };

            console.log(`🔍 Sending record for ${date}:`, {
              overrideExisting: recordData.overrideExisting,
              date: recordData.date,
              punchInTime: recordData.punchInTime,
              punchOutTime: recordData.punchOutTime
            });

            const response = await fetch(`${API_BASE}/api/admin/manual-attendance`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify(recordData)
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
              const result = await response.json();
              console.log(`❌ Error for ${date}:`, {
                status: response.status,
                result,
                overrideSent: recordData.overrideExisting
              });
              errors.push(`${date}: ${result.error || 'Failed to save'}`);
            }
          } catch (err) {
            errorCount++;
            errors.push(`${date}: Network error`);
          }
        }

        // Show results
        if (successCount > 0) {
          toast.success(`Successfully created/updated ${successCount} attendance records`);
        }
        if (errorCount > 0) {
          toast.error(`Failed to create ${errorCount} records. Check console for details.`);
          console.error("Multi-date creation errors:", errors);
        }

        // Close modal if any records were successful
        if (successCount > 0) {
          onSuccess?.();

          // Enhanced event dispatch for multi-date creation
          console.log("🔄 Dispatching enhanced events for multi-date creation...");
          setTimeout(() => {
            // Main event for legacy compatibility
            window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
              detail: {
                timestamp: Date.now(),
                userId: formData.userId,
                employeeId: formData.userId,
                dates: formData.selectedDates,
                action: 'multi-create',
                successCount,
                forceRefresh: true,
                message: `${successCount} attendance records created successfully`
              }
            }));

            // Enhanced events for specific components
            window.dispatchEvent(new CustomEvent('manualAttendanceUpdated', {
              detail: {
                type: 'MULTI_CREATE',
                employeeId: formData.userId,
                affectedDates: formData.selectedDates,
                successCount,
                timestamp: Date.now(),
                source: 'ManualAttendanceForm'
              }
            }));

            window.dispatchEvent(new CustomEvent('attendanceRecordModified', {
              detail: {
                operation: 'MULTI_CREATE',
                employeeId: formData.userId,
                recordCount: successCount,
                timestamp: Date.now()
              }
            }));

            console.log(`📢 Manual Form: Multi-date events dispatched for ${successCount} records`);
          }, 100); // 500ms delay to ensure database consistency

          handleClose();
        }
      } else {
        // Handle single date (existing logic)
        const url = isEdit
          ? `${API_BASE}/api/admin/manual-attendance/${editData._id}`
          : `${API_BASE}/api/admin/manual-attendance`;

        const method = isEdit ? "PUT" : "POST";

        // Convert local datetime-local input to proper UTC
        const convertToUTC = (dateTimeLocal) => {
          if (!dateTimeLocal) return "";
          // dateTimeLocal format: "2025-10-07T14:00"
          // Create Date object in local timezone and convert to UTC
          const localDate = new Date(dateTimeLocal);
          return localDate.toISOString();
        };

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            // Convert times to UTC ISO strings (Option C - no timezone conversion)
            punchInTime: convertToUTC(formData.punchInTime),
            punchOutTime: convertToUTC(formData.punchOutTime),
            breakSessions: formData.breakSessions.map(session => ({
              ...session,
              start: convertToUTC(session.start),
              end: convertToUTC(session.end)
            })),
            overrideExisting: formData.overrideExisting || isEdit // Always override for edits
          })
        });

        const result = await response.json();

        if (response.ok) {
          console.log("✅ Single record operation successful:", result);
          console.log("📊 Work duration calculation from server:", {
            workDurationSeconds: result.data?.dailyWork?.workDurationSeconds,
            calculatedMetrics: result.data?.calculatedMetrics,
            timeline: result.data?.dailyWork?.timeline
          });
          toast.success(
            isEdit
              ? "Attendance record updated successfully"
              : "Manual attendance record created successfully"
          );
          onSuccess?.(result.data);

          // Enhanced event dispatch for single record operation
          console.log("🔄 Dispatching enhanced events for single record operation...");
          setTimeout(() => {
            // Main event for legacy compatibility
            window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
              detail: {
                timestamp: Date.now(),
                recordId: result.data?.dailyWork?._id,
                userId: formData.userId,
                employeeId: formData.userId,
                date: formData.date || formData.selectedDates,
                action: isEdit ? 'update' : 'create',
                forceRefresh: true,
                message: isEdit ? "Attendance record updated successfully" : "Manual attendance record created successfully"
              }
            }));

            // Enhanced events for specific components
            window.dispatchEvent(new CustomEvent('manualAttendanceUpdated', {
              detail: {
                type: isEdit ? 'UPDATE' : 'CREATE',
                operation: isEdit ? 'EDIT' : 'ADD',
                employeeId: formData.userId,
                recordId: result.data?.dailyWork?._id,
                date: formData.date,
                timestamp: Date.now(),
                source: 'ManualAttendanceForm'
              }
            }));

            window.dispatchEvent(new CustomEvent('attendanceRecordModified', {
              detail: {
                operation: isEdit ? 'UPDATE' : 'CREATE',
                employeeId: formData.userId,
                recordId: result.data?.dailyWork?._id,
                timestamp: Date.now()
              }
            }));

            console.log(`📢 Manual Form: Single record events dispatched for ${isEdit ? 'update' : 'create'}`);
          }, 100); // 500ms delay to ensure database consistency

          handleClose();
        } else {
          toast.error(result.error || "Failed to save attendance record");

          if (response.status === 409) {
            // Conflict - record exists
            setFormData(prev => ({ ...prev, overrideExisting: true }));
            toast.warn("Record exists. Check 'Override Existing' to replace it.");
          }
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
      isWFH: false,
      isPaidLeave: false,
      leaveType: "",
      overrideExisting: false,
      isMultiDate: false,
      selectedDates: [],
      dateRange: {
        startDate: "",
        endDate: ""
      }
    });
    setErrors({});
    setMultiDateProgress({ current: 0, total: 0 });
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

  // Generate date range
  const generateDateRange = (startDate, endDate) => {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  // Handle date range change
  const handleDateRangeChange = (field, value) => {
    const newDateRange = { ...formData.dateRange, [field]: value };
    setFormData(prev => ({ ...prev, dateRange: newDateRange }));

    // Auto-generate selected dates if both start and end are set
    if (newDateRange.startDate && newDateRange.endDate) {
      const generatedDates = generateDateRange(newDateRange.startDate, newDateRange.endDate);
      setFormData(prev => ({ ...prev, selectedDates: generatedDates }));
    }
  };

  // Toggle specific date in selection
  const toggleDateSelection = (date) => {
    setFormData(prev => ({
      ...prev,
      selectedDates: prev.selectedDates.includes(date)
        ? prev.selectedDates.filter(d => d !== date)
        : [...prev.selectedDates, date].sort()
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
                {editData && editData._id ? "Edit" : editData ? "Duplicate" : "Add"} Manual Attendance
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
            {/* Edit/Duplicate Warning */}
            {editData && editData._id && (
              <div className="p-4 bg-amber-900/20 border border-amber-600/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-amber-300 font-medium">Editing Previous Attendance</h4>
                    <p className="text-amber-200/80 text-sm mt-1">
                      You are editing an existing attendance record. You can change the employee, date, and all other details.
                      This will update the historical record and may affect reports and calculations.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {editData && !editData._id && (
              <div className="p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-green-300 font-medium">Duplicating Attendance Record</h4>
                    <p className="text-green-200/80 text-sm mt-1">
                      You are creating a new attendance record based on an existing one.
                      All fields have been pre-filled, but you can modify any details before saving.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                  disabled={loadingUsers}
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
                  disabled={formData.isMultiDate}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.date}
                  </p>
                )}
              </div>
            </div>

            {/* Multi-Date Toggle - Show for both new records and edits */}
            <div className="border-t border-slate-600/30 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isMultiDate}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    isMultiDate: e.target.checked,
                    selectedDates: e.target.checked ? [] : prev.selectedDates,
                    date: e.target.checked ? "" : prev.date,
                    // Reset time fields to time-only format when switching to multi-date
                    punchInTime: e.target.checked && prev.punchInTime && prev.punchInTime.includes('T')
                      ? prev.punchInTime.split('T')[1]
                      : prev.punchInTime,
                    punchOutTime: e.target.checked && prev.punchOutTime && prev.punchOutTime.includes('T')
                      ? prev.punchOutTime.split('T')[1]
                      : prev.punchOutTime,
                    breakSessions: e.target.checked
                      ? prev.breakSessions.map(session => ({
                          ...session,
                          start: session.start && session.start.includes('T') ? session.start.split('T')[1] : session.start,
                          end: session.end && session.end.includes('T') ? session.end.split('T')[1] : session.end
                        }))
                      : prev.breakSessions
                  }))}
                  className="w-5 h-5 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                />
                <div>
                  <span className="text-white font-medium">
                    {editData ? "Apply Changes to Multiple Dates" : "Apply to Multiple Dates"}
                  </span>
                  <p className="text-sm text-gray-400 mt-1">
                    {editData
                      ? "Update the same attendance data across multiple dates at once"
                      : "Create the same attendance record across multiple dates at once"
                    }
                  </p>
                </div>
              </label>
            </div>

            {/* Multi-Date Selection */}
            {formData.isMultiDate && (
              <div className="space-y-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <h4 className="text-md font-medium text-white flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-cyan-400" />
                  Select Multiple Dates
                </h4>

                {editData && (
                  <div className="p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="text-blue-300 font-medium text-sm">Multi-Date Edit Mode</h5>
                        <p className="text-blue-200/80 text-xs mt-1">
                          The current attendance data will be applied to all selected dates.
                          Existing records for those dates will be replaced with these new values.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Range Quick Select */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={formData.dateRange.startDate}
                      onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
                    <input
                      type="date"
                      value={formData.dateRange.endDate}
                      onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Quick Date Range Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const endDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
                      const start = today.toISOString().split('T')[0];
                      const end = endDate.toISOString().split('T')[0];
                      setFormData(prev => ({
                        ...prev,
                        dateRange: { startDate: start, endDate: end },
                        selectedDates: generateDateRange(start, end)
                      }));
                    }}
                    className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs rounded transition-colors"
                  >
                    Next 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const monday = new Date(today);
                      monday.setDate(today.getDate() - today.getDay() + 1);
                      const friday = new Date(monday);
                      friday.setDate(monday.getDate() + 4);
                      const start = monday.toISOString().split('T')[0];
                      const end = friday.toISOString().split('T')[0];
                      setFormData(prev => ({
                        ...prev,
                        dateRange: { startDate: start, endDate: end },
                        selectedDates: generateDateRange(start, end)
                      }));
                    }}
                    className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded transition-colors"
                  >
                    This Week (Mon-Fri)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        selectedDates: [],
                        dateRange: { startDate: "", endDate: "" }
                      }));
                    }}
                    className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>

                {/* Selected Dates Display */}
                {formData.selectedDates.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">
                      Selected Dates ({formData.selectedDates.length}):
                    </p>
                    <div className="max-h-32 overflow-y-auto bg-slate-800/50 rounded p-3 border border-slate-600/30">
                      <div className="flex flex-wrap gap-1">
                        {formData.selectedDates.map(date => (
                          <span
                            key={date}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-600/20 text-cyan-300 text-xs rounded border border-cyan-600/30"
                          >
                            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                            <button
                              type="button"
                              onClick={() => toggleDateSelection(date)}
                              className="hover:bg-cyan-600/30 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {errors.selectedDates && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.selectedDates}
                  </p>
                )}
              </div>
            )}

            {/* Special Day Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Special Day Options</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Work From Home */}
                <label className="flex items-center gap-3 p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg cursor-pointer hover:bg-blue-600/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isWFH}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        isWFH: checked,
                        // Uncheck incompatible options
                        isOnLeave: false,
                        isHoliday: false,
                        isPaidLeave: false
                      }));
                    }}
                    className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Home className="w-5 h-5 text-blue-400" />
                    <div>
                      <span className="text-white font-medium">Work From Home</span>
                      <p className="text-xs text-gray-400 mt-0.5">Employee works remotely (requires punch in/out)</p>
                    </div>
                  </div>
                </label>

                {/* Paid Leave */}
                <label className="flex items-center gap-3 p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-lg cursor-pointer hover:bg-emerald-600/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isPaidLeave}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        isPaidLeave: checked,
                        isOnLeave: checked,  // Paid leave is still a leave
                        leaveType: checked ? 'paid' : '',
                        // Uncheck incompatible options
                        isWFH: false,
                        isHoliday: false
                      }));
                    }}
                    className="w-5 h-5 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-white font-medium">Paid Leave</span>
                      <p className="text-xs text-gray-400 mt-0.5">Approved paid leave (no work required)</p>
                    </div>
                  </div>
                </label>

                {/* Regular Leave */}
                <label className="flex items-center gap-3 p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg cursor-pointer hover:bg-purple-600/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isOnLeave && !formData.isPaidLeave}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        isOnLeave: checked,
                        leaveType: checked ? 'unpaid' : '',
                        // Uncheck incompatible options
                        isWFH: false,
                        isHoliday: false,
                        isPaidLeave: false
                      }));
                    }}
                    className="w-5 h-5 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <AlertCircle className="w-5 h-5 text-purple-400" />
                    <div>
                      <span className="text-white font-medium">Other Leave</span>
                      <p className="text-xs text-gray-400 mt-0.5">Unpaid, sick, or other leave types</p>
                    </div>
                  </div>
                </label>

                {/* Holiday */}
                <label className="flex items-center gap-3 p-4 bg-cyan-600/10 border border-cyan-600/30 rounded-lg cursor-pointer hover:bg-cyan-600/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isHoliday}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        isHoliday: checked,
                        // Uncheck incompatible options
                        isWFH: false,
                        isOnLeave: false,
                        isPaidLeave: false
                      }));
                    }}
                    className="w-5 h-5 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <div>
                      <span className="text-white font-medium">Holiday</span>
                      <p className="text-xs text-gray-400 mt-0.5">Public or company holiday</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Override Existing Section */}
            <div className="flex flex-wrap gap-4">

              {!editData && !formData.isMultiDate && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.overrideExisting}
                    onChange={(e) => setFormData(prev => ({ ...prev, overrideExisting: e.target.checked }))}
                    className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                  />
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <div>
                    <span className="text-gray-300">Override Existing Record</span>
                    <p className="text-xs text-gray-500 mt-1">
                      Replace existing attendance record if one exists for this date
                    </p>
                  </div>
                </label>
              )}

              {formData.isMultiDate && (
                <div className="flex items-center gap-2 text-cyan-400">
                  <AlertCircle className="w-4 h-4" />
                  <div>
                    <span className="text-sm font-medium">Auto-Override Enabled</span>
                    <p className="text-xs text-gray-500 mt-1">
                      Existing records will be automatically replaced for multi-date operations
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Work Hours - Show for normal days and WFH, but NOT for regular leaves or holidays */}
            {((!formData.isOnLeave && !formData.isHoliday) || formData.isWFH) && (
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
                      {formData.isMultiDate && (
                        <span className="text-xs text-cyan-400 ml-2">(Time only - will apply to all selected dates)</span>
                      )}
                    </label>
                    <input
                      type={formData.isMultiDate ? "time" : "datetime-local"}
                      value={formData.isMultiDate ?
                        (formData.punchInTime ? formData.punchInTime.split('T')[1] || formData.punchInTime : "") :
                        formData.punchInTime
                      }
                      onChange={(e) => {
                        if (formData.isMultiDate) {
                          // For multi-date, store only time
                          setFormData(prev => ({ ...prev, punchInTime: e.target.value }));
                        } else {
                          // For single date, store full datetime
                          setFormData(prev => ({ ...prev, punchInTime: e.target.value }));
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      placeholder={formData.isMultiDate ? "HH:MM" : ""}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Enter time as it should appear (e.g., 12:00 PM for noon)
                    </p>
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
                      {formData.isMultiDate && (
                        <span className="text-xs text-cyan-400 ml-2">(Time only - will apply to all selected dates)</span>
                      )}
                    </label>
                    <input
                      type={formData.isMultiDate ? "time" : "datetime-local"}
                      value={formData.isMultiDate ?
                        (formData.punchOutTime ? formData.punchOutTime.split('T')[1] || formData.punchOutTime : "") :
                        formData.punchOutTime
                      }
                      onChange={(e) => {
                        if (formData.isMultiDate) {
                          // For multi-date, store only time
                          setFormData(prev => ({ ...prev, punchOutTime: e.target.value }));
                        } else {
                          // For single date, store full datetime
                          setFormData(prev => ({ ...prev, punchOutTime: e.target.value }));
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      placeholder={formData.isMultiDate ? "HH:MM" : ""}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Enter time as it should appear (e.g., 12:00 PM for noon)
                    </p>
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
                            {formData.isMultiDate && (
                              <span className="text-xs text-cyan-400 ml-1">(Time only)</span>
                            )}
                          </label>
                          <input
                            type={formData.isMultiDate ? "time" : "datetime-local"}
                            value={formData.isMultiDate ?
                              (session.start ? session.start.split('T')[1] || session.start : "") :
                              session.start
                            }
                            onChange={(e) => updateBreakSession(index, "start", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            placeholder={formData.isMultiDate ? "HH:MM" : ""}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            End Time
                            {formData.isMultiDate && (
                              <span className="text-xs text-cyan-400 ml-1">(Time only)</span>
                            )}
                          </label>
                          <input
                            type={formData.isMultiDate ? "time" : "datetime-local"}
                            value={formData.isMultiDate ?
                              (session.end ? session.end.split('T')[1] || session.end : "") :
                              session.end
                            }
                            onChange={(e) => updateBreakSession(index, "end", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            placeholder={formData.isMultiDate ? "HH:MM" : ""}
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

            {/* Multi-Date Progress */}
            {loading && formData.isMultiDate && multiDateProgress.total > 0 && (
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Creating attendance records...</span>
                  <span className="text-sm text-cyan-400">
                    {multiDateProgress.current} of {multiDateProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(multiDateProgress.current / multiDateProgress.total) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            )}

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
                {loading
                  ? (formData.isMultiDate ? "Creating Records..." : "Saving...")
                  : (editData && editData._id)
                    ? "Update"
                    : formData.isMultiDate
                      ? `Create ${formData.selectedDates.length} Records`
                      : "Save"
                } Attendance
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ManualAttendanceForm;