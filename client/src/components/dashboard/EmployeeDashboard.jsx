import React from "react";
import PropTypes from "prop-types";

import SummaryCards from '../components/dashboard/SummaryCards';
import TodayTasks from '../components/dashboard/TodayTasks';
import RecentReports from '../components/dashboard/RecentReports';
import QuickActions from '../components/dashboard/QuickActions';
import RecentMessages from '../components/dashboard/RecentMessages';
import ProfileDetails from '../components/dashboard/ProfileDetails';

import {
  Bell,
  MessageCircle,
  FileText,
  Flag,
  User,
  LayoutDashboard,
  ClipboardList,
  HelpCircle,
} from 'lucide-react';

const EmployeeDashboard = ({
  greeting,
  summary,
  todayTasks,
  reports,
  actions,
  messages,
  profile,
}) => {
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Sidebar */}
      <aside
        className="w-64 bg-white shadow-md p-6 space-y-6"
        aria-label="Sidebar Navigation"
      >
        <div className="text-xl font-bold text-blue-600">WorkFlow CRM</div>
        <nav
          className="space-y-4 text-sm font-medium"
          aria-label="Main Navigation"
        >
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
      <main
        className="flex-1 p-8 overflow-y-auto"
        aria-label="Employee Dashboard Main Content"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Good Morning, {greeting.name}</h1>
            <p className="text-sm text-gray-500">{greeting.dateStr}</p>
          </div>
          <div className="flex items-center space-x-4">
            <Bell className="text-gray-500" aria-label="Notifications" />
            <img
              src={profile.avatar}
              alt="Avatar"
              className="w-9 h-9 rounded-full"
              loading="lazy"
            />
            <span className="text-sm font-medium">{profile.name}</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <SummaryCards summary={summary} />
        </div>

        {/* Tasks and Quick Actions */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <TodayTasks tasks={todayTasks} />
            <RecentReports reports={reports} />
          </div>
          <div className="space-y-6">
            <QuickActions actions={actions} />
            <RecentMessages messages={messages} />
          </div>
        </div>

        {/* Profile Details */}
        <ProfileDetails details={profile.details} className="mt-8" />
      </main>
    </div>
  );
};

// Sidebar Link
const SidebarLink = ({ icon, label, active }) => (
  <div
    className={`flex items-center space-x-3 cursor-pointer p-2 rounded ${
      active ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-gray-100 text-gray-800'
    }`}
    role="link"
    tabIndex={0}
    aria-current={active ? 'page' : undefined}
  >
    {icon}
    <span>{label}</span>
  </div>
);

SidebarLink.propTypes = {
  icon: PropTypes.element.isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
};

SidebarLink.defaultProps = {
  active: false,
};

EmployeeDashboard.propTypes = {
  greeting: PropTypes.shape({
    name: PropTypes.string.isRequired,
    dateStr: PropTypes.string.isRequired,
  }).isRequired,
  summary: PropTypes.shape({
    tasksDue: PropTypes.number.isRequired,
    pendingReports: PropTypes.number.isRequired,
    unreadMsgs: PropTypes.number.isRequired,
    openIssues: PropTypes.number.isRequired,
  }).isRequired,
  todayTasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  reports: PropTypes.arrayOf(PropTypes.object).isRequired,
  actions: PropTypes.arrayOf(PropTypes.object).isRequired,
  messages: PropTypes.arrayOf(PropTypes.object).isRequired,
  profile: PropTypes.shape({
    avatar: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    details: PropTypes.object.isRequired,
  }).isRequired,
};

export default EmployeeDashboard;
