import React, { useState, useEffect, useRef } from "react";
import LeaveSummary from "../components/leaves/LeaveSummary";
import RecentLeaveRequests from "../components/leaves/RecentLeaveRequests";
import LeaveApplicationForm from "../components/leaves/LeaveApplicationForm";
import HolidayList from "../components/leaves/HolidayList";
import TeamLeaveCalendar from "../components/leaves/TeamLeaveCalendar";
import Sidebar from "../components/dashboard/Sidebar";
import { fetchLeavesForEmployee, submitLeaveRequest } from "../api/leaveApi";

const MAX_REQUESTS = 4;
const POLL_INTERVAL = 5000; // 5 seconds

const HolidaysAndLeaves = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [leaveSummary, setLeaveSummary] = useState({ available: 18, taken: 0, pending: 0 });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

  const importantNotices = [
    "All leaves should be applied at least 7 days in advance.",
    "Unconfirmed employees are only eligible for unpaid leaves.",
    "Leaves on Fridays or Mondays will lead to a club deduction with weekends too.",
    "Sudden sick leave needs to reported the same day with supporting documents.",
    "Uninformed leave of more than 3 days is regarded as absconding.",
    "Confirmed employees not taking leaves are eligible for encashment after 6 months."
  ];

  const holidays = [
    { name: "Halloween", date: "Oct 31", type: "Public Holiday" },
    { name: "Thanksgiving", date: "Nov 23", type: "Public Holiday" },
    { name: "Black Friday", date: "Nov 24", type: "Public Holiday" },
  ];

  // Fetch leaves and update summary
  const loadLeaves = async () => {
    try {
      const data = await fetchLeavesForEmployee();
      const safeData = Array.isArray(data) ? data : [];

      const takenLeaves = safeData.filter(r => r.status === "Approved").length;
      const pendingLeaves = safeData.filter(r => r.status === "Pending").length;

      setLeaveRequests(safeData.slice(0, MAX_REQUESTS));
      setLeaveSummary({
        available: Math.max(0, 18 - takenLeaves),
        taken: takenLeaves,
        pending: pendingLeaves,
      });
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to fetch leave requests");
      setLoading(false);
    }
  };

  // Initial load + polling
  useEffect(() => {
    setLoading(true);
    loadLeaves();
    pollingRef.current = setInterval(loadLeaves, POLL_INTERVAL);

    return () => clearInterval(pollingRef.current);
  }, []);

  // Handle leave submission from LeaveApplicationForm
  const handleLeaveSubmit = async (formData) => {
    try {
      const newLeave = await submitLeaveRequest(formData);

      setLeaveRequests(prev => [newLeave, ...prev].slice(0, MAX_REQUESTS));
      setLeaveSummary(prev => ({
        available: Math.max(0, prev.available - 1),
        taken: prev.taken,
        pending: prev.pending + 1,
      }));
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to submit leave request");
    }
  };

  if (loading) return <div className="p-8">Loading your leave data...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="flex h-screen bg-gray-50 relative">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" onLogout={onLogout} />
      <main className={`flex-1 transition-all duration-300 overflow-y-auto ${collapsed ? "ml-20" : "ml-64"}`}>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Employee Leaves */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Leaves</h2>
              <LeaveSummary {...leaveSummary} importantNotices={importantNotices} />
            </div>
            <div className="space-y-4">
              <RecentLeaveRequests requests={leaveRequests} />
              <LeaveApplicationForm onSubmitLeave={handleLeaveSubmit} />
            </div>
          </div>

          {/* Team & Holidays */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Team & Holidays</h2>
            <HolidayList holidays={holidays} />
            <TeamLeaveCalendar />
          </div>

        </div>
      </main>
    </div>
  );
};

export default HolidaysAndLeaves;
