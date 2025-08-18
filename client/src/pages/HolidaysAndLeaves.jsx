import React, { useState, useEffect } from "react";
import LeaveSummary from "../components/leaves/LeaveSummary";
import RecentLeaveRequests from "../components/leaves/RecentLeaveRequests";
import LeaveApplicationForm from "../components/leaves/LeaveApplicationForm";
import HolidayList from "../components/leaves/HolidayList";
import TeamLeaveCalendar from "../components/leaves/TeamLeaveCalendar";
import Sidebar from "../components/dashboard/Sidebar";
import { fetchLeavesForEmployee, submitLeaveRequest } from "../api/leaveApi";

const MAX_REQUESTS = 4;

const HolidaysAndLeaves = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [leaveSummary, setLeaveSummary] = useState({
    available: 18,
    taken: 0,
    pending: 0,
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const holidays = [
    { name: "Halloween", date: "Oct 31", type: "Public Holiday" },
    { name: "Thanksgiving", date: "Nov 23", type: "Public Holiday" },
    { name: "Black Friday", date: "Nov 24", type: "Public Holiday" },
  ];

  const teamLeaves = [
    { name: "John Doe", dates: "Oct 20-22", type: "Vacation" },
    { name: "Jane Smith", dates: "Oct 25", type: "Sick Leave" },
    { name: "Mike Johnson", dates: "Nov 1-3", type: "Vacation" },
  ];

  const leaveTypeMap = {
    "Paid Leave": "paid",
    "Unpaid Leave": "unpaid",
    "Sick Leave": "sick",
    "Annual Leave": "annual",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchLeavesForEmployee();
        setLeaveRequests(data.slice(0, MAX_REQUESTS));
        const takenLeaves = data.filter((r) => r.status === "Approved").length;
        const pendingLeaves = data.filter((r) => r.status === "Pending").length;
        const availableLeaves = 18 - takenLeaves;
        setLeaveSummary({
          available: availableLeaves,
          taken: takenLeaves,
          pending: pendingLeaves,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLeaveSubmit = async ({ leaveType, startDate, endDate, reason }) => {
    try {
      const typeNormalized = leaveTypeMap[leaveType] || "paid";
      const newLeavePayload = { type: typeNormalized, startDate, endDate, reason };
      const newLeave = await submitLeaveRequest(newLeavePayload);
      setLeaveRequests((prev) => [newLeave, ...prev].slice(0, MAX_REQUESTS));
      setLeaveSummary((prev) => ({
        available: prev.available > 0 ? prev.available - 1 : 0,
        taken: prev.taken,
        pending: prev.pending + 1,
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8">Loading your leave data...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />
      <main
        className={`flex-1 transition-all duration-300 overflow-y-auto ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Leaves</h2>
              <LeaveSummary {...leaveSummary} />
            </div>
            <div className="space-y-4">
              <RecentLeaveRequests requests={leaveRequests} />
              <LeaveApplicationForm onSubmitLeave={handleLeaveSubmit} />
            </div>
          </div>
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Team & Holidays</h2>
            <HolidayList holidays={holidays} />
            <TeamLeaveCalendar teamLeaves={teamLeaves} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default HolidaysAndLeaves;
