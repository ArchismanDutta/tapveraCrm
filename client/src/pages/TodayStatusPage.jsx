import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import StatusCard from "../components/workstatus/StatusCard";
import BreakManagement from "../components/workstatus/BreakManagement";
import Timeline from "../components/workstatus/Timeline";
import SummaryCard from "../components/workstatus/SummaryCard";
import RecentActivity from "../components/workstatus/RecentActivity";
import PunchOutTodoPopup from "../components/todo/PunchOutTodoPopup";
import PunchOutConfirmPopup from "../components/workstatus/PunchOutConfirmPopup";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const formatHMS = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
};

const SIDEBAR_WIDTH_EXPANDED = 288;
const SIDEBAR_WIDTH_COLLAPSED = 80;

const TodayStatusPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState(null);
  const [liveWork, setLiveWork] = useState(0);
  const [liveBreak, setLiveBreak] = useState(0);
  const [selectedBreakType, setSelectedBreakType] = useState("");
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [showTodoPopup, setShowTodoPopup] = useState(false);
  const [pendingTodoTasks, setPendingTodoTasks] = useState([]);
  const [showPunchOutConfirm, setShowPunchOutConfirm] = useState(false);

  const [showFlexibleModal, setShowFlexibleModal] = useState(false);
  const [requestDate, setRequestDate] = useState("");
  const [requestStartTime, setRequestStartTime] = useState("");
  const [requestDurationHours, setRequestDurationHours] = useState(9);
  const [requestReason, setRequestReason] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const token = localStorage.getItem("token");

  const fetchStatus = async () => {
    try {
      const res = await axios.get("/api/status", { headers: { Authorization: `Bearer ${token}` } });
      setStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  const fetchWeeklySummary = async () => {
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
        params: { startDate: monday.toISOString(), endDate: sunday.toISOString() },
      });
      setWeeklySummary(res.data?.weeklySummary || null);
    } catch (err) {
      console.error("Failed to fetch weekly summary:", err);
    }
  };

  const updateStatus = async (update) => {
    try {
      const res = await axios.put("/api/status", update, { headers: { Authorization: `Bearer ${token}` } });
      setStatus(res.data);
      setSelectedBreakType("");
      fetchWeeklySummary();
      window.dispatchEvent(new Event("attendanceDataUpdate"));
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error("Failed to update status.");
    }
  };

  // Live timers
  useEffect(() => {
    if (!status) return setLiveWork(0);
    setLiveWork(status.workDurationSeconds || 0);
    if (status.currentlyWorking) {
      const timer = setInterval(() => setLiveWork((prev) => prev + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  useEffect(() => {
    if (!status) return setLiveBreak(0);
    setLiveBreak(status.breakDurationSeconds || 0);
    if (status.onBreak) {
      const timer = setInterval(() => setLiveBreak((prev) => prev + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
    fetchWeeklySummary();
    const interval = setInterval(() => {
      fetchStatus();
      fetchWeeklySummary();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => fetchWeeklySummary();
    window.addEventListener("attendanceDataUpdate", handler);
    return () => window.removeEventListener("attendanceDataUpdate", handler);
  }, []);

  const handlePunchIn = () => {
    if (status?.currentlyWorking) return;
    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      timelineEvent: { type: "Punch In", time: new Date().toLocaleTimeString() },
    });
  };

  const checkTodoTasksBeforePunchOut = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const res = await axios.get("/api/todos", {
        headers: { Authorization: `Bearer ${token}` },
        params: { date: today.toISOString() },
      });
      const incompletes = res.data.filter((t) => !t.completed);
      if (incompletes.length > 0) {
        setPendingTodoTasks(incompletes);
        setShowTodoPopup(true);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error checking todo tasks:", err);
      return true;
    }
  };

  const handlePunchOutClick = async () => {
    if (!(status?.currentlyWorking) && !(status?.onBreak)) return;
    const canPunchOut = await checkTodoTasksBeforePunchOut();
    if (canPunchOut) setShowPunchOutConfirm(true);
  };

  const onCancelPunchOut = () => setShowPunchOutConfirm(false);
  const onConfirmPunchOut = () => {
    setShowPunchOutConfirm(false);
    updateStatus({
      currentlyWorking: false,
      onBreak: false,
      timelineEvent: { type: "Punch Out", time: new Date().toLocaleTimeString() },
    });
  };

  const onCloseTodoPopup = () => {
    setShowTodoPopup(false);
    setPendingTodoTasks([]);
  };
  const onFindOutTodoPopup = () => {
    setShowTodoPopup(false);
    setPendingTodoTasks([]);
    window.location.href = "/todo";
  };
  const onMoveToTomorrowTodoPopup = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await Promise.all(
        pendingTodoTasks.map((task) =>
          axios.post(
            `/api/todos/${task._id}/move`,
            { newDate: tomorrow.toISOString() },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );
      setShowTodoPopup(false);
      setPendingTodoTasks([]);
      onConfirmPunchOut();
    } catch (err) {
      console.error("Failed to move tasks:", err);
      toast.error("Failed to move tasks.");
    }
  };

  const handleStartBreak = (breakType) => {
    if (!breakType || !status?.currentlyWorking || status?.onBreak) return;
    updateStatus({
      onBreak: true,
      currentlyWorking: false,
      breakStartTime: new Date(),
      timelineEvent: { type: `Break Start (${breakType})`, time: new Date().toLocaleTimeString() },
    });
  };

  const handleResumeWork = () => {
    if (!status?.onBreak) return;
    updateStatus({
      onBreak: false,
      currentlyWorking: true,
      breakStartTime: null,
      timelineEvent: { type: "Resume Work", time: new Date().toLocaleTimeString() },
    });
  };

  const handleSelectBreakType = (type) => setSelectedBreakType(type);

  const openFlexibleModal = () => {
    setRequestDate(new Date().toISOString().split("T")[0]);
    setRequestStartTime("");
    setRequestDurationHours(9);
    setRequestReason("");
    setShowFlexibleModal(true);
  };
  const closeFlexibleModal = () => {
    setShowFlexibleModal(false);
    setIsSubmittingRequest(false);
  };
  const submitFlexibleRequest = async (e) => {
    e.preventDefault();
    if (!requestDate || !requestStartTime) {
      toast.error("Please select date and start time.");
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const payload = {
        date: requestDate,
        requestedStartTime: requestStartTime,
        durationHours: Number(requestDurationHours) || 9,
        reason: requestReason?.trim() || "",
      };
      await axios.post("/api/flexible-shift/request", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Flexible shift request submitted.");
      closeFlexibleModal();
      fetchStatus();
      fetchWeeklySummary();
    } catch (err) {
      console.error("Flexible request failed:", err);
      const msg = err?.response?.data?.message || "Failed to submit request.";
      toast.error(msg);
      setIsSubmittingRequest(false);
    }
  };

  if (!status)
    return (
      <div className="text-gray-100 bg-[#101525] min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );

  const todayISO = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-[#101525] min-h-screen text-gray-100">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" onLogout={onLogout} />

      <main
        className="transition-all duration-300 p-2 sm:p-6 overflow-auto"
        style={{ marginLeft: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED, minHeight: "100vh" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-screen">
          <div className="col-span-2 flex flex-col gap-4">
            <StatusCard
              workDuration={formatHMS(liveWork)}
              breakTime={formatHMS(liveBreak)}
              arrivalTime={status.arrivalTimeFormatted || "--"}
              currentlyWorking={status.currentlyWorking}
              onPunchIn={handlePunchIn}
              onPunchOut={handlePunchOutClick}
              onRequestFlexible={openFlexibleModal} // new prop
            />

            <BreakManagement
              breakDuration={formatHMS(liveBreak)}
              onBreak={status.onBreak}
              onStartBreak={handleStartBreak}
              onResumeWork={handleResumeWork}
              selectedBreakType={selectedBreakType}
              onSelectBreakType={handleSelectBreakType}
              currentlyWorking={status.currentlyWorking}
            />

            <Timeline timeline={status.timeline || []} />
          </div>

          <div className="space-y-4">
            <SummaryCard weeklySummary={weeklySummary} />
            <RecentActivity activities={status.recentActivities || []} />
          </div>
        </div>

        {showTodoPopup && (
          <PunchOutTodoPopup
            tasks={pendingTodoTasks}
            onClose={onCloseTodoPopup}
            onFindOut={onFindOutTodoPopup}
            onMoveToTomorrow={onMoveToTomorrowTodoPopup}
          />
        )}

        {showPunchOutConfirm && (
          <PunchOutConfirmPopup onCancel={onCancelPunchOut} onConfirm={onConfirmPunchOut} />
        )}

        {showFlexibleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-[#0f1724] text-gray-100 rounded-lg shadow-lg w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-3">Request Flexible Shift</h3>
              <form onSubmit={submitFlexibleRequest} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={requestDate}
                    min={todayISO}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0b1220] border border-gray-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={requestStartTime}
                    onChange={(e) => setRequestStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0b1220] border border-gray-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Duration (hours)</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={requestDurationHours}
                    onChange={(e) => setRequestDurationHours(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0b1220] border border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Reason (optional)</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded bg-[#0b1220] border border-gray-700"
                    placeholder="Short reason"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeFlexibleModal}
                    className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
                    disabled={isSubmittingRequest}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white"
                    disabled={isSubmittingRequest}
                  >
                    {isSubmittingRequest ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TodayStatusPage;
