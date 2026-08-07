import React, { useState, useEffect } from "react";
import LeaveSummary from "../components/leaves/LeaveSummary";
import RecentLeaveRequests from "../components/leaves/RecentLeaveRequests";
import LeaveApplicationForm from "../components/leaves/LeaveApplicationForm";
import HolidayList from "../components/leaves/HolidayList";
import TeamLeaveCalendar from "../components/leaves/TeamLeaveCalendar";
import EditLeaveRequestModal from "../components/leaves/EditLeaveRequestModal";
import Sidebar from "../components/dashboard/Sidebar";
import { AlertCircle, CalendarDays, RefreshCw } from "lucide-react";
import { fetchLeavesForEmployee, submitLeaveRequest, updateLeaveRequest } from "../api/leaveApi";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const MAX_REQUESTS = 4;

const getRequestedDays = (request) => {
  if (request?.type === "halfDay") return 0.5;
  const start = request?.period?.start ? new Date(request.period.start) : null;
  const end = request?.period?.end ? new Date(request.period.end) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000) + 1);
};

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

  const importantNotices = [
    "All leaves should be applied at least 7 days in advance.",
    "Unconfirmed employees are only eligible for unpaid leaves.",
    "Leaves on Fridays or Mondays will lead to a club deduction with weekends too.",
    "Sudden sick leave must be reported the same day with supporting documents.",
    "Uninformed leave of more than 3 days is regarded as absconding.",
    "Confirmed employees not taking leaves are eligible for encashment after 6 months.",
  ];

  // Fetch leaves and update summary
  const loadLeaves = async () => {
    try {
      const data = await fetchLeavesForEmployee();
      const safeData = Array.isArray(data) ? data : [];

      const takenLeaves = safeData
        .filter((request) => request.status === "Approved")
        .reduce((total, request) => total + getRequestedDays(request), 0);
      const pendingLeaves = safeData
        .filter((request) => request.status === "Pending")
        .reduce((total, request) => total + getRequestedDays(request), 0);

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
      const source = Array.isArray(res.data) ? res.data : [];
      const data = source.map((h) => ({
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

  // Initial load, then event-driven: the server emits "leave:updated"
  // (bridged to this window event by WebSocketContext.jsx) whenever this
  // employee's leave request is created or approved/rejected, so a 30s
  // re-poll is redundant with it.
  useEffect(() => {
    loadLeaves();
    loadHolidays();
    window.addEventListener("leave-updated", loadLeaves);
    return () => window.removeEventListener("leave-updated", loadLeaves);
  }, []);

  // Handle leave submission from LeaveApplicationForm
  const handleLeaveSubmit = async (formData) => {
    try {
      const newLeave = await submitLeaveRequest(formData);

      setLeaveRequests((prev) => [newLeave, ...prev].slice(0, MAX_REQUESTS));
      setLeaveSummary((prev) => ({
        available: prev.available,
        taken: prev.taken,
        pending: prev.pending + getRequestedDays(newLeave),
      }));
      setErrorLeaves(null);
    } catch (err) {
      console.error(err);
      setErrorLeaves(err.message || "Failed to submit leave request");
      throw err;
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

      await loadLeaves();

      setErrorLeaves(null);
    } catch (err) {
      console.error("Failed to update leave request:", err);
      throw new Error(err.message || "Failed to update leave request");
    }
  };

  // Initial loading state
  if (loadingLeaves && loadingHolidays)
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="h-14 w-14 rounded-full border-2 border-blue-200 dark:border-blue-300/20" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">Preparing leave requests...</p>
        </div>
      </div>
    );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />
      <main
        className={`relative z-10 h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 [overscroll-behavior-y:auto] [scrollbar-gutter:stable] sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:flex-row sm:items-center sm:px-6 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"><CalendarDays className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Time away</p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Leave requests</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Plan leave, review requests, and keep team dates in view.</p>
              </div>
            </div>
            <button type="button" onClick={() => { loadLeaves(); loadHolidays(); }} disabled={loadingLeaves || loadingHolidays} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]">
              <RefreshCw className={`h-4 w-4 ${loadingLeaves || loadingHolidays ? "animate-spin" : ""}`} /> Refresh
            </button>
          </header>

          {(errorLeaves || errorHolidays) && (
            <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
              <div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Some leave information could not be loaded.</div>
              {errorLeaves && <p className="text-xs">Requests: {errorLeaves}</p>}
              {errorHolidays && <p className="text-xs">Holidays: {errorHolidays}</p>}
            </div>
          )}

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          {/* Employee Leaves */}
          <section className="space-y-4">
            <div>
              <h2 className="mb-3 text-base font-semibold text-slate-950 dark:text-white">
                Your leave balance
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
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Team & holidays
            </h2>
            <HolidayList holidays={holidays} loading={loadingHolidays} error={errorHolidays} />
            <TeamLeaveCalendar />
          </section>
        </div>
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
