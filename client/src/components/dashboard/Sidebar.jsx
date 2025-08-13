import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- import navigate
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
  HelpCircle,
  Send,
  Users,
} from "lucide-react";
import { FaChevronCircleRight } from "react-icons/fa";
import { NavLink } from "react-router-dom";

const menuConfig = {
  employee: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { to: "/profile", icon: <User size={18} />, label: "My Profile" },
    { to: "/tasks", icon: <ClipboardList size={18} />, label: "Tasks" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/reports", icon: <FileText size={18} />, label: "Reports" },
    { to: "/requirements", icon: <Flag size={18} />, label: "Requirements" },
    { to: "/help", icon: <HelpCircle size={18} />, label: "Help Center" },
  ],
  admin: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { to: "/employees", icon: <Users size={18} />, label: "Employee Details" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/help", icon: <HelpCircle size={18} />, label: "Help Center" },
  ],
  superadmin: [
    { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { to: "/employees", icon: <Users size={18} />, label: "Manage Employees" },
    { to: "/messages", icon: <MessageCircle size={18} />, label: "Messages" },
    { to: "/reports", icon: <FileText size={18} />, label: "Reports" },
    { to: "/help", icon: <HelpCircle size={18} />, label: "Help Center" },
  ],
};

const Sidebar = ({ collapsed, setCollapsed, userRole = "employee" }) => {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const navigate = useNavigate(); // hook to navigate

  const navItems = menuConfig[userRole] || [];

  const handleLogout = () => {
    // Clear stored login data
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Redirect to login
    navigate("/login");
  };

  return (
    <>
      <aside
        className={`${
          collapsed ? "w-20" : "w-64"
        } bg-white shadow-md flex flex-col h-screen fixed left-0 top-0 transition-all duration-300 z-20`}
      >
        {/* Logo & Collapse */}
        <div
          className={`p-4 flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <img src={tapveraLogo} alt="Tapvera Logo" className="h-10 w-auto" />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1 rounded-full transition-transform ${
              collapsed ? "rotate-180" : "rotate-0"
            }`}
          >
            <FaChevronCircleRight size={22} className="text-gray-600" />
          </button>
        </div>

        {/* Nav Links */}
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

        {/* Show Send Daily Updates only for employees */}
        {userRole === "employee" && (
          <div className="p-4">
            <div
              onClick={() => setShowEmailModal(true)}
              className="flex items-center space-x-3 cursor-pointer p-2 rounded bg-yellow-50 hover:bg-yellow-100 text-gray-700"
            >
              <Send size={18} />
              {!collapsed && (
                <span className="font-semibold">Send Daily Updates</span>
              )}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 shadow-inner">
          <button
            onClick={handleLogout}
            className="w-full p-2 rounded bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-400 text-black text-sm"
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
