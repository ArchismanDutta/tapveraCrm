
import React, { useEffect, useState, useCallback } from 'react'; // Line 1
import axios from 'axios';
import timeUtils from '../utils/timeUtils';
import AttendanceStats from '../components/attendance/AttendanceStats';
import AttendanceCalendar from '../components/attendance/AttendanceCalendar';
import WeeklyHoursChart from '../components/attendance/WeeklyHoursChart';
import RecentActivityTable from '../components/attendance/RecentActivityTable';
import Sidebar from '../components/dashboard/Sidebar';
import { RefreshCw, AlertCircle, Clock, Users, Calendar as CalendarIcon } from 'lucide-react';
import newAttendanceService from '../services/newAttendanceService';

const AttendancePage = ({ onLogout }) => {
  console.log("🎨 AttendancePage component rendering");

  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [teamOnLeave, setTeamOnLeave] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [activityFilter, setActivityFilter] = useState('5days'); // Default to last 5 days
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [cachedLeaves, setCachedLeaves] = useState(null);
  const [cachedHolidays, setCachedHolidays] = useState(null);
  const [lastCacheTime, setLastCacheTime] = useState(null);


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
    timeout: 30000,
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
    if (!seconds || seconds === 0 || isNaN(seconds)) return 0;

    // Validate input to prevent corrupted data from affecting display
    if (seconds < 0) {
      console.warn(`⚠️ Negative work duration found: ${seconds}, setting to 0`);
      return 0;
    }

    // Cap at 24 hours (86400 seconds) to prevent unrealistic display values
    const cappedSeconds = Math.min(seconds, 86400);
    if (cappedSeconds !== seconds) {
      console.warn(`⚠️ Capping work duration for display: ${seconds} -> ${cappedSeconds}`);
    }

    // Use Math.floor for consistency with backend
    const hours = Math.floor(cappedSeconds / 3600);
    const minutes = Math.floor((cappedSeconds % 3600) / 60);
    return hours + (minutes / 60);
  };

  // Use centralized time utility for consistent timezone handling
  const formatTime = (dateString) => {
    return timeUtils.formatTime(dateString);
  };

  const isWorkingDay = (date) => {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
  };

  // OPTION C: Parse timeline without timezone conversion
  // Times in DB are stored as UTC but represent local times
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

      // Return the ISO string directly - timeUtils will extract UTC components
      return targetEvent.time;
    } catch (error) {
      console.warn(`Error parsing timeline for ${eventType}:`, error);
      return null;
    }
  };

  // OPTION C: Return ISO string directly - let timeUtils handle display
  const getArrivalTime = (dailyData) => {
    // Priority 1: Direct arrivalTime field (ISO string)
    if (dailyData.arrivalTime) {
      return dailyData.arrivalTime;
    }

    // Priority 2: First punch in from timeline (ISO string)
    if (dailyData.timeline && Array.isArray(dailyData.timeline)) {
      const punchInTime = getPunchTimeFromTimeline(dailyData.timeline, "punch in");
      if (punchInTime) return punchInTime;
    }

    // Priority 3: First worked session start time (ISO string)
    if (dailyData.workedSessions && Array.isArray(dailyData.workedSessions) && dailyData.workedSessions.length > 0) {
      const firstSession = dailyData.workedSessions[0];
      if (firstSession.start) {
        return firstSession.start;
      }
    }

    return null;
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

  // Fetch current user status
  const fetchCurrentStatus = useCallback(async () => {
    try {
      console.log("🆕 Fetching current attendance status");
      const response = await newAttendanceService.getTodayStatus();

      if (!response.success || !response.data) {
        throw new Error('Invalid response from attendance system');
      }

      const attendanceData = response.data.attendance;

      console.log("📊 Current status response:", {
        hasAttendance: !!attendanceData,
        currentlyWorking: attendanceData?.currentlyWorking,
        onBreak: attendanceData?.onBreak,
        arrivalTime: attendanceData?.arrivalTime,
        workDuration: attendanceData?.workDuration
      });

      // Convert to format expected by existing components
      // Format arrival time for display using centralized time utility
      let formattedArrivalTime = null;
      if (attendanceData?.arrivalTime) {
        formattedArrivalTime = timeUtils.formatTime(attendanceData.arrivalTime);
      }

      const statusData = {
        userId: attendanceData?.userId,
        currentlyWorking: attendanceData?.currentlyWorking || false,
        onBreak: attendanceData?.onBreak || false,
        workDuration: attendanceData?.workDuration || '0h 0m',
        breakDuration: attendanceData?.breakDuration || '0h 0m',
        workDurationSeconds: attendanceData?.workDurationSeconds || 0,
        breakDurationSeconds: attendanceData?.breakDurationSeconds || 0,
        arrivalTime: formattedArrivalTime, // Use formatted time
        arrivalTimeRaw: attendanceData?.arrivalTime, // Keep raw for calculations
        isLate: attendanceData?.isLate || false,
        isPresent: attendanceData?.isPresent || false,
        timeline: attendanceData?.events?.map(event => {
          const typeMap = {
            'PUNCH_IN': 'Punch In',
            'PUNCH_OUT': 'Punch Out',
            'BREAK_START': 'Break Start',
            'BREAK_END': 'Break End'
          };
          return {
            type: typeMap[event.type] || event.type,
            time: event.timestamp,
            location: event.location
          };
        }) || []
      };

      setCurrentStatus(statusData);
      return statusData;
    } catch (error) {
      console.error('Error fetching current status:', error);
      return null;
    }
  }, []);

  // Fetch team members on leave
  const fetchTeamOnLeave = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await apiClient.get('/api/leaves/team', {
        params: { 
          department: user.department,
          excludeEmail: user.email 
        }
      });
      
      const today = new Date();
      const todayString = today.toDateString();
      
      // Filter leaves that are active today
      const activeLeaves = response.data.filter(leave => {
        const startDate = new Date(leave.period.start);
        const endDate = new Date(leave.period.end);
        return startDate <= today && endDate >= today;
      }).slice(0, 5); // Limit to 5 for display

      setTeamOnLeave(activeLeaves);
    } catch (error) {
      console.error('Error fetching team leaves:', error);
      setTeamOnLeave([]);
    }
  }, []);

  // Handle activity filter change
  const handleActivityFilterChange = useCallback((filter) => {
    setActivityFilter(filter);
    // Note: fetchAttendanceData will automatically use the new filter value
    // since it reads activityFilter via getActivityDateRange
  }, []);

  // Handle month change
  const handleMonthChange = useCallback((newDate) => {
    setSelectedMonth(newDate.getMonth());
    setSelectedYear(newDate.getFullYear());
  }, []);

  // Get date range based on activity filter
  const getActivityDateRange = useCallback(() => {
    const now = new Date();
    let startDate, endDate;

    switch (activityFilter) {
      case '5days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 4); // Last 5 days including today
        endDate = new Date(now);
        break;
      case 'week':
        const day = now.getDay();
        const diffToMonday = (day + 6) % 7;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - diffToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }, [activityFilter]);

  const fetchAttendanceData = useCallback(async (isRefresh = false) => {
    console.log("🚀 fetchAttendanceData called", { isRefresh, selectedMonth, selectedYear, activityFilter });
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const now = new Date();

      // Calculate month range for calendar and summary using selected month/year
      const monthStart = new Date(selectedYear, selectedMonth, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Get activity date range based on filter
      const { startDate: activityStart, endDate: activityEnd } = getActivityDateRange();
      console.log(`📅 Activity Date Range (${activityFilter}):`, {
        start: activityStart.toISOString(),
        end: activityEnd.toISOString(),
        filterDays: Math.ceil((activityEnd - activityStart) / (1000 * 60 * 60 * 24))
      });

      // Fetch data using new attendance system
      console.log("🆕 Fetching attendance data");
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const fetchPromises = [];

      // Monthly attendance data for calendar, stats, AND recent activity
      // We'll filter activity data on the frontend for better UX (instant filter switching)
      fetchPromises.push(
        newAttendanceService.getEmployeeMonthlyAttendance(user.id || user._id, selectedYear, selectedMonth + 1),
        fetchCurrentStatus()
      );

      // OPTIMIZATION: Use cached data for leaves and holidays if recent
      const currentTime = Date.now();
      const cacheExpiryMs = 15 * 60 * 1000; // 15 minutes
      const shouldUseCachedData = !isRefresh && lastCacheTime && (currentTime - lastCacheTime) < cacheExpiryMs;

      // Fetch leaves and holidays only if not cached or expired
      if (!shouldUseCachedData) {
        fetchPromises.push(
          apiClient.get('/api/leaves/mine'),
          apiClient.get('/api/holidays?shift=standard')
        );
      }

      const results = await Promise.all(fetchPromises);

      // Parse responses from new attendance system
      const monthlyAttendanceRes = results[0];
      const statusRes = results[1];
      let leavesRes = { data: [] };
      let holidaysRes = { data: [] };

      console.log("🔍 Backend Response - Monthly Attendance:", {
        success: monthlyAttendanceRes?.success,
        hasData: !!monthlyAttendanceRes?.data,
        dataLength: monthlyAttendanceRes?.data?.data?.length || 0
      });

      // Convert monthly attendance response
      let weeklyRes;
      if (monthlyAttendanceRes.success && monthlyAttendanceRes.data) {
        const monthlyData = monthlyAttendanceRes.data;

        console.log("📊 Raw monthly data from backend:", monthlyData);
        console.log("📊 Monthly summary lateDays:", monthlyData.summary?.lateDays);
        console.log("📊 Monthly summary full:", monthlyData.summary);
        console.log("📊 Monthly data array with isLate:", monthlyData.data?.map(d => ({
          date: d.date,
          isLate: d.isLate,
          arrivalTime: d.arrivalTime,
          shiftStart: d.shift?.startTime,
          allFields: Object.keys(d)
        })));

        // The backend returns "data" not "attendance"
        const attendanceArray = monthlyData.data || [];

        weeklyRes = {
          data: {
            dailyData: attendanceArray.map(day => ({
              date: day.date,
              workDurationSeconds: day.workDurationSeconds || 0,
              breakDurationSeconds: day.breakDurationSeconds || 0,
              isAbsent: day.isAbsent || false,
              isLate: day.isLate || false,
              isPresent: day.isPresent || false,
              isHalfDay: day.isHalfDay || (day.workDurationSeconds < (4 * 3600)),
              isWFH: false, // TODO: Add WFH support in new system
              // CRITICAL: Format times as strings to prevent React rendering Date objects
              arrivalTime: day.arrivalTime ? (typeof day.arrivalTime === 'string' ? day.arrivalTime : new Date(day.arrivalTime).toISOString()) : null,
              departureTime: day.departureTime ? (typeof day.departureTime === 'string' ? day.departureTime : new Date(day.departureTime).toISOString()) : null,
              currentlyWorking: day.currentlyWorking || false,
              onBreak: day.onBreak || false,
              // CRITICAL: Include shift data from backend
              shift: day.shift,
              timeline: day.events?.map(event => ({
                type: event.type === 'PUNCH_IN' ? 'Punch In' :
                      event.type === 'PUNCH_OUT' ? 'Punch Out' :
                      event.type === 'BREAK_START' ? 'Break Start' :
                      event.type === 'BREAK_END' ? 'Break End' : event.type,
                time: event.timestamp,
                location: event.location
              })) || [],
              // Add sessions for compatibility
              workedSessions: [], // Can be computed from events if needed
              breakSessions: []
            })),
            weeklySummary: {
              presentDays: monthlyData.summary?.presentDays || 0,
              onTimeRate: (monthlyData.summary?.punctualityRate || 0) + '%',
              quickStats: {
                lateArrivals: monthlyData.summary?.lateDays || 0
              }
            }
          }
        };

        console.log("✅ Converted weekly data:", {
          dailyDataCount: weeklyRes.data.dailyData.length,
          presentDays: weeklyRes.data.weeklySummary.presentDays,
          onTimeRate: weeklyRes.data.weeklySummary.onTimeRate,
          lateArrivals: weeklyRes.data.weeklySummary.quickStats?.lateArrivals
        });
      } else {
        // Fallback to empty data structure
        weeklyRes = {
          data: {
            dailyData: [],
            weeklySummary: {
              presentDays: 0,
              onTimeRate: '0%',
              quickStats: { lateArrivals: 0 }
            }
          }
        };
      }

      // Use monthly data for activity (filter on frontend for instant response)
      let activityRes = weeklyRes;
      console.log("✅ Using monthly data for Recent Activity:", {
        totalRecords: weeklyRes.data.dailyData.length
      });

      // Update result index since we removed the separate activity call
      let resultIndex = 2;

      if (!shouldUseCachedData) {
        leavesRes = results[resultIndex] || { data: [] };
        holidaysRes = results[resultIndex + 1] || { data: [] };

        // Update cache
        setCachedLeaves(leavesRes.data);
        setCachedHolidays(holidaysRes.data);
        setLastCacheTime(currentTime);
      } else {
        // Use cached data
        leavesRes = { data: cachedLeaves || [] };
        holidaysRes = { data: cachedHolidays || [] };
      }

      const { dailyData = [], weeklySummary = {} } = weeklyRes.data;
      const { dailyData: activityData = [] } = activityRes.data;
      const approvedLeaves = leavesRes.data.filter(l => l.status.toLowerCase() === "approved");
      const holidays = holidaysRes.data || [];

      // Calculate present days using backend calculation (already processed)
      // Use backend calculated present days with validation
      let presentDaysCount = weeklySummary.presentDays;
      if (typeof presentDaysCount !== 'number' || presentDaysCount < 0) {
        console.warn('Invalid presentDaysCount from backend, calculating from dailyData');
        presentDaysCount = dailyData.filter(d => !d.isAbsent).length;
      }

      // Calculate working days for the month (excluding weekends, holidays, and approved leaves)
      const weekWorkingDays = calculateWorkingDays(monthStart, monthEnd, holidays, approvedLeaves);

      // Calculate total work hours with validation
      const totalWorkHours = dailyData.reduce((sum, d) => {
        const workHours = calculateHoursFromSeconds(d.workDurationSeconds || 0);
        // Additional validation to prevent accumulating invalid data
        if (isNaN(workHours) || workHours < 0) {
          console.warn(`Invalid work hours for date ${d.date}:`, workHours);
          return sum;
        }
        return sum + workHours;
      }, 0);

      // Calculate attendance rate with validation
      let attendanceRate = 0;
      if (weekWorkingDays > 0 && presentDaysCount >= 0) {
        attendanceRate = Math.min(100, Math.floor((presentDaysCount / weekWorkingDays) * 100));
      }

      // Validate attendance rate calculation
      if (attendanceRate > 100) {
        console.warn(`⚠️ Attendance rate exceeds 100%: ${attendanceRate}%, capping to 100%`);
        attendanceRate = 100;
      }

      // Use backend calculated on-time data with validation
      let onTimeRate = 0;
      if (weeklySummary.onTimeRate) {
        const rawOnTimeRate = parseInt(weeklySummary.onTimeRate.replace('%', '') || '0');
        onTimeRate = Math.min(100, Math.max(0, rawOnTimeRate));
      }

      // Enhanced stats with additional metrics and validation
      const averageHoursPerDay = presentDaysCount > 0 ?
        Math.min(24, (totalWorkHours / presentDaysCount)) : 0;

      // Determine period text based on selected month
      const isCurrentMonth = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();
      const periodText = isCurrentMonth ? "This month" :
        `${new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}`;

      // Calculate actual full days and half days from backend data
      const fullDaysCount = dailyData.filter(d => {
        const workHours = (d.workDurationSeconds || 0) / 3600;
        return !d.isAbsent && workHours >= 8;
      }).length;

      const halfDaysCount = dailyData.filter(d => {
        const workHours = (d.workDurationSeconds || 0) / 3600;
        return d.isHalfDay || (!d.isAbsent && workHours >= 4 && workHours < 8);
      }).length;

      // Calculate absent days from backend data
      // For now, use the basic calculation - will be updated when calendar is built
      const absentDaysCount = dailyData.filter(d => d.isAbsent).length;

      const calculatedStats = {
        attendanceRate: Math.round(attendanceRate),
        presentDays: Math.max(0, presentDaysCount),
        totalDays: Math.max(0, weekWorkingDays),
        workingHours: Math.max(0, totalWorkHours).toFixed(1),
        onTimeRate: Math.round(onTimeRate),
        lastUpdated: new Date().toLocaleString(),
        period: periodText,
        averageHoursPerDay: averageHoursPerDay.toFixed(1),
        lateDays: Math.max(0, weeklySummary.quickStats?.lateArrivals || 0),
        fullDays: Math.max(0, fullDaysCount),
        halfDays: Math.max(0, halfDaysCount),
        absentDays: Math.max(0, absentDaysCount),
        currentStatus: isCurrentMonth && statusRes ? {
          isWorking: Boolean(statusRes.currentlyWorking),
          onBreak: Boolean(statusRes.onBreak),
          todayHours: calculateHoursFromSeconds(statusRes.workDurationSeconds || 0).toFixed(1),
          arrivalTime: statusRes.arrivalTimeFormatted || null
        } : null
      };

      console.log("📊 Final stats being set:", calculatedStats);
      setStats(calculatedStats);

      // Process calendar data (enhanced with more status types)
      const tempDate = new Date(selectedYear, selectedMonth, 1);
      const month = tempDate.toLocaleString("default", { month: "long" });
      const year = selectedYear;
      const monthIndex = selectedMonth;

      // Create leave days set for current month
      // IMPORTANT: Exclude WFH - it's NOT a leave, it's a normal working day!
      const leaveDaysSet = new Set();
      const wfhDaysSet = new Set(); // Track WFH days separately

      approvedLeaves.forEach(leave => {
        const start = new Date(leave.period?.start || leave.startDate);
        const end = new Date(leave.period?.end || leave.endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() === year && d.getMonth() === monthIndex) {
            if (leave.type === 'workFromHome') {
              // WFH days should show as WFH status (magenta), not leave
              wfhDaysSet.add(d.getDate());
            } else {
              // Regular leaves (paid, unpaid, sick, etc.)
              leaveDaysSet.add(d.getDate());
            }
          }
        }
      });

      // Create holiday days map for current month
      const holidayDaysMap = {};
      holidays.forEach(h => {
        // Fix timezone issue for holidays
        const dateString = h.date.includes('T') ? h.date.split('T')[0] : h.date;
        const dateObj = new Date(dateString + 'T12:00:00');
        if (dateObj.getFullYear() === year && dateObj.getMonth() === monthIndex) {
          const dayNum = parseInt(dateString.split('-')[2], 10);
          holidayDaysMap[dayNum] = {
            day: dayNum,
            status: "holiday",
            name: h.name,
            type: h.type,
            workingHours: "0.0"
          };
        }
      });

      // Map daily attendance data
      const attendanceDaysMap = {};
      dailyData.forEach(d => {
        // Fix timezone issue: ALWAYS extract date from string to avoid UTC conversion
        let dateString;
        if (typeof d.date === 'string') {
          dateString = d.date.includes('T') ? d.date.split('T')[0] : d.date;
        } else {
          // Convert Date object to ISO string and extract date part
          dateString = d.date.toISOString().split('T')[0];
        }

        // Extract day number from YYYY-MM-DD format (always correct, no timezone shift)
        const dayNum = parseInt(dateString.split('-')[2], 10);

        // Debug logging to track date mapping
        console.log(`📅 Mapping attendance data: ${d.date} -> ${dateString} -> day ${dayNum}`, {
          originalDate: d.date,
          dateString,
          dayNum,
          workHours: ((d.workDurationSeconds || 0) / 3600).toFixed(1),
          isAbsent: d.isAbsent,
          isHalfDay: d.isHalfDay,
          isLate: d.isLate
        });
        // OPTION C: Get times as ISO strings (no conversion)
        const arrivalTime = getArrivalTime(d);
        const punchOutTime = getPunchTimeFromTimeline(d.timeline, "punch out");

        let status = "absent";
        // Use backend calculated status with WFH support
        // ⭐ Priority: WFH (DOMINATES ALL) > Absent/Leave > Late > Half-day > Present
        // WFH DOMINATES: If employee has WFH and worked, show WFH regardless of late/early/half-day
        if ((d.isWFH || d.leaveInfo?.type === 'workFromHome') &&
            (!d.isAbsent && (d.workDurationSeconds > 0 || d.isPresent))) {
          // ⭐ HIGHEST PRIORITY: Work From Home - DOMINATES over late/half-day/early
          // If employee has WFH and worked ANY amount, show as WFH (magenta)
          status = "wfh";
        } else if (d.isAbsent) {
          // Check if it's an approved leave (not WFH)
          if (d.leaveInfo && d.leaveInfo.type !== 'workFromHome') {
            status = d.leaveInfo.type === 'halfDay' ? "half-day-leave" : "approved-leave";
          } else {
            status = "absent";
          }
        } else if (d.isLate) {
          // Late takes priority over half-day (but NOT over WFH)
          status = "late";
          console.log(`🔴 LATE DAY DETECTED: ${d.date}`, {isLate: d.isLate, isHalfDay: d.isHalfDay, status, arrivalTime: d.arrivalTime});
        } else if (d.isHalfDay) {
          // Check if it's half-day leave or just worked half day
          status = d.leaveInfo && d.leaveInfo.type === 'halfDay' ? "half-day-leave" : "half-day";
        } else {
          status = "present";
        }

        // OPTION C: Calculate late minutes using UTC time components
        const shiftData = d.shift || d.assignedShift || d.effectiveShift;
        const expectedStart = shiftData?.startTime || d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);

        // Calculate late minutes by comparing UTC time components directly
        let lateMinutes = 0;
        const isFlexible = shiftData?.isFlexible || d.effectiveShift?.isFlexible || false;

        // Always calculate late minutes if we have arrival time (for display purposes)
        if (arrivalTime && !isFlexible) {
          // Parse arrival time in user's local timezone
          const arrivalDate = new Date(arrivalTime);
          const arrivalHours = arrivalDate.getHours();
          const arrivalMinutes = arrivalDate.getMinutes();

          // Calculate minutes since midnight
          const arrivalTotalMinutes = arrivalHours * 60 + arrivalMinutes;
          const expectedTotalMinutes = expH * 60 + expM;

          // Calculate difference (positive = late, negative = early)
          const minutesDiff = arrivalTotalMinutes - expectedTotalMinutes;

          // Only show as late if backend confirms isLate AND actually late (not early)
          if (d.isLate && minutesDiff > 0) {
            lateMinutes = minutesDiff;
            console.log(`✅ Calculated late minutes for ${d.date}: ${lateMinutes} min (shift: ${expectedStart}, arrival: ${arrivalHours}:${String(arrivalMinutes).padStart(2, '0')})`);
          } else if (minutesDiff <= 0) {
            // Arrived on-time or early
            lateMinutes = 0;
            console.log(`✅ On-time/Early arrival for ${d.date}: ${Math.abs(minutesDiff)} min early (shift: ${expectedStart}, arrival: ${arrivalHours}:${String(arrivalMinutes).padStart(2, '0')})`);
          }
        }

        // For WFH, set standard working hours if no actual logged hours
        let displayHours = calculateHoursFromSeconds(d.workDurationSeconds || 0).toFixed(1);
        if (d.isWFH && (!d.workDurationSeconds || d.workDurationSeconds === 0)) {
          // For WFH with no logged time, assume standard working hours
          displayHours = d.leaveInfo?.type === 'halfDay' ? "4.0" : "7.5";
        }

        attendanceDaysMap[dayNum] = {
          day: dayNum,
          status,
          workingHours: displayHours,
          // OPTION C: Store ISO strings directly (already in correct format)
          arrivalTime: arrivalTime,
          departureTime: punchOutTime,
          name: d.isWFH ? "Work From Home" :
                d.leaveInfo ? `${d.leaveInfo.type} Leave` : null,
          metadata: {
            totalBreakTime: calculateHoursFromSeconds(d.breakDurationSeconds || 0).toFixed(1),
            breakSessions: d.breakSessions?.length || 0,
            isFlexible,
            lateMinutes,
            workDurationSeconds: d.workDurationSeconds || 0,
            breakDurationSeconds: d.breakDurationSeconds || 0,
            shiftType: d.shiftType || 'standard',
            effectiveShift: d.effectiveShift,
            assignedShift: shiftData, // Use the shift data we extracted
            isLate: d.isLate || false,
            isHalfDay: d.isHalfDay || false,
            isAbsent: d.isAbsent || false,
            isWFH: d.isWFH || false,
            isFullDay: !d.isHalfDay && !d.isAbsent,
            netHours: ((d.workDurationSeconds || 0) + (d.breakDurationSeconds || 0)) / 3600,
            timeline: d.timeline || [],
            leaveInfo: d.leaveInfo
          }
        };
      });

      // Build calendar days array
      const maxDays = new Date(year, monthIndex + 1, 0).getDate();
      const days = [];

      for (let i = 1; i <= maxDays; i++) {
        const dateObj = new Date(year, monthIndex, i);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (holidayDaysMap[i]) {
          days.push(holidayDaysMap[i]);
        } else if (isWeekend) {
          days.push({
            day: i,
            status: "weekend",
            workingHours: "0.0",
            name: "Weekend"
          });
        } else if (attendanceDaysMap[i]) {
          // Has attendance data - use actual status from punch in/out
          days.push(attendanceDaysMap[i]);
        } else if (wfhDaysSet.has(i)) {
          // Approved WFH but no attendance data yet (employee hasn't punched in)
          // Show as WFH status (magenta) to indicate WFH is approved
          const isPast = dateObj < new Date() && dateObj.toDateString() !== new Date().toDateString();
          days.push({
            day: i,
            status: isPast ? "absent" : "wfh", // If past and no work, mark absent; otherwise show as WFH
            workingHours: "0.0",
            name: isPast ? "Absent (WFH Not Utilized)" : "Work From Home",
            metadata: {
              isWFH: true
            }
          });
        } else if (leaveDaysSet.has(i)) {
          days.push({
            day: i,
            status: "leave",
            workingHours: "0.0",
            name: "Approved Leave"
          });
        } else {
          const isToday = dateObj.toDateString() === new Date().toDateString();
          const isPast = dateObj < new Date();

          days.push({
            day: i,
            status: isPast && !isToday ? "absent" : "default",
            workingHours: "0.0"
          });
        }
      }

      const firstDayOfMonth = new Date(year, monthIndex, 1);
      const startDayOfWeek = firstDayOfMonth.getDay();

      const monthlyStats = {
        // Present includes: on-time, late, wfh, and half-day (all non-absent working days)
        totalPresent: days.filter(d => ["present", "late", "wfh", "half-day"].includes(d.status)).length,
        totalLate: days.filter(d => d.status === "late").length,
        totalAbsent: days.filter(d => d.status === "absent").length,
        totalLeave: days.filter(d => ["leave", "half-day-leave", "approved-leave"].includes(d.status)).length,
        totalWFH: days.filter(d => d.status === "wfh").length,
        totalHolidays: days.filter(d => d.status === "holiday").length,
        totalHalfDay: days.filter(d => ["half-day", "half-day-leave"].includes(d.status)).length
      };

      setCalendarData({
        month,
        year,
        days,
        startDayOfWeek,
        monthlyStats
      });

      // Update stats with correct absent days from calendar
      setStats(prevStats => ({
        ...prevStats,
        absentDays: monthlyStats.totalAbsent
      }));

      // Weekly hours chart data
      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyHoursData = weekDays.map(label => ({ label, hours: 0, target: 8 }));

      dailyData.forEach(d => {
        // Fix timezone issue for weekly chart
        const dateString = typeof d.date === 'string' ?
          (d.date.includes('T') ? d.date.split('T')[0] : d.date) :
          d.date.toISOString().split('T')[0];
        const dateObj = new Date(dateString + 'T12:00:00'); // Use noon to avoid timezone issues
        const dayOfWeek = dateObj.getDay();

        // Calculate hours including WFH logic
        let hours = calculateHoursFromSeconds(d.workDurationSeconds || 0);

        // For WFH with no logged hours, use standard hours
        if (d.isWFH && hours === 0) {
          hours = d.leaveInfo?.type === 'halfDay' ? 4.0 : 7.5;
        }

        if (dayOfWeek >= 0 && dayOfWeek <= 6) {
          weeklyHoursData[dayOfWeek].hours = hours;
        }
      });

      setWeeklyHours(weeklyHoursData);

      // Get activity date range for filtering (recalculate for consistency)
      let activityStartDate, activityEndDate;
      try {
        const dateRange = getActivityDateRange();
        activityStartDate = dateRange.startDate;
        activityEndDate = dateRange.endDate;
      } catch (err) {
        console.error("Error getting activity date range:", err);
        // Fallback to month range
        activityStartDate = monthStart;
        activityEndDate = monthEnd;
      }

      // Filter activity data based on selected date range (frontend filtering for instant response)
      const filteredActivityData = activityData.filter(d => {
        try {
          const recordDate = new Date(typeof d.date === 'string' ?
            (d.date.includes('T') ? d.date.split('T')[0] : d.date) :
            d.date.toISOString().split('T')[0]);
          recordDate.setHours(0, 0, 0, 0);

          return recordDate >= activityStartDate && recordDate <= activityEndDate;
        } catch (err) {
          console.error("Error filtering activity record:", d, err);
          return false;
        }
      });

      console.log(`🔍 Filtered activity data:`, {
        totalRecords: activityData.length,
        filteredRecords: filteredActivityData.length,
        dateRange: activityStartDate && activityEndDate ?
          `${activityStartDate.toISOString().split('T')[0]} to ${activityEndDate.toISOString().split('T')[0]}` :
          'Invalid date range',
        filter: activityFilter
      });

      // Simplified recent activity data processing
      const recent = filteredActivityData.map(d => {
        const arrivalTime = getArrivalTime(d);
        const punchOutTime = getPunchTimeFromTimeline(d.timeline, "punch out");

        // Debug logging for recent activity
        console.log(`📊 Recent Activity - Processing ${d.date}:`, {
          arrivalTime,
          punchOutTime,
          workDurationSeconds: d.workDurationSeconds,
          isLate: d.isLate,
          isAbsent: d.isAbsent
        });

        let status = "Absent";
        let statusColor = "red";

        // Use backend calculated status with WFH support
        // ⭐ WFH DOMINATES: If employee has WFH and worked, show WFH regardless of late/half-day
        if ((d.isWFH || d.leaveInfo?.type === 'workFromHome') &&
            (!d.isAbsent && (d.workDurationSeconds > 0 || d.isPresent))) {
          status = "WFH";
          statusColor = "fuchsia"; // Magenta color to match calendar
        } else if (d.isAbsent) {
          if (d.leaveInfo && d.leaveInfo.type !== 'workFromHome') {
            status = d.leaveInfo.type === 'halfDay' ? "Half Day Leave" :
                     `${d.leaveInfo.type.charAt(0).toUpperCase() + d.leaveInfo.type.slice(1)} Leave`;
            statusColor = "purple";
          } else {
            status = "Absent";
            statusColor = "red";
          }
        } else if (d.isHalfDay) {
          status = d.leaveInfo && d.leaveInfo.type === 'halfDay' ? "Half Day Leave" : "Half Day";
          statusColor = "orange";
        } else if (d.isLate) {
          status = "Late";
          statusColor = "yellow";
        } else {
          status = "Present";
          statusColor = "green";
        }

        // Calculate working hours for display, including WFH logic
        let displayWorkingHours = calculateHoursFromSeconds(d.workDurationSeconds || 0);
        if (d.isWFH && displayWorkingHours === 0) {
          displayWorkingHours = d.leaveInfo?.type === 'halfDay' ? 4.0 : 7.5;
        }

        // Calculate efficiency based on actual expected hours
        let efficiency = 0;
        if (d.isWFH) {
          const expectedHours = d.leaveInfo?.type === 'halfDay' ? 4 : 7.5;
          efficiency = Math.round((displayWorkingHours / expectedHours) * 100);
        } else if (d.workDurationSeconds > 0) {
          efficiency = Math.round(((d.workDurationSeconds || 0) / (7.5 * 3600)) * 100);
        }

        const formattedTimeIn = d.isWFH ? "WFH" : formatTime(arrivalTime);
        const formattedTimeOut = d.isWFH ? "WFH" : formatTime(punchOutTime);

        console.log(`✅ Recent Activity - Formatted times for ${d.date}: TimeIn=${formattedTimeIn}, TimeOut=${formattedTimeOut}`);

        return {
          date: typeof d.date === 'string' ?
            (d.date.includes('T') ? d.date.split('T')[0] : d.date) :
            d.date.toISOString().split('T')[0],
          timeIn: formattedTimeIn,
          timeOut: formattedTimeOut,
          status,
          statusColor,
          workingHours: displayWorkingHours.toFixed(1) + "h",
          breakTime: calculateHoursFromSeconds(d.breakDurationSeconds || 0).toFixed(1) + "h",
          efficiency: efficiency + "%"
        };
      });

      console.log(`🎯 Setting Recent Activity with ${recent.length} records:`, recent);
      setRecentActivity(recent);

      // Fetch team leave data
      await fetchTeamOnLeave();

    } catch (error) {
      console.error("Error loading attendance data:", error);
      setError(error.response?.data?.message || error.message || "Failed to load attendance data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchCurrentStatus, fetchTeamOnLeave, getActivityDateRange, selectedMonth, selectedYear]);

  useEffect(() => {
    console.log("📍 AttendancePage mounted, fetching initial data");
    fetchAttendanceData();

    // OPTIMIZATION: Smarter real-time updates based on user's actual working status
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentMinutes = hour * 60 + minute;

        // Get user's shift from localStorage (set during login)
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const assignedShift = user.assignedShift || user.standardShiftType;

        // Determine if user is likely working based on their shift or current status
        let isLikelyWorking = false;

        // Check if user has an active shift today
        if (assignedShift) {
          // Parse shift times (format: "09:00" or "HH:MM")
          const shiftStart = assignedShift.start || assignedShift.startTime || "09:00";
          const shiftEnd = assignedShift.end || assignedShift.endTime || "18:00";

          const [startHour, startMin] = shiftStart.split(':').map(Number);
          const [endHour, endMin] = shiftEnd.split(':').map(Number);

          const shiftStartMinutes = startHour * 60 + startMin;
          let shiftEndMinutes = endHour * 60 + endMin;

          // Handle night shifts (end time < start time means crosses midnight)
          if (shiftEndMinutes < shiftStartMinutes) {
            shiftEndMinutes += 24 * 60; // Add 24 hours
          }

          // Allow 1 hour before shift start and 2 hours after shift end
          const earlyArrivalBuffer = 60; // minutes
          const lateStayBuffer = 120; // minutes

          const effectiveStart = shiftStartMinutes - earlyArrivalBuffer;
          const effectiveEnd = shiftEndMinutes + lateStayBuffer;

          isLikelyWorking = currentMinutes >= effectiveStart && currentMinutes <= effectiveEnd;
        }

        // If no shift info, check if user is currently working based on status
        if (!isLikelyWorking && currentStatus) {
          isLikelyWorking = currentStatus.currentlyWorking || currentStatus.onBreak;
        }

        // Fallback: if no shift and no current status, only poll during standard business hours
        if (!assignedShift && !currentStatus) {
          const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
          isLikelyWorking = isWeekday && hour >= 7 && hour <= 20; // Broader window
        }

        if (isLikelyWorking) {
          fetchAttendanceData(true); // Full refresh when user is working
        } else {
          // Minimal updates outside working hours (only fetch current status)
          fetchCurrentStatus();
        }
      }
    }, 300000); // Update every 5 minutes when page is visible

    return () => clearInterval(intervalId);
  }, [fetchAttendanceData, fetchCurrentStatus, selectedMonth, selectedYear, activityFilter]); // Added activityFilter to refetch when changed

  // Listen for attendance updates
  useEffect(() => {
    const handleAttendanceUpdate = () => {
      console.log("🔔 Event: attendanceDataUpdate received - refreshing data");
      fetchAttendanceData(true);
    };
    const handleStatusUpdate = () => {
      console.log("🔔 Event: statusUpdate received - fetching status");
      fetchCurrentStatus();
    };
    const handleManualAttendanceUpdate = () => {
      // Refresh all data when manual attendance is updated
      console.log("🔔 Event: attendanceDataUpdated received - full refresh");
      fetchAttendanceData(true);
      fetchCurrentStatus();
    };

    window.addEventListener("attendanceDataUpdate", handleAttendanceUpdate);
    window.addEventListener("statusUpdate", handleStatusUpdate);
    window.addEventListener("attendanceDataUpdated", handleManualAttendanceUpdate);

    console.log("✅ Attendance event listeners registered");

    return () => {
      window.removeEventListener("attendanceDataUpdate", handleAttendanceUpdate);
      window.removeEventListener("statusUpdate", handleStatusUpdate);
      window.removeEventListener("attendanceDataUpdated", handleManualAttendanceUpdate);
      console.log("🗑️ Attendance event listeners removed");
    };
  }, [fetchAttendanceData, fetchCurrentStatus]);

  const handleRefresh = () => {
    fetchAttendanceData(true);
  };

  if (loading) {
    return (
      <div className="p-4 text-gray-100 bg-[#0f1419] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading attendance data...</p>
          <p className="text-sm text-gray-400 mt-2">Connecting to backend services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-gray-100 bg-[#0f1419] min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-6">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-red-400 font-semibold mb-2 text-lg">Error Loading Data</h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <button
              onClick={() => fetchAttendanceData()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats || !calendarData) {
    return (
      <div className="p-4 text-gray-100 bg-[#0f1419] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-lg">No attendance data available</p>
          <p className="text-sm text-gray-400 mt-2">Please check back later or contact your administrator</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f1419] text-gray-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />
      <main className={`flex-1 p-6 space-y-6 transition-all duration-300 ${collapsed ? "ml-20" : "ml-72"}`}>
        {/* Header with enhanced status info */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Attendance Dashboard</h1>
            <p className="text-gray-400 mb-3">Track your daily attendance and work hours</p>
            
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
                  Work: {currentStatus.workDuration || '0h 0m'}
                </div>
                <div className="text-sm text-orange-400">
                  Break: {currentStatus.breakDuration || '0h 0m'}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Team on Leave indicator */}
            {teamOnLeave.length > 0 && (
              <div className="bg-[#161c2c] rounded-lg px-3 py-2 border border-[#232945] flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-300">
                  {teamOnLeave.length} teammate{teamOnLeave.length !== 1 ? 's' : ''} on leave
                </span>
              </div>
            )}

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>
        
        <AttendanceStats stats={stats} />
        
        <div className="grid lg:grid-cols-3 grid-cols-1 gap-6">
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <AttendanceCalendar data={calendarData} onMonthChange={handleMonthChange} />
            <RecentActivityTable
              activities={recentActivity}
              onDateFilterChange={handleActivityFilterChange}
              currentFilter={activityFilter}
            />
          </div>
          <div className="space-y-6">
            <WeeklyHoursChart weeklyHours={weeklyHours} targetHours={8} />
            
            {/* Team on Leave Card */}
            {teamOnLeave.length > 0 && (
              <div className="bg-[#161c2c] rounded-xl shadow-md p-4 border border-[#232945]">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-lg text-gray-100">Team on Leave</h3>
                </div>
                <div className="space-y-2">
                  {teamOnLeave.slice(0, 5).map((leave, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{leave.employee.name}</span>
                      <span className="text-purple-400">{leave.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AttendancePage;
