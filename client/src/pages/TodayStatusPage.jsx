import React, { useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import StatusCard from "../components/workstatus/StatusCard";
import BreakManagement from "../components/workstatus/BreakManagement";
import Timeline from "../components/workstatus/Timeline";
import SummaryCard from "../components/workstatus/SummaryCard";
import RecentActivity from "../components/workstatus/RecentActivity";

const TodayStatusPage = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [breakDuration, setBreakDuration] = useState("00:15:23");
  const [onBreak, setOnBreak] = useState(false);

  const handleStartBreak = () => setOnBreak(true);
  const handleResumeWork = () => setOnBreak(false);

  const todayTimeline = [
    { type: "Punch In", time: "9:15 AM" },
    { type: "Break Start", time: "12:30 PM" },
    { type: "Break End", time: "1:15 PM" },
    { type: "Expected Punch Out", time: "5:00 PM" },
  ];

  const weekSummary = {
    totalHours: "40h 15m",
    avgDaily: "8h 3m",
    onTimeRate: "95%",
    breaksTaken: 12,
    quickStats: { earlyArrivals: 3, lateArrivals: 1, perfectDays: 4 },
  };

  const recentActivities = [
    { date: "Feb 12", activity: "Punch In", time: "9:15 AM" },
    { date: "Feb 12", activity: "Break Start", time: "12:30 PM" },
    { date: "Feb 11", activity: "Punch Out", time: "5:30 PM" },
    { date: "Feb 11", activity: "Break End", time: "1:15 PM" },
    { date: "Feb 11", activity: "Punch In", time: "9:00 AM" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
      />

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } p-6`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-screen">
          {/* Left Column */}
          <div className="col-span-2 flex flex-col gap-6">
            <StatusCard
              workDuration="8h 45m"
              breakTime="45m"
              arrivalTime="9:15 AM"
              currentlyWorking={true}
            />

            <BreakManagement
              breakDuration={breakDuration}
              onBreak={onBreak}
              onStartBreak={handleStartBreak}
              onResumeWork={handleResumeWork}
            />

            <Timeline timeline={todayTimeline} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <SummaryCard summary={weekSummary} />
            <RecentActivity activities={recentActivities} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TodayStatusPage;
