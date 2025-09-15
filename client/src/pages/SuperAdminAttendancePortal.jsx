import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import AttendanceStats from "../components/attendance/AttendanceStats";
import AttendanceCalendar from "../components/attendance/AttendanceCalendar";
import WeeklyHoursChart from "../components/attendance/WeeklyHoursChart";
import RecentActivityTable from "../components/attendance/RecentActivityTable";
import Sidebar from "../components/dashboard/Sidebar";
import { RefreshCw, AlertCircle, Clock, Users, Calendar as CalendarIcon, User, Search, UserCheck, Activity, Building2, ChevronDown } from "lucide-react";

const SuperAdminAttendancePortal = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [stats, setStats] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [employeeCache, setEmployeeCache] = useState(new Map());
  const [showDropdown, setShowDropdown] = useState(false);

  // Dropdown positioning (Portal)
  const selectorRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });

  const token = localStorage.getItem("token");
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const MIN_PRESENT_SECONDS = 5 * 3600; // 5 hours minimum for present status
  const SIDEBAR_WIDTH_EXPANDED = 288;
  const SIDEBAR_WIDTH_COLLAPSED = 80;

  // Enhanced axios configuration with proper error handling
  const apiClient = axios.create({
    baseURL: API_BASE,
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 5000, // Reduced timeout for faster failure detection
  });

  // Add response interceptor for better error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      throw error;
    }
  );

  // Utility functions
  const calculateHoursFromSeconds = (seconds) => {
    if (!seconds || seconds === 0) return 0;
    return Math.round((seconds / 3600) * 10) / 10;
  };

  const formatTime = (dateString) => {
    if (!dateString) return "--";
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return "--";
    }
  };

  const isWorkingDay = (date) => {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
  };

  const calculateWorkingDays = (startDate, endDate, holidays = [], leaves = []) => {
    let workingDays = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    const holidayDates = new Set(holidays.map(h => new Date(h.date).toDateString()));
    const leaveDates = new Set();
    
    // Process leaves into date strings
    leaves.forEach(leave => {
      const leaveStart = new Date(leave.period?.start || leave.startDate);
      const leaveEnd = new Date(leave.period?.end || leave.endDate);
      
      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        leaveDates.add(d.toDateString());
      }
    });

    while (current <= end) {
      if (isWorkingDay(current) && 
          !holidayDates.has(current.toDateString()) && 
          !leaveDates.has(current.toDateString())) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  };

  // Enhanced timeline parsing with better error handling
  const getPunchTimeFromTimeline = (timeline, eventType) => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null;
    
    try {
      const events = timeline.filter(event => 
        event.type && event.type.toLowerCase().includes(eventType.toLowerCase())
      );
      
      if (events.length === 0) return null;
      
      // For punch in, get the first occurrence; for punch out, get the last
      const sortedEvents = events.sort((a, b) => new Date(a.time) - new Date(b.time));
      const targetEvent = eventType === "punch in" ? sortedEvents[0] : sortedEvents[sortedEvents.length - 1];
      
      return new Date(targetEvent.time);
    } catch (error) {
      console.warn(`Error parsing timeline for ${eventType}:`, error);
      return null;
    }
  };

  const getArrivalTime = (dailyData) => {
    // Priority 1: Direct arrivalTime field
    if (dailyData.arrivalTime) {
      return new Date(dailyData.arrivalTime);
    }
    
    // Priority 2: First punch in from timeline
    if (dailyData.timeline && Array.isArray(dailyData.timeline)) {
      const punchInTime = getPunchTimeFromTimeline(dailyData.timeline, "punch in");
      if (punchInTime) return punchInTime;
    }
    
    // Priority 3: First worked session start time
    if (dailyData.workedSessions && Array.isArray(dailyData.workedSessions) && dailyData.workedSessions.length > 0) {
      const firstSession = dailyData.workedSessions[0];
      if (firstSession.start) {
        return new Date(firstSession.start);
      }
    }
    
    return null;
  };

  // Derive robust departure time: prefer direct field, otherwise last punch out, else last session end
  const getDepartureTime = (dailyData) => {
    if (!dailyData) return null;
    if (dailyData.departureTime) {
      try { return new Date(dailyData.departureTime); } catch {}
    }
    if (Array.isArray(dailyData.timeline)) {
      const po = getPunchTimeFromTimeline(dailyData.timeline, "punch out");
      if (po) return po;
    }
    if (Array.isArray(dailyData.workedSessions) && dailyData.workedSessions.length > 0) {
      const last = dailyData.workedSessions[dailyData.workedSessions.length - 1];
      if (last?.end) {
        try { return new Date(last.end); } catch {}
      }
    }
    return null;
  };

  // Position dropdown right under the selector using a Portal
  const updateDropdownPosition = useCallback(() => {
    if (!selectorRef.current) return;
    const rect = selectorRef.current.getBoundingClientRect();
    setDropdownCoords({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      width: rect.width
    });
  }, []);

  // Fetch all employees
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await apiClient.get(`/api/admin/employees?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('Employees response:', response.data); // Debug log
      
      // Handle the correct response structure: { success: true, data: employees }
      const employeesData = response.data?.success ? response.data.data : [];
      setEmployees(employeesData);
      
      if (employeesData.length === 0) {
        console.warn('No employees found in response');
        setError('No employees found. Please check your permissions.');
      } else {
        console.log(`Loaded ${employeesData.length} employees`);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Failed to load employee list: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch current user status for selected employee
  const fetchCurrentStatus = useCallback(async (employeeId) => {
    if (!employeeId) return null;
    try {
      const response = await apiClient.get(`/api/status/today/${employeeId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching current status:', error);
      return null;
    }
  }, []);

  // Fetch attendance data for selected employee
  const fetchAttendanceData = useCallback(async (employeeId, isRefresh = false) => {
    if (!employeeId) return;
    
    // Check cache first (unless it's a refresh)
    if (!isRefresh && employeeCache.has(employeeId)) {
      const cachedData = employeeCache.get(employeeId);
      setStats(cachedData.stats);
      setCalendarData(cachedData.calendarData);
      setWeeklyHours(cachedData.weeklyHours);
      setRecentActivity(cachedData.recentActivity);
      setCurrentStatus(cachedData.currentStatus);
      setLoadingEmployeeData(false);
      return;
    }
    
    // Add overall timeout to prevent hanging
    const overallTimeout = setTimeout(() => {
      setError('Request timeout - please try again');
      setLoadingEmployeeData(false);
      setRefreshing(false);
    }, 15000); // 15 second overall timeout
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);

      const now = new Date();
      // Use full current month range so the calendar has complete data
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Create a timeout promise for the main API call
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );

      // Fetch only the essential weekly data with timeout
      const weeklyRes = await Promise.race([
        apiClient.get('/api/summary/week', {
          params: {
            userId: employeeId,
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString(),
          },
        }),
        timeoutPromise
      ]);

      // Set basic stats immediately for faster UI response
      const { dailyData = [] } = weeklyRes.data;
      const presentDaysCount = dailyData.filter(d => (d.workDurationSeconds || 0) >= MIN_PRESENT_SECONDS).length;
      const totalWorkHours = dailyData.reduce((sum, d) => 
        sum + calculateHoursFromSeconds(d.workDurationSeconds || 0), 0
      );

      // Don't set stats yet - wait for complete data

      // Fetch additional data in parallel with shorter timeouts
      const [statusRes, leavesRes, holidaysRes] = await Promise.allSettled([
        fetchCurrentStatus(employeeId),
        apiClient.get(`/api/leaves/employee/${employeeId}`, { timeout: 3000 }).catch(() => ({ data: [] })),
        apiClient.get('/api/holidays?shift=standard', { timeout: 3000 }).catch(() => ({ data: [] }))
      ]);

      // Process the additional data results
      const statusData = statusRes.status === 'fulfilled' ? statusRes.value : null;
      const approvedLeaves = leavesRes.status === 'fulfilled' ? 
        leavesRes.value.data.filter(l => l.status.toLowerCase() === "approved") : [];
      const holidays = holidaysRes.status === 'fulfilled' ? holidaysRes.value.data || [] : [];

      // Calculate working days for accurate stats over the month
      const weekWorkingDays = calculateWorkingDays(monthStart, monthEnd, holidays, approvedLeaves);
      
      // Set complete stats with all accurate calculations
      setStats({
        attendanceRate: weekWorkingDays > 0 ? Math.round((presentDaysCount / weekWorkingDays) * 100) : 0,
        presentDays: presentDaysCount,
        totalDays: weekWorkingDays,
        workingHours: totalWorkHours.toFixed(1),
        onTimeRate: 0, // Will be calculated below
        lastUpdated: new Date().toLocaleString(),
        period: "This month",
        averageHoursPerDay: presentDaysCount > 0 ? (totalWorkHours / presentDaysCount).toFixed(1) : "0.0",
        lateDays: 0, // Will be calculated below
        currentStatus: statusData ? {
          isWorking: statusData.currentlyWorking,
          onBreak: statusData.onBreak,
          todayHours: calculateHoursFromSeconds(statusData.workDurationSeconds || 0).toFixed(1),
          arrivalTime: statusData.arrivalTimeFormatted
        } : null
      });

      // Calculate on-time rate (only for standard shift employees)
      const onTimeDays = dailyData.filter(d => {
        if ((d.workDurationSeconds || 0) < MIN_PRESENT_SECONDS) return false;
        
        // Only calculate late/early for standard shift employees
        if (d.effectiveShift?.isFlexible) return true; // Flexible shift = always on-time if present
        
        const arrivalTime = getArrivalTime(d);
        if (!arrivalTime) return false;
        
        const expectedStart = d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = new Date(arrivalTime);
        expectedDate.setHours(expH, expM, 0, 0);
        
        return arrivalTime <= expectedDate;
      }).length;

      const onTimeRate = presentDaysCount > 0 ? 
        Math.round((onTimeDays / presentDaysCount) * 100) : 0;

      // Final stats update with complete data
      setStats(prev => ({
        ...prev,
        onTimeRate,
        lateDays: presentDaysCount - onTimeDays
      }));

      // Simplified calendar data processing for faster loading
      const nowMonth = now.toLocaleString("default", { month: "long" });
      const year = now.getFullYear();
      const monthIndex = now.getMonth();
      const maxDays = new Date(year, monthIndex + 1, 0).getDate();
      
      // Create a simple calendar with basic data
      const days = Array.from({ length: maxDays }, (_, i) => {
        const dayNum = i + 1;
        const dateObj = new Date(year, monthIndex, dayNum);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Find matching attendance data
        const attendanceData = dailyData.find(d => {
          const dDate = new Date(d.date);
          return dDate.getDate() === dayNum && dDate.getMonth() === monthIndex;
        });
        
        let status = "absent";
        let workingHours = "0.0";
        
        if (attendanceData) {
          const workSeconds = attendanceData.workDurationSeconds || 0;
          workingHours = calculateHoursFromSeconds(workSeconds).toFixed(1);
          
          if (workSeconds >= MIN_PRESENT_SECONDS) {
            status = "present";
          } else if (workSeconds > 0) {
            status = "half-day";
          }
        } else if (isWeekend) {
          status = "weekend";
        }
        
        return { 
          day: dayNum, 
          status, 
          workingHours
        };
      });

      const firstDayOfMonth = new Date(year, monthIndex, 1);
      const startDayOfWeek = firstDayOfMonth.getDay();

      // Set calendar data
      setCalendarData({
        month: nowMonth,
        year,
        days,
        startDayOfWeek,
        monthlyStats: {
          totalPresent: days.filter(d => d.status === "present").length,
          totalLate: days.filter(d => d.status === "late").length,
          totalAbsent: days.filter(d => d.status === "absent").length,
          totalLeave: 0, // Simplified for speed
          totalHolidays: 0 // Simplified for speed
        }
      });

      // Simplified weekly hours processing
      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyHoursData = weekDays.map(label => ({ label, hours: 0, target: 8 }));

      dailyData.forEach(d => {
        const dayOfWeek = new Date(d.date).getDay();
        if (dayOfWeek >= 0 && dayOfWeek <= 6) {
          weeklyHoursData[dayOfWeek].hours = calculateHoursFromSeconds(d.workDurationSeconds || 0);
        }
      });

      // Simplified recent activity processing
      const recent = dailyData.slice(0, 5).map(d => {
        const workSeconds = d.workDurationSeconds || 0;
        const breakSeconds = d.breakDurationSeconds || 0;
        
        let status = "Absent";
        let statusColor = "red";
        
        if (workSeconds >= MIN_PRESENT_SECONDS) {
          status = "Present";
          statusColor = "green";
        } else if (workSeconds > 0) {
          status = "Half Day";
          statusColor = "orange";
        }

        return {
          date: new Date(d.date).toISOString().split("T")[0],
          timeIn: formatTime(getArrivalTime(d)),
          timeOut: formatTime(getDepartureTime(d)),
          status,
          statusColor,
          workingHours: calculateHoursFromSeconds(workSeconds).toFixed(1) + "h",
          breakTime: calculateHoursFromSeconds(breakSeconds).toFixed(1) + "h",
          efficiency: workSeconds > 0 ? 
            Math.round((workSeconds / (8 * 3600)) * 100) + "%" : "0%"
        };
      });

      // Set all data at once
      setWeeklyHours(weeklyHoursData);
      setRecentActivity(recent);
      setCurrentStatus(statusData);

      // Cache the data for future use (use freshly computed values, not stale state)
      const cachedStats = {
        attendanceRate: weekWorkingDays > 0 ? Math.round((presentDaysCount / weekWorkingDays) * 100) : 0,
        presentDays: presentDaysCount,
        totalDays: weekWorkingDays,
        workingHours: totalWorkHours.toFixed(1),
        onTimeRate,
        lastUpdated: new Date().toLocaleString(),
        period: "This week",
        averageHoursPerDay: presentDaysCount > 0 ? (totalWorkHours / presentDaysCount).toFixed(1) : "0.0",
        lateDays: presentDaysCount - onTimeDays,
        currentStatus: statusData ? {
          isWorking: statusData.currentlyWorking,
          onBreak: statusData.onBreak,
          todayHours: calculateHoursFromSeconds(statusData.workDurationSeconds || 0).toFixed(1),
          arrivalTime: statusData.arrivalTimeFormatted
        } : null
      };

      const cachedCalendarData = {
        month: nowMonth,
        year,
        days,
        startDayOfWeek,
        monthlyStats: {
          totalPresent: days.filter(d => d.status === "present").length,
          totalLate: days.filter(d => d.status === "late").length,
          totalAbsent: days.filter(d => d.status === "absent").length,
          totalLeave: 0,
          totalHolidays: 0
        }
      };

      const cachedWeeklyHours = weeklyHoursData;
      const cachedRecentActivity = recent;
      const cachedCurrentStatus = statusData;

      setEmployeeCache(prev => {
        const newCache = new Map(prev);
        newCache.set(employeeId, {
          stats: cachedStats,
          calendarData: cachedCalendarData,
          weeklyHours: cachedWeeklyHours,
          recentActivity: cachedRecentActivity,
          currentStatus: cachedCurrentStatus,
          timestamp: Date.now()
        });
        return newCache;
      });

    } catch (error) {
      console.error("Error loading attendance data:", error);
      setError(error.response?.data?.message || error.message || "Failed to load attendance data");
    } finally {
      clearTimeout(overallTimeout);
      setLoading(false);
      setLoadingEmployeeData(false);
      setRefreshing(false);
    }
  }, [fetchCurrentStatus, employeeCache]);

  // Load employees on component mount
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Load attendance data when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      // Set loading state immediately when employee is selected
      setLoadingEmployeeData(true);
      setError(null);
      // Clear previous data to show loading state
      setStats(null);
      setCalendarData(null);
      setWeeklyHours([]);
      setRecentActivity([]);
      setCurrentStatus(null);
      
      // Then fetch the data
      fetchAttendanceData(selectedEmployee._id);
    }
  }, [selectedEmployee, fetchAttendanceData]);

  const handleRefresh = () => {
    if (selectedEmployee) {
      fetchAttendanceData(selectedEmployee._id, true);
    }
  };

  const handleEmployeeSelect = useCallback((employee) => {
    // Only reset if selecting a different employee
    if (selectedEmployee?._id !== employee._id) {
      setSelectedEmployee(employee);
      setShowDropdown(false);
      // Don't reset stats immediately - let the loading state handle the UI
      // The fetchAttendanceData will be called by useEffect and will show loading
    }
  }, [selectedEmployee]);

  // Debounce search term to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Optimize filteredEmployees calculation with useMemo
  const filteredEmployees = useMemo(() => {
    // Ensure employees is always an array
    if (!Array.isArray(employees)) return [];
    
    if (!debouncedSearchTerm.trim()) return employees.slice(0, 10); // Limit to 10 for better performance
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return employees.filter(emp => {
      try {
        return (
          (emp.name && emp.name.toLowerCase().includes(searchLower)) ||
          (emp.employeeId && emp.employeeId.toLowerCase().includes(searchLower)) ||
          (emp.department && emp.department.toLowerCase().includes(searchLower))
        );
      } catch (error) {
        console.warn('Error filtering employee:', emp, error);
        return false;
      }
    }).slice(0, 8); // Limit results for better UX
  }, [employees, debouncedSearchTerm]);

  // Handle click outside dropdown (works with Portal)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const inSelector = selectorRef.current?.contains(event.target);
      const inDropdown = dropdownRef.current?.contains(event.target);
      if (!inSelector && !inDropdown) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reposition dropdown on open/resize/scroll
  useEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
    const handler = () => updateDropdownPosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true); // capture to catch scrolls in nested containers
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [showDropdown, updateDropdownPosition]);

  // Calculate aggregate stats
  const totalEmployees = employees.length;
  const currentlyWorking = employees.filter(emp => emp.currentStatus?.currentlyWorking).length || 0;
  
  // Only show loading screen if we're loading employees AND have no employees yet
  if (loading && employees.length === 0) {
    return (
      <div className="bg-[#101525] min-h-screen flex items-center justify-center">

        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <Users className="w-6 h-6 text-purple-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-purple-200 text-lg font-medium">Loading Employee Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101525] text-gray-100 min-h-screen flex">

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="superadmin"
        onLogout={onLogout}
      />
      
      <main
        className="flex-1 p-8 space-y-8 overflow-auto transition-all duration-300"
        style={{ marginLeft: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      >
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Employee Attendance Portal
            </h1>
            <p className="text-gray-400 text-lg">Monitor and analyze employee attendance patterns</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => fetchEmployees()}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-orange-500/25 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Employees
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || !selectedEmployee}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Error Loading Data</h3>
                <p className="text-red-200 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchEmployees()}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition-all duration-300 font-medium shadow-lg hover:shadow-red-500/25 transform hover:scale-105"
            >
              Retry
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 hover:border-blue-400/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Total Employees</p>
                <p className="text-3xl font-bold text-white mt-1">{totalEmployees}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6 hover:border-green-400/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-sm font-medium">Selected Employee</p>
                <p className="text-lg font-bold text-white truncate max-w-32 mt-1">
                  {selectedEmployee ? selectedEmployee.name : 'None'}
                </p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-xl">
                <UserCheck className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 hover:border-orange-400/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-200 text-sm font-medium">Current Status</p>
                <p className="text-lg font-bold text-white mt-1">
                  {currentStatus ? (currentStatus.currentlyWorking ? 'Working' : 'Offline') : 'Unknown'}
                </p>
              </div>
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Employee Selection Section */}
        <div className="space-y-6 relative">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <User className="w-6 h-6 text-cyan-400" />
              Employee Selection
            </h2>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-cyan-400/40 transition-all duration-300">
            {/* Enhanced Search and Selection Interface */}
            <div className="space-y-6">
              {/* Search Input with Portal-based Dropdown */}
              <div className="employee-selector relative" ref={selectorRef}>
                <div className="relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2 z-10" />
                  <input
                    type="text"
                    placeholder="Search employees by name, ID, or department..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                      updateDropdownPosition();
                    }}
                    onFocus={() => {
                      setShowDropdown(true);
                      updateDropdownPosition();
                    }}
                    className="w-full pl-12 pr-12 py-4 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-lg placeholder-gray-400 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:border-slate-500/50"
                  />
                  <ChevronDown className={`w-5 h-5 text-gray-400 absolute right-4 top-1/2 transform -translate-y-1/2 transition-transform duration-200 z-10 ${showDropdown ? 'rotate-180' : ''}`} />
                </div>

                {/* Dropdown rendered via Portal to avoid clipping/stacking issues */}
                {showDropdown && (searchTerm.trim() || filteredEmployees.length > 0) &&
                  createPortal(
                    <div
                      ref={dropdownRef}
                      className="bg-slate-800/95 backdrop-blur-xl border border-slate-600/50 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-[9999]"
                      style={{
                        position: 'absolute',
                        top: dropdownCoords.top,
                        left: dropdownCoords.left,
                        width: dropdownCoords.width
                      }}
                    >
                      {filteredEmployees.length > 0 ? (
                        <div className="py-2">
                          {filteredEmployees.map((employee) => {
                            const isSelected = selectedEmployee?._id === employee._id;
                            return (
                              <div
                                key={employee._id}
                                onClick={() => handleEmployeeSelect(employee)}
                                className={`px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-slate-700/50 border-l-4 ${
                                  isSelected
                                    ? 'border-cyan-400 bg-cyan-500/10'
                                    : 'border-transparent hover:border-slate-500'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                                    isSelected
                                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                                      : 'bg-gradient-to-br from-purple-500 to-pink-600'
                                  }`}>
                                    {employee.name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`font-semibold text-sm truncate ${
                                      isSelected ? 'text-cyan-400' : 'text-white'
                                    }`}>
                                      {employee.name || 'N/A'}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                      <span>ID: {employee.employeeId || 'N/A'}</span>
                                      <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                                      <Building2 className="w-3 h-3" />
                                      <span className="truncate">{employee.department || 'N/A'}</span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : searchTerm.trim() ? (
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-600/20 to-gray-800/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Search className="w-6 h-6 text-gray-500" />
                          </div>
                          <h4 className="text-white font-medium">No employees found</h4>
                          <p className="text-gray-400 text-sm mt-1">
                            No employees match "{searchTerm}"
                          </p>
                        </div>
                      ) : null}
                    </div>,
                    document.body
                  )
                }
              </div>

              {/* Selected Employee Display */}
              {selectedEmployee && (
                <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 backdrop-blur-sm border border-slate-600/30 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {selectedEmployee.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white">{selectedEmployee.name}</h3>
                      <div className="flex items-center gap-3 text-gray-400 mt-1">
                        <span className="text-sm">ID: {selectedEmployee.employeeId}</span>
                        <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          <span className="text-sm">{selectedEmployee.department}</span>
                        </div>
                        <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                        <span className="inline-block px-2 py-1 bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-purple-300 rounded-md text-xs font-medium capitalize">
                          {selectedEmployee.role}
                        </span>
                      </div>
                    </div>
                    {currentStatus && (
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <div className={`w-3 h-3 rounded-full ${
                            currentStatus.currentlyWorking ? 'bg-green-400 animate-pulse' : 
                            currentStatus.onBreak ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
                          }`}></div>
                          <span className="text-sm font-medium text-white">
                            {currentStatus.currentlyWorking ? 'Working' : 
                             currentStatus.onBreak ? 'On Break' : 'Offline'}
                          </span>
                        </div>
                        {currentStatus.arrivalTime && (
                          <p className="text-xs text-gray-400">
                            Arrived: {currentStatus.arrivalTime}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Stats for All Employees (when no employee is selected) */}
              {!selectedEmployee && !searchTerm.trim() && employees.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">{employees.length}</div>
                    <div className="text-sm text-gray-400">Total Employees</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{currentlyWorking}</div>
                    <div className="text-sm text-gray-400">Currently Working</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">
                      {employees.filter(emp => emp.department).length}
                    </div>
                    <div className="text-sm text-gray-400">With Departments</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400 mb-1">
                      {[...new Set(employees.map(emp => emp.department).filter(Boolean))].length}
                    </div>
                    <div className="text-sm text-gray-400">Departments</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Data Display */}
        {selectedEmployee && (
          <>
            {loadingEmployeeData && (
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-8 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                    <Activity className="w-5 h-5 text-purple-400 absolute inset-0 m-auto" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-white">Loading Attendance Data</h3>
                    <p className="text-gray-400">Fetching data for {selectedEmployee.name}...</p>
                  </div>
                </div>
              </div>
            )}

            {error && !loadingEmployeeData && (
              <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-500/20 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Error Loading Data</h3>
                    <p className="text-red-200 mt-1">{error}</p>
                  </div>
                </div>
                <button 
                  onClick={() => fetchAttendanceData(selectedEmployee._id)}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition-all duration-300 font-medium shadow-lg hover:shadow-red-500/25 transform hover:scale-105"
                >
                  Retry
                </button>
              </div>
            )}

            {!loadingEmployeeData && !error && stats && (
              <>
                {/* Current Status Bar */}
                {currentStatus && (
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-4 hover:border-cyan-400/40 transition-all duration-300">
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${
                          currentStatus.currentlyWorking ? 'bg-green-400 animate-pulse' : 
                          currentStatus.onBreak ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
                        }`}></div>
                        <span className="text-white font-semibold">
                          {currentStatus.currentlyWorking ? 'Working' : 
                           currentStatus.onBreak ? 'On Break' : 'Offline'}
                        </span>
                      </div>
                      {currentStatus.arrivalTime && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>Arrived: {currentStatus.arrivalTime}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-400">
                        <Activity className="w-4 h-4" />
                        <span className="font-semibold text-white">Today: </span>
                        <span className="text-cyan-400 font-bold">{stats.currentStatus?.todayHours || '0.0'}h</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Attendance Stats */}
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden hover:border-cyan-400/40 transition-all duration-300">
                  <AttendanceStats stats={stats} />
                </div>
                
                <div className="grid lg:grid-cols-3 grid-cols-1 gap-6">
                  <div className="lg:col-span-2 flex flex-col space-y-6">
                    {/* Calendar */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden hover:border-cyan-400/40 transition-all duration-300">
                      {calendarData ? (
                        <AttendanceCalendar data={calendarData} />
                      ) : (
                        <div className="p-8">
                          <div className="animate-pulse">
                            <div className="h-8 bg-slate-700/50 rounded-xl w-1/3 mb-6"></div>
                            <div className="grid grid-cols-7 gap-3">
                              {Array.from({ length: 35 }).map((_, i) => (
                                <div key={i} className="h-12 bg-slate-700/50 rounded-lg"></div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Recent Activity */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden hover:border-cyan-400/40 transition-all duration-300">
                      {recentActivity.length > 0 ? (
                        <RecentActivityTable activities={recentActivity} />
                      ) : (
                        <div className="p-8">
                          <div className="animate-pulse">
                            <div className="h-8 bg-slate-700/50 rounded-xl w-1/3 mb-6"></div>
                            <div className="space-y-4">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-6 bg-slate-700/50 rounded-lg"></div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Weekly Hours Chart */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden hover:border-cyan-400/40 transition-all duration-300">
                      {weeklyHours.length > 0 ? (
                        <WeeklyHoursChart weeklyHours={weeklyHours} targetHours={8} />
                      ) : (
                        <div className="p-8">
                          <div className="animate-pulse">
                            <div className="h-8 bg-slate-700/50 rounded-xl w-1/3 mb-6"></div>
                            <div className="h-48 bg-slate-700/50 rounded-xl"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!selectedEmployee && !loading && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-12 text-center hover:border-cyan-400/40 transition-all duration-300">
            <div className="flex flex-col items-center space-y-6">
              <div className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl">
                <CalendarIcon className="w-12 h-12 text-blue-400" />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-bold text-white">Select an Employee</h3>
                <p className="text-gray-400 text-lg max-w-md mx-auto">
                  Use the search bar above to find and select an employee to view their detailed attendance information and analytics
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminAttendancePortal;
