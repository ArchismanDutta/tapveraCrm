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
  Users,
  Calendar,
} from "lucide-react";
import { FaChevronCircleRight } from "react-icons/fa";
import { NavLink } from "react-router-dom";

// Updated menu config with Holidays for admin, super-admin, and hr
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
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch In/Out" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/admin/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    { to: "/attendance", icon: <ClipboardList size={18} />, label: "Attendance" },
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    { to: "/admin/holidays", icon: <Calendar size={18} />, label: "Holidays List" }, // new link
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
  ],
  admin: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Admin Dashboard" },
    { to: "/today-status", icon: <ClipboardList size={18} />, label: "Punch In/Out" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/admin/holidays", icon: <Calendar size={18} />, label: "Holidays List" }, // new link
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
  ],
  "super-admin": [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Super Admin Dashboard" },
    { to: "/admin/leaves", icon: <FileText size={18} />, label: "Leave Requests" },
    { to: "/directory", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/todo", icon: <ClipboardList size={18} />, label: "Todo" },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/admin/holidays", icon: <Calendar size={18} />, label: "Holidays List" }, // new link
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
  ],
};

const Sidebar = ({ collapsed, setCollapsed, onLogout }) => {
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Determine role from JWT
  let role = "employee";
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      role = payload.role ? payload.role.toLowerCase() : "employee";
    } catch {
      // invalid token
    }
  }

  const menuItems = menuConfig[role] || menuConfig["employee"];

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col bg-gradient-to-br from-[#13161c]/90 via-[#181a25]/95 to-[#191a27]/95 text-blue-100 shadow-2xl border-r border-[#232945] transition-width duration-300 ease-in-out overflow-hidden ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className={`flex items-center p-4 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <NavLink to="/dashboard" tabIndex={collapsed ? -1 : 0}>
              <img src={tapveraLogo} alt="Tapvera" className="h-10 w-auto drop-shadow-lg" />
            </NavLink>
          )}
          <button
            aria-label="Toggle Sidebar"
            className={`p-2 rounded-full transition transform bg-[#232945] hover:bg-white/20 ${
              collapsed ? "rotate-0" : "rotate-180"
            }`}
            onClick={() => setCollapsed(!collapsed)}
            tabIndex={0}
          >
            <FaChevronCircleRight size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              to={item.to}
              key={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-md"
                    : "text-blue-100 hover:text-blue-300"
                } ${collapsed ? "justify-center" : "justify-start"}`
              }
              tabIndex={collapsed ? -1 : 0}
            >
              <span className="flex items-center justify-center">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {role === "employee" && !collapsed && (
          <div className="px-4 py-2 border-t border-[#232945]">
            <button
              onClick={() => setShowEmailModal(true)}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-400 text-white py-2 font-semibold shadow-lg hover:brightness-110 transition"
              tabIndex={0}
            >
              Send Daily Updates
            </button>
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#232945]">
          <button
            onClick={onLogout}
            className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-400 text-white shadow-lg hover:brightness-110 transition flex items-center justify-center"
            tabIndex={0}
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

      {showEmailModal && (
        <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)}>
          <DailyEmailSender onClose={() => setShowEmailModal(false)} />
        </Modal>
      )}
    </>
  );
};

export default Sidebar;
