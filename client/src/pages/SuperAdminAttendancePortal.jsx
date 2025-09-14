import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import AttendanceStats from "../components/attendance/AttendanceStats";
import AttendanceCalendar from "../components/attendance/AttendanceCalendar";
import WeeklyHoursChart from "../components/attendance/WeeklyHoursChart";
import RecentActivityTable from "../components/attendance/RecentActivityTable";
import Sidebar from "../components/dashboard/Sidebar";
import { RefreshCw, AlertCircle, Clock, Users, Calendar as CalendarIcon, User, Search } from "lucide-react";

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

  const token = localStorage.getItem("token");
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const MIN_PRESENT_SECONDS = 5 * 3600; // 5 hours minimum for present status

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
      
      // Calculate current week range (Monday to Sunday)
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // Create a timeout promise for the main API call
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );

      // Fetch only the essential weekly data with timeout
      const weeklyRes = await Promise.race([
        apiClient.get('/api/summary/week', {
          params: {
            userId: employeeId,
            startDate: monday.toISOString(),
            endDate: sunday.toISOString(),
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

      // Calculate working days for accurate stats
      const weekWorkingDays = calculateWorkingDays(monday, sunday, holidays, approvedLeaves);
      
      // Set complete stats with all accurate calculations
      setStats({
        attendanceRate: weekWorkingDays > 0 ? Math.round((presentDaysCount / weekWorkingDays) * 100) : 0,
        presentDays: presentDaysCount,
        totalDays: weekWorkingDays,
        workingHours: totalWorkHours.toFixed(1),
        onTimeRate: 0, // Will be calculated below
        lastUpdated: new Date().toLocaleString(),
        period: "This week",
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
      const month = now.toLocaleString("default", { month: "long" });
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
        month,
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
          timeOut: formatTime(getPunchTimeFromTimeline(d.timeline, "punch out")),
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

      // Cache the data for future use
      setEmployeeCache(prev => {
        const newCache = new Map(prev);
        newCache.set(employeeId, {
          stats,
          calendarData,
          weeklyHours,
          recentActivity,
          currentStatus: statusRes,
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
    
    if (!debouncedSearchTerm.trim()) return employees;
    
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
    });
  }, [employees, debouncedSearchTerm]);

  // Debug effect to track search state
  useEffect(() => {
    console.log('Search state:', { 
      searchTerm, 
      debouncedSearchTerm, 
      employeesLength: employees.length, 
      filteredLength: filteredEmployees.length 
    });
  }, [searchTerm, debouncedSearchTerm, employees.length, filteredEmployees.length]);

  // Only show loading screen if we're loading employees AND have no employees yet
  if (loading && employees.length === 0) {
    return (
      <div className="p-4 text-gray-100 bg-[#0f1419] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading employees...</p>
          <p className="text-sm text-gray-400 mt-2">Please wait while we fetch the employee list</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f1419] text-gray-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="superadmin"
        onLogout={onLogout}
      />
      <main className={`flex-1 p-6 space-y-6 transition-all duration-300 ${collapsed ? "ml-20" : "ml-72"}`}>
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Employee Attendance Portal</h1>
            <p className="text-gray-400 mb-3">View detailed attendance information for any employee</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchEmployees()}
              disabled={loading}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh Employees'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || !selectedEmployee}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-medium">Error</span>
            </div>
            <p className="text-gray-300 mt-2">{error}</p>
            <button
              onClick={() => fetchEmployees()}
              className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Employee Selection */}
        <div className="bg-[#161c2c] rounded-xl shadow-md p-4 border border-[#232945]">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-gray-100">Select Employee</h2>
            {employees.length > 0 && (
              <span className="text-xs text-gray-400 ml-auto">
                {employees.length} available
              </span>
            )}
          </div>
          
          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#232945] border border-[#3C3F6B] rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Employee List - Compact Table Style */}
          <div className="max-h-64 overflow-y-auto border border-[#3C3F6B] rounded-lg">
            <table className="w-full">
              <thead className="bg-[#232945] sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-300">Name</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-300">ID</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-300">Department</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-300">Role</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(filteredEmployees) && filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => {
                    const isSelected = selectedEmployee?._id === employee._id;
                    return (
                      <tr
                        key={employee._id}
                        onClick={() => handleEmployeeSelect(employee)}
                        className={`cursor-pointer transition-colors hover:bg-[#2a2f4a] ${
                          isSelected
                            ? 'bg-blue-600/20 border-l-4 border-blue-500'
                            : 'border-l-4 border-transparent'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <td className="py-2 px-3 text-sm text-gray-100 font-medium">{employee.name || 'N/A'}</td>
                        <td className="py-2 px-3 text-xs text-gray-400">{employee.employeeId || 'N/A'}</td>
                        <td className="py-2 px-3 text-xs text-gray-400">{employee.department || 'N/A'}</td>
                        <td className="py-2 px-3 text-xs text-gray-400 capitalize">{employee.role || 'N/A'}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="py-4 px-3 text-center text-gray-400">
                      {loading ? 'Loading employees...' : 'No employees found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {Array.isArray(filteredEmployees) && filteredEmployees.length === 0 && !loading && debouncedSearchTerm.trim() && (
            <div className="text-center py-6 text-gray-400">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No employees found matching "{debouncedSearchTerm}"</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Attendance Data Display */}
        {selectedEmployee && (
          <>
            {/* Selected Employee Info */}
            <div className="bg-[#161c2c] rounded-lg shadow-md p-3 border border-[#232945]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {selectedEmployee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-100">{selectedEmployee.name}</h3>
                  <p className="text-xs text-gray-400">{selectedEmployee.employeeId} • {selectedEmployee.department}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded-full capitalize">
                    {selectedEmployee.role}
                  </span>
                </div>
              </div>
            </div>

            {loadingEmployeeData && (
              <div className="bg-[#161c2c] rounded-lg p-4 border border-[#232945]">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <p className="text-sm text-gray-300">Loading attendance data for {selectedEmployee.name}...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 font-medium text-sm">Error Loading Data</span>
                </div>
                <p className="text-gray-300 text-sm mb-3">{error}</p>
                <button 
                  onClick={() => fetchAttendanceData(selectedEmployee._id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            )}

            {!loadingEmployeeData && !error && stats && (
              <>
                {/* Current Status Bar */}
                {currentStatus && (
                  <div className="flex items-center gap-4 bg-[#161c2c] rounded-lg px-4 py-2 border border-[#232945]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        currentStatus.currentlyWorking ? 'bg-green-500 animate-pulse' : 
                        currentStatus.onBreak ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-sm font-medium">
                        {currentStatus.currentlyWorking ? 'Working' : 
                         currentStatus.onBreak ? 'On Break' : 'Offline'}
                      </span>
                    </div>
                    {currentStatus.arrivalTime && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Arrived: {currentStatus.arrivalTime}</span>
                      </div>
                    )}
                    <div className="text-sm text-blue-400">
                      Today: {stats.currentStatus?.todayHours || '0.0'}h
                    </div>
                  </div>
                )}
                
                <AttendanceStats stats={stats} />
                
                <div className="grid lg:grid-cols-3 grid-cols-1 gap-6">
                  <div className="lg:col-span-2 flex flex-col space-y-6">
                    {calendarData ? (
                      <AttendanceCalendar data={calendarData} />
                    ) : (
                      <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
                        <div className="animate-pulse">
                          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
                          <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 35 }).map((_, i) => (
                              <div key={i} className="h-8 bg-gray-700 rounded"></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {recentActivity.length > 0 ? (
                      <RecentActivityTable activities={recentActivity} />
                    ) : (
                      <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
                        <div className="animate-pulse">
                          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
                          <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className="h-4 bg-gray-700 rounded"></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-6">
                    {weeklyHours.length > 0 ? (
                      <WeeklyHoursChart weeklyHours={weeklyHours} targetHours={8} />
                    ) : (
                      <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
                        <div className="animate-pulse">
                          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
                          <div className="h-32 bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!selectedEmployee && (
          <div className="text-center py-12 text-gray-400">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Employee Selected</h3>
            <p>Please select an employee from the list above to view their attendance details</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminAttendancePortal;
