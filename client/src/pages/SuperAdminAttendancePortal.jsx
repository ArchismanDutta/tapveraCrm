import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { attendanceUtils } from "../api.js";
import newAttendanceService from "../services/newAttendanceService";
import AttendanceStats from "../components/attendance/AttendanceStats";
import AttendanceCalendar from "../components/attendance/AttendanceCalendar";
import WeeklyHoursChart from "../components/attendance/WeeklyHoursChart";
import RecentActivityTable from "../components/attendance/RecentActivityTable";
import Sidebar from "../components/dashboard/Sidebar";
import { RefreshCw, AlertCircle, Clock, Users, Calendar as CalendarIcon, User, Search, UserCheck, Activity, Building2, ChevronDown } from "lucide-react";

const SuperAdminAttendancePortal = ({ onLogout }) => {
  // CRITICAL: Always use new attendance system for accurate data
  const USE_NEW_ATTENDANCE_SYSTEM = true;

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

  // Month/Year navigation state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Enhanced cache management for real-time sync
  const clearEmployeeCache = useCallback((employeeId = null) => {
    if (employeeId) {
      // Clear cache for specific employee
      setEmployeeCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(employeeId);
        console.log(`🗑️ SuperAdmin: Cleared cache for employee ${employeeId}`);
        return newCache;
      });
    } else {
      // Clear all cache
      setEmployeeCache(new Map());
      console.log('🗑️ SuperAdmin: Cleared all employee cache');
    }
  }, []);

  const [showDropdown, setShowDropdown] = useState(false);
  const [hasFullMonthData, setHasFullMonthData] = useState(false);

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
    timeout: 30000, // Increased timeout for complex attendance calculations
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

  // Use standardized utility functions
  const calculateHoursFromSeconds = attendanceUtils.calculateWorkHours;
  const formatTime = attendanceUtils.formatTime;

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

  // Use standardized utility functions for time extraction
  const getArrivalTime = attendanceUtils.getArrivalTime;
  const getDepartureTime = attendanceUtils.getDepartureTime;

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
      console.log('🆕 Fetching employee current status:', employeeId);

      // For admin access, fetch today's attendance data
      const today = new Date();
      const response = await newAttendanceService.getEmployeeAttendanceRange(employeeId, today, today);

      let statusData = null;
      if (response.success && response.data && response.data.data.length > 0) {
        // Use the first (today's) record directly
        statusData = response.data.data[0];
      }

      console.log('Current status response:', statusData);
      return statusData;
    } catch (error) {
      console.error('Error fetching current status:', error);
      console.error('Current status error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return null;
    }
  }, []);

  // Fetch attendance data for selected employee
  const fetchAttendanceData = useCallback(async (employeeId, isRefresh = false) => {
    if (!employeeId) return;

    // CRITICAL: Force refresh should ALWAYS bypass cache for 100% accuracy
    // Only use cache for initial non-refresh loads AND if cache is recent (< 30 seconds)
    if (!isRefresh && employeeCache.has(employeeId)) {
      const cachedData = employeeCache.get(employeeId);
      const cacheAge = Date.now() - (cachedData.timestamp || 0);
      const MAX_CACHE_AGE = 30000; // 30 seconds max cache age

      // Only use cache if it's fresh
      if (cacheAge < MAX_CACHE_AGE) {
        console.log(`📦 Using cached data for employee ${employeeId} (age: ${Math.round(cacheAge / 1000)}s)`);
        setStats(cachedData.stats);
        setCalendarData(cachedData.calendarData);
        setWeeklyHours(cachedData.weeklyHours);
        setRecentActivity(cachedData.recentActivity);
        setCurrentStatus(cachedData.currentStatus);
        setLoadingEmployeeData(false);
        return;
      } else {
        console.log(`🔄 Cache expired for employee ${employeeId} (age: ${Math.round(cacheAge / 1000)}s), fetching fresh data`);
        // Clear expired cache
        clearEmployeeCache(employeeId);
      }
    } else if (isRefresh) {
      console.log(`🔄 Force refresh requested for employee ${employeeId}, bypassing cache`);
      // Clear cache on refresh to ensure fresh data
      clearEmployeeCache(employeeId);
    }
    
    // Add overall timeout to prevent hanging
    const overallTimeout = setTimeout(() => {
      setError('Request timeout - The server is taking longer than expected. Please try again or contact support.');
      setLoadingEmployeeData(false);
      setRefreshing(false);
    }, 45000); // 45 second overall timeout for complex operations
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);

      const now = new Date();

      // For SuperAdmin portal, use the selected month/year for calendar navigation
      let dataStart, dataEnd;

      if (isRefresh || hasFullMonthData) {
        // On refresh or when full data is requested, use selected month for complete data
        dataStart = new Date(selectedYear, selectedMonth, 1);
        dataEnd = new Date(selectedYear, selectedMonth + 1, 0);
        setHasFullMonthData(true);
      } else {
        // Initial load: use selected month (default is current month)
        dataStart = new Date(selectedYear, selectedMonth, 1);
        dataEnd = new Date(selectedYear, selectedMonth + 1, 0);
        setHasFullMonthData(true);
      }

      dataStart.setHours(0, 0, 0, 0);
      dataEnd.setHours(23, 59, 59, 999);

      console.log('Date range strategy:', isRefresh ? 'Full month' : 'Last 2 weeks');

      // Create a timeout promise for the main API call
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - Server took longer than 30 seconds')), 30000)
      );

      // Fetch attendance data using appropriate system
      console.log('Fetching attendance data for employee:', employeeId);
      console.log('Date range:', {
        startDate: dataStart.toISOString(),
        endDate: dataEnd.toISOString()
      });

      let weeklyRes;
      if (USE_NEW_ATTENDANCE_SYSTEM) {
        console.log("🆕 SuperAdmin: Using new attendance system for data fetching");
        const response = await Promise.race([
          newAttendanceService.getEmployeeAttendanceRange(employeeId, dataStart, dataEnd),
          timeoutPromise
        ]);

        if (response.success && response.data) {
          // Store the original raw data for detailed processing
          const rawDailyData = response.data.data || [];

          console.log('🔍 Raw data from new system:', {
            recordCount: rawDailyData.length,
            sampleRecord: rawDailyData[0] ? {
              date: rawDailyData[0].date,
              fields: Object.keys(rawDailyData[0]),
              hasEvents: !!rawDailyData[0].events,
              hasCalculated: !!rawDailyData[0].calculated,
              hasTimeline: !!rawDailyData[0].timeline
            } : null
          });

          // Enhanced data processing for SuperAdmin with full detail preservation
          const enhancedDailyData = rawDailyData.map(day => {
            // Preserve all original fields and add computed ones
            const enhanced = {
              // Core fields
              date: day.date,
              workDurationSeconds: day.workDurationSeconds || day.calculated?.workDurationSeconds || 0,
              breakDurationSeconds: day.breakDurationSeconds || day.calculated?.breakDurationSeconds || 0,

              // Status fields
              isAbsent: day.isAbsent !== false, // Default to absent if not explicitly present
              isPresent: day.isPresent || day.calculated?.isPresent || false,
              isLate: day.isLate || day.calculated?.isLate || false,
              isHalfDay: day.isHalfDay || day.calculated?.isHalfDay || false,
              isWFH: day.isWFH || day.calculated?.isWFH || false,
              isEarly: day.isEarly || day.calculated?.isEarly || false,

              // Time fields
              arrivalTime: day.arrivalTime || day.calculated?.arrivalTime,
              departureTime: day.departureTime || day.calculated?.departureTime,

              // Extended details preserved
              shiftType: day.shiftType || day.calculated?.shiftType || 'standard',
              expectedStartTime: day.expectedStartTime || day.calculated?.expectedStartTime,
              expectedEndTime: day.expectedEndTime || day.calculated?.expectedEndTime,

              // Performance metrics
              efficiency: day.efficiency || day.calculated?.efficiency || 0,
              punctualityScore: day.punctualityScore || day.calculated?.punctualityScore || 0,

              // Timeline and events (preserve original structure)
              timeline: day.timeline || day.events || [],
              events: day.events || day.timeline || [],

              // Leave information
              leaveInfo: day.leaveInfo || day.calculated?.leaveInfo || null,
              leaveType: day.leaveType || day.calculated?.leaveType || null,

              // Raw data for debugging
              rawData: day,

              // Employee specific data
              employeeId: day.employeeId || day.userId,
              metadata: day.metadata || {}
            };

            console.log(`📅 Enhanced data for ${enhanced.date}:`, {
              workHours: (enhanced.workDurationSeconds / 3600).toFixed(1),
              status: {
                present: enhanced.isPresent,
                absent: enhanced.isAbsent,
                late: enhanced.isLate,
                wfh: enhanced.isWFH
              },
              times: {
                arrival: enhanced.arrivalTime,
                departure: enhanced.departureTime
              },
              eventCount: enhanced.timeline?.length || 0
            });

            return enhanced;
          });

          // Create a weekly-like response structure for legacy compatibility
          const weeklyResponse = {
            success: true,
            data: {
              dailyData: enhancedDailyData,
              weeklyTotals: response.data.summary || {
                totalWorkDays: 0,
                totalWorkHours: 0,
                averagePunctualityRate: 0
              }
            }
          };

          // Use enhanced data directly instead of lossy conversion
          weeklyRes = {
            data: {
              dailyData: enhancedDailyData,
              weeklySummary: {
                // Compute summary from enhanced data
                presentDays: enhancedDailyData.filter(d => d.isPresent).length,
                totalWork: response.data.summary?.totalWorkHours ?
                  `${response.data.summary.totalWorkHours.toFixed(1)}h` :
                  `${(enhancedDailyData.reduce((sum, d) => sum + (d.workDurationSeconds || 0), 0) / 3600).toFixed(1)}h`,
                totalBreak: response.data.summary?.totalBreakHours ?
                  `${response.data.summary.totalBreakHours.toFixed(1)}h` :
                  `${(enhancedDailyData.reduce((sum, d) => sum + (d.breakDurationSeconds || 0), 0) / 3600).toFixed(1)}h`,
                onTimeRate: response.data.summary?.averagePunctualityRate ?
                  `${Math.round(response.data.summary.averagePunctualityRate)}%` :
                  `${Math.round((enhancedDailyData.filter(d => d.isPresent && !d.isLate).length / Math.max(enhancedDailyData.filter(d => d.isPresent).length, 1)) * 100)}%`,
                quickStats: {
                  lateArrivals: enhancedDailyData.filter(d => d.isLate).length,
                  earlyArrivals: enhancedDailyData.filter(d => d.isEarly).length,
                  wfhDays: enhancedDailyData.filter(d => d.isWFH).length,
                  perfectDays: enhancedDailyData.filter(d => d.isPresent && !d.isLate && !d.isEarly).length
                }
              }
            }
          };

          console.log('🎯 Enhanced SuperAdmin data:', {
            originalCount: rawDailyData.length,
            enhancedCount: enhancedDailyData.length,
            preservedFields: enhancedDailyData[0] ? Object.keys(enhancedDailyData[0]).length : 0,
            summary: weeklyRes.data.weeklySummary
          });
        } else {
          throw new Error('Invalid response from new attendance system');
        }
      } else {
        console.log("📍 SuperAdmin: Using legacy attendance system");
        weeklyRes = await Promise.race([
          apiClient.get('/api/summary/week', {
            params: {
              userId: employeeId,
              startDate: dataStart.toISOString(),
              endDate: dataEnd.toISOString(),
              _t: Date.now(), // Cache-busting parameter
            },
          }),
          timeoutPromise
        ]);
      }

      console.log('Weekly data response:', weeklyRes.data);

      // Set basic stats immediately for faster UI response
      const { dailyData = [] } = weeklyRes.data || {};

      if (!Array.isArray(dailyData)) {
        throw new Error('Invalid response format: dailyData is not an array');
      }

      console.log('Daily data received:', dailyData.length, 'records');

      // Calculate total work hours with enhanced validation for new system data
      const totalWorkHours = dailyData.reduce((sum, d) => {
        const workSeconds = d.workDurationSeconds || 0;

        // Log any unrealistic values (more than 24 hours = 86400 seconds)
        if (workSeconds > 86400) {
          console.warn(`⚠️ Unrealistic work duration detected for ${d.date}:`, {
            workDurationSeconds: workSeconds,
            workHours: (workSeconds / 3600).toFixed(1),
            recordId: d._id
          });
          // Cap at 24 hours maximum for calculation purposes
          return sum + Math.min(workSeconds, 86400) / 3600;
        }

        return sum + (workSeconds / 3600);
      }, 0);

      // Enhanced attendance status determination that works with converted data
      let presentDaysCount = 0;
      let lateDaysCount = 0;
      let halfDayCount = 0;
      let absentDaysCount = 0;
      let wfhDaysCount = 0;

      dailyData.forEach(d => {
        // Use the data directly from the converted format
        if (d.isWFH) {
          wfhDaysCount++;
          presentDaysCount++; // WFH counts as present
        } else if (d.isAbsent) {
          absentDaysCount++;
        } else if (d.isHalfDay) {
          halfDayCount++;
          presentDaysCount++; // Half day counts as present
        } else if (d.isLate) {
          lateDaysCount++;
          presentDaysCount++; // Late but present
        } else if (!d.isAbsent && (d.workDurationSeconds || 0) > 0) {
          presentDaysCount++; // Regular present day
        } else {
          absentDaysCount++;
        }
      });

      console.log('Enhanced stats calculated:', {
        presentDaysCount,
        lateDaysCount,
        halfDayCount,
        absentDaysCount,
        wfhDaysCount,
        totalWorkHours: totalWorkHours.toFixed(1),
        dataSourceSystem: USE_NEW_ATTENDANCE_SYSTEM ? 'New System' : 'Legacy System'
      });

      // Fetch additional data in parallel with shorter timeouts
      console.log('Fetching additional data...');
      const [statusRes, leavesRes, holidaysRes] = await Promise.allSettled([
        fetchCurrentStatus(employeeId),
        apiClient.get(`/api/leaves/employee/${employeeId}`, { timeout: 3000 }).catch((err) => {
          console.warn('Leaves API failed:', err.message);
          return { data: [] };
        }),
        apiClient.get('/api/holidays?shift=standard', { timeout: 3000 }).catch((err) => {
          console.warn('Holidays API failed:', err.message);
          return { data: [] };
        })
      ]);

      console.log('Promise.allSettled results:', {
        statusRes: statusRes.status,
        leavesRes: leavesRes.status,
        holidaysRes: holidaysRes.status
      });

      // Process the additional data results with better error handling
      const statusData = statusRes.status === 'fulfilled' ? statusRes.value : null;

      let approvedLeaves = [];
      if (leavesRes.status === 'fulfilled' && leavesRes.value?.data) {
        try {
          approvedLeaves = Array.isArray(leavesRes.value.data) ?
            leavesRes.value.data.filter(l => l.status?.toLowerCase() === "approved") : [];
        } catch (err) {
          console.warn('Error processing leaves data:', err);
          approvedLeaves = [];
        }
      }

      let holidays = [];
      if (holidaysRes.status === 'fulfilled' && holidaysRes.value?.data) {
        try {
          holidays = Array.isArray(holidaysRes.value.data) ? holidaysRes.value.data : [];
        } catch (err) {
          console.warn('Error processing holidays data:', err);
          holidays = [];
        }
      }

      console.log('Processed additional data:', {
        statusData: statusData ? 'loaded' : 'null',
        approvedLeaves: approvedLeaves.length,
        holidays: holidays.length
      });

      // Calculate working days for accurate stats over the data range
      const weekWorkingDays = calculateWorkingDays(dataStart, dataEnd, holidays, approvedLeaves);
      
      // Calculate on-time rate properly (presentDaysCount already includes late and half-day)
      const totalPresentDays = presentDaysCount;
      const onTimeDays = presentDaysCount - lateDaysCount; // Exclude late days from on-time calculation
      const onTimeRate = totalPresentDays > 0 ? Math.round((onTimeDays / totalPresentDays) * 100) : 0;

      // Set complete stats with enhanced accuracy for new system
      const enhancedStats = {
        attendanceRate: weekWorkingDays > 0 ? Math.min(100, Math.floor((totalPresentDays / weekWorkingDays) * 100)) : 0,
        presentDays: totalPresentDays,
        totalDays: weekWorkingDays,
        workingHours: totalWorkHours.toFixed(1),
        onTimeRate: onTimeRate, // Already a number
        lastUpdated: new Date().toLocaleString(),
        period: isRefresh || hasFullMonthData ? "This month" : "Last 2 weeks",
        averageHoursPerDay: totalPresentDays > 0 ? (totalWorkHours / totalPresentDays).toFixed(1) : "0.0",
        lateDays: lateDaysCount,
        halfDays: halfDayCount,
        absentDays: absentDaysCount,
        wfhDays: wfhDaysCount,
        // Enhanced breakdown for better accuracy
        breakdown: {
          onTime: onTimeDays,
          late: lateDaysCount,
          halfDay: halfDayCount,
          wfh: wfhDaysCount,
          absent: absentDaysCount
        },
        currentStatus: statusData ? {
          isWorking: Boolean(statusData.currentlyWorking),
          onBreak: Boolean(statusData.onBreak),
          todayHours: ((statusData.workDurationSeconds || 0) / 3600).toFixed(1),
          arrivalTime: statusData.arrivalTimeFormatted || (statusData.arrivalTime ? new Date(statusData.arrivalTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }) : null)
        } : null,
        // System tracking for debugging
        systemInfo: {
          useNewSystem: USE_NEW_ATTENDANCE_SYSTEM,
          dataConversion: USE_NEW_ATTENDANCE_SYSTEM ? 'Converted from new system' : 'Legacy data',
          recordCount: dailyData.length
        }
      };

      console.log('📊 Enhanced stats for SuperAdmin portal:', enhancedStats);
      setStats(enhancedStats);

      console.log('Stats calculation completed:', {
        attendanceRate: weekWorkingDays > 0 ? Math.floor((totalPresentDays / weekWorkingDays) * 100) : 0,
        presentDays: totalPresentDays,
        lateDays: lateDaysCount,
        onTimeRate: `${onTimeRate}%`
      });

      // Calendar data processing using selected month/year from state
      const monthDate = new Date(selectedYear, selectedMonth, 1);
      const nowMonth = monthDate.toLocaleString("default", { month: "long" });
      const year = selectedYear;
      const monthIndex = selectedMonth;
      const maxDays = new Date(year, monthIndex + 1, 0).getDate();

      console.log(`📅 Building calendar for: ${nowMonth} ${year} (selected: ${selectedMonth}/${selectedYear})`);

      console.log('Calendar processing for:', hasFullMonthData ? 'Full month' : 'Recent data only');
      
      // Create enhanced calendar data with complete attendance information
      const days = Array.from({ length: maxDays }, (_, i) => {
        const dayNum = i + 1;
        const dateObj = new Date(year, monthIndex, dayNum);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Enhanced date matching with multiple fallback strategies
        let attendanceData = null;
        const targetDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        // Strategy 1: Direct date string matching (most reliable)
        attendanceData = dailyData.find(d => {
          if (!d.date) return false;

          let dateStr;
          if (typeof d.date === 'string') {
            dateStr = d.date.includes('T') ? d.date.split('T')[0] : d.date;
          } else {
            dateStr = new Date(d.date).toISOString().split('T')[0];
          }

          return dateStr === targetDateStr;
        });

        // Strategy 2: Date object comparison (fallback)
        if (!attendanceData) {
          attendanceData = dailyData.find(d => {
            if (!d.date) return false;

            try {
              const dDate = new Date(d.date);
              // Normalize to avoid timezone issues
              const normalizedDate = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
              const targetDate = new Date(year, monthIndex, dayNum);

              return normalizedDate.getTime() === targetDate.getTime();
            } catch (err) {
              console.warn('Date parsing error for calendar:', d.date, err);
              return false;
            }
          });
        }

        // Strategy 3: Flexible day/month/year matching (last resort)
        if (!attendanceData) {
          attendanceData = dailyData.find(d => {
            if (!d.date) return false;

            try {
              const dDate = new Date(d.date);
              return dDate.getDate() === dayNum && dDate.getMonth() === monthIndex && dDate.getFullYear() === year;
            } catch (err) {
              return false;
            }
          });
        }

        // Log matching results for debugging
        if (dayNum <= 3) { // Only log first few days to avoid spam
          console.log(`📅 Calendar matching for ${targetDateStr} (day ${dayNum}):`, {
            found: !!attendanceData,
            availableDates: dailyData.slice(0, 3).map(d => ({
              original: d.date,
              normalized: typeof d.date === 'string'
                ? (d.date.includes('T') ? d.date.split('T')[0] : d.date)
                : new Date(d.date).toISOString().split('T')[0]
            })),
            matchedData: attendanceData ? {
              date: attendanceData.date,
              workHours: (attendanceData.workDurationSeconds / 3600).toFixed(1),
              status: {
                present: attendanceData.isPresent,
                absent: attendanceData.isAbsent,
                late: attendanceData.isLate,
                wfh: attendanceData.isWFH
              }
            } : null
          });
        }

        let status = "absent";
        let workingHours = "0.0";
        let arrivalTime = null;
        let departureTime = null;
        let metadata = {};

        if (attendanceData) {
          // Enhanced status determination using all available enhanced data
          console.log(`📅 Processing calendar status for ${targetDateStr}:`, {
            isPresent: attendanceData.isPresent,
            isAbsent: attendanceData.isAbsent,
            isWFH: attendanceData.isWFH,
            isLate: attendanceData.isLate,
            isHalfDay: attendanceData.isHalfDay,
            isEarly: attendanceData.isEarly,
            workSeconds: attendanceData.workDurationSeconds,
            leaveInfo: attendanceData.leaveInfo
          });

          // Priority-based status determination for accurate calendar display
          if (attendanceData.isWFH) {
            status = "wfh";
          } else if (attendanceData.leaveInfo && attendanceData.leaveInfo.type) {
            // Handle different leave types
            switch (attendanceData.leaveInfo.type) {
              case 'sick':
                status = "sick-leave";
                break;
              case 'vacation':
                status = "vacation";
                break;
              case 'personal':
                status = "personal-leave";
                break;
              case 'halfDay':
                status = "half-day-leave";
                break;
              default:
                status = "approved-leave";
            }
          } else if (attendanceData.isAbsent && !attendanceData.isPresent) {
            status = "absent";
          } else if (attendanceData.isHalfDay && attendanceData.isPresent) {
            status = "half-day";
          } else if (attendanceData.isLate && attendanceData.isPresent) {
            status = "late";
          } else if (attendanceData.isEarly && attendanceData.isPresent) {
            status = "early";
          } else if (attendanceData.isPresent || (attendanceData.workDurationSeconds && attendanceData.workDurationSeconds > 0)) {
            status = "present";
          } else {
            status = "absent";
          }

          // Calculate working hours with validation
          const rawWorkSeconds = attendanceData.workDurationSeconds || 0;
          const cappedWorkSeconds = Math.min(rawWorkSeconds, 86400); // Cap at 24 hours
          workingHours = (cappedWorkSeconds / 3600).toFixed(1);

          // FIXED: Extract and format arrival/departure times properly (same logic as Recent Activity)
          // Try direct fields first and format immediately
          if (attendanceData.arrivalTime) {
            try {
              const arrivalDate = new Date(attendanceData.arrivalTime);
              if (!isNaN(arrivalDate.getTime())) {
                arrivalTime = arrivalDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              }
            } catch (err) {
              console.warn('Invalid arrivalTime format:', attendanceData.arrivalTime);
            }
          }

          if (attendanceData.departureTime) {
            try {
              const departureDate = new Date(attendanceData.departureTime);
              if (!isNaN(departureDate.getTime())) {
                departureTime = departureDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              }
            } catch (err) {
              console.warn('Invalid departureTime format:', attendanceData.departureTime);
            }
          }

          // If not available, extract from timeline and format
          if (!arrivalTime && attendanceData.timeline && Array.isArray(attendanceData.timeline)) {
            const punchInEvent = attendanceData.timeline.find(event =>
              event.type && (event.type.toLowerCase().includes('punch in') || event.type === 'PUNCH_IN')
            );
            if (punchInEvent) {
              const eventTime = punchInEvent.time || punchInEvent.timestamp;
              if (eventTime) {
                try {
                  const timeDate = new Date(eventTime);
                  if (!isNaN(timeDate.getTime())) {
                    arrivalTime = timeDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });
                  }
                } catch (err) {
                  console.warn('Invalid punch in time:', eventTime);
                }
              }
            }
          }

          if (!departureTime && attendanceData.timeline && Array.isArray(attendanceData.timeline)) {
            const punchOutEvent = [...attendanceData.timeline].reverse().find(event =>
              event.type && (event.type.toLowerCase().includes('punch out') || event.type === 'PUNCH_OUT')
            );
            if (punchOutEvent) {
              const eventTime = punchOutEvent.time || punchOutEvent.timestamp;
              if (eventTime) {
                try {
                  const timeDate = new Date(eventTime);
                  if (!isNaN(timeDate.getTime())) {
                    departureTime = timeDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });
                  }
                } catch (err) {
                  console.warn('Invalid punch out time:', eventTime);
                }
              }
            }
          }

          // CRITICAL: Calculate break duration - use provided value OR calculate from timeline
          let breakSeconds = attendanceData.breakDurationSeconds || 0;

          // If no breakDurationSeconds provided, calculate from timeline as fallback
          if (breakSeconds === 0 && attendanceData.timeline && Array.isArray(attendanceData.timeline)) {
            let currentBreakStart = null;

            for (const event of attendanceData.timeline) {
              const eventTime = new Date(event.time);
              const eventType = String(event.type || '').toUpperCase();

              if (eventType === 'BREAK_START' || eventType.includes('BREAK START')) {
                currentBreakStart = eventTime;
              } else if ((eventType === 'BREAK_END' || eventType.includes('BREAK END') || eventType.includes('RESUME WORK')) && currentBreakStart) {
                breakSeconds += (eventTime - currentBreakStart) / 1000;
                currentBreakStart = null;
              }
            }

            console.log(`⚠️ Calculated break duration from timeline: ${breakSeconds}s`);
          }

          const breakMinutes = Math.round(breakSeconds / 60);
          const breakHours = (breakSeconds / 3600).toFixed(1);
          const efficiency = attendanceData.workDurationSeconds > 0 ?
            Math.round((attendanceData.workDurationSeconds / (8 * 3600)) * 100) : 0;

          console.log(`📊 Processing calendar data for ${targetDateStr}:`, {
            workSeconds: attendanceData.workDurationSeconds,
            breakSeconds: breakSeconds,
            breakMinutes: breakMinutes,
            breakHours: breakHours,
            hasTimeline: !!attendanceData.timeline,
            timelineLength: attendanceData.timeline?.length || 0,
            source: attendanceData.breakDurationSeconds > 0 ? 'API' : 'Timeline Calculation'
          });

          // Calculate break sessions count from timeline
          // CRITICAL: New system uses 'BREAK_START', legacy uses 'Break Start (Type)'
          let breakSessions = 0;
          if (attendanceData.timeline && Array.isArray(attendanceData.timeline)) {
            breakSessions = attendanceData.timeline.filter(event => {
              if (!event.type) return false;
              const eventType = String(event.type).toUpperCase();
              return eventType === 'BREAK_START' ||
                     eventType.includes('BREAK START') ||
                     eventType.includes('BREAK_START');
            }).length;

            console.log(`📊 Break sessions calculated for day:`, {
              totalEvents: attendanceData.timeline.length,
              breakSessions: breakSessions,
              eventTypes: attendanceData.timeline.map(e => e.type)
            });
          }

          // Calculate "late by" minutes
          let lateMinutes = 0;
          if (attendanceData.isLate && attendanceData.arrivalTime && attendanceData.expectedStartTime) {
            try {
              const arrivalDate = new Date(attendanceData.arrivalTime);
              const [expHour, expMin] = attendanceData.expectedStartTime.split(':').map(Number);
              const expectedDate = new Date(arrivalDate);
              expectedDate.setHours(expHour, expMin, 0, 0);

              if (!isNaN(arrivalDate.getTime()) && !isNaN(expectedDate.getTime()) && arrivalDate > expectedDate) {
                lateMinutes = Math.round((arrivalDate - expectedDate) / 60000);
              }
            } catch (err) {
              console.warn('Error calculating late minutes:', err);
            }
          }

          // Calculate net hours (work + break)
          const netHours = (rawWorkSeconds + (attendanceData.breakDurationSeconds || 0)) / 3600;

          metadata = {
            // CRITICAL: Fields expected by AttendanceCalendar tooltip
            breakSessions: breakSessions,
            totalBreakTime: breakHours,
            lateMinutes: lateMinutes,

            // Core time data
            workDurationSeconds: attendanceData.workDurationSeconds || 0,
            breakDurationSeconds: attendanceData.breakDurationSeconds || 0,
            breakDurationMinutes: breakMinutes,
            actualWorkHours: (rawWorkSeconds / 3600).toFixed(1),
            cappedWorkHours: (cappedWorkSeconds / 3600).toFixed(1),
            netHours: netHours,

            // Status flags
            isPresent: attendanceData.isPresent === true,
            isAbsent: attendanceData.isAbsent === true,
            isLate: attendanceData.isLate === true,
            isEarly: attendanceData.isEarly === true,
            isWFH: attendanceData.isWFH === true,
            isHalfDay: attendanceData.isHalfDay === true,
            isFullDay: rawWorkSeconds >= (6.5 * 3600),
            isFlexible: attendanceData.shiftType === 'flexible' || attendanceData.shiftType === 'flexiblePermanent',

            // Time tracking (use formatted strings from above)
            arrivalTime: arrivalTime || null, // Use the formatted arrivalTime variable
            departureTime: departureTime || null, // Use the formatted departureTime variable
            expectedStartTime: attendanceData.expectedStartTime,
            expectedEndTime: attendanceData.expectedEndTime,

            // Shift info
            effectiveShift: attendanceData.expectedStartTime && attendanceData.expectedEndTime ? {
              start: attendanceData.expectedStartTime,
              end: attendanceData.expectedEndTime
            } : null,

            // Work details
            shiftType: attendanceData.shiftType || 'standard',
            efficiency: efficiency,
            punctualityScore: attendanceData.punctualityScore || 0,

            // Leave and event data
            leaveInfo: attendanceData.leaveInfo || null,
            leaveType: attendanceData.leaveType || null,
            timeline: attendanceData.timeline || [],
            events: attendanceData.events || [],
            eventCount: (attendanceData.timeline || []).length,

            // Employee data
            employeeId: attendanceData.employeeId,

            // System information
            dataSource: USE_NEW_ATTENDANCE_SYSTEM ? 'New System (Enhanced)' : 'Legacy System',
            rawDataFields: Object.keys(attendanceData).length,
            hasDetailedData: !!(attendanceData.timeline || attendanceData.events),

            // Additional computed metrics
            workMinutes: Math.round(rawWorkSeconds / 60),
            breakHours: breakHours,
            netWorkTime: Math.max(0, rawWorkSeconds - (attendanceData.breakDurationSeconds || 0)),
            isProductiveDay: efficiency >= 80
          };

          console.log(`Calendar day ${dayNum}:`, {
            status: status,
            workingHours: workingHours,
            rawSeconds: rawWorkSeconds,
            workHours: (rawWorkSeconds / 3600).toFixed(1),
            isLate: attendanceData.isLate,
            isHalfDay: attendanceData.isHalfDay,
            isFullDay: attendanceData.isFullDay
          });

        } else if (isWeekend) {
          status = "weekend";
          metadata = { isWeekend: true };
        } else {
          // Future dates or days with no data
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dateObj.setHours(0, 0, 0, 0);

          if (dateObj > today) {
            status = "default"; // Future date
            metadata = { isFuture: true };
          } else {
            status = "absent"; // Past date with no data
            metadata = { noData: true };
          }
        }

        return {
          day: dayNum,
          status,
          workingHours,
          // FIXED: Times are already formatted strings, don't convert again
          arrivalTime: arrivalTime || null,
          departureTime: departureTime || null,
          metadata
        };
      });

      const firstDayOfMonth = new Date(year, monthIndex, 1);
      const startDayOfWeek = firstDayOfMonth.getDay();

      // Calculate enhanced monthly stats
      const monthlyStats = {
        totalPresent: days.filter(d => d.status === "present").length,
        totalLate: days.filter(d => d.status === "late").length,
        totalHalfDay: days.filter(d => d.status === "half-day").length,
        totalAbsent: days.filter(d => d.status === "absent").length,
        totalWeekend: days.filter(d => d.status === "weekend").length,
        totalLeave: 0, // Could be enhanced later
        totalHolidays: 0, // Could be enhanced later
        totalWorkingDays: days.filter(d => !["weekend", "default"].includes(d.status)).length,
        totalWorkHours: days.reduce((sum, d) => sum + parseFloat(d.workingHours || 0), 0).toFixed(1)
      };

      console.log('Calendar monthly stats:', monthlyStats);

      // Set calendar data with enhanced information
      setCalendarData({
        month: nowMonth,
        year,
        days,
        startDayOfWeek,
        monthlyStats
      });

      // Enhanced weekly hours processing with accurate calculations
      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyHoursData = weekDays.map(label => ({ label, hours: 0, target: 8 }));

      console.log('📊 Processing weekly hours data for chart...');

      dailyData.forEach((d, index) => {
        // Enhanced date parsing for weekly chart with comprehensive validation
        let dayOfWeek;
        let dateString;

        try {
          // Multiple date parsing strategies for robustness
          if (typeof d.date === 'string') {
            dateString = d.date.includes('T') ? d.date.split('T')[0] : d.date;
          } else if (d.date instanceof Date) {
            dateString = d.date.toISOString().split('T')[0];
          } else {
            console.warn(`Invalid date format in record ${index}:`, d.date);
            return;
          }

          // Parse day of week with timezone consideration
          dayOfWeek = new Date(dateString + 'T12:00:00').getDay();

          // Validate day of week
          if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            console.warn(`Invalid day of week for date ${dateString}:`, dayOfWeek);
            return;
          }

        } catch (err) {
          console.error('Error parsing date for weekly chart:', {
            date: d.date,
            type: typeof d.date,
            index: index,
            error: err.message
          });
          return;
        }

        // Enhanced work hours calculation with validation
        const workSeconds = d.workDurationSeconds || 0;

        // Validate work seconds
        if (typeof workSeconds !== 'number' || workSeconds < 0) {
          console.warn(`Invalid work duration for ${dateString}:`, workSeconds);
          return;
        }

        // Cap at 24 hours for weekly chart display and convert to hours
        const cappedSeconds = Math.min(workSeconds, 86400);
        const workHours = cappedSeconds / 3600;

        // Additional validation for realistic work hours
        if (workHours > 24) {
          console.warn(`Unrealistic work hours for ${dateString}: ${workHours.toFixed(1)}h`);
        }

        // Accumulate hours for the day (in case there are multiple records for the same day)
        const previousHours = weeklyHoursData[dayOfWeek].hours;
        weeklyHoursData[dayOfWeek].hours += workHours;

        // Enhanced logging for debugging
        if (workHours > 0) {
          console.log(`📅 ${weekDays[dayOfWeek]} (${dateString}): +${workHours.toFixed(1)}h (total: ${weeklyHoursData[dayOfWeek].hours.toFixed(1)}h)`, {
            originalSeconds: workSeconds,
            cappedSeconds: cappedSeconds,
            isWFH: d.isWFH,
            isPresent: d.isPresent,
            status: d.isAbsent ? 'absent' : d.isWFH ? 'wfh' : d.isLate ? 'late' : 'present'
          });
        }
      });

      // Round final hours for display
      weeklyHoursData.forEach(day => {
        day.hours = Math.round(day.hours * 10) / 10; // Round to 1 decimal place
      });

      console.log('📊 Final weekly hours data:', weeklyHoursData);

      // Enhanced recent activity processing with accurate data handling
      console.log('📋 Processing recent activity data...');

      const recent = dailyData
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(d => {
          // Enhanced status determination for new system data
          let status, statusColor;

          if (d.isWFH) {
            status = 'Work From Home';
            statusColor = 'blue';
          } else if (d.isAbsent) {
            if (d.leaveInfo && d.leaveInfo.type !== 'workFromHome') {
              status = d.leaveInfo.type === 'halfDay' ? 'Half Day Leave' : 'On Leave';
              statusColor = 'purple';
            } else {
              status = 'Absent';
              statusColor = 'red';
            }
          } else if (d.isHalfDay && !d.leaveInfo) {
            status = 'Half Day';
            statusColor = 'orange';
          } else if (d.isLate) {
            status = 'Late';
            statusColor = 'yellow';
          } else if (!d.isAbsent && (d.workDurationSeconds || 0) > 0) {
            status = 'Present';
            statusColor = 'green';
          } else {
            status = 'Absent';
            statusColor = 'red';
          }

          // Enhanced time extraction from timeline or direct fields
          let timeIn = null, timeOut = null;

          // Try direct fields first
          if (d.arrivalTime) {
            timeIn = new Date(d.arrivalTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          }

          if (d.departureTime) {
            timeOut = new Date(d.departureTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          }

          // If not available, extract from timeline
          if (!timeIn && d.timeline && Array.isArray(d.timeline)) {
            const punchInEvent = d.timeline.find(event =>
              event.type && (event.type.toLowerCase().includes('punch in') || event.type === 'PUNCH_IN')
            );
            if (punchInEvent) {
              const eventTime = punchInEvent.time || punchInEvent.timestamp;
              if (eventTime) {
                timeIn = new Date(eventTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              }
            }
          }

          if (!timeOut && d.timeline && Array.isArray(d.timeline)) {
            const punchOutEvent = [...d.timeline].reverse().find(event =>
              event.type && (event.type.toLowerCase().includes('punch out') || event.type === 'PUNCH_OUT')
            );
            if (punchOutEvent) {
              const eventTime = punchOutEvent.time || punchOutEvent.timestamp;
              if (eventTime) {
                timeOut = new Date(eventTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              }
            }
          }

          // Calculate accurate metrics
          const workSeconds = d.workDurationSeconds || 0;
          const cappedWorkSeconds = Math.min(workSeconds, 86400);
          const workHours = (cappedWorkSeconds / 3600).toFixed(1);
          const breakMinutes = Math.round((d.breakDurationSeconds || 0) / 60);
          const efficiency = workSeconds > 0 ? Math.floor((workSeconds / (8 * 3600)) * 100) : 0;

          const activity = {
            date: typeof d.date === 'string' ?
              (d.date.includes('T') ? d.date.split('T')[0] : d.date) :
              d.date.toISOString().split('T')[0],
            timeIn: timeIn || '--',
            timeOut: timeOut || '--',
            status: status,
            statusColor: statusColor,
            workingHours: workHours + "h",
            breakTime: `${breakMinutes}m`,
            efficiency: `${efficiency}%`,
            // Additional metadata for debugging
            metadata: {
              rawWorkSeconds: workSeconds,
              rawBreakSeconds: d.breakDurationSeconds || 0,
              isWFH: d.isWFH || false,
              dataSource: USE_NEW_ATTENDANCE_SYSTEM ? 'New System' : 'Legacy System'
            }
          };

          console.log(`📋 Recent activity for ${activity.date}:`, activity);
          return activity;
        });

      console.log('📋 Final recent activity data:', recent);

      // 🎯 COMPREHENSIVE DATA VALIDATION SUMMARY
      console.log('🎯 ===== EMPLOYEE DETAIL ACCURACY VALIDATION =====');

      // Validate all components have accurate data
      const validationSummary = {
        // Raw data validation
        rawDataCount: dailyData.length,
        enhancedDataFields: dailyData[0] ? Object.keys(dailyData[0]).length : 0,
        hasTimelineData: dailyData.filter(d => d.timeline && d.timeline.length > 0).length,
        hasWorkData: dailyData.filter(d => d.workDurationSeconds > 0).length,

        // Calendar validation
        calendarDays: days.length,
        calendarDaysWithData: days.filter(d => d.status !== 'absent' && d.status !== 'weekend' && d.status !== 'default').length,
        calendarValidStatuses: ['present', 'late', 'early', 'half-day', 'wfh', 'sick-leave', 'vacation', 'personal-leave'],
        calendarStatusBreakdown: {
          present: days.filter(d => d.status === 'present').length,
          late: days.filter(d => d.status === 'late').length,
          wfh: days.filter(d => d.status === 'wfh').length,
          absent: days.filter(d => d.status === 'absent').length,
          weekend: days.filter(d => d.status === 'weekend').length
        },

        // Weekly hours validation
        weeklyHoursTotalHours: weeklyHoursData.reduce((sum, day) => sum + day.hours, 0),
        weeklyHoursValidDays: weeklyHoursData.filter(day => day.hours > 0).length,
        weeklyHoursBreakdown: weeklyHoursData.map(day => ({
          day: day.label,
          hours: day.hours
        })),

        // Recent activity validation
        recentActivityCount: recent.length,
        recentActivityWithTimes: recent.filter(r => r.timeIn !== '--' && r.timeOut !== '--').length,
        recentActivityStatusTypes: [...new Set(recent.map(r => r.status))],

        // Current status validation
        currentStatusValid: !!statusData,
        currentStatusData: statusData ? {
          working: statusData.currentlyWorking,
          onBreak: statusData.onBreak,
          hasArrival: !!statusData.arrivalTime || !!statusData.arrivalTimeFormatted,
          todayHours: statusData.workDurationSeconds ? (statusData.workDurationSeconds / 3600).toFixed(1) : '0'
        } : null,

        // System information
        dataSource: USE_NEW_ATTENDANCE_SYSTEM ? 'Enhanced New System' : 'Legacy System',
        processingTimestamp: new Date().toISOString(),
        dataIntegrityScore: Math.round(
          ((dailyData.length > 0 ? 25 : 0) +
           (days.filter(d => d.workingHours !== '0.0').length > 0 ? 25 : 0) +
           (weeklyHoursData.filter(d => d.hours > 0).length > 0 ? 25 : 0) +
           (recent.length > 0 ? 25 : 0))
        )
      };

      console.log('📊 Employee Detail Validation Results:', validationSummary);

      // Data quality checks
      const qualityChecks = {
        dateConsistency: dailyData.every(d => d.date),
        workDataRealistic: dailyData.every(d => (d.workDurationSeconds || 0) <= 86400),
        timelineIntegrity: dailyData.filter(d => d.timeline).every(d => Array.isArray(d.timeline)),
        statusLogic: dailyData.every(d => {
          if (d.isAbsent) return (d.workDurationSeconds || 0) === 0 || d.isWFH;
          return true;
        }),
        calendarDateMatching: days.every(day => {
          if (day.status === 'weekend' || day.status === 'default') return true;
          return day.day >= 1 && day.day <= 31;
        })
      };

      console.log('✅ Data Quality Checks:', qualityChecks);

      if (Object.values(qualityChecks).every(check => check)) {
        console.log('🎉 ALL EMPLOYEE DETAIL COMPONENTS PASS VALIDATION');
      } else {
        console.warn('⚠️ Some validation checks failed:',
          Object.entries(qualityChecks).filter(([key, value]) => !value)
        );
      }

      // Set all data at once with comprehensive logging
      console.log('🎯 Setting final component data with validated accuracy:', {
        weeklyHoursDataLength: weeklyHoursData.length,
        recentActivityLength: recent.length,
        calendarDaysCount: days.length,
        hasCurrentStatus: !!statusData,
        dataIntegrityScore: validationSummary.dataIntegrityScore,
        systemUsed: USE_NEW_ATTENDANCE_SYSTEM ? 'Enhanced New Attendance System' : 'Legacy System'
      });

      setWeeklyHours(weeklyHoursData);
      setRecentActivity(recent);
      setCurrentStatus(statusData);

      // CRITICAL: Cache data must match the exact format of enhancedStats for consistency
      // Use the EXACT same objects that were set to state to prevent any discrepancies
      setEmployeeCache(prev => {
        const newCache = new Map(prev);
        newCache.set(employeeId, {
          stats: enhancedStats, // Use the exact enhancedStats object, not a recalculated version
          calendarData: {
            month: nowMonth,
            year,
            days,
            startDayOfWeek,
            monthlyStats
          },
          weeklyHours: weeklyHoursData,
          recentActivity: recent,
          currentStatus: statusData,
          timestamp: Date.now()
        });
        console.log(`💾 Cached data for employee ${employeeId} at ${new Date().toLocaleTimeString()}`);
        return newCache;
      });

    } catch (error) {
      console.error("Error loading attendance data:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });

      let errorMessage = "Failed to load attendance data";

      if (error.message === 'Request timeout') {
        errorMessage = "Request timed out. Please try again.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = "Request timeout. Please check your connection.";
      }

      setError(errorMessage);
    } finally {
      clearTimeout(overallTimeout);
      setLoading(false);
      setLoadingEmployeeData(false);
      setRefreshing(false);
    }
  }, [fetchCurrentStatus, employeeCache, hasFullMonthData, USE_NEW_ATTENDANCE_SYSTEM, selectedMonth, selectedYear, clearEmployeeCache]);

  // Immediate data refresh utility (defined after fetchAttendanceData)
  const refreshEmployeeData = useCallback(async (employeeId, showLoader = true) => {
    if (!employeeId) return;

    try {
      if (showLoader) {
        setLoadingEmployeeData(true);
        setError(null);
      }

      console.log(`🔄 SuperAdmin: Force refreshing data for employee ${employeeId}`);

      // Clear cache for this employee
      clearEmployeeCache(employeeId);

      // Fetch fresh data
      await fetchAttendanceData(employeeId, true);

      console.log(`✅ SuperAdmin: Successfully refreshed data for employee ${employeeId}`);
    } catch (error) {
      console.error(`❌ SuperAdmin: Failed to refresh data for employee ${employeeId}:`, error);
      setError('Failed to refresh attendance data');
    }
  }, [clearEmployeeCache, fetchAttendanceData]);

  // Handle month navigation in calendar
  const handleMonthChange = useCallback((newDate) => {
    setSelectedMonth(newDate.getMonth());
    setSelectedYear(newDate.getFullYear());
    // Clear cache when month changes to force fresh data
    if (selectedEmployee) {
      clearEmployeeCache(selectedEmployee._id);
    }
  }, [selectedEmployee, clearEmployeeCache]);

  console.log('🔍 SuperAdminAttendancePortal Debug Info:', {
    selectedEmployee: selectedEmployee?.name,
    hasStats: !!stats,
    hasCalendarData: !!calendarData,
    hasWeeklyHours: weeklyHours?.length > 0,
    hasRecentActivity: recentActivity?.length > 0,
    loadingEmployeeData,
    error: error,
    useNewSystem: USE_NEW_ATTENDANCE_SYSTEM,
    systemIntegration: {
      newAttendanceService: !!newAttendanceService
    },
    syncStatus: {
      cacheSize: employeeCache.size,
      lastRefresh: stats?.lastUpdated || 'Never',
      syncListenersActive: true
    }
  });

  // Sync testing utility (exposed to window for debugging)
  useEffect(() => {
    window.testSuperAdminSync = {
      triggerRefresh: () => {
        if (selectedEmployee) {
          console.log('🧪 Test: Triggering manual refresh for', selectedEmployee.name);
          refreshEmployeeData(selectedEmployee._id, true);
        } else {
          console.log('🧪 Test: No employee selected');
        }
      },
      clearCache: () => {
        console.log('🧪 Test: Clearing all cache');
        clearEmployeeCache();
      },
      getStatus: () => ({
        selectedEmployee: selectedEmployee?.name || 'None',
        cacheSize: employeeCache.size,
        hasData: {
          stats: !!stats,
          calendar: !!calendarData,
          weeklyHours: weeklyHours?.length > 0,
          recentActivity: recentActivity?.length > 0
        },
        lastUpdate: stats?.lastUpdated || 'Never'
      }),
      simulateUpdate: (employeeId) => {
        console.log('🧪 Test: Simulating attendance update for employee:', employeeId);
        window.dispatchEvent(new CustomEvent('attendanceDataUpdated', {
          detail: {
            employeeId: employeeId || selectedEmployee?._id,
            timestamp: Date.now(),
            action: 'test-update',
            message: 'Test sync triggered'
          }
        }));
      }
    };

    return () => {
      delete window.testSuperAdminSync;
    };
  }, [selectedEmployee, employeeCache, stats, calendarData, weeklyHours, recentActivity, refreshEmployeeData, clearEmployeeCache]);

  // Load employees on component mount
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Enhanced real-time sync for manual attendance management updates
  useEffect(() => {
    const handleAttendanceUpdate = (event) => {
      console.log('🔄 SuperAdmin: Manual attendance update detected:', event.detail);

      const updateData = event.detail || {};
      const affectedEmployeeId = updateData.employeeId || updateData.userId;

      // Smart cache invalidation
      if (affectedEmployeeId) {
        // Clear cache only for affected employee for better performance
        clearEmployeeCache(affectedEmployeeId);
        console.log(`🎯 SuperAdmin: Targeted cache clear for employee ${affectedEmployeeId}`);

        // If the affected employee is currently selected, refresh immediately
        if (selectedEmployee && selectedEmployee._id === affectedEmployeeId) {
          refreshEmployeeData(affectedEmployeeId, true);
        }
      } else {
        // Clear all cache if no specific employee identified
        clearEmployeeCache();

        // Refresh currently selected employee
        if (selectedEmployee) {
          refreshEmployeeData(selectedEmployee._id, true);
        }
      }

      // Refresh employee list if requested
      if (updateData.refreshEmployeeList) {
        console.log('👥 SuperAdmin: Refreshing employee list');
        fetchEmployees();
      }

      // Show success notification
      if (updateData.message) {
        console.log(`📢 SuperAdmin: ${updateData.message}`);
      }
    };

    const handleStatusUpdate = (event) => {
      console.log('🔄 SuperAdmin: Status update detected:', event.detail);

      // Refresh current status immediately for selected employee
      if (selectedEmployee) {
        fetchCurrentStatus(selectedEmployee._id).then((statusData) => {
          if (statusData) {
            setCurrentStatus(statusData);
            console.log('✅ SuperAdmin: Status updated:', statusData);
          }
        });
      }
    };

    // Enhanced event listeners for comprehensive sync
    window.addEventListener('attendanceDataUpdated', handleAttendanceUpdate);
    window.addEventListener('manualAttendanceUpdated', handleAttendanceUpdate);
    window.addEventListener('statusUpdate', handleStatusUpdate);
    window.addEventListener('attendanceRecordModified', handleAttendanceUpdate);

    console.log('🎧 SuperAdmin: Enhanced sync listeners registered');

    return () => {
      window.removeEventListener('attendanceDataUpdated', handleAttendanceUpdate);
      window.removeEventListener('manualAttendanceUpdated', handleAttendanceUpdate);
      window.removeEventListener('statusUpdate', handleStatusUpdate);
      window.removeEventListener('attendanceRecordModified', handleAttendanceUpdate);
      console.log('🎧 SuperAdmin: Sync listeners cleanup completed');
    };
  }, [selectedEmployee, fetchAttendanceData, fetchCurrentStatus, fetchEmployees, clearEmployeeCache, refreshEmployeeData]);

  // Auto-refresh current employee data periodically for real-time accuracy
  useEffect(() => {
    if (!selectedEmployee) return;

    // More aggressive refresh during work hours for 100% accuracy
    const refreshInterval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
      const isWorkingHours = hour >= 8 && hour <= 19;

      // Force refresh to ensure latest data (bypasses cache)
      if (isWeekday && isWorkingHours) {
        console.log('🔄 Auto-refresh: Fetching latest attendance data');
        fetchAttendanceData(selectedEmployee._id, true);
      }
    }, 120000); // 2 minutes for more real-time updates

    return () => clearInterval(refreshInterval);
  }, [selectedEmployee, fetchAttendanceData]);

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

  // Refetch data when month/year changes
  useEffect(() => {
    if (selectedEmployee) {
      console.log(`📅 Month changed to ${selectedMonth + 1}/${selectedYear}, refetching data...`);
      fetchAttendanceData(selectedEmployee._id);
    }
  }, [selectedMonth, selectedYear, selectedEmployee, fetchAttendanceData]);

  const handleRefresh = () => {
    if (selectedEmployee) {
      fetchAttendanceData(selectedEmployee._id, true);
    }
  };

  const handleLoadFullMonth = () => {
    if (selectedEmployee) {
      setHasFullMonthData(true);
      fetchAttendanceData(selectedEmployee._id, true);
    }
  };

  const handleEmployeeSelect = useCallback((employee) => {
    // Only reset if selecting a different employee
    if (selectedEmployee?._id !== employee._id) {
      setSelectedEmployee(employee);
      setShowDropdown(false);
      setHasFullMonthData(false); // Reset to start with fast load for new employee
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
            {selectedEmployee && !hasFullMonthData && (
              <button
                onClick={handleLoadFullMonth}
                disabled={loadingEmployeeData || refreshing}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-green-500/25 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CalendarIcon className="w-4 h-4" />
                Load Full Month
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing || !selectedEmployee}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Real-time Sync Indicator */}
        {selectedEmployee && stats && (
          <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-600/20 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-400">Live Data</span>
              </div>
              <div className="w-px h-4 bg-slate-600"></div>
              <span className="text-sm text-gray-400">
                Last updated: <span className="text-white font-medium">{stats.lastUpdated || 'Never'}</span>
              </span>
              <div className="w-px h-4 bg-slate-600"></div>
              <span className="text-sm text-gray-400">
                Period: <span className="text-cyan-400 font-medium">{stats.period || 'N/A'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Activity className="w-3 h-3" />
              <span>Auto-refresh: 2 min</span>
            </div>
          </div>
        )}

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
                        <AttendanceCalendar data={calendarData} onMonthChange={handleMonthChange} />
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
