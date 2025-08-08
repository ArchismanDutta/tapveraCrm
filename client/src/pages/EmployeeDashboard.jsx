import React, { useState } from "react";
import { Bell } from "lucide-react";

import SummaryCards from "../components/dashboard/SummaryCards";
import TodayTasks from "../components/dashboard/TodayTasks";
import QuickActions from "../components/dashboard/QuickActions";
import RecentReports from "../components/dashboard/RecentReports";
import RecentMessages from "../components/dashboard/RecentMessages";
import ProfileDetails from "../components/dashboard/ProfileDetails";
import Sidebar from "../components/dashboard/Sidebar";

const EmployeeDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  // Mock data...
  const summaryData = [
    { label: "Tasks Due Today", count: 5, bg: "bg-blue-50" },
    { label: "Pending Reports", count: 2, bg: "bg-green-50" },
    { label: "Unread Messages", count: 3, bg: "bg-indigo-50" },
    { label: "Open Issues", count: 1, bg: "bg-red-50" },
  ];

  const tasks = [
    { label: "Client Meeting - Project Alpha", time: "10:00 AM", level: "High", color: "red" },
    { label: "Report Submission - Q3 Review", time: "2:00 PM", level: "Medium", color: "yellow" },
    { label: "Team Sync", time: "4:00 PM", level: "Low", color: "green" },
  ];

  const quickActions = [
    { label: "Report an Issue", colorClass: "text-red-600 border border-red-200" },
    { label: "Submit Requirement", colorClass: "text-blue-600 border border-blue-200" },
    { label: "Start Chat", colorClass: "text-purple-600 border border-purple-200" },
    { label: "Send Report", colorClass: "text-green-600 border border-green-200" },
  ];

  const reports = [
    { label: "Weekly Progress Report", date: "Oct 15, 2023", status: "Submitted", color: "blue" },
    { label: "Project Status Update", date: "Oct 14, 2023", status: "Pending", color: "yellow" },
    { label: "Sprint Review Report", date: "Oct 13, 2023", status: "Approved", color: "green" },
  ];

  const messages = [
    { name: "Sarah Johnson", msg: "Updated the project timeline", time: "2h ago", img: "https://i.pravatar.cc/40?img=1" },
    { name: "Mike Wilson", msg: "Meeting rescheduled to 3 PM", time: "4h ago", img: "https://i.pravatar.cc/40?img=2" },
    { name: "Emily Davis", msg: "New requirements document", time: "5h ago", img: "https://i.pravatar.cc/40?img=4" },
  ];

  const profileDetails = [
    { label: "Employee ID", value: "EMP001" },
    { label: "Department", value: "Engineering" },
    { label: "Position", value: "Senior Developer" },
    { label: "Email", value: "john.smith@workflow.com" },
    { label: "Phone", value: "+1 (555) 123-4567" },
    { label: "Working Hours", value: "9:00 AM - 6:00 PM" },
  ];

  return (
    <div className="flex bg-gray-50 font-sans text-gray-800">
      {/* Sidebar */}
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main Content */}
      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Good Morning, Archisman</h1>
            <p className="text-sm text-gray-500">Friday, August 08, 2025 • 9:30 AM</p>
          </div>
          <div className="flex items-center space-x-4">
            <Bell className="text-gray-500" />
            <img src="https://i.pravatar.cc/40?img=3" alt="Avatar" className="w-9 h-9 rounded-full" />
            <span className="text-sm font-medium">Archisman Dutta</span>
          </div>
        </div>

        <SummaryCards data={summaryData} />

        <div className="grid grid-cols-3 gap-6 mb-8">
          <TodayTasks data={tasks} className="col-span-2" />
          <QuickActions actions={quickActions} />
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <RecentReports reports={reports} className="col-span-2" />
          <RecentMessages messages={messages} />
        </div>

        <ProfileDetails details={profileDetails} />
      </main>
    </div>
  );
};

export default EmployeeDashboard;
