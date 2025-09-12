import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import AttendanceStats from "../components/attendance/AttendanceStats";
import AttendanceCalendar from "../components/attendance/AttendanceCalendar";
import WeeklyHoursChart from "../components/attendance/WeeklyHoursChart";
import RecentActivityTable from "../components/attendance/RecentActivityTable";
import Sidebar from "../components/dashboard/Sidebar";

const AttendancePage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("token");

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  // Helper function to check if a date is a working day (Monday-Friday)
  const isWorkingDay = (date) => {
    const day = date.getUTCDay();
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
  };

  // Enhanced helper function to get punch out time from timeline
  const getPunchOutFromTimeline = (timeline) => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null;
    
    // Look for punch out events with various possible formats
    const punchOutEvents = timeline.filter(event => 
      event.type && (
        event.type.toLowerCase().includes('punch out') ||
        event.type.toLowerCase().includes('punchout') ||
        event.type.toLowerCase() === 'punch_out' ||
        event.type.toLowerCase() === 'punchOut'
      )
    );
    
    if (punchOutEvents.length === 0) return null;
    
    // Get the latest punch out time
    const sortedPunchOuts = punchOutEvents.sort((a, b) => new Date(b.time) - new Date(a.time));
    return new Date(sortedPunchOuts[0].time);
  };

  // Enhanced helper function to get punch in time from timeline  
  const getPunchInFromTimeline = (timeline) => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null;
    
    // Look for punch in events with various possible formats
    const punchInEvents = timeline.filter(event => 
      event.type && (
        event.type.toLowerCase().includes('punch in') ||
        event.type.toLowerCase().includes('punchin') ||
        event.type.toLowerCase() === 'punch_in' ||
        event.type.toLowerCase() === 'punchIn'
      )
    );
    
    if (punchInEvents.length === 0) return null;
    
    // Get the earliest punch in time (first punch in of the day)
    const sortedPunchIns = punchInEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
    return new Date(sortedPunchIns[0].time);
  };

  // Enhanced helper function to get arrival time with multiple fallback sources
  const getArrivalTime = (dailyData) => {
    // Priority 1: Direct arrivalTime field
    if (dailyData.arrivalTime) {
      return new Date(dailyData.arrivalTime);
    }
    
    // Priority 2: First punch in from timeline
    if (dailyData.timeline && Array.isArray(dailyData.timeline)) {
      const punchInTime = getPunchInFromTimeline(dailyData.timeline);
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

  // Enhanced hours calculation with proper rounding
  const calculateHoursFromSeconds = (seconds) => {
    if (!seconds || seconds === 0) return 0;
    return Math.round((seconds / 3600) * 10) / 10;
  };

  // Calculate working days in a date range excluding weekends and holidays
  const calculateWorkingDays = (startDate, endDate, holidays = [], leaves = []) => {
    let workingDays = 0;
    let totalDays = 0;
    
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    const holidayDates = new Set(holidays.map(h => new Date(h.date).toDateString()));
    const leaveDates = new Set(leaves.map(l => {
      const dates = [];
      const start = new Date(l.period?.start || l.startDate);
      const end = new Date(l.period?.end || l.endDate);
      
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toDateString());
      }
      return dates;
    }).flat());

    while (current <= end) {
      totalDays++;
      
      if (isWorkingDay(current) && 
          !holidayDates.has(current.toDateString()) && 
          !leaveDates.has(current.toDateString())) {
        workingDays++;
      }
      
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { workingDays, totalDays };
  };

  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate current week range (Monday → Sunday) in UTC
      const now = new Date();
      const day = now.getUTCDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - diffToMonday,
          0,
          0,
          0
        )
      );
      const sunday = new Date(
        Date.UTC(
          monday.getUTCFullYear(),
          monday.getUTCMonth(),
          monday.getUTCDate() + 6,
          23,
          59,
          59
        )
      );

      // Calculate month range for calendar
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
      );
      const monthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)
      );

      // Fetch all required data in parallel
      const [weeklyRes, leavesRes, holidaysRes] = await Promise.all([
        // Weekly summary and daily data
        axios.get(`${API_BASE}/api/summary/week`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            startDate: monday.toISOString(),
            endDate: sunday.toISOString(),
          },
        }),
        
        // User's approved leaves
        axios.get(`${API_BASE}/api/leaves/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        
        // Holidays for the shift
        axios.get(`${API_BASE}/api/holidays?shift=standard`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      const { dailyData = [], weeklySummary = {} } = weeklyRes.data;
      
      // Filter approved leaves
      const approvedLeaves = leavesRes.data.filter(
        (l) => l.status.toLowerCase() === "approved"
      );

      // Process holidays for current month
      const holidays = holidaysRes.data || [];
      const month = monday.toLocaleString("default", { month: "long" });
      const year = monday.getFullYear();
      const monthIndex = monday.getUTCMonth();

      // Create leave days set for current month
      const leaveDaysSet = new Set();
      approvedLeaves.forEach((leave) => {
        const start = new Date(leave.period?.start || leave.startDate);
        const end = new Date(leave.period?.end || leave.endDate);
        for (
          let d = new Date(start);
          d <= end;
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          if (d.getUTCFullYear() === year && d.getUTCMonth() === monthIndex) {
            leaveDaysSet.add(d.getUTCDate());
          }
        }
      });

      // Create holiday days map for current month
      const holidayDaysMap = {};
      holidays.forEach((h) => {
        const dateObj = new Date(h.date);
        if (
          dateObj.getUTCFullYear() === year &&
          dateObj.getUTCMonth() === monthIndex
        ) {
          holidayDaysMap[dateObj.getUTCDate()] = {
            day: dateObj.getUTCDate(),
            status: "holiday",
            name: h.name,
            type: h.type,
            optional: h.optional,
            workingHours: "0.0"
          };
        }
      });

      // Minimum seconds of work to be marked present (5 hours)
      const MIN_PRESENT_SECONDS = 5 * 3600;

      // Calculate present days based on workDurationSeconds >= 5 hours
      const presentDaysCount = dailyData.filter(
        (d) => (d.workDurationSeconds || 0) >= MIN_PRESENT_SECONDS
      ).length;

      // Calculate working days for this week (excluding weekends, holidays, leaves)
      const weekWorkingDays = calculateWorkingDays(
        monday, 
        sunday, 
        holidays.filter(h => {
          const hDate = new Date(h.date);
          return hDate >= monday && hDate <= sunday;
        }), 
        approvedLeaves.filter(l => {
          const start = new Date(l.period?.start || l.startDate);
          const end = new Date(l.period?.end || l.endDate);
          return (start <= sunday && end >= monday);
        })
      ).workingDays;

      // Calculate total work hours for the week
      const totalWorkHours = dailyData.reduce((sum, d) => 
        sum + calculateHoursFromSeconds(d.workDurationSeconds), 0
      );

      // Calculate attendance rate (present days / expected working days * 100)
      const attendanceRate = weekWorkingDays > 0 ? 
        Math.round((presentDaysCount / weekWorkingDays) * 100) : 0;

      // Calculate on-time rate from daily data
      const onTimeDays = dailyData.filter(d => {
        if ((d.workDurationSeconds || 0) < MIN_PRESENT_SECONDS) return false;
        
        const arrivalDate = getArrivalTime(d);
        if (!arrivalDate) return false;
        
        const expectedStart = d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = new Date(arrivalDate);
        expectedDate.setUTCHours(expH, expM, 0, 0);
        
        return arrivalDate <= expectedDate;
      }).length;

      const onTimeRate = presentDaysCount > 0 ? 
        Math.round((onTimeDays / presentDaysCount) * 100) : 0;

      // Update attendance stats
      setStats({
        attendanceRate,
        presentDays: presentDaysCount,
        totalDays: weekWorkingDays,
        workingHours: totalWorkHours.toFixed(1),
        onTimeRate,
        lastUpdated: "Today",
        period: "This week",
        totalWorkingDaysInWeek: weekWorkingDays,
        totalWeekDays: Math.max(weekWorkingDays, 5) // Show at least 5 for context
      });

      // Map attendance days with enhanced logic
      const attendanceDaysMap = {};
      dailyData.forEach((d) => {
        const dayNum = new Date(d.date).getUTCDate();
        
        const arrivalDate = getArrivalTime(d);
        const punchOutDate = getPunchOutFromTimeline(d.timeline);
        
        const expectedStart = d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = arrivalDate ? new Date(arrivalDate) : new Date(d.date);
        expectedDate.setUTCHours(expH, expM, 0, 0);

        // Determine status
        let status = "absent";
        if ((d.workDurationSeconds || 0) >= MIN_PRESENT_SECONDS) {
          status = "present";
          if (arrivalDate && arrivalDate > expectedDate) {
            status = "late";
          }
        }
        
        const workingHours = calculateHoursFromSeconds(d.workDurationSeconds).toFixed(1);

        attendanceDaysMap[dayNum] = { 
          day: dayNum, 
          status, 
          workingHours,
          arrivalTime: arrivalDate,
          departureTime: punchOutDate,
          metadata: {
            totalBreakTime: calculateHoursFromSeconds(d.breakDurationSeconds).toFixed(1),
            breakSessions: d.breakSessions?.length || 0,
            isFlexible: d.effectiveShift?.isFlexible || false
          }
        };
      });

      // Build full calendar days array
      const maxDays = new Date(year, monthIndex + 1, 0).getDate();
      const days = [];

      for (let i = 1; i <= maxDays; i++) {
        const dateObj = new Date(Date.UTC(year, monthIndex, i));
        const dayOfWeek = dateObj.getUTCDay();
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
          // Future working days or days without data
          const isToday = dateObj.toDateString() === new Date().toDateString();
          const isPast = dateObj < new Date();
          
          days.push({ 
            day: i, 
            status: isPast ? (isToday ? "default" : "absent") : "default", 
            workingHours: "0.0" 
          });
        }
      }

      // Start day of month for calendar alignment
      const firstDayOfMonth = new Date(Date.UTC(year, monthIndex, 1));
      const startDayOfWeek = firstDayOfMonth.getUTCDay();

      setCalendarData({
        month,
        year,
        days,
        startDayOfWeek,
      });

      // Weekly hours chart with proper day mapping
      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyHoursData = weekDays.map((label) => ({
        label,
        hours: 0,
      }));

      // Map daily data to correct weekdays
      dailyData.forEach((d) => {
        const dateObj = new Date(d.date);
        const dayOfWeek = dateObj.getUTCDay();
        const hours = calculateHoursFromSeconds(d.workDurationSeconds);
        weeklyHoursData[dayOfWeek].hours = hours;
      });

      setWeeklyHours(weeklyHoursData);

      // Enhanced recent activity data with better time extraction
      const recent = dailyData.slice(0, 10).map((d) => {
        const arrivalDate = getArrivalTime(d);
        const punchOutDate = getPunchOutFromTimeline(d.timeline);
        
        const expectedStart = d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = arrivalDate ? new Date(arrivalDate) : new Date(d.date);
        expectedDate.setUTCHours(expH, expM, 0, 0);

        let status = "Absent";
        if ((d.workDurationSeconds || 0) >= MIN_PRESENT_SECONDS) {
          if (arrivalDate && arrivalDate > expectedDate) {
            const lateMinutes = Math.floor((arrivalDate - expectedDate) / (1000 * 60));
            status = `Late (${lateMinutes}min)`;
          } else {
            status = "Present";
          }
        }

        // Enhanced time formatting
        const formatTime = (date) => {
          if (!date) return "--";
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          });
        };

        return {
          date: new Date(d.date).toISOString().split("T")[0],
          timeIn: formatTime(arrivalDate),
          timeOut: formatTime(punchOutDate),
          status,
          workingHours: calculateHoursFromSeconds(d.workDurationSeconds).toFixed(1) + "h",
          breakTime: calculateHoursFromSeconds(d.breakDurationSeconds).toFixed(1) + "h",
          // Additional metadata for debugging
          debugInfo: {
            hasArrivalTime: !!d.arrivalTime,
            hasPunchInTimeline: !!(d.timeline && getPunchInFromTimeline(d.timeline)),
            hasPunchOutTimeline: !!(d.timeline && getPunchOutFromTimeline(d.timeline)),
            hasWorkedSessions: !!(d.workedSessions && d.workedSessions.length > 0),
            timelineEvents: d.timeline?.map(t => ({ type: t.type, time: t.time })) || []
          }
        };
      });

      setRecentActivity(recent);
      
      // Debug logging for the first activity
      if (recent.length > 0) {
        console.log("First activity debug info:", recent[0].debugInfo);
      }
      
    } catch (error) {
      console.error("Error loading attendance data:", error);
      setError(error.response?.data?.message || error.message || "Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [token, API_BASE]);

  useEffect(() => {
    fetchAttendanceData();
    const intervalId = setInterval(fetchAttendanceData, 60000);
    return () => clearInterval(intervalId);
  }, [fetchAttendanceData]);

  useEffect(() => {
    const handleAttendanceUpdate = () => fetchAttendanceData();
    window.addEventListener("attendanceDataUpdate", handleAttendanceUpdate);
    return () =>
      window.removeEventListener("attendanceDataUpdate", handleAttendanceUpdate);
  }, [fetchAttendanceData]);

  if (loading) {
    return (
      <div className="p-4 text-gray-100 bg-[#101525] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-gray-100 bg-[#101525] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-red-400 font-semibold mb-2">Error Loading Data</h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <button 
              onClick={fetchAttendanceData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats || !calendarData) {
    return (
      <div className="p-4 text-gray-100 bg-[#101525] min-h-screen flex items-center justify-center">
        <p>No attendance data available</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#101525] text-gray-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />
      <main
        className={`flex-1 p-6 space-y-6 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-100">Attendance Dashboard</h1>
          <button
            onClick={fetchAttendanceData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors text-sm"
          >
            Refresh Data
          </button>
        </div>
        
        <AttendanceStats stats={stats} />
        <div className="grid lg:grid-cols-3 grid-cols-1 gap-6">
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <AttendanceCalendar data={calendarData} />
            <RecentActivityTable activities={recentActivity} />
          </div>
          <WeeklyHoursChart 
            weeklyHours={weeklyHours} 
            targetHours={8} 
            showTarget={true} 
          />
        </div>
      </main>
    </div>
  );
};

export default AttendancePage;