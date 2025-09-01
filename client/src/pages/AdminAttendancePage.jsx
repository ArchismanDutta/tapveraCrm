import React, { useEffect, useState } from "react";
import { fetchEmployees, fetchEmployeeSummary } from "../api/adminApi";
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
    // Default date range: current month
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

  // Load employees on mount
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetchEmployees();
        setEmployees(res.data);
        if (res.data.length > 0) {
          setSelectedEmployee(res.data[0]); // Select first employee by default
        }
      } catch (err) {
        console.error("Failed to load employees", err);
      }
    }
    loadEmployees();
  }, []);

  // Load summary when employee or date range changes
  useEffect(() => {
    if (!selectedEmployee || !dateRange.startDate || !dateRange.endDate) return;

    setLoading(true);
    async function loadSummary() {
      try {
        const res = await fetchEmployeeSummary(
          selectedEmployee._id,
          dateRange.startDate,
          dateRange.endDate
        );
        setSummaryData(res.data);
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
    <div className="p-6 bg-gray-900 min-h-screen text-white max-w-7xl mx-auto">
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

      {loading && <p className="text-center text-gray-300">Loading summary...</p>}

      {!loading && summaryData && (
        <>
          <AttendanceSummaryCard summary={summaryData.summary} />
          <AttendanceCalendar dailyData={summaryData.attendanceRecords} />
          <LeaveList leaves={summaryData.leaves} />
          <WorkHoursChart dailyData={summaryData.attendanceRecords} />
        </>
      )}

      {!loading && !summaryData && (
        <p className="text-center text-gray-400">No data to display. Please select employee and date range.</p>
      )}
    </div>
  );
};

export default AdminAttendancePage;
