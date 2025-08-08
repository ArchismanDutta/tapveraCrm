import React from "react";
import tapveraLogo from "../assets/tapvera.png";

import {
  Bell,
  MessageCircle,
  FileText,
  Flag,
  User,
  LayoutDashboard,
  ClipboardList,
  HelpCircle,
} from "lucide-react";

const EmployeeDashboard = () => {
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md p-6 space-y-6">
        <img src={tapveraLogo} alt="Tapvera Logo" className="h-10 w-auto" />
        <nav className="space-y-4 text-sm font-medium">
          <SidebarLink icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <SidebarLink icon={<User size={18} />} label="My Profile" />
          <SidebarLink icon={<ClipboardList size={18} />} label="Tasks" />
          <SidebarLink icon={<MessageCircle size={18} />} label="Messages" />
          <SidebarLink icon={<FileText size={18} />} label="Reports" />
          <SidebarLink icon={<Flag size={18} />} label="Requirements" />
          <SidebarLink icon={<HelpCircle size={18} />} label="Help Center" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Good Morning, Archisman</h1>
            <p className="text-sm text-gray-500">Friday, August 08, 2025 • 9:30 AM</p>
          </div>
          <div className="flex items-center space-x-4">
            <Bell className="text-gray-500" />
            <img
              src="https://i.pravatar.cc/40?img=3"
              alt="Avatar"
              className="w-9 h-9 rounded-full"
            />
            <span className="text-sm font-medium">Archisman Dutta</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <SummaryCard label="Tasks Due Today" count="5" bg="bg-blue-50" />
          <SummaryCard label="Pending Reports" count="2" bg="bg-green-50" />
          <SummaryCard label="Unread Messages" count="3" bg="bg-indigo-50" />
          <SummaryCard label="Open Issues" count="1" bg="bg-red-50" />
        </div>

        {/* Tasks and Quick Actions */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Today's Tasks</h2>
            <TaskItem label="Client Meeting - Project Alpha" time="10:00 AM" level="High" color="red" />
            <TaskItem label="Report Submission - Q3 Review" time="2:00 PM" level="Medium" color="yellow" />
            <TaskItem label="Team Sync" time="4:00 PM" level="Low" color="green" />
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <QuickAction label="Report an Issue" className="text-red-600 border border-red-200" />
              <QuickAction label="Submit Requirement" className="text-blue-600 border border-blue-200" />
              <QuickAction label="Start Chat" className="text-purple-600 border border-purple-200" />
              <QuickAction label="Send Report" className="text-green-600 border border-green-200" />
            </div>
          </div>
        </div>

        {/* Reports & Messages */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Recent Work Reports</h2>
              <button className="bg-blue-600 text-white text-sm px-3 py-1 rounded">+ Submit New Report</button>
            </div>
            <ReportItem label="Weekly Progress Report" date="Oct 15, 2023" status="Submitted" color="blue" />
            <ReportItem label="Project Status Update" date="Oct 14, 2023" status="Pending" color="yellow" />
            <ReportItem label="Sprint Review Report" date="Oct 13, 2023" status="Approved" color="green" />
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Messages</h2>
            <MessageItem name="Sarah Johnson" msg="Updated the project timeline" time="2h ago" img="https://i.pravatar.cc/40?img=1" />
            <MessageItem name="Mike Wilson" msg="Meeting rescheduled to 3 PM" time="4h ago" img="https://i.pravatar.cc/40?img=2" />
            <MessageItem name="Emily Davis" msg="New requirements document" time="5h ago" img="https://i.pravatar.cc/40?img=4" />
          </div>
        </div>

        {/* Personal Details */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Personal Details</h2>
            <button className="text-sm text-blue-600">Edit Profile</button>
          </div>
          <div className="grid grid-cols-3 gap-6 text-sm text-gray-600">
            <Detail label="Employee ID" value="EMP001" />
            <Detail label="Department" value="Engineering" />
            <Detail label="Position" value="Senior Developer" />
            <Detail label="Email" value="john.smith@workflow.com" />
            <Detail label="Phone" value="+1 (555) 123-4567" />
            <Detail label="Working Hours" value="9:00 AM - 6:00 PM" />
          </div>
        </div>
      </main>
    </div>
  );
};

// Component: Sidebar Link
const SidebarLink = ({ icon, label, active }) => (
  <div className={`flex items-center space-x-3 cursor-pointer p-2 rounded ${active ? "bg-blue-50 text-blue-600 font-semibold" : "hover:bg-gray-100"}`}>
    {icon}
    <span>{label}</span>
  </div>
);

// Component: Summary Card
const SummaryCard = ({ label, count, bg }) => (
  <div className={`p-5 rounded-xl shadow-sm ${bg}`}>
    <div className="text-2xl font-bold mb-1">{count}</div>
    <div className="text-sm text-gray-600">{label}</div>
  </div>
);

// Component: Task Item
const TaskItem = ({ label, time, level, color }) => {
  const colorMap = {
    red: "bg-red-400 text-white bg-red-100",
    yellow: "bg-yellow-500 text-white bg-yellow-100",
    green: "bg-green-500 text-white bg-green-100",
  };
  const dotColor = `bg-${color}-500`;
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-none">
      <div className="flex items-center space-x-3">
        <span className={`h-3 w-3 rounded-full ${dotColor}`}></span>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-gray-500">{time}</p>
        </div>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full ${colorMap[color]}`}>{level}</span>
    </div>
  );
};

// Component: Quick Action
const QuickAction = ({ label, className }) => (
  <button className={`p-3 rounded text-sm text-left ${className}`}>{label}</button>
);

// Component: Report Item
const ReportItem = ({ label, date, status, color }) => {
  const colorClass = `bg-${color}-100 text-${color}-600`;
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-none">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-gray-500">{date}</p>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full ${colorClass} font-medium`}>{status}</span>
    </div>
  );
};

// Component: Message Item
const MessageItem = ({ name, msg, time, img }) => (
  <div className="flex items-center space-x-3 mb-4">
    <img src={img} alt={name} className="w-8 h-8 rounded-full" />
    <div>
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs text-gray-500">{msg}</p>
    </div>
    <span className="text-xs text-gray-400 ml-auto">{time}</span>
  </div>
);

// Component: Detail
const Detail = ({ label, value }) => (
  <div>
    <p className="text-gray-400">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);

export default EmployeeDashboard;
