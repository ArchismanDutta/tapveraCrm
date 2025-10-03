// src/pages/TodayStatusPage.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import newAttendanceService from "../services/newAttendanceService";
import attendanceDataConverter from "../services/attendanceDataConverter";


const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const SIDEBAR_WIDTH_EXPANDED = 288;
const SIDEBAR_WIDTH_COLLAPSED = 80;

// Feature flag for new attendance system
const USE_NEW_ATTENDANCE_SYSTEM = import.meta.env.VITE_USE_NEW_ATTENDANCE === 'true' || true;

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


const TodayStatusPage = ({ onLogout }) => {
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
      const arrivalDate = new Date(firstPunchIn.time);
      if (!isNaN(arrivalDate.getTime())) {
        return arrivalDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }
    }

    // Fallback to server-provided formatted time
    if (statusData.arrivalTimeFormatted) {
      return statusData.arrivalTimeFormatted;
    }

    // Last fallback: parse server UTC time to local
    if (statusData.arrivalTime) {
      const arrivalDate = new Date(statusData.arrivalTime);
      if (!isNaN(arrivalDate.getTime())) {
        return arrivalDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }
    }

    return "--";
  }, []);
  const [liveWork, setLiveWork] = useState(0);
  const [liveBreak, setLiveBreak] = useState(0);
  const [selectedBreakType, setSelectedBreakType] = useState("");
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [showTodoPopup, setShowTodoPopup] = useState(false);
  const [pendingTodoTasks, setPendingTodoTasks] = useState([]);

  // Ref to track previous status for detecting state changes
  const previousStatusRef = useRef(null);
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
  const [dataLoadingStates, setDataLoadingStates] = useState({
    status: false,
    weeklySummary: false,
    flexibleRequests: false
  });
  const [dataErrors, setDataErrors] = useState({
    status: null,
    weeklySummary: null,
    flexibleRequests: null
  });
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState(null);

  const token = localStorage.getItem("token");

  // Helper function to create axios config
  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${token}` },
  });

  // Enhanced fetch status with retry logic and support for new attendance system
  const fetchStatus = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff

    // Update loading state
    setDataLoadingStates(prev => ({ ...prev, status: true }));
    setDataErrors(prev => ({ ...prev, status: null }));

    try {
      let statusData;

      if (USE_NEW_ATTENDANCE_SYSTEM) {
        // Use new attendance system
        console.log("🆕 Using new attendance system API");
        const response = await newAttendanceService.getTodayStatus();

        if (response.success && response.data) {
          // Use the service's conversion method for better consistency
          statusData = newAttendanceService.convertToLegacyFormat(response);

          // Add summary data from response
          if (response.data.summary) {
            statusData = { ...statusData, ...response.data.summary };
          }

          console.log("✅ Successfully fetched new attendance status:", statusData);
        } else {
          throw new Error('Invalid response format from new attendance API');
        }
      } else {
        // Use old attendance system (fallback)
        console.log("📍 Using legacy attendance system API");
        const res = await axios.get(
          `${API_BASE}/api/status/today`,
          {
            ...getAxiosConfig(),
            params: {
              _timestamp: Date.now(), // Cache-busting
              _retry: retryCount
            },
            timeout: 15000 // 15 second timeout
          }
        );

        console.log("✅ Successfully fetched legacy status:", res.data);

        // Validate critical data
        if (res.data && typeof res.data === 'object') {
          statusData = { ...res.data };

          // If server sends arrivalTime in UTC, convert to local formatted time
          if (statusData.arrivalTime && !statusData.arrivalTimeFormatted) {
            const arrivalDate = new Date(statusData.arrivalTime);
            if (!isNaN(arrivalDate.getTime())) {
              statusData.arrivalTimeFormatted = arrivalDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });
              console.log("🕒 Converted legacy UTC arrival time to local:", statusData.arrivalTimeFormatted);
            }
          }
        } else {
          throw new Error('Invalid status data received from legacy API');
        }
      }

      setStatus(statusData);
      setDataLoadingStates(prev => ({ ...prev, status: false }));
      setDataErrors(prev => ({ ...prev, status: null }));
      setLastSuccessfulFetch(new Date());
      return statusData;

    } catch (err) {
      console.error(
        `❌ Failed to fetch today's status (attempt ${retryCount + 1}/${maxRetries + 1}):`,
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        // Handle authentication error - don't retry
        localStorage.removeItem("token");
        if (onLogout) onLogout();
        return null;
      }

      // Retry logic for network errors or server issues
      if (retryCount < maxRetries &&
          (err.code === 'NETWORK_ERROR' ||
           err.response?.status >= 500 ||
           err.code === 'ECONNABORTED')) {
        console.log(`🔄 Retrying in ${retryDelay}ms...`);
        setTimeout(() => fetchStatus(retryCount + 1), retryDelay);
        return null;
      }

      // Update error state and show error toast on final failure
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
  }, [token, onLogout]);

  // Enhanced fetch weekly summary with retry logic and support for new attendance system
  const fetchWeeklySummary = useCallback(async (retryCount = 0) => {
    const maxRetries = 2;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 3000);

    // Update loading state
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

      let weeklySummaryData, dailyDataArray;

      if (USE_NEW_ATTENDANCE_SYSTEM) {
        // Use new attendance system (employee-accessible endpoint)
        console.log("🆕 Using new attendance system for weekly summary");
        const response = await newAttendanceService.getMyWeeklySummary(monday, sunday);

        if (response.success && response.data) {
          console.log("📊 Raw weekly summary response:", response.data);

          // Try to convert new weekly data to legacy format using the converter
          const convertedData = attendanceDataConverter.convertWeeklyDataToLegacy(response);

          if (convertedData && convertedData.data) {
            weeklySummaryData = convertedData.data.weeklySummary;
            dailyDataArray = convertedData.data.dailyData;
            console.log("✅ Using converted weekly data:", {
              presentDays: weeklySummaryData.presentDays,
              totalWork: weeklySummaryData.totalWork,
              totalBreak: weeklySummaryData.totalBreak,
              avgDailyWork: weeklySummaryData.avgDailyWork,
              onTimeRate: weeklySummaryData.onTimeRate,
              dailyCount: dailyDataArray.length
            });
          } else {
            // Fallback: Try to extract data directly from response
            console.log("⚠️ Conversion failed, trying direct extraction");
            const rawData = response.data;

            // Try different possible structures for summary data
            const summarySource = rawData.weeklyTotals || rawData.summary || rawData.totals || {};

            weeklySummaryData = {
              presentDays: summarySource.presentDays || summarySource.totalPresent || 0,
              totalWork: summarySource.totalWorkTime || summarySource.totalWork || '0h 0m',
              totalBreak: summarySource.totalBreakTime || summarySource.totalBreak || '0h 0m',
              avgDailyWork: summarySource.avgDailyWork || '0h 0m',
              avgDailyBreak: summarySource.avgDailyBreak || '0h 0m',
              onTimeRate: summarySource.onTimePercentage ?
                Math.round(summarySource.onTimePercentage) + '%' : '0%',
              breaksTaken: summarySource.breaksTaken || 0,
              quickStats: {
                earlyArrivals: summarySource.earlyArrivals || 0,
                lateArrivals: summarySource.lateArrivals || summarySource.totalLate || 0,
                perfectDays: summarySource.perfectDays || 0
              },
              // Legacy compatibility
              totalWorkTime: summarySource.totalWorkTime || summarySource.totalWork || '0h 0m',
              totalBreakTime: summarySource.totalBreakTime || summarySource.totalBreak || '0h 0m'
            };

            dailyDataArray = rawData.dailyData || rawData.attendance || [];

            console.log("📋 Fallback weekly data:", {
              presentDays: weeklySummaryData.presentDays,
              dailyCount: dailyDataArray.length,
              summarySource: Object.keys(summarySource)
            });
          }

          // Validate the final data - if everything is zero, something might be wrong
          if (weeklySummaryData.presentDays === 0 &&
              weeklySummaryData.totalWorkTime === '0h 0m' &&
              dailyDataArray.length === 0) {
            console.warn("⚠️ All weekly summary values are zero - possible data issue");

            // Keep previous values if available, or set reasonable defaults
            if (!weeklySummary || (weeklySummary.presentDays === 0 && dailyData.length === 0)) {
              console.log("📝 Setting comprehensive fallback data for SummaryCard");
              weeklySummaryData = {
                presentDays: 0,
                totalWork: '0h 0m',
                totalBreak: '0h 0m',
                avgDailyWork: '0h 0m',
                avgDailyBreak: '0h 0m',
                onTimeRate: '0%',
                breaksTaken: 0,
                quickStats: {
                  earlyArrivals: 0,
                  lateArrivals: 0,
                  perfectDays: 0
                },
                // Legacy compatibility
                totalWorkTime: '0h 0m',
                totalBreakTime: '0h 0m'
              };
            } else {
              console.log("📋 Preserving previous valid data");
              weeklySummaryData = weeklySummary;
              dailyDataArray = dailyData;
            }
          }

          console.log("✅ Final weekly summary data:", weeklySummaryData);
        } else {
          throw new Error('Invalid response from new weekly summary API');
        }
      } else {
        // Use old system
        console.log("📍 Using legacy system for weekly summary");
        const res = await axios.get(`${API_BASE}/api/summary/week`, {
          ...getAxiosConfig(),
          params: {
            startDate: monday.toISOString(),
            endDate: sunday.toISOString(),
            _timestamp: Date.now(), // Cache-busting
            _retry: retryCount
          },
          timeout: 12000 // 12 second timeout
        });

        console.log("✅ Successfully fetched legacy weekly summary:", res.data);

        // Validate and set data with fallbacks
        weeklySummaryData = res.data?.weeklySummary || null;
        dailyDataArray = Array.isArray(res.data?.dailyData) ? res.data.dailyData : [];
      }

      // Update state with proper logging
      console.log("📊 Setting weekly summary state:", {
        hasData: !!weeklySummaryData,
        presentDays: weeklySummaryData?.presentDays,
        totalWorkTime: weeklySummaryData?.totalWorkTime,
        dailyDataCount: dailyDataArray?.length
      });

      setWeeklySummary(weeklySummaryData);
      setDailyData(dailyDataArray);
      setDataLoadingStates(prev => ({ ...prev, weeklySummary: false }));
      setDataErrors(prev => ({ ...prev, weeklySummary: null }));

      // Force component update by dispatching event
      window.dispatchEvent(new CustomEvent("weeklySummaryUpdated", {
        detail: { weeklySummary: weeklySummaryData, dailyData: dailyDataArray }
      }));

      return { weeklySummary: weeklySummaryData, dailyData: dailyDataArray };
    } catch (err) {
      console.error(
        `❌ Failed to fetch weekly summary (attempt ${retryCount + 1}/${maxRetries + 1}):`,
        err.response?.data || err.message
      );

      // Retry logic for network/server errors
      if (retryCount < maxRetries &&
          (err.code === 'NETWORK_ERROR' ||
           err.response?.status >= 500 ||
           err.code === 'ECONNABORTED')) {
        console.log(`🔄 Retrying weekly summary in ${retryDelay}ms...`);
        setTimeout(() => fetchWeeklySummary(retryCount + 1), retryDelay);
        return null;
      }

      // Update error state and show error on final failure
      if (retryCount >= maxRetries) {
        const errorMessage = "Failed to load weekly summary. Some data may be incomplete.";
        setDataErrors(prev => ({ ...prev, weeklySummary: errorMessage }));
        toast.error(errorMessage);
      }

      setDataLoadingStates(prev => ({ ...prev, weeklySummary: false }));
      return null;
    }
  }, [token]);

  // Enhanced fetch flexible shift requests with retry and validation
  const fetchFlexibleRequests = useCallback(async (retryCount = 0) => {
    const maxRetries = 2;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 3000);

    // Update loading state
    setDataLoadingStates(prev => ({ ...prev, flexibleRequests: true }));
    setDataErrors(prev => ({ ...prev, flexibleRequests: null }));

    try {
      const res = await axios.get(
        `${API_BASE}/api/flexible-shifts/my-requests`,
        {
          ...getAxiosConfig(),
          params: {
            _timestamp: Date.now(), // Cache-busting
            _retry: retryCount
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log("✅ Successfully fetched flexible requests:", res.data);

      // Validate data and ensure it's an array
      const requestsData = Array.isArray(res.data) ? res.data : [];
      setFlexibleRequests(requestsData);
      setDataLoadingStates(prev => ({ ...prev, flexibleRequests: false }));
      setDataErrors(prev => ({ ...prev, flexibleRequests: null }));

      return requestsData;
    } catch (err) {
      console.error(
        `❌ Failed to fetch flexible shift requests (attempt ${retryCount + 1}/${maxRetries + 1}):`,
        err.response?.data || err.message
      );

      // Retry logic for network/server errors
      if (retryCount < maxRetries &&
          (err.code === 'NETWORK_ERROR' ||
           err.response?.status >= 500 ||
           err.code === 'ECONNABORTED')) {
        console.log(`🔄 Retrying flexible requests in ${retryDelay}ms...`);
        setTimeout(() => fetchFlexibleRequests(retryCount + 1), retryDelay);
        return null;
      }

      // Update error state - silently fail for flexible requests as they're not critical
      if (retryCount >= maxRetries && err.response?.status !== 404) {
        const errorMessage = "Could not load flexible shift requests";
        setDataErrors(prev => ({ ...prev, flexibleRequests: errorMessage }));
        console.warn(errorMessage + ", but continuing...");
      }

      setDataLoadingStates(prev => ({ ...prev, flexibleRequests: false }));
      return [];
    }
  }, [token]);

  // Enhanced update status with optimistic updates and better error handling
  const updateStatus = async (update) => {
    if (!status && update?.currentlyWorking !== true) {
      console.warn("⚠️ Cannot update status - no current status available");
      return;
    }

    if (requestInProgress) {
      toast.info("Please wait for the current operation to complete.");
      return;
    }

    console.log("📤 Status update initiated:", update);

    setRequestInProgress(true);
    setIsLoading(true);

    // Store previous status for rollback on error
    const previousStatus = { ...status };
    const previousLiveWork = liveWork;
    const previousLiveBreak = liveBreak;

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

      // Optimistic update - immediately update UI for better responsiveness
      if (payload.timelineEvent) {
        const eventType = payload.timelineEvent.type?.toLowerCase() || '';
        const eventTime = payload.timelineEvent.time;

        const optimisticStatus = {
          ...status,
          currentlyWorking: payload.currentlyWorking,
          onBreak: payload.onBreak,
          timeline: [...(status.timeline || []), {
            ...payload.timelineEvent,
            time: eventTime
          }]
        };

        // Handle arrival time for punch in events
        if (eventType.includes('punch in') && !status.arrivalTime) {
          // Use current UTC time for arrival time (matches backend expectation)
          const currentUTCTime = new Date();
          optimisticStatus.arrivalTime = currentUTCTime.toISOString();
          // Format for display using local time
          optimisticStatus.arrivalTimeFormatted = currentUTCTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          console.log("🚀 Setting arrival time optimistically (UTC):", optimisticStatus.arrivalTime);
          console.log("🚀 Arrival time formatted (local):", optimisticStatus.arrivalTimeFormatted);
        }

        setStatus(optimisticStatus);
        console.log("🚀 Optimistic update applied");
      }

      console.log("📤 Sending update payload:", payload);

      let serverResponse;

      if (USE_NEW_ATTENDANCE_SYSTEM && payload.timelineEvent) {
        // Use new attendance system
        console.log("🆕 Using new attendance system for status update");

        // Use the converter to map event types
        const newEventType = attendanceDataConverter.extractEventType(payload.timelineEvent.type);

        console.log("📝 Event type mapping:", { original: payload.timelineEvent.type, mapped: newEventType });

        const response = await newAttendanceService.recordPunchAction(newEventType, {
          location: payload.timelineEvent.location || 'Office',
          notes: payload.timelineEvent.notes || ''
        });

        if (response.success && response.data) {
          // CRITICAL: Protect against zero duration values during break transitions
          const currentWork = liveWork;
          const currentBreak = liveBreak;

          // Convert new response format to legacy format
          serverResponse = {
            currentlyWorking: response.data.currentlyWorking,
            onBreak: response.data.onBreak,
            currentStatus: response.data.currentStatus,
            workDuration: response.data.workDuration,
            breakDuration: response.data.breakDuration,
            // PROTECTION: Never let server zeros override good timer values
            workDurationSeconds: Math.max(response.data.workDurationSeconds || 0, currentWork || 0),
            breakDurationSeconds: Math.max(response.data.breakDurationSeconds || 0, currentBreak || 0),
            arrivalTime: response.data.arrivalTime,
            departureTime: response.data.departureTime,
            isLate: response.data.isLate,
            timeline: status.timeline, // Keep existing timeline, will be refreshed by fetchStatus
            // Add the new event to timeline optimistically
            lastEvent: {
              type: payload.timelineEvent.type,
              time: payload.timelineEvent.time,
              location: payload.timelineEvent.location
            }
          };

          console.log("🛡️ Protected server response:", {
            serverWork: response.data.workDurationSeconds,
            currentWork,
            finalWork: serverResponse.workDurationSeconds,
            serverBreak: response.data.breakDurationSeconds,
            currentBreak,
            finalBreak: serverResponse.breakDurationSeconds
          });
        } else {
          throw new Error(response.message || 'New attendance system call failed');
        }
      } else {
        // Use old attendance system
        console.log("📍 Using legacy attendance system for status update");
        const res = await axios.put(
          `${API_BASE}/api/status/today`,
          payload,
          {
            ...getAxiosConfig(),
            timeout: 10000 // 10 second timeout for status updates
          }
        );

        console.log("✅ Legacy status update successful:", res.data);

        // CRITICAL: Protect against zero duration values in legacy response too
        const currentWork = liveWork;
        const currentBreak = liveBreak;

        serverResponse = {
          ...res.data,
          // PROTECTION: Never let server zeros override good timer values
          workDurationSeconds: Math.max(res.data.workDurationSeconds || 0, currentWork || 0),
          breakDurationSeconds: Math.max(res.data.breakDurationSeconds || 0, currentBreak || 0)
        };

        console.log("🛡️ Protected legacy response:", {
          serverWork: res.data.workDurationSeconds,
          currentWork,
          finalWork: serverResponse.workDurationSeconds,
          serverBreak: res.data.breakDurationSeconds,
          currentBreak,
          finalBreak: serverResponse.breakDurationSeconds
        });
      }

      // Update with server response and ensure proper time formatting
      const serverStatus = { ...serverResponse };

      // IMMEDIATE: Trigger weekly summary refresh for responsive UI
      console.log("🚀 Immediate weekly summary refresh trigger");
      setTimeout(() => {
        fetchWeeklySummary().catch(err => {
          console.warn("⚠️ Immediate weekly summary refresh failed:", err);
        });
      }, 100); // Very quick refresh attempt

      // If server sends arrivalTime in UTC, convert to local formatted time
      if (serverStatus.arrivalTime && !serverStatus.arrivalTimeFormatted) {
        const arrivalDate = new Date(serverStatus.arrivalTime);
        if (!isNaN(arrivalDate.getTime())) {
          serverStatus.arrivalTimeFormatted = arrivalDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          console.log("🕒 Converted server UTC arrival time to local:", serverStatus.arrivalTimeFormatted);
        }
      }

      setStatus(serverStatus);
      setSelectedBreakType("");
      setConnectionStatus('online');
      setDataErrors(prev => ({ ...prev, status: null }));

      // For punch-in events, refresh status to ensure arrival time is properly synced
      const eventType = payload.timelineEvent?.type?.toLowerCase() || '';
      if (eventType.includes('punch in')) {
        console.log("🔄 Refreshing status after punch-in to sync arrival time...");
        setTimeout(() => {
          fetchStatus().catch(err => {
            console.warn("⚠️ Failed to refresh status after punch-in:", err);
          });
        }, 1000); // Small delay to allow backend processing
      }

      // Refresh related data in background with delay to ensure backend processing is complete
      setTimeout(() => {
        console.log("🔄 Refreshing weekly summary after status update...");
        fetchWeeklySummary().catch(err => {
          console.error("❌ Failed to refresh weekly summary after status update:", err);
          // Try again with a shorter delay
          setTimeout(() => {
            console.log("🔄 Retrying weekly summary refresh...");
            fetchWeeklySummary().catch(retryErr => {
              console.error("❌ Weekly summary retry also failed:", retryErr);
            });
          }, 1000);
        });
      }, 1000); // Reduced delay from 2 seconds to 1 second

      // Notify other components
      window.dispatchEvent(new CustomEvent("statusUpdate", {
        detail: {
          type: payload.timelineEvent?.type,
          timestamp: new Date().toISOString(),
          status: serverResponse
        }
      }));

      // Show success message for major actions with enhanced feedback
      if (payload.timelineEvent?.type) {
        const eventType = payload.timelineEvent.type.toLowerCase();
        if (eventType.includes("punch in")) {
          toast.success("🔓 Punched in successfully! Work timer started.", { autoClose: 3000 });
        } else if (eventType.includes("punch out")) {
          toast.success("🔒 Punched out successfully! Great work today!", { autoClose: 3000 });
        } else if (eventType.includes("break")) {
          toast.success("☕ Break started! Take your time.", { autoClose: 3000 });
        } else if (eventType.includes("resume")) {
          toast.success("💼 Work resumed! Break timer stopped.", { autoClose: 3000 });
        }
      }
    } catch (err) {
      console.error("❌ Status update failed:", err);

      // Rollback optimistic update
      setStatus(previousStatus);
      setLiveWork(previousLiveWork);
      setLiveBreak(previousLiveBreak);
      console.log("🔄 Optimistic update rolled back");

      const serverData = err.response?.data;
      const errorMessage =
        serverData?.message ||
        serverData?.error ||
        (err.code === 'NETWORK_ERROR' ? "Network error. Please check your connection." : "Failed to update status.");

      // Set connection status based on error type
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

  // Enhanced live timers with better synchronization and accuracy
  useEffect(() => {
    if (!status) return;

    console.log("🕰️ Initializing live timers:", {
      currentlyWorking: status.currentlyWorking,
      onBreak: status.onBreak,
      workDurationSeconds: status.workDurationSeconds,
      breakDurationSeconds: status.breakDurationSeconds
    });

    // Calculate current live time based on timeline instead of just using server duration
    // This prevents timer resets during polling/refreshes

    const timers = [];
    let workStartTime = null;
    let breakStartTime = null;
    const now = new Date();

    // Calculate accurate start times and current durations from timeline if available
    if (status.timeline && Array.isArray(status.timeline)) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find the last work session start time
      const lastWorkStart = [...status.timeline]
        .reverse()
        .find(event => {
          const eventDate = new Date(event.time);
          return eventDate >= todayStart &&
                 (event.type?.toLowerCase().includes('punch in') ||
                  event.type?.toLowerCase().includes('resume'));
        });

      // Find the last break start time
      const lastBreakStart = [...status.timeline]
        .reverse()
        .find(event => {
          const eventDate = new Date(event.time);
          return eventDate >= todayStart &&
                 event.type?.toLowerCase().includes('break start');
        });

      if (lastWorkStart) workStartTime = new Date(lastWorkStart.time);
      if (lastBreakStart) {
        breakStartTime = new Date(lastBreakStart.time);
        console.log("📍 Break start time detected:", {
          breakStartTime: breakStartTime.toISOString(),
          currentlyOnBreak: status.onBreak,
          serverBreakDuration: status.breakDurationSeconds
        });
      }
    }

    // Simplified approach: Always use server values for initialization
    // Let the timers handle increments independently
    const serverWorkDuration = status.workDurationSeconds || 0;
    const serverBreakDuration = status.breakDurationSeconds || 0;

    console.log("📊 Server durations:", {
      work: serverWorkDuration,
      break: serverBreakDuration,
      currentlyWorking: status.currentlyWorking,
      onBreak: status.onBreak
    });

    // Work timer logic - preserve values during break transitions
    setLiveWork(prev => {
      // First initialization
      if (prev === 0) {
        // Try to restore from localStorage first (for refresh stability)
        const stored = localStorage.getItem(`workTimer_${new Date().toDateString()}`);
        const storedValue = stored ? parseInt(stored) : 0;

        // Use stored value if it's reasonable (within 30 seconds of server)
        if (storedValue > 0 && Math.abs(storedValue - serverWorkDuration) <= 30) {
          console.log("🔄 Restoring work timer from localStorage:", storedValue);
          return storedValue;
        }

        console.log("🔄 Initializing work timer from server:", serverWorkDuration);
        return serverWorkDuration;
      }

      // CRITICAL: Don't reset work timer during break transitions
      // Work time should NEVER decrease during break start/end
      if (serverWorkDuration < prev && status.onBreak) {
        console.log("🚫 Preventing work timer reset during break:", {
          prev,
          server: serverWorkDuration,
          preserving: prev
        });
        return prev; // Keep current value
      }

      // Only sync if server value is significantly higher (work progressed)
      const diff = serverWorkDuration - prev;
      if (diff > 30) {
        console.log("🔄 Work timer progression sync:", {
          prev,
          server: serverWorkDuration,
          diff
        });
        return serverWorkDuration;
      }

      // Save current value to localStorage for refresh stability
      localStorage.setItem(`workTimer_${new Date().toDateString()}`, prev.toString());

      // Otherwise keep current timer value
      return prev;
    });

    setLiveBreak(prev => {
      // Check if break status changed (transition in/out of break)
      const previousStatus = previousStatusRef.current;
      const wasOnBreak = previousStatus?.onBreak;
      const isNowOnBreak = status.onBreak;

      // CRITICAL: Only reset break timer if we have VALID server data
      if (previousStatus && wasOnBreak !== isNowOnBreak) {
        // If ending break, preserve accumulated break time (never decrease)
        if (wasOnBreak && !isNowOnBreak) {
          console.log("🔄 Break ended, preserving break time:", {
            current: prev,
            server: serverBreakDuration,
            preserving: Math.max(prev, serverBreakDuration)
          });
          return Math.max(prev, serverBreakDuration); // Use higher value
        }

        // If starting break, only reset if server has reasonable data
        if (!wasOnBreak && isNowOnBreak) {
          if (serverBreakDuration > 0 && serverBreakDuration >= prev) {
            console.log("🔄 Break started, using server value:", serverBreakDuration);
            return serverBreakDuration;
          } else {
            console.log("🔄 Break started, preserving current value:", prev);
            return prev; // Keep current if server data looks wrong
          }
        }
      }

      // First initialization - try localStorage first
      if (prev === 0) {
        const stored = localStorage.getItem(`breakTimer_${new Date().toDateString()}`);
        const storedValue = stored ? parseInt(stored) : 0;

        // Use stored value if it's reasonable (within 30 seconds of server)
        if (storedValue > 0 && Math.abs(storedValue - serverBreakDuration) <= 30) {
          console.log("🔄 Restoring break timer from localStorage:", storedValue);
          return storedValue;
        }

        console.log("🔄 Initializing break timer from server:", serverBreakDuration);
        return serverBreakDuration;
      }

      // CRITICAL: Never decrease break time except on valid progression
      if (serverBreakDuration < prev && serverBreakDuration === 0) {
        console.log("🚫 Preventing break timer reset to zero:", {
          prev,
          server: serverBreakDuration,
          preserving: prev
        });
        return prev; // Keep current value
      }

      // Only sync if server value is significantly higher (break progressed)
      const diff = serverBreakDuration - prev;
      if (diff > 30) {
        console.log("🔄 Break timer progression sync:", {
          prev,
          server: serverBreakDuration,
          diff
        });
        return serverBreakDuration;
      }

      // Save current value to localStorage for refresh stability
      localStorage.setItem(`breakTimer_${new Date().toDateString()}`, prev.toString());

      // Otherwise preserve the current timer value (let the interval handle increments)
      return prev;
    });

    // Update the previous status reference for next comparison
    previousStatusRef.current = status;

    // Ultra-simple work timer - just increment every second
    if (status.currentlyWorking && !status.onBreak) {
      const workTimer = setInterval(() => {
        setLiveWork(prev => prev + 1);
      }, 1000);

      timers.push(workTimer);
      console.log("▶️ Ultra-simple work timer started");
    }

    // Ultra-simple break timer - just increment every second
    if (status.onBreak) {
      const breakTimer = setInterval(() => {
        setLiveBreak(prev => prev + 1);
      }, 1000);

      timers.push(breakTimer);
      console.log("⏸️ Ultra-simple break timer started");
    }

    // Page visibility optimization - pause timers when page is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("😴 Page hidden - timers will sync on visibility");
      } else {
        console.log("👁️ Page visible - resyncing timers");
        // Resync when page becomes visible
        setTimeout(() => {
          if (status.currentlyWorking || status.onBreak) {
            fetchStatus(); // Refresh to get accurate server state
          }
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      timers.forEach(clearInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      console.log("⏹️ Timers cleared");
    };
  }, [
    status?.currentlyWorking,
    status?.onBreak,
    status?.workDurationSeconds,
    status?.breakDurationSeconds,
    status?.timeline,
    fetchStatus
  ]);

  // Enhanced data fetching with intelligent refresh intervals
  const fetchAllData = useCallback(async (options = {}) => {
    const { isInitial = false, force = false } = options;

    if (!force && requestInProgress) {
      console.log("⏸️ Skipping data fetch - request in progress");
      return;
    }

    console.log(`📡 ${isInitial ? 'Initial' : 'Periodic'} data fetch started`);

    // Fetch data in parallel for better performance
    const promises = [
      fetchStatus(),
      fetchWeeklySummary(),
      fetchFlexibleRequests()
    ];

    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📊 Data fetch completed: ${successful} successful, ${failed} failed`);

      if (failed > 0 && isInitial) {
        toast.warning(`Some data could not be loaded. Retrying in background...`);
      }
    } catch (error) {
      console.error("❌ Critical error during data fetch:", error);
      if (isInitial) {
        toast.error("Failed to load application data. Please refresh the page.");
      }
    }
  }, [fetchStatus, fetchWeeklySummary, fetchFlexibleRequests, requestInProgress]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData({ isInitial: true });
  }, []);

  // Periodic data refresh with smart intervals
  useEffect(() => {
    // More frequent updates for status (every 30s), less frequent for summary data (every 2min)
    const statusInterval = setInterval(() => {
      if (!requestInProgress) {
        console.log("🔄 Quick status refresh");
        fetchStatus();
      }
    }, 30000); // 30 seconds for live status

    const summaryInterval = setInterval(() => {
      if (!requestInProgress) {
        console.log("📈 Summary data refresh");
        fetchWeeklySummary();
      }
    }, 120000); // 2 minutes for summary data

    const flexibleInterval = setInterval(() => {
      if (!requestInProgress) {
        console.log("📋 Flexible requests refresh");
        fetchFlexibleRequests();
      }
    }, 300000); // 5 minutes for flexible requests

    return () => {
      clearInterval(statusInterval);
      clearInterval(summaryInterval);
      clearInterval(flexibleInterval);
    };
  }, [fetchStatus, fetchWeeklySummary, fetchFlexibleRequests, requestInProgress]);

  // External update listener with enhanced event handling
  useEffect(() => {
    const handler = (event) => {
      console.log("🔔 External data update event received:", event.detail);

      if (!requestInProgress) {
        // Force refresh when external update is triggered
        fetchAllData({ force: true });
      } else {
        // Schedule refresh after current request completes
        setTimeout(() => {
          if (!requestInProgress) {
            fetchAllData({ force: true });
          }
        }, 1000);
      }
    };

    // Listen for multiple event types
    const events = ['attendanceDataUpdate', 'statusUpdate', 'dataRefresh'];
    events.forEach(eventType => {
      window.addEventListener(eventType, handler);
    });

    return () => {
      events.forEach(eventType => {
        window.removeEventListener(eventType, handler);
      });
    };
  }, [fetchAllData, requestInProgress]);

  // Page visibility change handler - refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !requestInProgress) {
        console.log("👁️ Page became visible - refreshing data");
        fetchAllData({ force: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAllData, requestInProgress]);

  // Network connectivity handler with enhanced state management
  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 Network connectivity restored - refreshing data");
      setConnectionStatus('online');
      toast.success("Connection restored. Refreshing data...");
      // Reset all error states on reconnection
      setDataErrors({
        status: null,
        weeklySummary: null,
        flexibleRequests: null
      });
      fetchAllData({ force: true });
    };

    const handleOffline = () => {
      console.log("📡 Network connectivity lost");
      setConnectionStatus('offline');
      toast.warning("Connection lost. Data may not be up to date.", {
        autoClose: false,
        closeOnClick: true
      });
    };

    // Set initial connection status
    setConnectionStatus(navigator.onLine ? 'online' : 'offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchAllData]);

  // Auto-recovery mechanism for failed requests
  useEffect(() => {
    const hasErrors = dataErrors.status || dataErrors.weeklySummary;
    const isOnline = connectionStatus === 'online';
    const notLoading = !dataLoadingStates.status && !dataLoadingStates.weeklySummary;

    if (hasErrors && isOnline && notLoading) {
      console.log("🔄 Auto-recovery: Attempting to refetch failed data");
      const recoveryTimer = setTimeout(() => {
        fetchAllData({ force: true });
      }, 10000); // Try to recover after 10 seconds

      return () => clearTimeout(recoveryTimer);
    }
  }, [dataErrors, connectionStatus, dataLoadingStates, fetchAllData]);

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

  // Enhanced quick stats calculation with real-time updates and memoization
  const combinedQuickStats = useMemo(() => {
    if (!weeklySummary || !status) {
      console.log("📊 Quick stats: No data available");
      return null;
    }

    console.log("📊 Calculating combined quick stats...");

    const backendQuickStats = weeklySummary.quickStats || {};
    const workedSessions = status.workedSessions || [];
    const shiftStart = status.effectiveShift?.start || "09:00";

    let earlyArrivals = 0;
    let lateArrivals = 0;
    let perfectDays = 0;

    try {
      const [shiftH, shiftM] = shiftStart.split(":").map(Number);

      workedSessions.forEach((session) => {
        const punchInTime = new Date(session.start);
        if (isNaN(punchInTime.getTime())) {
          console.warn("⚠️ Invalid session start time:", session.start);
          return;
        }

        const expectedShift = new Date(punchInTime);
        expectedShift.setHours(shiftH, shiftM, 0, 0);

        if (punchInTime <= expectedShift) {
          earlyArrivals++;
        } else {
          lateArrivals++;
        }
      });

      // Calculate perfect days based on punctuality and work hours
      perfectDays = Math.max(earlyArrivals - lateArrivals, 0);

      const calculatedStats = {
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

      console.log("✅ Quick stats calculated:", calculatedStats);
      return calculatedStats;
    } catch (error) {
      console.error("❌ Error calculating quick stats:", error);
      return backendQuickStats;
    }
  }, [weeklySummary, status]);

  const weeklySummaryWithQuickStats = useMemo(() => {
    console.log("🔄 Computing weeklySummaryWithQuickStats:", {
      hasWeeklySummary: !!weeklySummary,
      hasCombinedQuickStats: !!combinedQuickStats,
      presentDays: weeklySummary?.presentDays,
      totalWorkTime: weeklySummary?.totalWorkTime
    });

    if (!weeklySummary) {
      console.log("❌ No weekly summary data available");
      return null;
    }

    const result = {
      ...weeklySummary,
      quickStats: combinedQuickStats || weeklySummary.quickStats,
    };

    console.log("✅ Final weekly summary with quick stats:", result);
    return result;
  }, [weeklySummary, combinedQuickStats]);

  // Enhanced daily data adjustment with real-time synchronization and validation
  const adjustedDailyData = useMemo(() => {
    if (!Array.isArray(dailyData) || !status) {
      console.log("📅 Daily data: No data available for adjustment");
      return dailyData || [];
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    console.log("📅 Adjusting daily data for today:", todayStr);

    const adjustedData = dailyData.map((d) => {
      try {
        const dKey = new Date(d.date).toISOString().slice(0, 10);
        if (dKey !== todayStr) return d;

        // Create enhanced today's entry with live data
        const enhancedEntry = {
          ...d,
          workDurationSeconds:
            typeof liveWork === "number" && liveWork >= 0
              ? liveWork
              : d.workDurationSeconds || 0,
          breakDurationSeconds:
            typeof liveBreak === "number" && liveBreak >= 0
              ? liveBreak
              : d.breakDurationSeconds || 0,
          arrivalTime: status.arrivalTime || d.arrivalTime,
          // Add real-time indicators
          isLive: status.currentlyWorking || status.onBreak,
          lastUpdated: new Date().toISOString(),
          // Add status context
          currentStatus: {
            working: status.currentlyWorking,
            onBreak: status.onBreak,
            punchedOut: alreadyPunchedOut
          }
        };

        console.log("✅ Today's entry enhanced:", {
          workDuration: formatHMS(enhancedEntry.workDurationSeconds),
          breakDuration: formatHMS(enhancedEntry.breakDurationSeconds),
          isLive: enhancedEntry.isLive
        });

        return enhancedEntry;
      } catch (error) {
        console.error("❌ Error adjusting daily data entry:", error, d);
        return d; // Return original entry on error
      }
    });

    return adjustedData;
  }, [dailyData, status, liveWork, liveBreak, alreadyPunchedOut]);

  if (!status)
    return (
      <div className="flex min-h-screen bg-[#0f1419] text-gray-100 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold mb-4">Loading Status</h2>
          <p className="text-gray-400">Please wait while we load your work status...</p>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen bg-[#0f1419] text-gray-100">

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />

      <main
        className={`flex-1 p-6 space-y-6 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Today's Status</h1>
            <p className="text-gray-400 mb-3">Monitor your daily work activity and manage your time</p>

            {/* Status indicator */}
            <div className="flex items-center gap-4 bg-[#161c2c] rounded-lg px-4 py-2 border border-[#232945]">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  status?.currentlyWorking
                    ? status?.onBreak
                      ? 'bg-yellow-400 animate-pulse'
                      : 'bg-green-400 animate-pulse'
                    : 'bg-gray-500'
                }`}></div>
                <span className="text-sm font-medium">
                  {status?.currentlyWorking
                    ? status?.onBreak
                      ? 'On Break'
                      : 'Working'
                    : 'Offline'
                  }
                </span>
              </div>

              {/* System indicator */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700/50">
                <div className={`w-1.5 h-1.5 rounded-full ${USE_NEW_ATTENDANCE_SYSTEM ? 'bg-green-400' : 'bg-orange-400'}`}></div>
                <span className="text-xs text-gray-300">
                  {USE_NEW_ATTENDANCE_SYSTEM ? 'New System' : 'Legacy'}
                </span>
              </div>
              {(() => {
                const arrivalTime = getFormattedArrivalTime(status);
                return arrivalTime !== "--" ? (
                  <div className="text-sm text-gray-400">
                    Arrived: {arrivalTime}
                  </div>
                ) : null;
              })()}
              <div className="text-sm text-blue-400">
                Work: {formatHMS(liveWork)}
              </div>
              <div className="text-sm text-orange-400">
                Break: {formatHMS(liveBreak)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(dataErrors.status || dataErrors.weeklySummary || connectionStatus !== 'online') && (
              <button
                onClick={() => fetchAllData({ force: true })}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                disabled={dataLoadingStates.status || dataLoadingStates.weeklySummary}
              >
                <svg className={`w-4 h-4 ${(dataLoadingStates.status || dataLoadingStates.weeklySummary) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {(dataLoadingStates.status || dataLoadingStates.weeklySummary) ? 'Syncing...' : 'Retry'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 space-y-6">
            <div className="bg-[#161c2c] rounded-xl shadow-md border border-[#232945] relative">
              {dataLoadingStates.status && (
                <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-3 bg-[#161c2c] p-4 rounded-lg border border-[#232945]">
                    <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-gray-200">Updating status...</span>
                  </div>
                </div>
              )}
              <StatusCard
                workDuration={formatHMS(liveWork)}
                breakTime={formatHMS(liveBreak)}
                arrivalTime={getFormattedArrivalTime(status)}
                currentlyWorking={status.currentlyWorking}
                alreadyPunchedIn={alreadyPunchedIn}
                alreadyPunchedOut={alreadyPunchedOut}
                onPunchIn={handlePunchIn}
                onPunchOut={handlePunchOutClick}
                onRequestFlexible={openFlexibleModal}
                isLoading={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#161c2c] rounded-xl shadow-md border border-[#232945]">
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
              </div>
              <div className="bg-[#161c2c] rounded-xl shadow-md border border-[#232945]">
                <Timeline timeline={status.timeline || []} />
              </div>
            </div>
          </div>

          <div className="xl:col-span-2">
            <div className="bg-[#161c2c] rounded-xl shadow-md border border-[#232945] sticky top-8 relative">
              {dataLoadingStates.weeklySummary && (
                <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-3 bg-[#161c2c] p-4 rounded-lg border border-[#232945]">
                    <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-gray-200">Loading summary...</span>
                  </div>
                </div>
              )}
              <SummaryCard
                key={`summary-${weeklySummary?.presentDays}-${weeklySummary?.totalWorkTime}-${Date.now()}`}
                weeklySummary={weeklySummaryWithQuickStats}
                dailyData={adjustedDailyData}
              />
            </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 overflow-auto p-4"
            onClick={closeFlexibleModal}
          >
            <div
              className="bg-[#161c2c] text-white rounded-xl shadow-xl w-full max-w-5xl p-6 max-h-[90vh] overflow-auto border border-[#232945]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    Request Flexible Shift
                  </h2>
                  <p className="text-gray-400">Submit a request for flexible working hours</p>
                </div>
                <button
                  onClick={closeFlexibleModal}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
                onSubmit={submitFlexibleRequest}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    Date
                  </label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full rounded-lg p-3 bg-[#0f1419] text-white border border-[#232945] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={requestStartTime}
                    onChange={(e) => setRequestStartTime(e.target.value)}
                    className="w-full rounded-lg p-3 bg-[#0f1419] text-white border border-[#232945] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={requestDurationHours}
                    onChange={(e) => setRequestDurationHours(e.target.value)}
                    min={1}
                    max={24}
                    className="w-full rounded-lg p-3 bg-[#0f1419] text-white border border-[#232945] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    Reason
                  </label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="w-full rounded-lg p-3 bg-[#0f1419] text-white border border-[#232945] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                    placeholder="Optional reason for flexible shift request..."
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    className="px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                    onClick={closeFlexibleModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors ${
                      isSubmittingRequest ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={isSubmittingRequest}
                  >
                    {isSubmittingRequest ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Submitting...
                      </div>
                    ) : (
                      "Submit Request"
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8">
                <h3 className="text-xl font-bold text-white mb-4">My Requests</h3>
                {sortedFlexibleRequests.length === 0 ? (
                  <div className="text-center py-12 bg-[#0f1419] rounded-lg border border-[#232945]">
                    <p className="text-gray-300 text-lg mb-2">No requests found</p>
                    <p className="text-gray-500 text-sm">Your flexible shift requests will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[#232945]">
                    <table className="w-full border-collapse bg-[#0f1419]">
                      <thead className="bg-[#232945]">
                        <tr>
                          <th className="p-4 text-left font-semibold text-gray-200 border-b border-[#232945]">
                            Date
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-200 border-b border-[#232945]">
                            Start Time
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-200 border-b border-[#232945]">
                            Duration
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-200 border-b border-[#232945]">
                            Reason
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-200 border-b border-[#232945]">
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
                              className={`hover:bg-[#232945]/50 transition-colors ${
                                idx % 2 === 0 ? "bg-[#161c2c]/50" : ""
                              }`}
                            >
                              <td className="p-4 border-b border-[#232945] text-white">
                                {formatDate(r.requestedDate)}
                              </td>
                              <td className="p-4 border-b border-[#232945] text-gray-300">
                                {r.requestedStartTime || "-"}
                              </td>
                              <td className="p-4 border-b border-[#232945] text-gray-300">
                                {r.durationHours ? `${r.durationHours}h` : "-"}
                              </td>
                              <td className="p-4 border-b border-[#232945] text-gray-300 max-w-xs">
                                <div className="truncate" title={r.reason || "-"}>
                                  {r.reason || "-"}
                                </div>
                              </td>
                              <td className="p-4 border-b border-[#232945]">
                                <span
                                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                    statusLower === 'approved'
                                      ? 'bg-green-600 text-white'
                                      : statusLower === 'rejected'
                                      ? 'bg-red-600 text-white'
                                      : 'bg-orange-600 text-white'
                                  }`}
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
