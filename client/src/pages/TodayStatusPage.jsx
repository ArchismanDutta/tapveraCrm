// src/pages/TodayStatusPage.jsx
import React, { useEffect, useState } from "react";
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

// --- Backend URL ---
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// --- Helpers ---
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

  // --- Auth ---
  const token = localStorage.getItem("token");
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };
  const user = JSON.parse(localStorage.getItem("user"));

  // --- Fetch Status ---
  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/status`, axiosConfig);
      setStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch status:", err.response?.data || err);
    }
  };

  // --- Fetch Weekly Summary ---
  const fetchWeeklySummary = async () => {
    try {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7; // Monday as start of week
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
  };

  // --- Fetch Flexible Requests ---
  const fetchFlexibleRequests = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/flexible-shifts/my-requests`,
        axiosConfig
      );
      setFlexibleRequests(res.data || []);
    } catch (err) {
      console.error("Failed to fetch flexible shift requests:", err.response?.data || err);
    }
  };

  // --- Update Status ---
  const updateStatus = async (update) => {
    if (!status && update?.currentlyWorking !== true) return;
    try {
      const payload = {
        userId: user?._id,
        currentlyWorking: status?.currentlyWorking || false,
        onBreak: status?.onBreak || false,
        workDurationSeconds: status?.workDurationSeconds || 0,
        breakDurationSeconds: status?.breakDurationSeconds || 0,
        arrivalTime: status?.arrivalTime || null,
        ...update,
      };

      console.log("📤 Sending status update:", payload);

      const res = await axios.put(`${API_BASE}/api/status`, payload, axiosConfig);
      setStatus(res.data);
      setSelectedBreakType("");
      fetchWeeklySummary();
      window.dispatchEvent(new Event("attendanceDataUpdate"));
    } catch (err) {
      console.error("❌ Failed to update status:", err.response?.data || err);
      toast.error(err?.response?.data?.message || "Failed to update status.");
    }
  };

  // --- Live Timers ---
  useEffect(() => {
    if (!status) return;
    setLiveWork(status.workDurationSeconds || 0);
    setLiveBreak(status.breakDurationSeconds || 0);

    let workTimer, breakTimer;
    if (status.currentlyWorking) {
      workTimer = setInterval(() => setLiveWork((prev) => prev + 1), 1000);
    }
    if (status.onBreak) {
      breakTimer = setInterval(() => setLiveBreak((prev) => prev + 1), 1000);
    }
    return () => {
      clearInterval(workTimer);
      clearInterval(breakTimer);
    };
  }, [status]);

  // --- Initial Fetch ---
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
  }, []);

  useEffect(() => {
    const handler = () => {
      fetchWeeklySummary();
      fetchFlexibleRequests();
    };
    window.addEventListener("attendanceDataUpdate", handler);
    return () => window.removeEventListener("attendanceDataUpdate", handler);
  }, []);

  // --- Punch In/Out ---
  const handlePunchIn = () => {
    if (status?.currentlyWorking) return;

    const alreadyPunchedIn = status?.timeline?.some((e) => e.type === "Punch In");
    if (alreadyPunchedIn) {
      toast.error("You have already punched in today.");
      return;
    }

    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      arrivalTime: new Date().toISOString(),
      timelineEvent: { type: "Punch In", time: new Date().toISOString() },
    });
  };

  const checkTodoTasksBeforePunchOut = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const res = await axios.get(`${API_BASE}/api/todos`, {
        ...axiosConfig,
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

    const alreadyPunchedOut = status?.timeline?.some((e) => e.type === "Punch Out");
    if (alreadyPunchedOut) {
      toast.error("You have already punched out today.");
      return;
    }

    const canPunchOut = await checkTodoTasksBeforePunchOut();
    if (canPunchOut) setShowPunchOutConfirm(true);
  };

  const onCancelPunchOut = () => setShowPunchOutConfirm(false);
  const onConfirmPunchOut = () => {
    setShowPunchOutConfirm(false);
    updateStatus({
      currentlyWorking: false,
      onBreak: false,
      timelineEvent: { type: "Punch Out", time: new Date().toISOString() },
    });
  };

  // --- Break Handlers ---
  const handleStartBreak = (breakType) => {
    if (!breakType || !status?.currentlyWorking || status?.onBreak) return;
    updateStatus({
      currentlyWorking: false,
      onBreak: true,
      breakStartTime: new Date().toISOString(),
      timelineEvent: {
        type: `Break Start (${breakType})`,
        time: new Date().toISOString(),
      },
    });
  };

  const handleResumeWork = () => {
    if (!status?.onBreak) return;
    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      breakStartTime: null,
      timelineEvent: { type: "Resume Work", time: new Date().toISOString() },
    });
  };

  const handleSelectBreakType = (type) => setSelectedBreakType(type);

  // --- Flexible Shift Modal ---
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
      const msg =
        err?.response?.data?.message || "Failed to submit request.";
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
              currentlyWorking={status.currentlyWorking}
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
              onSelectBreakType={handleSelectBreakType}
              currentlyWorking={status.currentlyWorking}
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

        {showPunchOutConfirm && (
          <PunchOutConfirmPopup
            onCancel={onCancelPunchOut}
            onConfirm={onConfirmPunchOut}
          />
        )}

        {/* --- Flexible Shift Modal --- */}
        {showFlexibleModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto"
            onClick={closeFlexibleModal}
          >
            <div
              className="bg-[#0f1724] text-gray-100 rounded-lg shadow-lg w-full max-w-md p-6 max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4">
                Request Flexible Shift
              </h2>
              <form
                className="flex flex-col gap-4"
                onSubmit={submitFlexibleRequest}
              >
                <label className="flex flex-col gap-1">
                  Date:
                  <input
                    type="date"
                    className="w-full rounded bg-gray-800 text-white px-2 py-1"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Start Time:
                  <input
                    type="time"
                    className="w-full rounded bg-gray-800 text-white px-2 py-1"
                    value={requestStartTime}
                    onChange={(e) => setRequestStartTime(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Duration (hours):
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className="w-full rounded bg-gray-800 text-white px-2 py-1"
                    value={requestDurationHours}
                    onChange={(e) => setRequestDurationHours(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Reason:
                  <textarea
                    className="w-full rounded bg-gray-800 text-white px-2 py-1"
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                  />
                </label>

                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={closeFlexibleModal}
                    className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 text-white"
                  >
                    {isSubmittingRequest ? "Submitting..." : "Submit"}
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
