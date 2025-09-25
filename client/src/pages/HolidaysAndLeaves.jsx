import React, { useState, useEffect, useRef } from "react";
import LeaveSummary from "../components/leaves/LeaveSummary";
import RecentLeaveRequests from "../components/leaves/RecentLeaveRequests";
import LeaveApplicationForm from "../components/leaves/LeaveApplicationForm";
import HolidayList from "../components/leaves/HolidayList";
import TeamLeaveCalendar from "../components/leaves/TeamLeaveCalendar";
import EditLeaveRequestModal from "../components/leaves/EditLeaveRequestModal";
import Sidebar from "../components/dashboard/Sidebar";
import { fetchLeavesForEmployee, submitLeaveRequest, updateLeaveRequest } from "../api/leaveApi";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const MAX_REQUESTS = 4;
const POLL_INTERVAL = 5000; // 5 seconds

const HolidaysAndLeaves = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [leaveSummary, setLeaveSummary] = useState({
    available: 18,
    taken: 0,
    pending: 0,
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [errorLeaves, setErrorLeaves] = useState(null);

  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(true);
  const [errorHolidays, setErrorHolidays] = useState(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  const pollingRef = useRef(null);

  const importantNotices = [
    "All leaves should be applied at least 7 days in advance.",
    "Unconfirmed employees are only eligible for unpaid leaves.",
    "Leaves on Fridays or Mondays will lead to a club deduction with weekends too.",
    "Sudden sick leave needs to reported the same day with supporting documents.",
    "Uninformed leave of more than 3 days is regarded as absconding.",
    "Confirmed employees not taking leaves are eligible for encashment after 6 months.",
  ];

  // Fetch leaves and update summary
  const loadLeaves = async () => {
    try {
      const data = await fetchLeavesForEmployee();
      const safeData = Array.isArray(data) ? data : [];

      const takenLeaves = safeData.filter(
        (r) => r.status === "Approved"
      ).length;
      const pendingLeaves = safeData.filter(
        (r) => r.status === "Pending"
      ).length;

      setLeaveRequests(safeData.slice(0, MAX_REQUESTS));
      setLeaveSummary({
        available: Math.max(0, 18 - takenLeaves),
        taken: takenLeaves,
        pending: pendingLeaves,
      });
      setErrorLeaves(null);
    } catch (err) {
      setErrorLeaves(err.message || "Failed to fetch leave requests");
    } finally {
      setLoadingLeaves(false);
    }
  };

  // Fetch holidays from backend
  const loadHolidays = async () => {
    try {
      setLoadingHolidays(true);
      const res = await axios.get(`${API_BASE}/api/holidays?shift=ALL`);
      const data = res.data.map((h) => ({
        name: h.name,
        date: new Date(h.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        type: h.type,
      }));
      setHolidays(data);
      setErrorHolidays(null);
    } catch (err) {
      console.error("Failed to fetch holidays:", err);
      setHolidays([]);
      setErrorHolidays("Failed to load holidays");
    } finally {
      setLoadingHolidays(false);
    }
  };

  // Initial load + polling for leaves
  useEffect(() => {
    loadLeaves();
    loadHolidays();
    pollingRef.current = setInterval(loadLeaves, POLL_INTERVAL);

    return () => clearInterval(pollingRef.current);
  }, []);

  // Handle leave submission from LeaveApplicationForm
  const handleLeaveSubmit = async (formData) => {
    try {
      const newLeave = await submitLeaveRequest(formData);

      setLeaveRequests((prev) => [newLeave, ...prev].slice(0, MAX_REQUESTS));
      setLeaveSummary((prev) => ({
        available: Math.max(0, prev.available - 1),
        taken: prev.taken,
        pending: prev.pending + 1,
      }));
      setErrorLeaves(null);
    } catch (err) {
      console.error(err);
      setErrorLeaves(err.message || "Failed to submit leave request");
    }
  };

  // Handle opening edit modal
  const handleEditRequest = (leaveRequest) => {
    setEditingRequest(leaveRequest);
    setEditModalOpen(true);
  };

  // Handle closing edit modal
  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingRequest(null);
  };

  // Handle saving edited leave request
  const handleSaveEditedRequest = async (leaveId, formData) => {
    try {
      const updatedLeave = await updateLeaveRequest(leaveId, formData);

      // Update the leave request in the local state
      setLeaveRequests((prev) =>
        prev.map((req) => (req._id === leaveId ? updatedLeave : req))
      );

      setErrorLeaves(null);
    } catch (err) {
      console.error("Failed to update leave request:", err);
      throw new Error(err.message || "Failed to update leave request");
    }
  };

  // Global loading/error
  if (loadingLeaves && loadingHolidays)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#141a29] via-[#181d2a] to-[#1b2233] text-blue-100 font-medium text-lg">
        Loading your leave and holiday data...
      </div>
    );
  if (errorLeaves || errorHolidays)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#141a29] via-[#181d2a] to-[#1b2233] text-red-600 font-semibold text-lg">
        {errorLeaves && <p>Error fetching leaves: {errorLeaves}</p>}
        {errorHolidays && <p>Error fetching holidays: {errorHolidays}</p>}
      </div>
    );

  return (
    <div className="flex bg-gradient-to-br from-[#141a29] via-[#181d2a] to-[#1b2233] min-h-screen font-sans text-blue-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />
      <main
        className={`flex-1 p-8 transition-all duration-300 overflow-y-auto ${
          collapsed ? "ml-24" : "ml-72"
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Leaves */}
          <section className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-blue-100 mb-4">
                Your Leaves
              </h2>
              <LeaveSummary
                {...leaveSummary}
                importantNotices={importantNotices}
              />
            </div>
            <div className="space-y-4">
              <RecentLeaveRequests
                requests={leaveRequests}
                onEditRequest={handleEditRequest}
              />
              <LeaveApplicationForm onSubmitLeave={handleLeaveSubmit} />
            </div>
          </section>

          {/* Team & Holidays */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-blue-100 mb-4">
              Team & Holidays
            </h2>
            <HolidayList holidays={holidays} />
            <TeamLeaveCalendar />
          </section>
        </div>
      </main>

      {/* Edit Leave Request Modal */}
      <EditLeaveRequestModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        leaveRequest={editingRequest}
        onSave={handleSaveEditedRequest}
      />
    </div>
  );
};

export default HolidaysAndLeaves;
