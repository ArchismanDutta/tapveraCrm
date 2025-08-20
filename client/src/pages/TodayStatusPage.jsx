import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import StatusCard from "../components/workstatus/StatusCard";
import BreakManagement from "../components/workstatus/BreakManagement";
import Timeline from "../components/workstatus/Timeline";
import SummaryCard from "../components/workstatus/SummaryCard";
import RecentActivity from "../components/workstatus/RecentActivity";

// Single definition of formatHMS function
function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

const TodayStatusPage = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState(null);
  const [liveWork, setLiveWork] = useState(0);
  const [liveBreak, setLiveBreak] = useState(0);
  const [selectedBreakType, setSelectedBreakType] = useState("");
  const [weeklySummary, setWeeklySummary] = useState(null);

  const token = localStorage.getItem("token");

  // Fetch today's status
  const fetchStatus = async () => {
    try {
      const res = await axios.get("/api/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  // Fetch weekly summary
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

      if (res.data && res.data.weeklySummary) {
        setWeeklySummary(res.data.weeklySummary);
      } else {
        setWeeklySummary(null);
      }
    } catch (err) {
      console.error("Failed to fetch weekly summary:", err);
    }
  };

  // Update today's status
  const updateStatus = async (update) => {
    try {
      const res = await axios.put("/api/status", update, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(res.data);
      setSelectedBreakType("");
      fetchWeeklySummary();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Live Work Timer
  useEffect(() => {
    if (!status) return;
    setLiveWork(status.workDurationSeconds || 0);
    if (status.currentlyWorking && status.lastSessionStart) {
      const base = status.workDurationSeconds || 0;
      const lastStart = new Date(status.lastSessionStart).getTime();
      const timer = setInterval(() => {
        setLiveWork(base + Math.floor((Date.now() - lastStart) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  // Live Break Timer
  useEffect(() => {
    if (!status) return;
    if (status.onBreak && status.breakStartTs) {
      const breakStart = new Date(status.breakStartTs).getTime();
      const timer = setInterval(() => {
        setLiveBreak(Math.floor((Date.now() - breakStart) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setLiveBreak(0);
    }
  }, [status]);

  // Initial fetch & periodic refresh
  useEffect(() => {
    fetchStatus();
    fetchWeeklySummary();
    const interval = setInterval(() => {
      fetchStatus();
      fetchWeeklySummary();
    }, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Event handlers
  const handlePunchIn = () => {
    if (status?.currentlyWorking) return;
    updateStatus({
      currentlyWorking: true,
      onBreak: false,
      timelineEvent: { type: "Punch In", time: new Date().toLocaleTimeString() },
    });
  };

  const handlePunchOut = () => {
    if (!(status?.currentlyWorking) && !(status?.onBreak)) return;
    updateStatus({
      currentlyWorking: false,
      onBreak: false,
      timelineEvent: { type: "Punch Out", time: new Date().toLocaleTimeString() },
    });
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

  if (!status) return <div>Loading...</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" />
      <main
        className={`flex-1 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} p-2 sm:p-4 md:p-6`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-screen">
          <div className="col-span-2 flex flex-col gap-4">
            <StatusCard
              workDuration={formatHMS(liveWork)}
              breakTime={formatHMS(status.breakDurationSeconds)}
              arrivalTime={status.arrivalTimeFormatted || "--"}
              currentlyWorking={status.currentlyWorking}
              onPunchIn={handlePunchIn}
              onPunchOut={handlePunchOut}
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
      </main>
    </div>
  );
};

export default TodayStatusPage;
