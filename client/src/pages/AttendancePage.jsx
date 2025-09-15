import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import AttendanceStats from "../components/attendance/AttendanceStats";
import AttendanceCalendar from "../components/attendance/AttendanceCalendar";
import WeeklyHoursChart from "../components/attendance/WeeklyHoursChart";
import RecentActivityTable from "../components/attendance/RecentActivityTable";
import Sidebar from "../components/dashboard/Sidebar";
import { RefreshCw, AlertCircle, Clock, Users, Calendar as CalendarIcon } from "lucide-react";

const AttendancePage = ({ onLogout }) => {
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
      const response = await apiClient.get('/api/status/today');
      setCurrentStatus(response.data);
      return response.data;
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

  const fetchAttendanceData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const now = new Date();
      
      // Calculate month range for calendar and summary
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Fetch all required data in parallel
      const [weeklyRes, leavesRes, holidaysRes, statusRes] = await Promise.all([
        apiClient.get('/api/summary/week', {
          params: {
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString(),
          },
        }),
        apiClient.get('/api/leaves/mine'),
        apiClient.get('/api/holidays?shift=standard'),
        fetchCurrentStatus()
      ]);

      const { dailyData = [], weeklySummary = {} } = weeklyRes.data;
      const approvedLeaves = leavesRes.data.filter(l => l.status.toLowerCase() === "approved");
      const holidays = holidaysRes.data || [];

      // Calculate present days (5+ hours of work)
      const presentDaysCount = dailyData.filter(d => (d.workDurationSeconds || 0) >= MIN_PRESENT_SECONDS).length;

      // Calculate working days for the month (excluding weekends, holidays, and approved leaves)
      const weekWorkingDays = calculateWorkingDays(monthStart, monthEnd, holidays, approvedLeaves);

      // Calculate total work hours for the week
      const totalWorkHours = dailyData.reduce((sum, d) => 
        sum + calculateHoursFromSeconds(d.workDurationSeconds || 0), 0
      );

      // Calculate attendance rate
      const attendanceRate = weekWorkingDays > 0 ? 
        Math.round((presentDaysCount / weekWorkingDays) * 100) : 0;

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

      // Enhanced stats with additional metrics
      setStats({
        attendanceRate,
        presentDays: presentDaysCount,
        totalDays: weekWorkingDays,
        workingHours: totalWorkHours.toFixed(1),
        onTimeRate,
        lastUpdated: new Date().toLocaleString(),
        period: "This month",
        averageHoursPerDay: presentDaysCount > 0 ? (totalWorkHours / presentDaysCount).toFixed(1) : "0.0",
        lateDays: presentDaysCount - onTimeDays,
        currentStatus: statusRes ? {
          isWorking: statusRes.currentlyWorking,
          onBreak: statusRes.onBreak,
          todayHours: calculateHoursFromSeconds(statusRes.workDurationSeconds || 0).toFixed(1),
          arrivalTime: statusRes.arrivalTimeFormatted
        } : null
      });

      // Process calendar data (enhanced with more status types)
      const month = now.toLocaleString("default", { month: "long" });
      const year = now.getFullYear();
      const monthIndex = now.getMonth();

      // Create leave days set for current month
      const leaveDaysSet = new Set();
      approvedLeaves.forEach(leave => {
        const start = new Date(leave.period?.start || leave.startDate);
        const end = new Date(leave.period?.end || leave.endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() === year && d.getMonth() === monthIndex) {
            leaveDaysSet.add(d.getDate());
          }
        }
      });

      // Create holiday days map for current month
      const holidayDaysMap = {};
      holidays.forEach(h => {
        const dateObj = new Date(h.date);
        if (dateObj.getFullYear() === year && dateObj.getMonth() === monthIndex) {
          holidayDaysMap[dateObj.getDate()] = {
            day: dateObj.getDate(),
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
        const dayNum = new Date(d.date).getDate();
        const arrivalTime = getArrivalTime(d);
        const punchOutTime = getPunchTimeFromTimeline(d.timeline, "punch out");
        
        const expectedStart = d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = arrivalTime ? new Date(arrivalTime) : new Date(d.date);
        expectedDate.setHours(expH, expM, 0, 0);

        let status = "absent";

        if ((d.workDurationSeconds || 0) >= MIN_PRESENT_SECONDS) {
          status = "present";
          // Only check for late status for standard shift employees
          if (!d.effectiveShift?.isFlexible && arrivalTime && arrivalTime > expectedDate) {
            status = "late";
          }
        } else if ((d.workDurationSeconds || 0) > 0) {
          status = "half-day";
        }

        attendanceDaysMap[dayNum] = {
          day: dayNum,
          status,
          workingHours: calculateHoursFromSeconds(d.workDurationSeconds || 0).toFixed(1),
          arrivalTime,
          departureTime: punchOutTime,
          metadata: {
            totalBreakTime: calculateHoursFromSeconds(d.breakDurationSeconds || 0).toFixed(1),
            breakSessions: d.breakSessions?.length || 0,
            isFlexible: d.effectiveShift?.isFlexible || false,
            lateMinutes: (!d.effectiveShift?.isFlexible && arrivalTime && arrivalTime > expectedDate) ? 
              Math.floor((arrivalTime - expectedDate) / (1000 * 60)) : 0
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
        } else if (leaveDaysSet.has(i)) {
          days.push({ 
            day: i, 
            status: "leave", 
            workingHours: "0.0",
            name: "Approved Leave"
          });
        } else if (attendanceDaysMap[i]) {
          days.push(attendanceDaysMap[i]);
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

      setCalendarData({
        month,
        year,
        days,
        startDayOfWeek,
        monthlyStats: {
          totalPresent: days.filter(d => d.status === "present").length,
          totalLate: days.filter(d => d.status === "late").length,
          totalAbsent: days.filter(d => d.status === "absent").length,
          totalLeave: days.filter(d => d.status === "leave").length,
          totalHolidays: days.filter(d => d.status === "holiday").length
        }
      });

      // Weekly hours chart data
      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyHoursData = weekDays.map(label => ({ label, hours: 0, target: 8 }));

      dailyData.forEach(d => {
        const dateObj = new Date(d.date);
        const dayOfWeek = dateObj.getDay();
        const hours = calculateHoursFromSeconds(d.workDurationSeconds || 0);
        if (dayOfWeek >= 0 && dayOfWeek <= 6) {
          weeklyHoursData[dayOfWeek].hours = hours;
        }
      });

      setWeeklyHours(weeklyHoursData);

      // Enhanced recent activity data
      const recent = dailyData.slice(0, 10).map(d => {
        const arrivalTime = getArrivalTime(d);
        const punchOutTime = getPunchTimeFromTimeline(d.timeline, "punch out");
        
        const expectedStart = d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = arrivalTime ? new Date(arrivalTime) : new Date(d.date);
        expectedDate.setHours(expH, expM, 0, 0);

        let status = "Absent";
        let statusColor = "red";
        
        if ((d.workDurationSeconds || 0) >= MIN_PRESENT_SECONDS) {
          if (arrivalTime && arrivalTime > expectedDate) {
            const lateMinutes = Math.floor((arrivalTime - expectedDate) / (1000 * 60));
            status = `Late (${lateMinutes}min)`;
            statusColor = "yellow";
          } else {
            status = "Present";
            statusColor = "green";
          }
        } else if ((d.workDurationSeconds || 0) > 0) {
          status = "Half Day";
          statusColor = "orange";
        }

        return {
          date: new Date(d.date).toISOString().split("T")[0],
          timeIn: formatTime(arrivalTime),
          timeOut: formatTime(punchOutTime),
          status,
          statusColor,
          workingHours: calculateHoursFromSeconds(d.workDurationSeconds || 0).toFixed(1) + "h",
          breakTime: calculateHoursFromSeconds(d.breakDurationSeconds || 0).toFixed(1) + "h",
          efficiency: d.workDurationSeconds > 0 ? 
            Math.round(((d.workDurationSeconds || 0) / (8 * 3600)) * 100) + "%" : "0%"
        };
      });

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
  }, [fetchCurrentStatus, fetchTeamOnLeave]);

  useEffect(() => {
    fetchAttendanceData();
    
    // Set up real-time updates
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAttendanceData(true);
      }
    }, 60000); // Update every minute when page is visible

    return () => clearInterval(intervalId);
  }, [fetchAttendanceData]);

  // Listen for attendance updates
  useEffect(() => {
    const handleAttendanceUpdate = () => fetchAttendanceData(true);
    const handleStatusUpdate = () => fetchCurrentStatus();
    
    window.addEventListener("attendanceDataUpdate", handleAttendanceUpdate);
    window.addEventListener("statusUpdate", handleStatusUpdate);
    
    return () => {
      window.removeEventListener("attendanceDataUpdate", handleAttendanceUpdate);
      window.removeEventListener("statusUpdate", handleStatusUpdate);
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
                  Today: {stats.currentStatus?.todayHours || '0.0'}h
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
            <AttendanceCalendar data={calendarData} />
            <RecentActivityTable activities={recentActivity} />
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
