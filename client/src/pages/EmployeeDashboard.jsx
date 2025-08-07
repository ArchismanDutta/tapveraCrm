
import React from "react";
import {
Bell,
MessageCircle,
FileText,
Flag,
User,
LayoutDashboard,
ClipboardList,
Send,
HelpCircle,
} from "lucide-react";

const EmployeeDashboard = () => {
return (
<div className="flex min-h-screen bg-gray-50 font-sans text-gray-800">
{/* Sidebar */}
<aside className="w-64 bg-white shadow-md p-6 space-y-6">
<div className="text-xl font-bold text-blue-600">WorkFlow CRM</div>
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
<h1 className="text-2xl font-semibold">Good Morning, John</h1>
<p className="text-sm text-gray-500">Monday, October 16, 2023 • 9:30 AM</p>
</div>
<div className="flex items-center space-x-4">
<Bell className="text-gray-500" />
<img
src="https://i.pravatar.cc/40?img=3"
alt="Avatar"
className="w-9 h-9 rounded-full"
/>
<span className="text-sm font-medium">John Smith</span>
</div>
</div>

{/* Summary Cards */}
<div className="grid grid-cols-4 gap-6 mb-8">
<SummaryCard label="Tasks Due Today" count="5" color="bg-blue-50" icon="📅" />
<SummaryCard label="Pending Reports" count="2" color="bg-green-50" icon="📄" />
<SummaryCard label="Unread Messages" count="3" color="bg-indigo-50" icon="💬" />
<SummaryCard label="Open Issues" count="1" color="bg-red-50" icon="🚩" />
</div>

{/* Tasks and Quick Actions */}
<div className="grid grid-cols-3 gap-6 mb-8">
{/* Today’s Tasks */}
<div className="col-span-2 bg-white rounded-xl shadow p-6">
<h2 className="text-lg font-semibold mb-4">Today's Tasks</h2>
<TaskItem label="Client Meeting - Project Alpha" time="10:00 AM" level="High" color="red" />
<TaskItem label="Report Submission - Q3 Review" time="2:00 PM" level="Medium" color="yellow" />
<TaskItem label="Team Sync" time="4:00 PM" level="Low" color="green" />
</div>

{/* Quick Actions */}
<div className="bg-white rounded-xl shadow p-6">
<h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
<div className="grid grid-cols-2 gap-4 text-sm">
<QuickAction label="Report an Issue" color="text-red-600" border="border-red-200" />
<QuickAction label="Submit Requirement" color="text-blue-600" border="border-blue-200" />
<QuickAction label="Start Chat" color="text-purple-600" border="border-purple-200" />
<QuickAction label="Send Report" color="text-green-600" border="border-green-200" />
</div>
</div>
</div>

{/* Work Reports and Messages */}
<div className="grid grid-cols-3 gap-6 mb-8">
{/* Recent Work Reports */}
<div className="col-span-2 bg-white rounded-xl shadow p-6">
<div className="flex justify-between items-center mb-4">
<h2 className="text-lg font-semibold">Recent Work Reports</h2>
<button className="bg-blue-600 text-white text-sm px-3 py-1 rounded">+ Submit New Report</button>
</div>
<ReportItem label="Weekly Progress Report" date="Oct 15, 2023" status="Submitted" color="blue" />
<ReportItem label="Project Status Update" date="Oct 14, 2023" status="Pending" color="yellow" />
<ReportItem label="Sprint Review Report" date="Oct 13, 2023" status="Approved" color="green" />
</div>

{/* Recent Messages */}
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

// Component Definitions
const SidebarLink = ({ icon, label, active }) => (
<div className={`flex items-center space-x-3 cursor-pointer p-2 rounded ${active ? "bg-blue-50 text-blue-600 font-semibold" : "hover:bg-gray-100"}`}>
{icon}
<span>{label}</span>
</div>
);

const SummaryCard = ({ label, count, color, icon }) => (
<div className={`p-5 rounded-xl shadow-sm ${color}`}>
<div className="text-2xl font-bold mb-1">{count}</div>
<div className="text-sm text-gray-600">{label}</div>
</div>
);

const TaskItem = ({ label, time, level, color }) => (
<div className="flex justify-between items-center py-2 border-b last:border-none">
<div className="flex items-center space-x-3">
<span className={`h-3 w-3 rounded-full bg-${color}-500`}></span>
<div>
<p className="font-medium">{label}</p>
<p className="text-xs text-gray-500">{time}</p>
</div>
</div>
<span className={`text-xs px-2 py-1 rounded-full bg-${color}-100 text-${color}-600 font-medium`}>{level}</span>
</div>
);

const QuickAction = ({ label, color, border }) => (
<button className={`border ${border} p-3 rounded text-sm ${color} text-left`}>{label}</button>
);

const ReportItem = ({ label, date, status, color }) => (
<div className="flex justify-between items-center py-2 border-b last:border-none">
<div>
<p className="font-medium">{label}</p>
<p className="text-xs text-gray-500">{date}</p>
</div>
<span className={`text-xs px-2 py-1 rounded-full bg-${color}-100 text-${color}-600 font-medium`}>{status}</span>
</div>
);

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

const Detail = ({ label, value }) => (
<div>
<p className="text-gray-400">{label}</p>
<p className="font-medium">{value}</p>
</div>
);

export default EmployeeDashboard;