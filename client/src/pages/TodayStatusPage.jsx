// src/pages/TodayStatusPage.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import StatusCard from "../components/workstatus/StatusCard";
import BreakManagement from "../components/workstatus/BreakManagement";
import Timeline from "../components/workstatus/Timeline";
import SummaryCard from "../components/workstatus/SummaryCard";
import RecentActivity from "../components/workstatus/RecentActivity";

const formatDuration = (ms) => {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const parseTimeStringToDate = (timeString) => {
  // timeString example "9:15 AM"
  const [time, modifier] = timeString.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
};

// New helper to safely parse breakDuration string like "1h 30m" to milliseconds
const parseBreakDuration = (durationString) => {
  if (!durationString) return 0;
  let hours = 0,
    minutes = 0;
  const hourMatch = durationString.match(/(\d+)h/);
  if (hourMatch) {
    hours = parseInt(hourMatch[1], 10);
  }
  const minMatch = durationString.match(/(\d+)m/);
  if (minMatch) {
    minutes = parseInt(minMatch[1], 10);
  }
  return (hours * 60 + minutes) * 60 * 1000;
};

const TodayStatusPage = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState(null);

  // refs to store punch in time and break start time
  const punchInTimeRef = useRef(null);
  const breakStartTimeRef = useRef(null);

  // For selected break type from BreakManagement
  const [selectedBreakType, setSelectedBreakType] = useState("");

  const token = localStorage.getItem("token");

  const fetchStatus = async () => {
    try {
      const res = await axios.get("/api/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setStatus(res.data);

      // Set punchIn time ref from arrivalTime if exists
      if (res.data.arrivalTime) {
        punchInTimeRef.current = parseTimeStringToDate(res.data.arrivalTime);
      } else {
        punchInTimeRef.current = null;
      }

      // Set breakStart time ref from breakStartTime if user is on break
      if (res.data.onBreak && res.data.breakStartTime) {
        breakStartTimeRef.current = new Date(res.data.breakStartTime);
      } else {
        breakStartTimeRef.current = null;
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  // Update backend and local status state
  const updateStatus = async (update) => {
    try {
      const res = await axios.put("/api/status", update, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(res.data);

      if (update.timelineEvent?.type === "Punch In") {
        punchInTimeRef.current = new Date();
      }
      if (update.timelineEvent?.type === "Break Start") {
        breakStartTimeRef.current = new Date();
      }
      if (update.timelineEvent?.type === "Resume Work") {
        breakStartTimeRef.current = null;
      }

      // Also update arrivalTime ref and breakStartTime ref when updated explicitly
      if (update.arrivalTime) {
        punchInTimeRef.current = parseTimeStringToDate(update.arrivalTime);
      }
      if (update.breakStartTime) {
        breakStartTimeRef.current = new Date(update.breakStartTime);
      }
      if (
        (update.onBreak === false || update.onBreak === undefined) &&
        !update.breakStartTime
      ) {
        breakStartTimeRef.current = null;
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Recalculate work duration and break time every minute
  useEffect(() => {
    if (!status) return;

    const interval = setInterval(() => {
      const now = new Date();

      if (!punchInTimeRef.current) return;

      // Use safe parse function here:
      let totalBreakMs = parseBreakDuration(status.breakDuration);

      // Add current ongoing break duration if on break
      if (breakStartTimeRef.current) {
        totalBreakMs += now - breakStartTimeRef.current;
      }

      // Calculate work duration = time since punch in - total breaks
      const workDurationMs = now - punchInTimeRef.current - totalBreakMs;

      setStatus((prev) => ({
        ...prev,
        workDuration: formatDuration(workDurationMs),
        breakTime: formatDuration(totalBreakMs),
        breakDuration: formatDuration(totalBreakMs),
      }));
    }, 60000);

    // Immediate update on mount/run
    const now = new Date();
    if (punchInTimeRef.current) {
      let immediateBreakMs = parseBreakDuration(status.breakDuration);

      if (breakStartTimeRef.current) {
        immediateBreakMs += now - breakStartTimeRef.current;
      }

      const workDurationMs = now - punchInTimeRef.current - immediateBreakMs;

      setStatus((prev) => ({
        ...prev,
        workDuration: formatDuration(workDurationMs),
        breakTime: formatDuration(immediateBreakMs),
        breakDuration: formatDuration(immediateBreakMs),
      }));
    }

    return () => clearInterval(interval);
  }, [status]);

  // Handler to punch in
  const handlePunchIn = () => {
    const now = new Date();

    let arrivalTimeStr = status.arrivalTime;
    if (!status.arrivalTime) {
      let hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      arrivalTimeStr = `${hours}:${mins} ${ampm}`;
    }

    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      arrivalTime: arrivalTimeStr,
      timelineEvent: { type: "Punch In", time: now.toLocaleTimeString() },
    });
  };

  // Handler to punch out
  const handlePunchOut = () => {
    updateStatus({
      currentlyWorking: false,
      onBreak: false,
      timelineEvent: { type: "Punch Out", time: new Date().toLocaleTimeString() },
    });
  };

  // Handler to start break with selected break type
  const handleStartBreak = (breakType) => {
    if (!breakType) return;
    const now = new Date();
    updateStatus({
      onBreak: true,
      currentlyWorking: false,
      breakStartTime: now.toISOString(),
      timelineEvent: { type: `Break Start (${breakType})`, time: now.toLocaleTimeString() },
    });
    setSelectedBreakType("");
  };

  // Handler to resume work after break
  const handleResumeWork = () => {
    updateStatus({
      onBreak: false,
      currentlyWorking: true,
      breakStartTime: null,
      timelineEvent: { type: "Resume Work", time: new Date().toLocaleTimeString() },
    });
  };

  // Handler to select break type from BreakManagement component
  const handleSelectBreakType = (type) => {
    setSelectedBreakType(type);
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!status) return <div>Loading...</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" />
      <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} p-6`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-screen">
          <div className="col-span-2 flex flex-col gap-6">
            <StatusCard
              workDuration={status.workDuration}
              breakTime={status.breakTime}
              arrivalTime={status.arrivalTime}
              currentlyWorking={status.currentlyWorking}
              onPunchIn={handlePunchIn}
              onPunchOut={handlePunchOut}
            />
            <BreakManagement
              breakDuration={status.breakDuration}
              onBreak={status.onBreak}
              onStartBreak={handleStartBreak}
              onResumeWork={handleResumeWork}
              selectedBreakType={selectedBreakType}
              onSelectBreakType={handleSelectBreakType}
            />
            <Timeline timeline={status.timeline || []} />
          </div>

          <div className="space-y-6">
            <SummaryCard summary={status.weekSummary} />
            <RecentActivity activities={status.recentActivities || []} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TodayStatusPage;
