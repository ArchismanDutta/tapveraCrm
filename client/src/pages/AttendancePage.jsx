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
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const res = await axios.get("/api/summary/week", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          startDate: monday.toISOString(),
          endDate: sunday.toISOString(),
        },
      });

      const data = res.data;
      const dailyData = data.dailyData || [];
      const weeklySummary = data.weeklySummary || {};

      const parseHours = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(" ");
        if (parts.length < 2) return 0;

        const hoursPart = parts[0] ? String(parts[0]) : "";
        const minsPart = parts[1] ? String(parts[1]) : "";

        const h = parseInt(hoursPart.replace("h", ""), 10) || 0;
        const m = parseInt(minsPart.replace("m", ""), 10) || 0;

        return h + m / 60;
      };

      const truncateTwoDecimals = (num) => {
        return Math.floor(num * 100) / 100;
      };

      setStats({
        attendanceRate: Math.round(weeklySummary.onTimeRate?.replace("%", "") || 0),
        presentDays: dailyData.length,
        totalDays: 30,
        workingHours: truncateTwoDecimals(parseHours(weeklySummary.totalWork)),
        onTimeRate: parseInt(weeklySummary.onTimeRate) || 0,
        lastUpdated: "Today",
        period: "This month",
      });

      const month = monday.toLocaleString("default", { month: "long" });
      const year = monday.getFullYear();

      const daysWithStatus = dailyData.map((d) => {
        const arrivalDate = new Date(d.arrivalTime);
        const expectedParts = (d.expectedStartTime || "09:00").split(":");
        const expectedDate = new Date(arrivalDate);
        expectedDate.setHours(+expectedParts[0], +expectedParts[1], 0, 0);

        let status = "present";
        if (!d.arrivalTime) status = "absent";
        else if (arrivalDate > expectedDate) status = "late";

        return { day: new Date(d.date).getDate(), status };
      });

      setCalendarData({
        month,
        year,
        days: daysWithStatus,
        startDayOfWeek: monday.getDay(),
      });

      const hoursByWeekday = Array(7).fill(0);
      dailyData.forEach((d) => {
        const dt = new Date(d.date);
        if (d.workDurationSeconds) hoursByWeekday[dt.getDay()] += d.workDurationSeconds / 3600;
      });
      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      setWeeklyHours(
        weekDays.map((label, idx) => ({
          label,
          hours: Math.round(hoursByWeekday[idx] * 10) / 10,
        }))
      );

      setRecentActivity(
        dailyData.slice(0, 10).map((d) => {
          const arrivalDate = new Date(d.arrivalTime);
          const expectedParts = (d.expectedStartTime || "09:00").split(":");
          const expectedDate = new Date(arrivalDate);
          expectedDate.setHours(+expectedParts[0], +expectedParts[1], 0, 0);

          return {
            date: new Date(d.date).toISOString().split("T")[0],
            timeIn: d.arrivalTime
              ? arrivalDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--",
            timeOut: "--", // enrich if available
            status: !d.arrivalTime ? "Absent" : arrivalDate > expectedDate ? "Late" : "Present",
          };
        })
      );
    } catch (error) {
      console.error("Error loading attendance data:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchAttendanceData();
    const intervalId = setInterval(fetchAttendanceData, 60000);
    return () => clearInterval(intervalId);
  }, [fetchAttendanceData]);

  useEffect(() => {
    function handleAttendanceUpdate() {
      fetchAttendanceData();
    }
    window.addEventListener("attendanceDataUpdate", handleAttendanceUpdate);
    return () => window.removeEventListener("attendanceDataUpdate", handleAttendanceUpdate);
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
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" />
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
