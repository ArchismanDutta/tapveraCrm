import axios from "axios";
import timeUtils from "./utils/timeUtils";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5000",
  timeout: 30000, // Increased timeout for complex queries
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach token automatically and add cache-busting
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  // Add cache-busting parameter for real-time data
  if (req.method === 'get' && !req.params) {
    req.params = {};
  }
  if (req.method === 'get') {
    req.params._t = Date.now();
  }

  return req;
});

// Handle auth errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Utility functions for consistent data processing across components
export const attendanceUtils = {
  // Standardized arrival time extraction
  getArrivalTime: (data) => {
    // Priority 1: Timeline punch-in events
    if (data.timeline && Array.isArray(data.timeline)) {
      const punchInEvent = data.timeline.find(event =>
        event.type && event.type.toLowerCase().includes('punch in')
      );
      if (punchInEvent && punchInEvent.time) {
        return new Date(punchInEvent.time);
      }
    }

    // Priority 2: Direct arrivalTime field
    if (data.arrivalTime) {
      return new Date(data.arrivalTime);
    }

    // Priority 3: First worked session
    if (data.workedSessions && Array.isArray(data.workedSessions) && data.workedSessions.length > 0) {
      const firstSession = data.workedSessions[0];
      if (firstSession.start) {
        return new Date(firstSession.start);
      }
    }

    return null;
  },

  // Standardized departure time extraction
  getDepartureTime: (data) => {
    // Priority 1: Timeline punch-out events
    if (data.timeline && Array.isArray(data.timeline)) {
      const punchOutEvents = data.timeline.filter(event =>
        event.type && event.type.toLowerCase().includes('punch out')
      );
      if (punchOutEvents.length > 0) {
        const lastPunchOut = punchOutEvents[punchOutEvents.length - 1];
        return new Date(lastPunchOut.time);
      }
    }

    // Priority 2: Direct punchOutTime field
    if (data.punchOutTime) {
      return new Date(data.punchOutTime);
    }

    // Priority 3: Last worked session end
    if (data.workedSessions && Array.isArray(data.workedSessions) && data.workedSessions.length > 0) {
      const lastSession = data.workedSessions[data.workedSessions.length - 1];
      if (lastSession.end) {
        return new Date(lastSession.end);
      }
    }

    return null;
  },

  // Standardized break time calculation
  calculateBreakMinutes: (data, isCurrentlyOnBreak = false) => {
    let totalMinutes = 0;

    // Method 1: Calculate from timeline events for real-time accuracy
    if (data.timeline && Array.isArray(data.timeline)) {
      let timelineBreakMinutes = 0;
      let currentBreakStart = null;

      // Sort timeline events by time to process in chronological order
      const sortedTimeline = data.timeline
        .filter(event => event.time && event.type)
        .sort((a, b) => new Date(a.time) - new Date(b.time));

      sortedTimeline.forEach(event => {
        const eventTime = new Date(event.time);
        const eventType = event.type.toLowerCase();

        if (eventType.includes('break start')) {
          currentBreakStart = eventTime;
        } else if ((eventType.includes('break end') || eventType.includes('resume work')) && currentBreakStart) {
          timelineBreakMinutes += (eventTime - currentBreakStart) / (1000 * 60);
          currentBreakStart = null;
        }
      });

      // If currently on break, add ongoing break time
      if (isCurrentlyOnBreak) {
        if (currentBreakStart) {
          // Use break start from timeline
          const now = new Date();
          timelineBreakMinutes += (now - currentBreakStart) / (1000 * 60);
        } else if (data.breakStartTime) {
          // Fallback to breakStartTime field
          const breakStart = new Date(data.breakStartTime);
          if (!isNaN(breakStart.getTime())) {
            const now = new Date();
            timelineBreakMinutes += (now - breakStart) / (1000 * 60);
          }
        } else if (data.lastBreakStart) {
          // Another fallback
          const breakStart = new Date(data.lastBreakStart);
          if (!isNaN(breakStart.getTime())) {
            const now = new Date();
            timelineBreakMinutes += (now - breakStart) / (1000 * 60);
          }
        }
      }

      if (timelineBreakMinutes > 0) {
        totalMinutes = Math.round(timelineBreakMinutes);
      }
    }

    // Method 2: Use stored breakDurationSeconds if timeline calculation failed
    if (totalMinutes === 0 && data.breakDurationSeconds && data.breakDurationSeconds > 0) {
      totalMinutes = Math.round(data.breakDurationSeconds / 60);

      // If currently on break, try to add ongoing time
      if (isCurrentlyOnBreak && (data.breakStartTime || data.lastBreakStart)) {
        const breakStartTime = data.breakStartTime || data.lastBreakStart;
        const breakStart = new Date(breakStartTime);
        if (!isNaN(breakStart.getTime())) {
          const now = new Date();
          const ongoingMinutes = (now - breakStart) / (1000 * 60);
          // Only add ongoing time if it's reasonable (less than 8 hours)
          if (ongoingMinutes > 0 && ongoingMinutes < 480) {
            totalMinutes += Math.round(ongoingMinutes);
          }
        }
      }
    }

    // Method 3: Fallback to break sessions
    if (totalMinutes === 0 && data.breakSessions && Array.isArray(data.breakSessions)) {
      const sessionBreakMs = data.breakSessions.reduce((sum, session) => {
        if (session.start && session.end) {
          return sum + (new Date(session.end) - new Date(session.start));
        }
        return sum;
      }, 0);
      totalMinutes = Math.round(sessionBreakMs / 60000);
    }

    // Method 4: Use totalBreakMinutes or breakDurationMinutes as final fallback
    if (totalMinutes === 0 && (data.totalBreakMinutes || data.breakDurationMinutes)) {
      totalMinutes = data.totalBreakMinutes || data.breakDurationMinutes || 0;
    }

    return Math.max(0, totalMinutes); // Ensure non-negative result
  },

  // Standardized work duration calculation (aligned with backend Math.floor logic)
  calculateWorkHours: (workDurationSeconds) => {
    if (!workDurationSeconds || workDurationSeconds === 0) return 0;
    const hours = Math.floor(workDurationSeconds / 3600);
    const minutes = Math.floor((workDurationSeconds % 3600) / 60);
    return hours + (minutes / 60);
  },

  // Format time consistently - Using centralized time utilities
  formatTime: (dateString) => {
    return timeUtils.formatTime(dateString);
  },

  // Standardized status determination based on work hours
  getAttendanceStatus: (data) => {
    const workHours = (data.workDurationSeconds || 0) / 3600; // Convert seconds to hours

    // Priority 1: Use backend-calculated status if available
    if (data.isAbsent === true) return { status: "absent", color: "red" };
    if (data.isFullDay === true) return { status: "present", color: "green" };
    if (data.isHalfDay === true) return { status: "half-day", color: "orange" };

    // Priority 2: Hours-based logic (your requirements)
    if (workHours < 5) {
      // Less than 5 hours or no punch-in = absent
      return { status: "absent", color: "red" };
    } else if (workHours >= 5 && workHours < 8) {
      // 5-8 hours = half day
      return { status: "half-day", color: "orange" };
    } else if (workHours >= 8) {
      // 8+ hours = full day (present)
      // Check if they were late for display purposes
      if (data.isLate === true) {
        return { status: "late", color: "yellow" };
      }
      return { status: "present", color: "green" };
    }

    // Fallback
    return { status: "absent", color: "red" };
  }
};

export default API;
