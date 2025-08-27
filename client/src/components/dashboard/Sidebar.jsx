import React, { useState } from "react";
import Modal from "../modal";
import DailyEmailSender from "../DailyEmailSender";
import tapveraLogo from "../../assets/tapvera.png";
import {
  LayoutDashboard,
  User,
  ClipboardList,
  MessageCircle,
  FileText,
  Flag,
  Send,
  Users,
} from "lucide-react";
import { FaChevronCircleRight } from "react-icons/fa";
import { NavLink } from "react-router-dom";

// Menu config per role
const menuConfig = {
  employee: [
    {
      to: "/dashboard",
      icon: <LayoutDashboard size={18} />,
      label: "Dashboard",
    },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    {
      to: "/today-status",
      icon: <ClipboardList size={18} />,
      label: "Today's Work",
    },
    {
      to: "/attendance",
      icon: <ClipboardList size={18} />,
      label: "Attendance",
    },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/leaves", icon: <FileText size={18} />, label: "Leaves & Holidays" },
  ],
  admin: [
    {
      to: "/dashboard",
      icon: <LayoutDashboard size={18} />,
      label: "Dashboard",
    },
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    {
      to: "/admin/leaves",
      icon: <FileText size={18} />,
      label: "Leave Requests",
    },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    {
      to: "/today-status",
      icon: <ClipboardList size={18} />,
      label: "Today's Work",
    },
  ],
  superadmin: [
    {
      to: "/dashboard",
      icon: <LayoutDashboard size={18} />,
      label: "Dashboard",
    },
    { to: "/employees", icon: <Users size={18} />, label: "Manage Employees" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/leaves", icon: <FileText size={18} />, label: "Leaves & Holidays" },
    { to: "/notices", icon: <Flag size={18} />, label: "Notice Board" },
    {
      to: "/today-status",
      icon: <ClipboardList size={18} />,
      label: "Today's Work",
    },
  ],
  hr: [
    {
      to: "/hrdashboard",
      icon: <LayoutDashboard size={18} />,
      label: "HR Dashboard",
    }, // Exclusive HR page
    // Admin menus below
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    {
      to: "/admin/leaves",
      icon: <FileText size={18} />,
      label: "Leave Requests",
    },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    {
      to: "/today-status",
      icon: <ClipboardList size={18} />,
      label: "Today's Work",
    },
  ],
};

const Sidebar = ({
  collapsed,
  setCollapsed,
  userRole = "employee",
  onLogout,
}) => {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const navItems = menuConfig[userRole] || [];

  return (
    <>
      <aside
        className={`${
          collapsed ? "w-20" : "w-72"
        } bg-gradient-to-br from-[#13161c]/80 via-[#181d2a]/90 to-[#191f2b]/90 text-blue-100 shadow-2xl border-r border-[#232945] fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-30 backdrop-blur-xl`}
      >
        {/* Logo & Collapse */}
        <div
          className={`p-4 flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <NavLink to="/dashboard">
            <img
              src={tapveraLogo}
              alt="Tapvera Logo"
              className="h-10 w-auto drop-shadow-lg"
            />
          </NavLink>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1 rounded-full transition-transform ${
              collapsed ? "rotate-180" : "rotate-0"
            } bg-[#232945] hover:bg-white/40 shadow`}
            aria-label="Toggle sidebar collapse"
          >
            <FaChevronCircleRight size={22} className="text-blue-200" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="mt-3 space-y-1 px-3 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Send Daily Updates - Employee only */}
        {userRole === "employee" && (
          <div className="px-4 pb-2 pt-3">
            <div
              onClick={() => setShowEmailModal(true)}
              className="flex items-center space-x-3 cursor-pointer p-2 rounded-xl bg-gradient-to-r from-white/60 to-white/40 hover:from-white/80 hover:to-white/60 text-black font-semibold shadow-lg"
            >
              <Send size={18} />
              {!collapsed && <span>Send Daily Updates</span>}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="px-4 py-5 border-t border-[#232945]">
          <button
            onClick={onLogout}
            className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-white/70 to-white/60 text-black text-base font-bold shadow-lg hover:from-white/90 hover:to-white/80 transition"
          >
            {collapsed ? "⏻" : "Logout"}
          </button>
        </div>
      </aside>

      {/* Modal for Daily Email Sender */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)}>
        <DailyEmailSender onClose={() => setShowEmailModal(false)} />
      </Modal>
    </>
  );
};

const SidebarLink = ({ to, icon, label, collapsed }) => (
  <NavLink
    to={to}
    end
    className={({ isActive }) =>
      `flex items-center space-x-3 cursor-pointer p-2 rounded-xl font-bold transition-all duration-150 ${
        isActive
          ? "bg-white/25 backdrop-blur-md border border-white/40 shadow-inner text-blue-900"
          : "hover:bg-white/10 hover:backdrop-blur-[2px] text-blue-100"
      }`
    }
    aria-label={label}
    style={{
      fontWeight: 600,
      fontSize: "1.04rem",
    }}
  >
    {icon}
    {!collapsed && <span>{label}</span>}
  </NavLink>
);

export default Sidebar;
