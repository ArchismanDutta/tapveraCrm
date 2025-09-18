// src/pages/TodayStatusPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const SIDEBAR_WIDTH_EXPANDED = 288;
const SIDEBAR_WIDTH_COLLAPSED = 80;

// Event types constants for consistency
const EVENT_TYPES = {
  PUNCH_IN: "Punch In",
  PUNCH_OUT: "Punch Out",
  BREAK_START: "Break Start",
  RESUME_WORK: "Resume Work",
};

const formatHMS = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s
    .toString()
    .padStart(2, "0")}s`;
};

const safeParseDate = (v) => {
  if (!v && v !== 0) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const normalizeEventType = (type) => {
  const normalized = String(type || "")
    .toLowerCase()
    .trim();
  if (normalized.includes("punch") && normalized.includes("in"))
    return "punch_in";
  if (normalized.includes("punch") && normalized.includes("out"))
    return "punch_out";
  if (normalized.includes("break") && normalized.includes("start"))
    return "break_start";
  if (normalized.includes("resume")) return "resume_work";
  return normalized.replace(/[\s_-]+/g, "");
};

const statusColors = {
  approved: "bg-green-500 text-white",
  rejected: "bg-red-500 text-white",
  pending: "bg-orange-500 text-white",
};

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
  const [isLoading, setIsLoading] = useState(false);
  const [requestInProgress, setRequestInProgress] = useState(false);

  const token = localStorage.getItem("token");

  // Helper function to create axios config
  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${token}` },
  });

  // Fetch today's status with enhanced error handling
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/status/today`,
        getAxiosConfig()
      );
      console.log("Fetched status:", res.data);
      setStatus(res.data);
    } catch (err) {
      console.error(
        "Failed to fetch today's status:",
        err.response?.data || err
      );
      if (err.response?.status === 401) {
        // Handle authentication error
        localStorage.removeItem("token");
        if (onLogout) onLogout();
      } else if (err.response?.status !== 500) {
        toast.error(
          err.response?.data?.message || "Failed to load today's status."
        );
      }
    }
  }, [token, onLogout]);

  // Fetch weekly summary and daily data
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
        ...getAxiosConfig(),
        params: {
          startDate: monday.toISOString(),
          endDate: sunday.toISOString(),
        },
      });

      setWeeklySummary(res.data?.weeklySummary || null);
      setDailyData(res.data?.dailyData || []);
    } catch (err) {
      console.error(
        "Failed to fetch weekly summary:",
        err.response?.data || err
      );
    }
  }, [token]);

  // Fetch flexible shift requests
  const fetchFlexibleRequests = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/flexible-shifts/my-requests`,
        getAxiosConfig()
      );
      setFlexibleRequests(res.data || []);
    } catch (err) {
      console.error(
        "Failed to fetch flexible shift requests:",
        err.response?.data || err
      );
    }
  }, [token]);

  // Enhanced update status with better error handling and race condition prevention
  const updateStatus = async (update) => {
    if (!status && update?.currentlyWorking !== true) return;

    if (requestInProgress) {
      toast.info("Please wait for the current operation to complete.");
      return;
    }

    setRequestInProgress(true);
    setIsLoading(true);

    try {
      const payload = {
        currentlyWorking: status?.currentlyWorking || false,
        onBreak: status?.onBreak || false,
        ...update,
      };

      // Validate and format timelineEvent.time
      if (payload.timelineEvent?.time) {
        const timeValue = new Date(payload.timelineEvent.time);
        if (isNaN(timeValue.getTime())) {
          throw new Error("Invalid time value in timeline event");
        }
        payload.timelineEvent.time = timeValue.toISOString();
      }

      // Validate and format breakStartTime
      if (payload.breakStartTime) {
        const breakStartValue = new Date(payload.breakStartTime);
        if (isNaN(breakStartValue.getTime())) {
          throw new Error("Invalid break start time value");
        }
        payload.breakStartTime = breakStartValue.toISOString();
      }

      console.log("Sending update payload:", payload);

      const res = await axios.put(
        `${API_BASE}/api/status/today`,
        payload,
        getAxiosConfig()
      );

      console.log("Update response:", res.data);
      setStatus(res.data);
      setSelectedBreakType("");

      // Refresh related data
      await fetchWeeklySummary();
      window.dispatchEvent(new Event("attendanceDataUpdate"));

      // Show success message for major actions
      if (payload.timelineEvent?.type) {
        const eventType = payload.timelineEvent.type.toLowerCase();
        if (eventType.includes("punch in")) {
          toast.success("Punched in successfully!");
        } else if (eventType.includes("punch out")) {
          toast.success("Punched out successfully!");
        } else if (eventType.includes("break")) {
          toast.success("Break started!");
        } else if (eventType.includes("resume")) {
          toast.success("Work resumed!");
        }
      }
    } catch (err) {
      const serverData = err.response?.data;
      const errorMessage =
        serverData?.message || serverData?.error || "Failed to update status.";
      toast.error(errorMessage);
      console.error("Failed to update status:", serverData || err);
    } finally {
      setIsLoading(false);
      setRequestInProgress(false);
    }
  };

  // Live timers update with improved logic
  useEffect(() => {
    if (!status) return;

    // Initialize with backend calculated values
    setLiveWork(status.workDurationSeconds || 0);
    setLiveBreak(status.breakDurationSeconds || 0);

    const timers = [];

    // Only start live timers if currently working or on break
    if (status.currentlyWorking && !status.onBreak) {
      timers.push(setInterval(() => setLiveWork((prev) => prev + 1), 1000));
    }
    if (status.onBreak) {
      timers.push(setInterval(() => setLiveBreak((prev) => prev + 1), 1000));
    }

    return () => timers.forEach(clearInterval);
  }, [
    status?.currentlyWorking,
    status?.onBreak,
    status?.workDurationSeconds,
    status?.breakDurationSeconds,
  ]);

  // Initial and periodic data fetch
  useEffect(() => {
    fetchStatus();
    fetchWeeklySummary();
    fetchFlexibleRequests();

    const interval = setInterval(() => {
      if (!requestInProgress) {
        fetchStatus();
        fetchWeeklySummary();
        fetchFlexibleRequests();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [
    fetchStatus,
    fetchWeeklySummary,
    fetchFlexibleRequests,
    requestInProgress,
  ]);

  // External update listener
  useEffect(() => {
    const handler = () => {
      if (!requestInProgress) {
        fetchStatus();
        fetchWeeklySummary();
        fetchFlexibleRequests();
      }
    };
    window.addEventListener("attendanceDataUpdate", handler);
    return () => window.removeEventListener("attendanceDataUpdate", handler);
  }, [
    fetchStatus,
    fetchWeeklySummary,
    fetchFlexibleRequests,
    requestInProgress,
  ]);

  // Enhanced punch logic with better validation
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const timelineToday = (status?.timeline || []).filter((e) => {
    const eventDate = safeParseDate(e.time);
    return eventDate && eventDate.toISOString().startsWith(todayKey);
  });

  const alreadyPunchedIn = timelineToday.some(
    (e) => normalizeEventType(e.type) === "punch_in"
  );

  const alreadyPunchedOut = timelineToday.some(
    (e) => normalizeEventType(e.type) === "punch_out"
  );

  const currentlyWorkingToday = !!status?.currentlyWorking;

  const handlePunchIn = () => {
    if (requestInProgress) {
      toast.info("Please wait for the current operation to complete.");
      return;
    }

    if (alreadyPunchedOut) {
      toast.error("You have already punched out today. Cannot punch in again.");
      return;
    }

    if (currentlyWorkingToday || alreadyPunchedIn) {
      toast.info("You are already punched in and working.");
      return;
    }

    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      timelineEvent: {
        type: EVENT_TYPES.PUNCH_IN,
        time: new Date().toISOString(),
      },
    });
  };

  const handlePunchOutClick = async () => {
    if (requestInProgress) {
      toast.info("Please wait for the current operation to complete.");
      return;
    }

    if (alreadyPunchedOut) {
      toast.error("You have already punched out today.");
      return;
    }

    if (!currentlyWorkingToday && !status?.onBreak) {
      toast.info("You are not currently working or on break.");
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const res = await axios.get(`${API_BASE}/api/todos`, {
        ...getAxiosConfig(),
        params: { date: today.toISOString() },
      });
      const incompletes = (res.data || []).filter((t) => !t.completed);
      if (incompletes.length) {
        setPendingTodoTasks(incompletes);
        setShowTodoPopup(true);
        return;
      }
      setShowPunchOutConfirm(true);
    } catch (err) {
      console.error("Error fetching todo tasks:", err);
      // Continue with punch out even if todos can't be fetched
      setShowPunchOutConfirm(true);
    }
  };

  const onCancelPunchOut = () => setShowPunchOutConfirm(false);

  const onConfirmPunchOut = () => {
    setShowPunchOutConfirm(false);
    updateStatus({
      currentlyWorking: false,
      onBreak: false,
      timelineEvent: {
        type: EVENT_TYPES.PUNCH_OUT,
        time: new Date().toISOString(),
      },
    });
  };

  // Enhanced break management with validation
  const handleStartBreak = (breakType) => {
    if (requestInProgress) {
      toast.info("Please wait for the current operation to complete.");
      return;
    }

    if (!breakType) {
      toast.error("Please select a break type first.");
      return;
    }

    if (!currentlyWorkingToday) {
      toast.error("You must be working to start a break.");
      return;
    }

    if (status?.onBreak) {
      toast.info("You are already on a break.");
      return;
    }

    if (alreadyPunchedOut) {
      toast.error("You have already punched out today. Cannot take a break.");
      return;
    }

    updateStatus({
      currentlyWorking: false,
      onBreak: true,
      breakStartTime: new Date().toISOString(),
      timelineEvent: {
        type: `${EVENT_TYPES.BREAK_START} (${breakType})`,
        time: new Date().toISOString(),
      },
    });
  };

  const handleResumeWork = () => {
    if (requestInProgress) {
      toast.info("Please wait for the current operation to complete.");
      return;
    }

    if (!status?.onBreak) {
      toast.info("You are not currently on a break.");
      return;
    }

    if (alreadyPunchedOut) {
      toast.error("You have already punched out today. Cannot resume work.");
      return;
    }

    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      breakStartTime: null,
      timelineEvent: {
        type: EVENT_TYPES.RESUME_WORK,
        time: new Date().toISOString(),
      },
    });
  };

  // Flexible shift modal functions (unchanged but with better error handling)
  const openFlexibleModal = () => {
    setRequestDate(new Date().toISOString().split("T")[0]);
    setRequestStartTime("");
    setRequestDurationHours(9);
    setRequestReason("");
    setShowFlexibleModal(true);
    fetchFlexibleRequests();
  };

  const closeFlexibleModal = () => {
    setShowFlexibleModal(false);
    setIsSubmittingRequest(false);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

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
        getAxiosConfig()
      );
      toast.success("Flexible shift request submitted.");

      // Clear form but keep modal open
      setRequestDate(new Date().toISOString().split("T")[0]);
      setRequestStartTime("");
      setRequestDurationHours(9);
      setRequestReason("");

      fetchStatus();
      fetchWeeklySummary();
      await fetchFlexibleRequests();
    } catch (err) {
      console.error(
        "Failed to submit flexible request:",
        err.response?.data || err
      );
      toast.error(err.response?.data?.message || "Failed to submit request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Sort flexible requests by requestedDate desc
  const sortedFlexibleRequests = (flexibleRequests || [])
    .slice()
    .sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));

  // Calculate quickStats combining backend and workedSessions dynamically
  const combinedQuickStats = useMemo(() => {
    if (!weeklySummary || !status) return null;

    const backendQuickStats = weeklySummary.quickStats || {};
    const workedSessions = status.workedSessions || [];
    const shiftStart = status.effectiveShift?.start || "09:00";

    let earlyArrivals = 0;
    let lateArrivals = 0;
    let perfectDays = 0;

    const [shiftH, shiftM] = shiftStart.split(":").map(Number);

    workedSessions.forEach((session) => {
      const punchInTime = new Date(session.start);
      if (isNaN(punchInTime.getTime())) return;

      const expectedShift = new Date(punchInTime);
      expectedShift.setHours(shiftH, shiftM, 0, 0);

      if (punchInTime <= expectedShift) {
        earlyArrivals++;
      } else {
        lateArrivals++;
      }
    });

    return {
      earlyArrivals:
        backendQuickStats.earlyArrivals > 0
          ? backendQuickStats.earlyArrivals
          : earlyArrivals,
      lateArrivals:
        backendQuickStats.lateArrivals > 0
          ? backendQuickStats.lateArrivals
          : lateArrivals,
      perfectDays:
        backendQuickStats.perfectDays > 0
          ? backendQuickStats.perfectDays
          : perfectDays,
    };
  }, [weeklySummary, status]);

  const weeklySummaryWithQuickStats = useMemo(() => {
    if (!weeklySummary) return null;
    return {
      ...weeklySummary,
      quickStats: combinedQuickStats || weeklySummary.quickStats,
    };
  }, [weeklySummary, combinedQuickStats]);

  // Keep SummaryCard in sync with live timers by overriding today's entry
  const adjustedDailyData = useMemo(() => {
    if (!Array.isArray(dailyData) || !status) return dailyData;
    const todayStr = new Date().toISOString().slice(0, 10);
    return dailyData.map((d) => {
      const dKey = new Date(d.date).toISOString().slice(0, 10);
      if (dKey !== todayStr) return d;
      return {
        ...d,
        workDurationSeconds:
          typeof liveWork === "number" ? liveWork : d.workDurationSeconds || 0,
        breakDurationSeconds:
          typeof liveBreak === "number"
            ? liveBreak
            : d.breakDurationSeconds || 0,
        arrivalTime: status.arrivalTime || d.arrivalTime,
      };
    });
  }, [dailyData, status, liveWork, liveBreak]);

  if (!status)
    return (
      <div className="min-h-screen bg-[#101525] flex items-center justify-center">
        <div className="text-white text-xl font-medium">Loading...</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#101525]">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />

      <main
        className="transition-all duration-300 p-4 sm:p-8 max-w-7xl mx-auto"
        style={{
          marginLeft: collapsed
            ? SIDEBAR_WIDTH_COLLAPSED
            : SIDEBAR_WIDTH_EXPANDED,
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Today Work Status
          </h1>
          <p className="text-gray-300">
            Manage employee shifts and schedules efficiently
          </p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
          {/* Left Column - Status & Break Management */}
          <div className="xl:col-span-3 space-y-6">
            <StatusCard
              workDuration={formatHMS(liveWork)}
              breakTime={formatHMS(liveBreak)}
              arrivalTime={
                status.arrivalTimeFormatted || status.arrivalTime || "--"
              }
              currentlyWorking={status.currentlyWorking}
              alreadyPunchedIn={alreadyPunchedIn}
              alreadyPunchedOut={alreadyPunchedOut}
              onPunchIn={handlePunchIn}
              onPunchOut={handlePunchOutClick}
              onRequestFlexible={openFlexibleModal}
              isLoading={isLoading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BreakManagement
                breakDuration={formatHMS(liveBreak)}
                onBreak={status.onBreak}
                onStartBreak={handleStartBreak}
                onResumeWork={handleResumeWork}
                selectedBreakType={selectedBreakType}
                onSelectBreakType={setSelectedBreakType}
                currentlyWorking={status.currentlyWorking}
                alreadyPunchedOut={alreadyPunchedOut}
                isLoading={isLoading}
              />
              <Timeline timeline={status.timeline || []} />
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="xl:col-span-1">
            <SummaryCard
              weeklySummary={weeklySummaryWithQuickStats}
              dailyData={adjustedDailyData}
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
                      getAxiosConfig()
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

        {showFlexibleModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-auto p-4"
            onClick={closeFlexibleModal}
          >
            <div
              className="bg-slate-900 text-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 max-h-[85vh] overflow-auto border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-3xl font-bold mb-6 text-white">
                Request Flexible Shift
              </h2>

              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
                onSubmit={submitFlexibleRequest}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full rounded-xl p-3 bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={requestStartTime}
                    onChange={(e) => setRequestStartTime(e.target.value)}
                    className="w-full rounded-xl p-3 bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={requestDurationHours}
                    onChange={(e) => setRequestDurationHours(e.target.value)}
                    min={1}
                    max={24}
                    className="w-full rounded-xl p-3 bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Reason
                  </label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="w-full rounded-xl p-3 bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24 resize-none"
                    placeholder="Optional reason for flexible shift request..."
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                  <button
                    type="button"
                    className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition font-medium"
                    onClick={closeFlexibleModal}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className={`px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition font-semibold ${
                      isSubmittingRequest ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={isSubmittingRequest}
                  >
                    {isSubmittingRequest ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>

              {/* Requests Table */}
              <div className="mt-8">
                <h3 className="text-2xl font-bold mb-6">My Requests</h3>
                {sortedFlexibleRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">No requests found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-700">
                    <table className="w-full border-collapse">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="p-4 text-left font-semibold text-gray-300 border-b border-slate-700">
                            Start Time
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-300 border-b border-slate-700">
                            Duration
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-300 border-b border-slate-700">
                            Reason
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-300 border-b border-slate-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedFlexibleRequests.map((r, idx) => {
                          const statusLower = (
                            r.status || "pending"
                          ).toLowerCase();
                          return (
                            <tr
                              key={
                                r._id ||
                                `${r.requestedDate}-${r.requestedStartTime}`
                              }
                              className={`hover:bg-slate-800/50 transition ${
                                idx % 2 === 0 ? "bg-slate-900/30" : ""
                              }`}
                            >
                              <td className="p-4 border-b border-slate-700/50">
                                {formatDate(r.requestedDate)}
                              </td>
                              <td className="p-4 border-b border-slate-700/50">
                                {r.requestedStartTime || "-"}
                              </td>
                              <td className="p-4 border-b border-slate-700/50">
                                {r.durationHours ? `${r.durationHours}h` : "-"}
                              </td>
                              <td className="p-4 border-b border-slate-700/50">
                                {r.reason || "-"}
                              </td>
                              <td className="p-4 border-b border-slate-700/50">
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[statusLower]}`}
                                >
                                  {r.status || "Pending"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TodayStatusPage;
