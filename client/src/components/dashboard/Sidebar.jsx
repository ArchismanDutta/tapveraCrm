import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  ClipboardList,
  MessageCircle,
  FileText,
  Flag,
  Users,
  Calendar,
  Clock,
} from "lucide-react";
import { FaChevronCircleRight } from "react-icons/fa";

import Modal from "../modal";
import DailyEmailSender from "../DailyEmailSender";
import tapveraLogo from "../../assets/tapvera.png";

// Role → Menu mapping
const menuConfig = {
  employee: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Employee Dashboard" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch In/Out" },
    { to: "/attendance", icon: <ClipboardList size={18} />, label: "My Attendance" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
  ],
  hr: [
    { to: "/hrdashboard", icon: <LayoutDashboard size={18} />, label: "HR Dashboard" },
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch In/Out" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/admin/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    { to: "/attendance", icon: <ClipboardList size={18} />, label: "My Attendance" },
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/admin/shifts", icon: <Clock size={18} />, label: "Shift Management" },
    { to: "/admin/manual-attendance", icon: <Calendar size={18} />, label: "Manual Attendance" },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    { to: "/admin/holidays", icon: <Calendar size={18} />, label: "Holidays List" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
    { to: "/super-admin", icon: <ClipboardList size={18} />, label: "Employees Current Status" },
  ],
  admin: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Admin Dashboard" },
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch In/Out" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/admin/shifts", icon: <Clock size={18} />, label: "Shift Management" },
    // { to: "/admin/manual-attendance", icon: <Calendar size={18} />, label: "Manual Attendance" },
    { to: "/admin/holidays", icon: <Calendar size={18} />, label: "Holidays List" },
    { to: "/attendance", icon: <ClipboardList size={18} />, label: "My Attendance" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
  //   { to: "/super-admin", icon: <ClipboardList size={18} />, label: "Employees Current Status" },
  ],
  "super-admin": [
    { to: "/hrdashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { to: "/admin/tasks", icon: <LayoutDashboard size={18} />, label: "Assign Task" },
    { to: "/admin/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/admin/shifts", icon: <Clock size={18} />, label: "Shift Management" },
    { to: "/admin/manual-attendance", icon: <Calendar size={18} />, label: "Manual Attendance" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/admin/holidays", icon: <Calendar size={18} />, label: "Holidays List" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
    { to: "/super-admin", icon: <ClipboardList size={18} />, label: "Employees Current Status" },
    { to: "/super-admin/attendance", icon: <Calendar size={18} />, label: "Employee Attendance Portal" },
  ],
};

// Convert backend role strings into something Sidebar can handle
const normalizeRole = (role) => {
  if (!role) return "employee";
  const normalized = role.toLowerCase().trim();
  if (normalized === "superadmin") return "super-admin";
  return normalized;
};

const Sidebar = ({ collapsed, setCollapsed, onLogout, userRole }) => {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [role, setRole] = useState("employee");
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    let resolvedRole = normalizeRole(userRole || "employee");
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.role) {
          resolvedRole = normalizeRole(parsed.role);
        }
      }
    } catch (e) {
      // fallback silently
    }
    setRole(resolvedRole);
  }, [userRole]);

  // Listen for chat unread total to show badge on Messages item
  useEffect(() => {
    const updateFromStorage = () => {
      try {
        const stored = Number(sessionStorage.getItem("chat_unread_total") || 0);
        setChatUnread(isNaN(stored) ? 0 : stored);
      } catch {
        setChatUnread(0);
      }
    };
    updateFromStorage();
    const handler = (e) => {
      const total = Number(e.detail?.total || 0);
      setChatUnread(isNaN(total) ? 0 : total);
    };
    window.addEventListener("chat-unread-total", handler);
    // Also poll storage every 3s as a fallback in case an event is missed
    const interval = setInterval(updateFromStorage, 3000);
    return () => window.removeEventListener("chat-unread-total", handler);
  }, []);

  const menuItems = menuConfig[role] || menuConfig["employee"];

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col
          bg-gradient-to-br from-[#13161c]/90 via-[#181a25]/95 to-[#191a27]/95
          text-blue-100 shadow-2xl border-r border-[#232945]
          transition-all duration-300 ease-in-out overflow-hidden
          ${collapsed ? "w-16" : "w-56"}`}
      >
        {/* Logo & Toggle */}
        <div
          className={`flex items-center p-4 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <NavLink to="/dashboard" tabIndex={collapsed ? -1 : 0}>
              <img
                src={tapveraLogo}
                alt="Tapvera"
                className="h-10 w-auto drop-shadow-lg"
              />
            </NavLink>
          )}
          <button
            aria-label="Toggle Sidebar"
            className={`p-2 rounded-full bg-[#232945] hover:bg-white/20
              transition-transform duration-300
              ${collapsed ? "rotate-0" : "rotate-180"}`}
            onClick={() => setCollapsed(!collapsed)}
          >
            <FaChevronCircleRight size={22} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              to={item.to}
              key={item.to}
              className={({ isActive, isPending }) =>
                `group flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-semibold
                transition-colors duration-150
                ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-md"
                    : "text-blue-100 hover:text-blue-300"
                }
                ${collapsed ? "justify-center" : "justify-start"}`
              }
              end={item.to === "/super-admin"}
              tabIndex={collapsed ? -1 : 0}
            >
              <span className="flex items-center justify-center relative">
                {item.icon}
                {item.to === "/messages" && chatUnread > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-[1px] rounded-full min-w-[16px] text-center">
                    {chatUnread > 99 ? "99+" : chatUnread}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  {item.label}
                  {item.to === "/messages" && chatUnread > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-[1px] rounded-full min-w-[18px] text-center">
                      {chatUnread > 99 ? "99+" : chatUnread}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Daily Updates Button (Employee only) */}
        {role === "employee" && !collapsed && (
          <div className="px-4 py-2 border-t border-[#232945]">
            <button
              onClick={() => setShowEmailModal(true)}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-400
              text-white py-2 font-semibold shadow-lg hover:brightness-110 transition"
            >
              Send Daily Updates
            </button>
          </div>
        )}

        {/* Logout Button */}
        <div className="px-4 py-3 border-t border-[#232945]">
          <button
            onClick={onLogout}
            className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-400
              text-white shadow-lg hover:brightness-110 transition flex items-center justify-center"
          >
            {collapsed ? (
              <span aria-label="Logout" role="img" style={{ fontSize: 20 }}>
                ⏻
              </span>
            ) : (
              "Logout"
            )}
          </button>
        </div>
      </aside>

      {/* Daily Email Modal */}
      {showEmailModal && (
        <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)}>
          <DailyEmailSender onClose={() => setShowEmailModal(false)} />
        </Modal>
      )}
    </>
  );
};

export default Sidebar;
