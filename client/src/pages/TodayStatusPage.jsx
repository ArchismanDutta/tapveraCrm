// src/pages/TodayStatusPage.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import AttendanceHero from "../components/attendance/AttendanceHero";
import AttendanceTimeline from "../components/attendance/AttendanceTimeline";
import BreakActions from "../components/attendance/BreakActions";
import WeeklySummary from "../components/attendance/WeeklySummary";
import PunchOutTodoPopup from "../components/todo/PunchOutTodoPopup";
import PunchOutConfirmPopup from "../components/workstatus/PunchOutConfirmPopup";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import newAttendanceService from "../services/newAttendanceService";
import timeUtils from "../utils/timeUtils";
import PaymentBlockOverlay from "../components/payment/PaymentBlockOverlay";
import usePaymentCheck from "../hooks/usePaymentCheck";


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

const formatHM = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
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


const TodayStatusPage = ({ onLogout }) => {
  // Payment blocking check
  const { activePayment, checkingPayment, clearPayment } = usePaymentCheck();

  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState(null);

  // Centralized arrival time calculation utility
  const getFormattedArrivalTime = useCallback((statusData) => {
    if (!statusData) return "--";

    // First, try to get from timeline (most accurate)
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const timelineToday = (statusData.timeline || []).filter((e) => {
      const eventDate = safeParseDate(e.time);
      return eventDate && eventDate.toISOString().startsWith(todayKey);
    });

    const firstPunchIn = timelineToday.find(
      (e) => normalizeEventType(e.type) === "punch_in"
    );

    if (firstPunchIn && firstPunchIn.time) {
      return timeUtils.formatTime(firstPunchIn.time);
    }

    // Fallback to server-provided formatted time
    if (statusData.arrivalTimeFormatted) {
      return statusData.arrivalTimeFormatted;
    }

    // Last fallback: parse server UTC time using timeUtils
    if (statusData.arrivalTime) {
      return timeUtils.formatTime(statusData.arrivalTime);
    }

    return "--";
  }, []);

  const [liveWork, setLiveWork] = useState(0);
  const [liveBreak, setLiveBreak] = useState(0);
  const [, setSelectedBreakType] = useState("");
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [showTodoPopup, setShowTodoPopup] = useState(false);
  const [pendingTodoTasks, setPendingTodoTasks] = useState([]);
  const initialFetchRef = useRef(false);

  const [showPunchOutConfirm, setShowPunchOutConfirm] = useState(false);
  const [, setFlexibleRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestInProgress, setRequestInProgress] = useState(false);
  const [, setDataLoadingStates] = useState({
    status: false,
    weeklySummary: false,
    flexibleRequests: false
  });
  const [, setDataErrors] = useState({
    status: null,
    weeklySummary: null,
    flexibleRequests: null
  });
  const [, setConnectionStatus] = useState('online');

  const token = localStorage.getItem("token");

  // Get user name from localStorage
  const [userName, setUserName] = useState("");

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(user.name || "");
      }
    } catch (err) {
      console.error("Failed to parse user from localStorage:", err);
    }
  }, []);

  // Helper function to create axios config
  const getAxiosConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${token}` },
  }), [token]);

  // Enhanced fetch status with retry logic and support for new attendance system
  const fetchStatus = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);

    setDataLoadingStates(prev => ({ ...prev, status: true }));
    setDataErrors(prev => ({ ...prev, status: null }));

    try {
      console.log("Fetching today's attendance status");
      const response = await newAttendanceService.getTodayStatus();

      if (!response.success || !response.data) {
        throw new Error('Invalid response format from attendance API');
      }

      let statusData = response.data.attendance || {};

      if (statusData.events && !statusData.timeline) {
        statusData.timeline = statusData.events.map(event => ({
          type: event.type,
          time: event.timestamp,
          location: event.location,
          manual: event.manual,
          notes: event.notes
        }));
      }

      if (response.data.summary) {
        statusData = { ...statusData, ...response.data.summary };
      }

      console.log("Successfully fetched attendance status:", statusData);

      setStatus(statusData);
      setDataLoadingStates(prev => ({ ...prev, status: false }));
      setDataErrors(prev => ({ ...prev, status: null }));
      return statusData;

    } catch (err) {
      console.error(
        `Failed to fetch today's status (attempt ${retryCount + 1}/${maxRetries + 1}):`,
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        if (onLogout) onLogout();
        return null;
      }

      if (retryCount < maxRetries &&
          (err.code === 'NETWORK_ERROR' ||
           err.response?.status >= 500 ||
           err.code === 'ECONNABORTED')) {
        console.log(`Retrying in ${retryDelay}ms...`);
        const retryTimer = setTimeout(() => fetchStatus(retryCount + 1), retryDelay);
        return () => clearTimeout(retryTimer);
      }

      if (retryCount >= maxRetries) {
        const errorMessage = err.response?.data?.message ||
          err.message ||
          "Failed to load today's status. Please check your connection.";

        setDataErrors(prev => ({ ...prev, status: errorMessage }));
        setConnectionStatus(err.code === 'NETWORK_ERROR' ? 'offline' : 'error');
        toast.error(errorMessage);
      }

      setDataLoadingStates(prev => ({ ...prev, status: false }));
      return null;
    }
  }, [onLogout]);

  const handlePaymentCleared = useCallback(() => {
    clearPayment();
    fetchStatus();
  }, [clearPayment, fetchStatus]);

  const fetchWeeklySummary = useCallback(async (retryCount = 0) => {
    const maxRetries = 2;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 3000);

    setDataLoadingStates(prev => ({ ...prev, weeklySummary: true }));
    setDataErrors(prev => ({ ...prev, weeklySummary: null }));

    try {
      const now = new Date();
      const diffToMonday = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      console.log("Fetching weekly summary");
      const response = await newAttendanceService.getMyWeeklySummary(monday, sunday);

      if (!response.success || !response.data) {
        throw new Error('Invalid response from weekly summary API');
      }

      const rawData = response.data;
      const summarySource = rawData.weeklyTotals || rawData.summary || rawData.totals || {};

      const weeklySummaryData = {
        presentDays: summarySource.presentDays || summarySource.totalPresent || summarySource.totalWorkDays || 0,
        totalWork: summarySource.totalWorkTime || summarySource.totalWork || '0h 0m',
        totalBreak: summarySource.totalBreakTime || summarySource.totalBreak || '0h 0m',
        avgDailyWork: summarySource.avgDailyWork || '0h 0m',
        avgDailyBreak: summarySource.avgDailyBreak || '0h 0m',
        onTimeRate: summarySource.onTimeRate ||
                   (summarySource.averagePunctualityRate ? summarySource.averagePunctualityRate + '%' : '0%'),
        breaksTaken: summarySource.breaksTaken || 0,
        quickStats: {
          earlyArrivals: summarySource.earlyArrivals || 0,
          lateArrivals: summarySource.lateArrivals || summarySource.totalLate || summarySource.daysLate || 0,
          perfectDays: summarySource.perfectDays || 0
        },
        totalWorkTime: summarySource.totalWorkTime || summarySource.totalWork || '0h 0m',
        totalBreakTime: summarySource.totalBreakTime || summarySource.totalBreak || '0h 0m'
      };

      const dailyDataArray = rawData.dailyData || rawData.attendance || [];

      setWeeklySummary(weeklySummaryData);
      setDailyData(dailyDataArray);
      setDataLoadingStates(prev => ({ ...prev, weeklySummary: false }));
      setDataErrors(prev => ({ ...prev, weeklySummary: null }));

      return { weeklySummary: weeklySummaryData, dailyData: dailyDataArray };
    } catch (err) {
      console.error(
        `Failed to fetch weekly summary (attempt ${retryCount + 1}/${maxRetries + 1}):`,
        err.response?.data || err.message
      );

      if (retryCount < maxRetries &&
          (err.code === 'NETWORK_ERROR' ||
           err.response?.status >= 500 ||
           err.code === 'ECONNABORTED')) {
        console.log(`Retrying weekly summary in ${retryDelay}ms...`);
        const retryTimer = setTimeout(() => fetchWeeklySummary(retryCount + 1), retryDelay);
        return () => clearTimeout(retryTimer);
      }

      if (retryCount >= maxRetries) {
        const errorMessage = "Failed to load weekly summary. Some data may be incomplete.";
        setDataErrors(prev => ({ ...prev, weeklySummary: errorMessage }));
      }

      setDataLoadingStates(prev => ({ ...prev, weeklySummary: false }));
      return null;
    }
  }, []);

  const fetchFlexibleRequests = useCallback(async (retryCount = 0) => {
    const maxRetries = 2;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 3000);

    setDataLoadingStates(prev => ({ ...prev, flexibleRequests: true }));
    setDataErrors(prev => ({ ...prev, flexibleRequests: null }));

    try {
      const res = await axios.get(
        `${API_BASE}/api/flexible-shifts/my-requests`,
        {
          ...getAxiosConfig(),
          params: {
            _timestamp: Date.now(),
            _retry: retryCount
          },
          timeout: 10000
        }
      );

      const requestsData = Array.isArray(res.data) ? res.data : [];
      setFlexibleRequests(requestsData);
      setDataLoadingStates(prev => ({ ...prev, flexibleRequests: false }));
      setDataErrors(prev => ({ ...prev, flexibleRequests: null }));

      return requestsData;
    } catch (err) {
      console.error(
        `Failed to fetch flexible shift requests (attempt ${retryCount + 1}/${maxRetries + 1}):`,
        err.response?.data || err.message
      );

      if (retryCount < maxRetries &&
          (err.code === 'NETWORK_ERROR' ||
           err.response?.status >= 500 ||
           err.code === 'ECONNABORTED')) {
        console.log(`Retrying flexible requests in ${retryDelay}ms...`);
        const retryTimer = setTimeout(() => fetchFlexibleRequests(retryCount + 1), retryDelay);
        return () => clearTimeout(retryTimer);
      }

      if (retryCount >= maxRetries && err.response?.status !== 404) {
        const errorMessage = "Could not load flexible shift requests";
        setDataErrors(prev => ({ ...prev, flexibleRequests: errorMessage }));
        console.warn(errorMessage + ", but continuing...");
      }

      setDataLoadingStates(prev => ({ ...prev, flexibleRequests: false }));
      return [];
    }
  }, [getAxiosConfig]);

  const updateStatus = async (update) => {
    if (!status && update?.currentlyWorking !== true) {
      console.warn("Cannot update status - no current status available");
      return;
    }

    if (requestInProgress) {
      toast.info("Please wait for the current operation to complete.");
      return;
    }

    console.log("Status update initiated:", update);

    setRequestInProgress(true);
    setIsLoading(true);

    const previousStatus = { ...status };
    const previousLiveWork = liveWork;
    const previousLiveBreak = liveBreak;
    const previousTimeline = Array.isArray(status?.timeline) ? status.timeline : [];
    let nextTimeline = previousTimeline;

    try {
      const payload = {
        currentlyWorking: status?.currentlyWorking || false,
        onBreak: status?.onBreak || false,
        ...update,
      };

      if (payload.timelineEvent?.time) {
        const timeValue = new Date(payload.timelineEvent.time);
        if (isNaN(timeValue.getTime())) {
          throw new Error("Invalid time value in timeline event");
        }
        payload.timelineEvent.time = timeValue.toISOString();
      }

      if (payload.breakStartTime) {
        const breakStartValue = new Date(payload.breakStartTime);
        if (isNaN(breakStartValue.getTime())) {
          throw new Error("Invalid break start time value");
        }
        payload.breakStartTime = breakStartValue.toISOString();
      }

      if (payload.timelineEvent) {
        const eventType = payload.timelineEvent.type?.toLowerCase() || '';
        const eventTime = payload.timelineEvent.time;
        const timelineEvent = {
          ...payload.timelineEvent,
          time: eventTime
        };
        nextTimeline = [...previousTimeline, timelineEvent];

        const optimisticStatus = {
          ...status,
          currentlyWorking: payload.currentlyWorking,
          onBreak: payload.onBreak,
          timeline: nextTimeline
        };

        if (eventType.includes('punch in') && !status.arrivalTime) {
          const currentUTCTime = new Date();
          optimisticStatus.arrivalTime = currentUTCTime.toISOString();
          optimisticStatus.arrivalTimeFormatted = timeUtils.formatTime(currentUTCTime.toISOString());
        }

        setStatus(optimisticStatus);
      }

      console.log("Sending update payload:", payload);

      if (!payload.timelineEvent) {
        throw new Error('Timeline event is required for attendance update');
      }

      const normalizeEventType = (eventType) => {
        const normalized = String(eventType || '').toLowerCase().trim();
        if (normalized.includes('punch') && normalized.includes('in')) return 'PUNCH_IN';
        if (normalized.includes('punch') && normalized.includes('out')) return 'PUNCH_OUT';
        if (normalized.includes('break') && normalized.includes('start')) return 'BREAK_START';
        if (normalized.includes('resume')) return 'BREAK_END';
        return 'PUNCH_IN';
      };

      const newEventType = normalizeEventType(payload.timelineEvent.type);

      const response = await newAttendanceService.recordPunchAction(newEventType, {
        location: payload.timelineEvent.location || 'Office',
        notes: payload.timelineEvent.notes || ''
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Attendance system call failed');
      }

      const currentWork = liveWork;
      const currentBreak = liveBreak;

      const serverResponse = {
        currentlyWorking: response.data.currentlyWorking,
        onBreak: response.data.onBreak,
        currentStatus: response.data.currentStatus,
        workDuration: response.data.workDuration,
        breakDuration: response.data.breakDuration,
        workDurationSeconds: Math.max(response.data.workDurationSeconds || 0, currentWork || 0),
        breakDurationSeconds: Math.max(response.data.breakDurationSeconds || 0, currentBreak || 0),
        arrivalTime: response.data.arrivalTime,
        departureTime: response.data.departureTime,
        isLate: response.data.isLate,
        timeline: nextTimeline,
        lastEvent: {
          type: payload.timelineEvent.type,
          time: payload.timelineEvent.time,
          location: payload.timelineEvent.location,
          notes: payload.timelineEvent.notes
        }
      };

      const serverStatus = { ...serverResponse };

      if (serverStatus.arrivalTime && !serverStatus.arrivalTimeFormatted) {
        serverStatus.arrivalTimeFormatted = timeUtils.formatTime(serverStatus.arrivalTime);
      }

      setStatus(serverStatus);
      setSelectedBreakType("");
      setConnectionStatus('online');
      setDataErrors(prev => ({ ...prev, status: null }));

      const eventType = payload.timelineEvent?.type?.toLowerCase() || '';
      if (eventType.includes('punch in')) {
        setTimeout(() => {
          fetchStatus().catch(err => {
            console.warn("Failed to refresh status after punch-in:", err);
          });
        }, 1000);
      }

      setTimeout(() => {
        fetchWeeklySummary().catch(err => {
          console.error("Failed to refresh weekly summary after status update:", err);
        });
      }, 1000);

      window.dispatchEvent(new CustomEvent("statusUpdate", {
        detail: {
          type: payload.timelineEvent?.type,
          timestamp: new Date().toISOString(),
          status: serverResponse
        }
      }));

      if (payload.timelineEvent?.type) {
        const eventType = payload.timelineEvent.type.toLowerCase();
        if (eventType.includes("punch in")) {
          toast.success("Punched in successfully! Work timer started.", { autoClose: 3000 });
        } else if (eventType.includes("punch out")) {
          toast.success("Punched out successfully! Great work today!", { autoClose: 3000 });
        } else if (eventType.includes("break")) {
          toast.success("Break started! Take your time.", { autoClose: 3000 });
        } else if (eventType.includes("resume")) {
          toast.success("Work resumed! Break timer stopped.", { autoClose: 3000 });
        }
      }
    } catch (err) {
      console.error("Status update failed:", err);

      setStatus(previousStatus);
      setLiveWork(previousLiveWork);
      setLiveBreak(previousLiveBreak);

      const serverData = err.response?.data;
      const errorMessage =
        serverData?.message ||
        serverData?.error ||
        (err.code === 'NETWORK_ERROR' ? "Network error. Please check your connection." : "Failed to update status.");

      if (err.code === 'NETWORK_ERROR' || err.response?.status >= 500) {
        setConnectionStatus('error');
        setDataErrors(prev => ({ ...prev, status: errorMessage }));
      }

      toast.error(errorMessage, { autoClose: 5000 });
    } finally {
      setIsLoading(false);
      setRequestInProgress(false);
    }
  };

  // Live timers effect
  useEffect(() => {
    if (!status) return;

    console.log("Initializing live timers");

    const timers = [];
    const now = new Date();

    // Calculate from timeline
    if (status.timeline && Array.isArray(status.timeline)) {
      const todayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const events = status.timeline.filter(e => {
        const eventDate = new Date(e.time);
        return eventDate >= todayStart && eventDate <= now;
      });

      let totalWorkSeconds = 0;
      let totalBreakSeconds = 0;
      let currentSessionStart = null;
      let currentBreakStart = null;

      for (const event of events) {
        const eventType = event.type?.toUpperCase() || '';
        const eventTime = new Date(event.time);

        if (eventType === 'PUNCH_IN' || eventType === 'BREAK_END') {
          currentSessionStart = eventTime;
        } else if (eventType === 'BREAK_START' || eventType === 'PUNCH_OUT') {
          if (currentSessionStart) {
            totalWorkSeconds += Math.floor((eventTime - currentSessionStart) / 1000);
            currentSessionStart = null;
          }
        }

        if (eventType === 'BREAK_START') {
          currentBreakStart = eventTime;
        } else if (eventType === 'BREAK_END') {
          if (currentBreakStart) {
            totalBreakSeconds += Math.floor((eventTime - currentBreakStart) / 1000);
            currentBreakStart = null;
          }
        }
      }

      if (currentSessionStart && status.currentlyWorking) {
        totalWorkSeconds += Math.floor((now - currentSessionStart) / 1000);
      }

      if (currentBreakStart && status.onBreak) {
        totalBreakSeconds += Math.floor((now - currentBreakStart) / 1000);
      }

      setLiveWork(prev => prev === 0 ? totalWorkSeconds : (totalWorkSeconds > prev ? totalWorkSeconds : prev));
      setLiveBreak(prev => prev === 0 ? totalBreakSeconds : (totalBreakSeconds > prev ? totalBreakSeconds : prev));
    }

    if (status.currentlyWorking && !status.onBreak) {
      const workTimer = setInterval(() => {
        setLiveWork(prev => prev + 1);
      }, 1000);
      timers.push(workTimer);
    }

    if (status.onBreak) {
      const breakTimer = setInterval(() => {
        setLiveBreak(prev => prev + 1);
      }, 1000);
      timers.push(breakTimer);
    }

    return () => {
      timers.forEach(clearInterval);
    };
  }, [status]);

  const fetchAllData = useCallback(async (options = {}) => {
    const { isInitial = false, force = false } = options;

    if (!force && requestInProgress) {
      console.log("Skipping data fetch - request in progress");
      return;
    }

    console.log(`${isInitial ? 'Initial' : 'Periodic'} data fetch started`);

    const promises = [
      fetchStatus(),
      fetchWeeklySummary(),
      fetchFlexibleRequests()
    ];

    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Data fetch completed: ${successful} successful, ${failed} failed`);

      if (failed > 0 && isInitial) {
        toast.warning(`Some data could not be loaded. Retrying in background...`);
      }
    } catch (error) {
      console.error("Critical error during data fetch:", error);
      if (isInitial) {
        toast.error("Failed to load application data. Please refresh the page.");
      }
    }
  }, [fetchStatus, fetchWeeklySummary, fetchFlexibleRequests, requestInProgress]);

  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    fetchAllData({ isInitial: true });
  }, [fetchAllData]);

  // Previously a 30s/120s poll pair. Now event-driven: the server emits
  // "attendance:updated" (bridged to this window event by
  // WebSocketContext.jsx) whenever this same user's attendance changes —
  // covering both another device/tab punching for them, and an admin's
  // manual correction — so a blind re-poll of this page's own data is
  // redundant with it. Filtered to this user's own ID because an admin/hr
  // viewer also gets this event for every OTHER employee's punches (they're
  // in the admin/hr role rooms too), and this page only cares about its own.
  useEffect(() => {
    const currentUserId = (() => {
      try { return JSON.parse(localStorage.getItem("user") || "{}")._id; } catch { return null; }
    })();

    const handleLiveAttendanceUpdate = (event) => {
      if (requestInProgress) return;
      const data = event.detail || {};
      if (data.userId && currentUserId && String(data.userId) !== String(currentUserId)) return;
      fetchStatus();
      fetchWeeklySummary();
    };

    window.addEventListener("attendance-updated", handleLiveAttendanceUpdate);
    return () => window.removeEventListener("attendance-updated", handleLiveAttendanceUpdate);
  }, [fetchStatus, fetchWeeklySummary, requestInProgress]);

  // Enhanced punch logic
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
        type: EVENT_TYPES.BREAK_START,
        time: new Date().toISOString(),
        notes: breakType,
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
      timelineEvent: {
        type: EVENT_TYPES.RESUME_WORK,
        time: new Date().toISOString(),
        notes: currentBreakType || "",
      },
    });
  };

  // Calculate derived values for new components
  const TARGET_WORK_HOURS = 8 * 3600; // 8 hours in seconds
  const remainingSeconds = Math.max(0, TARGET_WORK_HOURS - liveWork);
  const workProgress = Math.min((liveWork / TARGET_WORK_HOURS) * 100, 100);

  // Extract current break type if on break
  const currentBreakType = useMemo(() => {
    if (!status?.onBreak) return "";
    const lastBreakEvent = (status.timeline || [])
      .filter(e => e.type?.toLowerCase().includes("break") && e.type?.toLowerCase().includes("start"))
      .sort((a, b) => new Date(b.time) - new Date(a.time))[0];

    if (lastBreakEvent) {
      const notesLabel = String(lastBreakEvent.notes || "").trim();
      if (notesLabel) return notesLabel;

      const match = lastBreakEvent.type.match(/\(([^)]+)\)/);
      return match ? match[1] : "";
    }
    return "";
  }, [status]);

  if (!status)
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm dark:border-white/10 dark:bg-[#10131c]">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400"></div>
          <h2 className="mb-2 text-lg font-semibold">Loading attendance</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Preparing today&apos;s work status...</p>
        </div>
      </div>
    );

  if (checkingPayment) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
        <div className="text-center">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-2 border-blue-200 dark:border-blue-300/20"></div>
            <div className="absolute left-0 top-0 h-14 w-14 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent"></div>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">Preparing attendance...</p>
        </div>
      </div>
    );
  }

  if (activePayment) {
    return (
      <PaymentBlockOverlay
        payment={activePayment}
        onPaymentCleared={handlePaymentCleared}
      />
    );
  }

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
          <AttendanceHero
            userName={userName}
            currentlyWorking={status.currentlyWorking}
            onBreak={status.onBreak}
            punchInTime={getFormattedArrivalTime(status)}
            workedDuration={formatHMS(liveWork)}
            breakDuration={formatHMS(liveBreak)}
            remainingHours={formatHM(remainingSeconds)}
            onPunchIn={handlePunchIn}
            onPunchOut={handlePunchOutClick}
            isLoading={isLoading}
            alreadyPunchedIn={alreadyPunchedIn}
            alreadyPunchedOut={alreadyPunchedOut}
            workProgress={workProgress}
            isWFH={status.isWFH || status.leaveInfo?.isWFH || false}
          />

          {(status.currentlyWorking || status.onBreak) && (
            <BreakActions
              breakDuration={formatHMS(liveBreak)}
              onBreak={status.onBreak}
              onStartBreak={handleStartBreak}
              onResumeWork={handleResumeWork}
              currentlyWorking={status.currentlyWorking}
              isLoading={isLoading}
              currentBreakType={currentBreakType}
            />
          )}

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            <WeeklySummary
              dailyData={dailyData}
              weeklySummary={weeklySummary}
            />

            <AttendanceTimeline
              timeline={status.timeline || []}
            />
          </div>
        </div>

        {/* Modals */}
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
      </main>
    </div>
  );
};

export default TodayStatusPage;
