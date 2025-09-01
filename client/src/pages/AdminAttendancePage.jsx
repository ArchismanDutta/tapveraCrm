// File: pages/AdminAttendancePage.jsx
import React, { useEffect, useState } from "react";
import { fetchEmployees, fetchEmployeeSummary } from "../api/adminApi";
// NOTE: corrected imports to components/dashboard (your files are under dashboard)
import EmployeeSelector from "../components/adminattendance/EmployeeSelector";
import DateRangePicker from "../components/adminattendance/DateRangePicker";
import AttendanceSummaryCard from "../components/adminattendance/AttendanceSummaryCard";
import AttendanceCalendar from "../components/adminattendance/AttendanceCalendar";
import LeaveList from "../components/adminattendance/LeaveList";
import WorkHoursChart from "../components/adminattendance/WorkHoursChart";

const AdminAttendancePage = () => {
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

  // Utility: normalise an _id which could be a string or an object { $oid: '...' }
  const normaliseId = (id) => {
    if (!id) return "";
    if (typeof id === "string") return id;
    if (typeof id === "object" && id.$oid) return id.$oid;
    // fallback to string conversion
    try {
      return String(id);
    } catch {
      return "";
    }
  };

  // Load employees on mount (robust)
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetchEmployees();
        console.log("[AdminAttendancePage] fetchEmployees raw response:", res);

        // Resolve array from common shapes
        let dataArray = [];
        if (Array.isArray(res)) dataArray = res;
        else if (Array.isArray(res.data)) dataArray = res.data;
        else if (Array.isArray(res.data?.data)) dataArray = res.data.data;
        else {
          // Try to find any array inside the object
          const arr = Object.values(res || {}).find((v) => Array.isArray(v));
          if (arr) dataArray = arr;
        }

        console.log("[AdminAttendancePage] resolved dataArray:", dataArray);

        // Normalise role and id and filter employees only
        const employeeList = dataArray
          .map((emp) => ({
            ...emp,
            _id: normaliseId(emp._id || emp.id),
            role: (emp.role || "").toString().trim().toLowerCase(),
          }))
          .filter((emp) => emp.role === "employee");

        console.log("[AdminAttendancePage] filtered employeeList:", employeeList);

        setEmployees(employeeList);
        setSelectedEmployee(employeeList.length > 0 ? employeeList[0] : null);
      } catch (err) {
        console.error("[AdminAttendancePage] loadEmployees error:", err);
        setEmployees([]);
        setSelectedEmployee(null);
      }
    }

    loadEmployees();
  }, []);

  // Load employee summary when selectedEmployee or dateRange changes
  useEffect(() => {
    if (!selectedEmployee || !dateRange.startDate || !dateRange.endDate) {
      setSummaryData(null);
      return;
    }

    setLoading(true);

    async function loadSummary() {
      try {
        const res = await fetchEmployeeSummary(
          selectedEmployee._id,
          dateRange.startDate,
          dateRange.endDate
        );
        console.log("[AdminAttendancePage] fetchEmployeeSummary:", res);

        if (res?.success) {
          setSummaryData(res);
        } else if (Array.isArray(res)) {
          // if API returned array directly (rare), handle gracefully
          setSummaryData({ summary: {}, attendanceRecords: res, leaves: [] });
        } else {
          console.warn("No summary data or unexpected response:", res);
          setSummaryData(null);
        }
      } catch (err) {
        console.error("Failed to load summary", err);
        setSummaryData(null);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [selectedEmployee, dateRange]);

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white w-full">
  <h1 className="text-3xl font-bold mb-6">Employee Attendance Overview</h1>

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

  {loading && (
    <p className="text-center text-gray-300 my-6">Loading summary...</p>
  )}

  {!loading && summaryData ? (
    <>
      <AttendanceSummaryCard summary={summaryData.summary} />
      <AttendanceCalendar dailyData={summaryData.attendanceRecords} />
      <LeaveList leaves={summaryData.leaves} />
      <WorkHoursChart dailyData={summaryData.attendanceRecords} />
    </>
  ) : (
    !loading && (
      <p className="text-center text-gray-400 my-6">
        No data to display. Please select an employee and date range.
      </p>
    )
  )}
</div>

  );
};

export default AdminAttendancePage;
