// src/pages/TodayStatusPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import StatusCard from "../components/workstatus/StatusCard";
import BreakManagement from "../components/workstatus/BreakManagement";
import Timeline from "../components/workstatus/Timeline";
import SummaryCard from "../components/workstatus/SummaryCard";
import PunchOutTodoPopup from "../components/todo/PunchOutTodoPopup";
import PunchOutConfirmPopup from "../components/workstatus/PunchOutConfirmPopup";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const formatHMS = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s
    .toString()
    .padStart(2, "0")}s`;
};

const SIDEBAR_WIDTH_EXPANDED = 288;
const SIDEBAR_WIDTH_COLLAPSED = 80;

const safeParseDate = (v) => {
  if (!v && v !== 0) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const normalizeEventType = (t) =>
  String(t || "").toLowerCase().replace(/[\s_-]+/g, "");

const TodayStatusPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState(null);
  const [liveWork, setLiveWork] = useState(0);
  const [liveBreak, setLiveBreak] = useState(0);
  const [selectedBreakType, setSelectedBreakType] = useState("");
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [showTodoPopup, setShowTodoPopup] = useState(false);
  const [pendingTodoTasks, setPendingTodoTasks] = useState([]);
  const [showPunchOutConfirm, setShowPunchOutConfirm] = useState(false);
  const [showFlexibleModal, setShowFlexibleModal] = useState(false);
  const [requestDate, setRequestDate] = useState("");
  const [requestStartTime, setRequestStartTime] = useState("");
  const [requestDurationHours, setRequestDurationHours] = useState(9);
  const [requestReason, setRequestReason] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [flexibleRequests, setFlexibleRequests] = useState([]);

  const token = localStorage.getItem("token");
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  // -------------------
  // Fetch Data
  // -------------------
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/status/today`, axiosConfig);
      setStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch today's status:", err.response?.data || err);
      toast.error("Failed to load today's status.");
    }
  }, []);

  const fetchWeeklySummary = useCallback(async () => {
    try {
      const now = new Date();
      const diffToMonday = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const res = await axios.get(`${API_BASE}/api/summary/week`, {
        ...axiosConfig,
        params: {
          startDate: monday.toISOString(),
          endDate: sunday.toISOString(),
        },
      });

      setWeeklySummary(res.data?.weeklySummary || null);
      setDailyData(res.data?.dailyData || []);
    } catch (err) {
      console.error("Failed to fetch weekly summary:", err.response?.data || err);
    }
  }, []);

  const fetchFlexibleRequests = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/flexible-shifts/my-requests`,
        axiosConfig
      );
      const requests = res.data || [];
      setFlexibleRequests(
        requests
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
      );
    } catch (err) {
      console.error(
        "Failed to fetch flexible shift requests:",
        err.response?.data || err
      );
    }
  }, []);

  // -------------------
  // Update Status
  // -------------------
  const updateStatus = async (update) => {
    if (!status && update?.currentlyWorking !== true) return;
    try {
      const payload = {
        currentlyWorking: status?.currentlyWorking || false,
        onBreak: status?.onBreak || false,
        ...update,
      };
      if (payload.timelineEvent?.time) {
        payload.timelineEvent.time = new Date(payload.timelineEvent.time);
      }

      const res = await axios.put(
        `${API_BASE}/api/status/today`,
        payload,
        axiosConfig
      );
      setStatus(res.data);
      setSelectedBreakType("");
      fetchWeeklySummary();
      window.dispatchEvent(new Event("attendanceDataUpdate"));
    } catch (err) {
      const serverData = err.response?.data;
      toast.error(
        serverData?.message || serverData?.error || "Failed to update status."
      );
      console.error("Failed to update status:", serverData || err);
    }
  };

  // -------------------
  // Live Timers
  // -------------------
  useEffect(() => {
    if (!status) return;
    setLiveWork(status.workDurationSeconds || 0);
    setLiveBreak(status.breakDurationSeconds || 0);

    const timers = [];
    if (status.currentlyWorking) {
      timers.push(setInterval(() => setLiveWork((prev) => prev + 1), 1000));
    }
    if (status.onBreak) {
      timers.push(setInterval(() => setLiveBreak((prev) => prev + 1), 1000));
    }

    return () => timers.forEach(clearInterval);
  }, [status]);

  // -------------------
  // Initial + periodic refresh
  // -------------------
  useEffect(() => {
    fetchStatus();
    fetchWeeklySummary();
    fetchFlexibleRequests();
    const interval = setInterval(() => {
      fetchStatus();
      fetchWeeklySummary();
      fetchFlexibleRequests();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchWeeklySummary, fetchFlexibleRequests]);

  // -------------------
  // External updates
  // -------------------
  useEffect(() => {
    const handler = () => {
      fetchStatus();
      fetchWeeklySummary();
      fetchFlexibleRequests();
    };
    window.addEventListener("attendanceDataUpdate", handler);
    return () => window.removeEventListener("attendanceDataUpdate", handler);
  }, [fetchStatus, fetchWeeklySummary, fetchFlexibleRequests]);

  // -------------------
  // Punch logic
  // -------------------
  const todayKey = new Date().toISOString().slice(0, 10);
  const timelineToday = (status?.timeline || []).filter((e) =>
    safeParseDate(e.time)?.toISOString().startsWith(todayKey)
  );

  const alreadyPunchedIn = timelineToday.some(
    (e) => normalizeEventType(e.type) === "punchin"
  );
  const alreadyPunchedOut = timelineToday.some(
    (e) => normalizeEventType(e.type) === "punchout"
  );
  const currentlyWorkingToday = !!status?.currentlyWorking;

  const handlePunchIn = () => {
    if (currentlyWorkingToday || alreadyPunchedIn) {
      toast.info("You are already punched in.");
      return;
    }
    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      punchInTime: new Date(),
      timelineEvent: { type: "Punch In", time: new Date() },
    });
  };

  const handlePunchOutClick = async () => {
    if (!currentlyWorkingToday && !status?.onBreak) {
      toast.info("You are not currently working.");
      return;
    }
    if (alreadyPunchedOut) {
      toast.error("Already punched out today.");
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const res = await axios.get(`${API_BASE}/api/todos`, {
        ...axiosConfig,
        params: { date: today.toISOString() },
      });
      const incompletes = (res.data || []).filter((t) => !t.completed);
      if (incompletes.length) {
        setPendingTodoTasks(incompletes);
        setShowTodoPopup(true);
        return;
      }
    } catch (err) {
      console.error("Error fetching todo tasks:", err);
    }

    setShowPunchOutConfirm(true);
  };

  const onCancelPunchOut = () => setShowPunchOutConfirm(false);

  const onConfirmPunchOut = () => {
    setShowPunchOutConfirm(false);
    updateStatus({
      currentlyWorking: false,
      onBreak: false,
      punchOutTime: new Date(),
      timelineEvent: { type: "Punch Out", time: new Date() },
    });
  };

  // -------------------
  // Break logic
  // -------------------
  const handleStartBreak = (breakType) => {
    if (!breakType || !currentlyWorkingToday || status?.onBreak) {
      toast.info("Cannot start break right now.");
      return;
    }
    updateStatus({
      currentlyWorking: false,
      onBreak: true,
      breakStartTime: new Date(),
      timelineEvent: { type: `Break Start (${breakType})`, time: new Date() },
    });
  };

  const handleResumeWork = () => {
    if (!status?.onBreak) {
      toast.info("No active break to resume.");
      return;
    }
    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      breakStartTime: null,
      timelineEvent: { type: "Resume Work", time: new Date() },
    });
  };

  // -------------------
  // Flexible Shift Modal
  // -------------------
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
      await axios.post(
        `${API_BASE}/api/flexible-shifts/request`,
        {
          requestedDate: requestDate,
          requestedStartTime: requestStartTime,
          durationHours: Number(requestDurationHours) || 9,
          reason: requestReason?.trim() || "",
        },
        axiosConfig
      );
      toast.success("Flexible shift request submitted.");
      closeFlexibleModal();
      fetchStatus();
      fetchWeeklySummary();
      fetchFlexibleRequests();
    } catch (err) {
      console.error(
        "Failed to submit flexible request:",
        err.response?.data || err
      );
      toast.error(err?.response?.data?.message || "Failed to submit request.");
      setIsSubmittingRequest(false);
    }
  };

  // -------------------
  // Render
  // -------------------
  if (!status)
    return (
      <div className="text-gray-100 bg-[#101525] min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="bg-[#101525] min-h-screen text-gray-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />
      <main
        className="transition-all duration-300 p-2 sm:p-6 overflow-auto"
        style={{
          marginLeft: collapsed
            ? SIDEBAR_WIDTH_COLLAPSED
            : SIDEBAR_WIDTH_EXPANDED,
          minHeight: "100vh",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-screen">
          <div className="col-span-2 flex flex-col gap-4">
            <StatusCard
              workDuration={formatHMS(liveWork)}
              breakTime={formatHMS(liveBreak)}
              arrivalTime={status.arrivalTimeFormatted || "--"}
              currentlyWorking={currentlyWorkingToday}
              alreadyPunchedIn={alreadyPunchedIn}
              alreadyPunchedOut={alreadyPunchedOut}
              onPunchIn={handlePunchIn}
              onPunchOut={handlePunchOutClick}
              onRequestFlexible={openFlexibleModal}
            />
            <BreakManagement
              breakDuration={formatHMS(liveBreak)}
              onBreak={status.onBreak}
              onStartBreak={handleStartBreak}
              onResumeWork={handleResumeWork}
              selectedBreakType={selectedBreakType}
              onSelectBreakType={setSelectedBreakType}
              currentlyWorking={currentlyWorkingToday}
            />
            <Timeline timeline={status.timeline || []} />
          </div>
          <div className="space-y-4">
            <SummaryCard
              weeklySummary={weeklySummary}
              dailyData={dailyData}
            />
          </div>
        </div>

        {/* Punch Out Todo Popup */}
        {showTodoPopup && (
          <PunchOutTodoPopup
            tasks={pendingTodoTasks}
            onClose={() => {
              setShowTodoPopup(false);
              setPendingTodoTasks([]);
            }}
            onFindOut={() => (window.location.href = "/todo")}
            onMoveToTomorrow={async () => {
              try {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                await Promise.all(
                  pendingTodoTasks.map((task) =>
                    axios.post(
                      `${API_BASE}/api/todos/${task._id}/move`,
                      { newDate: tomorrow.toISOString() },
                      axiosConfig
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
            }}
          />
        )}

        {/* Punch Out Confirm Popup */}
        {showPunchOutConfirm && (
          <PunchOutConfirmPopup
            onCancel={onCancelPunchOut}
            onConfirm={onConfirmPunchOut}
          />
        )}

        {/* Flexible Shift Modal */}
        {showFlexibleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#101525] p-6 rounded-2xl w-full max-w-md text-gray-100">
              <h2 className="text-xl font-bold mb-4">Request Flexible Shift</h2>
              <form onSubmit={submitFlexibleRequest} className="flex flex-col gap-3">
                <label className="flex flex-col">
                  Date
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="rounded-md p-2 text-black"
                    required
                  />
                </label>
                <label className="flex flex-col">
                  Start Time
                  <input
                    type="time"
                    value={requestStartTime}
                    onChange={(e) => setRequestStartTime(e.target.value)}
                    className="rounded-md p-2 text-black"
                    required
                  />
                </label>
                <label className="flex flex-col">
                  Duration (hours)
                  <input
                    type="number"
                    value={requestDurationHours}
                    onChange={(e) => setRequestDurationHours(e.target.value)}
                    min={1}
                    max={24}
                    className="rounded-md p-2 text-black"
                    required
                  />
                </label>
                <label className="flex flex-col">
                  Reason
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="rounded-md p-2 text-black"
                  />
                </label>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
                    onClick={closeFlexibleModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-lg bg-pinkAccent text-white hover:opacity-90 ${
                      isSubmittingRequest ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={isSubmittingRequest}
                  >
                    Submit
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
