import React from "react";
import tapveraLogo from "../../assets/tapvera.png";
import {
  LayoutDashboard,
  User,
  ClipboardList,
  MessageCircle,
  FileText,
  Flag,
  HelpCircle,
} from "lucide-react";
import { FaChevronCircleRight } from "react-icons/fa";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
  { to: "/profile", icon: <User size={18} />, label: "My Profile" },
  { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
  { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
  { to: "/reports", icon: <FileText size={18} />, label: "Reports" },
  { to: "/requirements", icon: <Flag size={18} />, label: "Requirements" },
  { to: "/help", icon: <HelpCircle size={18} />, label: "Help Center" },
];

const Sidebar = ({ onLogout, collapsed, setCollapsed }) => {
  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } bg-white shadow-md flex flex-col h-screen fixed left-0 top-0 transition-all duration-300 z-20`}
    >
      {/* Logo & Collapse Button */}
      <div
        className={`p-4 flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <img
          src={tapveraLogo}
          alt="Tapvera Logo"
          className="h-10 w-auto transition-all duration-300"
        />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-1 rounded-full transition-transform transform ${
            collapsed ? "rotate-180" : "rotate-0"
          } hover:scale-110`}
          aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <FaChevronCircleRight size={22} className="text-gray-600" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4 flex-1">
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

      {/* Logout */}
      <div className="p-4 shadow-inner">
        <button
          onClick={onLogout}
          className="w-full p-2 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-400 text-black hover:bg-red-600 text-sm"
          aria-label="Logout"
        >
          {collapsed ? "⏻" : "Logout"}
        </button>
      </div>
    </aside>
  );
};

const SidebarLink = ({ to, icon, label, collapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center space-x-3 cursor-pointer p-2 rounded transition-colors ${
        isActive
          ? "bg-blue-50 text-yellow-600 font-semibold"
          : "hover:bg-gray-100 text-gray-700"
      }`
    }
    end
  >
    {icon}
    {!collapsed && <span>{label}</span>}
  </NavLink>
);

export default Sidebar;
