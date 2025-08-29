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

// Sidebar menu config based on roles
const menuConfig = {
  employee: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Employee Dashboard" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Today's Work" },
    { to: "/attendance", icon: <ClipboardList size={18} />, label: "Attendance" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
  ],
  hr: [
    { to: "/hrdashboard", icon: <LayoutDashboard size={18} />, label: "HR Dashboard" },
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch In / Out" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/admin/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    { to: "/attendance", icon: <ClipboardList size={18} />, label: "Attendance" },
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
  ],
  admin: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Admin Dashboard" },
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch In / Out" },
    // { to: "/admin/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
  ],
  "super-admin": [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Super Admin Dashboard" },
    // { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch-In / Punch-Out" },
    { to: "/admin/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
  ],
};

const Sidebar = ({ collapsed, setCollapsed, onLogout }) => {
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Determine role from JWT
  let roleKey = "employee";
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      roleKey = payload.role?.toLowerCase() || "employee";
    } catch (err) {
      console.error("Invalid token", err);
    }
  }

  const navItems = menuConfig[roleKey] || menuConfig["employee"];

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-screen z-30 flex flex-col bg-gradient-to-br from-[#13161c]/90 via-[#181d2a]/95 to-[#191f2b]/95 text-blue-100 shadow-2xl border-r border-[#232945] transition-all duration-300 ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <div className={`p-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <NavLink to="/dashboard">
              <img src={tapveraLogo} alt="Tapvera Logo" className="h-10 w-auto drop-shadow-lg" />
            </NavLink>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1 rounded-full transition-transform bg-[#232945] hover:bg-white/30 shadow ${
              collapsed ? "rotate-0" : "rotate-180"
            }`}
            aria-label="Toggle sidebar"
          >
            <FaChevronCircleRight size={22} className="text-blue-200" />
          </button>
        </div>

        <nav className="mt-3 space-y-1 px-3 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {roleKey === "employee" && (
          <div className="px-4 pb-2 pt-3">
            <div
              onClick={() => setShowEmailModal(true)}
              className="flex items-center justify-center space-x-3 cursor-pointer p-2 rounded-xl bg-gradient-to-r from-blue-500/70 to-blue-400/70 hover:from-blue-500 hover:to-blue-400 text-white font-semibold shadow-lg"
            >
              <Send size={18} />
              {!collapsed && <span>Send Daily Updates</span>}
            </div>
          </div>
        )}

        <div className="px-4 py-5 border-t border-[#232945]">
          <button
            onClick={onLogout}
            className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-red-500/70 to-red-400/70 text-white text-base font-bold shadow-lg hover:from-red-500 hover:to-red-400 transition"
          >
            {collapsed ? "⏻" : "Logout"}
          </button>
        </div>
      </aside>

      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)}>
        <DailyEmailSender onClose={() => setShowEmailModal(false)} />
      </Modal>
    </>
  );
};

const SidebarLink = ({ to, icon, label, collapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center ${collapsed ? "justify-center" : "space-x-3"} cursor-pointer p-2 rounded-xl font-medium transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-r from-blue-500/80 to-blue-400/80 text-white shadow-md"
          : "text-blue-100 hover:text-blue-300"
      }`
    }
    aria-label={label}
    style={{ fontWeight: 600, fontSize: "1.04rem" }}
  >
    {icon}
    {!collapsed && <span>{label}</span>}
  </NavLink>
);

export default Sidebar;
