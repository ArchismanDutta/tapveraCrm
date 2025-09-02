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
  const token = localStorage.getItem("token");

  const fetchAttendanceData = useCallback(async () => {
    try {
      // 1️⃣ Calculate current week range (Monday → Sunday) in UTC
      const now = new Date();
      const day = now.getUTCDay(); // Sunday=0
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

      // 2️⃣ Fetch weekly summary and daily attendance data
      const res = await axios.get("/api/summary/week", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          startDate: monday.toISOString(),
          endDate: sunday.toISOString(),
        },
      });

      const { dailyData = [], weeklySummary = {} } = res.data;

      // 3️⃣ Parse work hours helpers
      const parseHours = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(" ");
        const h = parseInt(parts[0].replace("h", ""), 10) || 0;
        const m = parseInt(parts[1].replace("m", ""), 10) || 0;
        return h + m / 60;
      };
      const truncateTwoDecimals = (num) => Math.floor(num * 100) / 100;

      // 4️⃣ Update stats
      setStats({
        attendanceRate: Math.round(
          weeklySummary.onTimeRate?.replace("%", "") || 0
        ),
        presentDays: dailyData.filter((d) => d.arrivalTime).length,
        totalDays: 30,
        workingHours: truncateTwoDecimals(parseHours(weeklySummary.totalWork)),
        onTimeRate: parseInt(weeklySummary.onTimeRate) || 0,
        lastUpdated: "Today",
        period: "This week",
      });

      // 5️⃣ Prepare calendar data with holiday integration
      const month = monday.toLocaleString("default", { month: "long" });
      const year = monday.getFullYear();
      const monthIndex = monday.getUTCMonth();

      // Fetch holidays for the relevant shift ("standard")
      const holidaysRes = await axios.get(`/api/holidays?shift=standard`);

      // Map holidays by day number for this month and year
      const holidayDaysMap = {};
      holidaysRes.data.forEach((h) => {
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
          };
        }
      });

      // Map attendance data by day for quick lookup
      const attendanceDaysMap = {};
      dailyData.forEach((d) => {
        const dayNum = new Date(d.date).getUTCDate();

        const arrivalDate = d.arrivalTime ? new Date(d.arrivalTime) : null;
        const expectedStart =
          d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = arrivalDate
          ? new Date(arrivalDate)
          : new Date(d.date);
        expectedDate.setUTCHours(expH, expM, 0, 0);

        let status = "present";
        if (!arrivalDate) status = "absent";
        else if (arrivalDate > expectedDate) status = "late";

        attendanceDaysMap[dayNum] = { day: dayNum, status };
      });

      // 6️⃣ Build full days array including weekends marked as holidays
      const maxDays = new Date(year, monthIndex + 1, 0).getDate();
      const days = [];
      for (let i = 1; i <= maxDays; i++) {
        const dateObj = new Date(Date.UTC(year, monthIndex, i));
        const dayOfWeek = dateObj.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (holidayDaysMap[i]) {
          days.push(holidayDaysMap[i]);
        } else if (isWeekend) {
          days.push({ day: i, status: "holiday" });
        } else if (attendanceDaysMap[i]) {
          days.push(attendanceDaysMap[i]);
        } else {
          days.push({ day: i, status: "default" });
        }
      }

      const firstDayOfMonth = new Date(Date.UTC(year, monthIndex, 1));
      const startDayOfWeek = firstDayOfMonth.getUTCDay();

      setCalendarData({
        month,
        year,
        days,
        startDayOfWeek,
      });

      // 7️⃣ Weekly hours chart setup
      const hoursByWeekday = Array(7).fill(0);
      dailyData.forEach((d) => {
        const dt = new Date(d.date);
        if (d.workDurationSeconds)
          hoursByWeekday[dt.getUTCDay()] += d.workDurationSeconds / 3600;
      });

      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      setWeeklyHours(
        weekDays.map((label, idx) => ({
          label,
          hours: Math.round(hoursByWeekday[idx] * 10) / 10,
        }))
      );

      // 8️⃣ Prepare recent activity table data
      const recent = dailyData.slice(0, 10).map((d) => {
        const arrivalDate = d.arrivalTime ? new Date(d.arrivalTime) : null;
        const expectedStart =
          d.effectiveShift?.start || d.expectedStartTime || "09:00";
        const [expH, expM] = expectedStart.split(":").map(Number);
        const expectedDate = arrivalDate
          ? new Date(arrivalDate)
          : new Date(d.date);
        expectedDate.setUTCHours(expH, expM, 0, 0);

        const lastWorked =
          d.workedSessions?.[d.workedSessions.length - 1] || {};
        const punchOut = lastWorked.end ? new Date(lastWorked.end) : null;

        return {
          date: new Date(d.date).toISOString().split("T")[0],
          timeIn: arrivalDate
            ? arrivalDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--",
          timeOut: punchOut
            ? punchOut.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--",
          status: !arrivalDate
            ? "Absent"
            : arrivalDate > expectedDate
            ? "Late"
            : "Present",
        };
      });

      setRecentActivity(recent);
    } catch (error) {
      console.error("Error loading attendance data:", error);
    }
  }, [token]);

  // Refresh every 1 minute
  useEffect(() => {
    fetchAttendanceData();
    const intervalId = setInterval(fetchAttendanceData, 60000);
    return () => clearInterval(intervalId);
  }, [fetchAttendanceData]);

  // Listen for attendance updates
  useEffect(() => {
    const handleAttendanceUpdate = () => fetchAttendanceData();
    window.addEventListener("attendanceDataUpdate", handleAttendanceUpdate);
    return () =>
      window.removeEventListener(
        "attendanceDataUpdate",
        handleAttendanceUpdate
      );
  }, [fetchAttendanceData]);

  if (!stats || !calendarData) {
    return (
      <div className="p-4 text-gray-100 bg-[#101525] min-h-screen flex items-center justify-center">
        Loading attendance data...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#101525] text-gray-100">
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
      />
      <main
        className={`flex-1 p-6 space-y-6 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        <AttendanceStats stats={stats} />
        <div className="grid lg:grid-cols-3 grid-cols-1 gap-6">
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <AttendanceCalendar data={calendarData} />
            <RecentActivityTable activities={recentActivity} />
          </div>
          <WeeklyHoursChart weeklyHours={weeklyHours} />
        </div>
      </main>
    </div>
  );
};

export default AttendancePage;
