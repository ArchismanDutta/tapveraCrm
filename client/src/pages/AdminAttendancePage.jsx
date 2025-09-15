// File: pages/AdminAttendancePage.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import { fetchEmployees, fetchEmployeeSummary } from "../api/adminApi";
import EmployeeSelector from "../components/adminattendance/EmployeeSelector";
import DateRangePicker from "../components/adminattendance/DateRangePicker";
import AttendanceSummaryCard from "../components/adminattendance/AttendanceSummaryCard";
import AttendanceCalendar from "../components/adminattendance/AttendanceCalendar";
import LeaveList from "../components/adminattendance/LeaveList";
import WorkHoursChart from "../components/adminattendance/WorkHoursChart";

const AdminAttendancePage = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    return { startDate: start, endDate: end };
  });
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);

  const userRole = localStorage.getItem("role") || "admin";

  // Utility to normalize IDs
  const normalizeId = (id) => {
    if (!id) return "";
    if (typeof id === "string") return id;
    if (typeof id === "object" && id.$oid) return id.$oid;
    return String(id);
  };

  // Convert UTC date to IST
  const toIST = (date) => {
    if (!date) return null;
    const istOffset = 5.5 * 60; // minutes
    return new Date(new Date(date).getTime() + istOffset * 60000);
  };

  // Compute first punch-in and last punch-out using timeline events to avoid counting break as punch-out
  const computePunchTimes = (dailyData = []) => {
    let firstPunchIn = null;
    let lastPunchOut = null;

    dailyData.forEach((day) => {
      // Skip absent days
      if (day.isAbsent) return;

      // First punch-in: prefer timeline event type includes 'punch in'; fallback to arrivalTime
      if (Array.isArray(day.timeline) && day.timeline.length) {
        const punchIns = day.timeline
          .filter((e) => typeof e.type === 'string' && e.type.toLowerCase().includes('punch in') && e.time)
          .map((e) => toIST(e.time))
          .filter(Boolean)
          .sort((a, b) => a - b);
        if (punchIns.length) {
          if (!firstPunchIn || punchIns[0] < firstPunchIn) firstPunchIn = punchIns[0];
        }
      }
      if (!firstPunchIn && day.arrivalTime) {
        const arrival = toIST(day.arrivalTime);
        if (!firstPunchIn || arrival < firstPunchIn) firstPunchIn = arrival;
      }

      // Last punch-out: strictly from timeline 'punch out' events (avoid treating break as punch-out)
      if (Array.isArray(day.timeline) && day.timeline.length) {
        const punchOuts = day.timeline
          .filter((e) => typeof e.type === 'string' && e.type.toLowerCase().includes('punch out') && e.time)
          .map((e) => toIST(e.time))
          .filter(Boolean)
          .sort((a, b) => a - b);
        if (punchOuts.length) {
          const last = punchOuts[punchOuts.length - 1];
          if (!lastPunchOut || last > lastPunchOut) lastPunchOut = last;
        }
      }
    });

    // Format to HH:MM AM/PM
    const formatTime = (date) => {
      if (!date) return "-";
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")} ${ampm}`;
    };

    return {
      firstPunchIn: formatTime(firstPunchIn),
      lastPunchOut: formatTime(lastPunchOut),
    };
  };

  // Fetch employees
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await fetchEmployees();
        let dataArray = [];

        if (Array.isArray(res)) dataArray = res;
        else if (Array.isArray(res.data)) dataArray = res.data;
        else if (Array.isArray(res.data?.data)) dataArray = res.data.data;
        else {
          const arr = Object.values(res || {}).find((v) => Array.isArray(v));
          if (arr) dataArray = arr;
        }

        const employeeList = dataArray
          .map((emp) => ({
            ...emp,
            _id: normalizeId(emp._id || emp.id),
            role: (emp.role || "").toString().trim().toLowerCase(),
          }))
          .filter((emp) => emp.role === "employee");

        setEmployees(employeeList);
        setSelectedEmployee(employeeList[0] || null);
      } catch (err) {
        console.error("[AdminAttendancePage] loadEmployees error:", err);
        setEmployees([]);
        setSelectedEmployee(null);
      }
    };

    loadEmployees();
  }, []);

  // Fetch employee summary
  useEffect(() => {
    if (!selectedEmployee || !dateRange.startDate || !dateRange.endDate) {
      setSummaryData(null);
      return;
    }

    const loadSummary = async () => {
      setLoading(true);
      try {
        const res = await fetchEmployeeSummary(
          selectedEmployee._id,
          dateRange.startDate,
          dateRange.endDate
        );

        if (res?.success) {
          const dailyData = res.dailyData || [];
          const { firstPunchIn, lastPunchOut } = computePunchTimes(dailyData);

          // Format hours like "Xh Ym" for display
          const formatHoursHM = (hoursStrOrNum) => {
            const hoursNum = parseFloat(hoursStrOrNum || 0);
            const totalMinutes = Math.round(hoursNum * 60);
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            return `${h}h ${m.toString().padStart(2, "0")}m`;
          };

          const summaryWithPunch = {
            ...res.summary,
            totalWorkHours: formatHoursHM(res.summary?.totalWorkHours),
            totalBreakHours: formatHoursHM(res.summary?.totalBreakHours),
            firstPunchIn,
            lastPunchOut,
          };

          setSummaryData({
            ...res,
            summary: summaryWithPunch,
            dailyData,
            leaves: res.leaves || [],
          });
        } else {
          setSummaryData(null);
          console.warn("[AdminAttendancePage] Unexpected summary response:", res);
        }
      } catch (err) {
        console.error("[AdminAttendancePage] loadSummary error:", err);
        setSummaryData(null);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [selectedEmployee, dateRange]);

  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole}
        onLogout={() => console.log("Logout clicked")}
      />

      {/* Main content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-16" : "ml-56"
        } p-6 bg-gray-900 min-h-screen text-white`}
      >
        <h1 className="text-3xl font-bold mb-6">Employee Attendance Overview</h1>

        {/* Employee Selector + Date Range */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1">
            <EmployeeSelector
              employees={employees}
              selected={selectedEmployee}
              onSelect={setSelectedEmployee}
            />
          </div>
          <div className="flex-1">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <p className="text-center text-gray-300 my-6">Loading summary...</p>
        )}

        {/* Attendance Data */}
        {!loading && summaryData ? (
          <>
            <AttendanceSummaryCard summary={summaryData.summary} />

            {/* Calendar */}
            <div className="my-6 border border-gray-700 rounded-lg p-4 shadow-lg bg-gray-800">
              <h2 className="text-xl font-semibold mb-4">Attendance Calendar</h2>
              <AttendanceCalendar
                dailyData={summaryData.dailyData}
                colorScheme={{
                  work: "bg-gradient-to-r from-green-400 to-green-600",
                  break: "bg-yellow-400",
                  leave: "bg-red-500",
                }}
                showTooltip
                rounded
              />
            </div>

            {/* Leave List */}
            <div className="my-6 border border-gray-700 rounded-lg p-4 shadow-lg bg-gray-800">
              <h2 className="text-xl font-semibold mb-4">Leaves Taken</h2>
              <LeaveList leaves={summaryData.leaves} />
            </div>

            {/* Work Hours Chart */}
            <div className="my-6 border border-gray-700 rounded-lg p-4 shadow-lg bg-gray-800">
              <h2 className="text-xl font-semibold mb-4">Work Hours Chart</h2>
              <WorkHoursChart
                dailyData={summaryData.dailyData}
                gradientColors={["#f19ad2", "#ab4ee1", "#9743c8"]}
                showTooltip
                rounded
              />
            </div>
          </>
        ) : (
          !loading && (
            <p className="text-center text-gray-400 my-6">
              No data to display. Please select an employee and date range.
            </p>
          )
        )}
      </div>
    </div>
  );
};

export default AdminAttendancePage;
