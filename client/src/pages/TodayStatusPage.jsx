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

function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

const SIDEBAR_WIDTH_EXPANDED = 288; // w-72 = 18rem = 288px
const SIDEBAR_WIDTH_COLLAPSED = 80; // w-20 = 5rem = 80px

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

  const token = localStorage.getItem("token");

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
        params: {
          startDate: monday.toISOString(),
          endDate: sunday.toISOString(),
        },
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

  const updateStatus = async (update) => {
    try {
      const res = await axios.put("/api/status", update, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(res.data);
      setSelectedBreakType("");
      fetchWeeklySummary();
      window.dispatchEvent(new Event("attendanceDataUpdate"));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  useEffect(() => {
    if (!status) return;
    setLiveWork(status.workDurationSeconds || 0);
    if (status.currentlyWorking && status.lastSessionStart) {
      const base = status.workDurationSeconds || 0;
      const lastStartTime = new Date(status.lastSessionStart).getTime();
      const timer = setInterval(() => {
        setLiveWork(base + Math.floor((Date.now() - lastStartTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  useEffect(() => {
    if (!status) return;
    if (status.onBreak && status.breakStartTs) {
      const breakStartTime = new Date(status.breakStartTs).getTime();
      const timer = setInterval(() => {
        setLiveBreak(Math.floor((Date.now() - breakStartTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setLiveBreak(0);
    }
  }, [status]);

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
    const handleAttendanceDataUpdate = () => {
      fetchWeeklySummary();
    };
    window.addEventListener("attendanceDataUpdate", handleAttendanceDataUpdate);
    return () => {
      window.removeEventListener("attendanceDataUpdate", handleAttendanceDataUpdate);
    };
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
      console.error("Error checking todo tasks before punch out:", err);
      return true;
    }
  };

  const handlePunchOutClick = async () => {
    if (!(status?.currentlyWorking) && !(status?.onBreak)) return;
    const canPunchOut = await checkTodoTasksBeforePunchOut();
    if (canPunchOut) {
      setShowPunchOutConfirm(true);
    }
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
          axios.post(`/api/todos/${task._id}/move`, { newDate: tomorrow.toISOString() }, { headers: { Authorization: `Bearer ${token}` } })
        )
      );

      setShowTodoPopup(false);
      setPendingTodoTasks([]);
      onConfirmPunchOut();
    } catch (err) {
      console.error("Failed to move tasks to tomorrow:", err);
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

  if (!status)
    return (
      <div className="text-gray-100 bg-[#101525] min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="bg-[#101525] min-h-screen text-gray-100">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" onLogout={onLogout} />
      <main
        className="transition-all duration-300 p-2 sm:p-6 overflow-auto"
        style={{
          marginLeft: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          minHeight: "100vh",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-screen">
          <div className="col-span-2 flex flex-col gap-4">
            <StatusCard
              workDuration={formatHMS(liveWork)}
              breakTime={formatHMS(status.breakDurationSeconds)}
              arrivalTime={status.arrivalTimeFormatted || "--"}
              currentlyWorking={status.currentlyWorking}
              onPunchIn={handlePunchIn}
              onPunchOut={handlePunchOutClick}
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
      </main>
    </div>
  );
};

export default TodayStatusPage;
