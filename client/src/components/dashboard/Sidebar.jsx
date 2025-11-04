import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ClipboardList,
  FileText,
  Flag,
  Calendar,
  Clock,
  TrendingUp,
  PhoneCall,
  BookOpen,
  Briefcase,
  FolderKanban,
  Bell,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
} from "lucide-react";
import { FaChevronCircleRight } from "react-icons/fa";
import { Users } from "@/components/animate-ui/icons/users";
import { Brush } from "@/components/animate-ui/icons/brush";
import { MessageSquareQuote } from "@/components/animate-ui/icons/message-square-quote";
import { ChevronUp } from "@/components/animate-ui/icons/chevron-up";
import { ChartNoAxesColumnDecreasing } from "@/components/animate-ui/icons/chart-no-axes-column-decreasing";
import { Gauge } from "@/components/animate-ui/icons/gauge";
import { LogIn } from "@/components/animate-ui/icons/log-in";
import { CircleCheckBig } from "@/components/animate-ui/icons/circle-check-big";
import { Clock10 as AnimatedClock10 } from "@/components/animate-ui/icons/clock-10";
import { Send } from "@/components/animate-ui/icons/send";
import { PanelLeft } from "@/components/animate-ui/icons/panel-left";
import { PartyPopper } from "@/components/animate-ui/icons/party-popper";
import { Gavel } from "@/components/animate-ui/icons/gavel";
import { Disc3 } from "@/components/animate-ui/icons/disc-3";
import { ChartBar } from "@/components/animate-ui/icons/chart-bar";
import { Fingerprint } from "@/components/animate-ui/icons/fingerprint";
import { User as AnimatedUser } from "@/components/animate-ui/icons/user";
import { Pin } from "@/components/animate-ui/icons/pin";
import { Compass } from "@/components/animate-ui/icons/compass";
import { RotateCw } from "@/components/animate-ui/icons/rotate-cw";
import Modal from "../modal";
import DailyEmailSender from "../DailyEmailSender";
import AchievementsDashboard from "../achievements/AchievementsDashboard";
import { useAchievements } from "../../contexts/AchievementContext";
import tapveraLogo from "../../assets/tapvera.png";

// Role → Menu mapping
const menuConfig = {
  employee: [
    {
      to: "/today-status",
      icon: <LogIn size={18} animateOnHover />,
      label: "Punch In/Out",
    },
    {
      to: "/dashboard",
      icon: <Gauge size={18} animateOnHover />,
      label: "Employee Dashboard",
    },

    {
      to: "/employee-portal",
      icon: <FolderKanban size={18} />,
      label: "My Projects",
    },
    {
      to: "/tasks",
      icon: <CircleCheckBig size={18} animateOnHover />,
      label: "My Tasks",
    },
    {
      to: "/sheets",
      icon: <FileSpreadsheet size={18} />,
      label: "Shared Sheets",
    },
    {
      to: "/attendance",
      icon: <AnimatedClock10 size={18} animateOnHover />,
      label: "My Attendance",
    },
    {
      to: "/leaves",
      icon: <Send size={18} animateOnHover />,
      label: "Leave Requests",
    },
    { to: "/todo", icon: <Brush size={18} animateOnHover />, label: "Todo" },
    {
      to: "/messages",
      icon: <MessageSquareQuote size={18} animateOnHover />,
      label: "Messages",
    },
    {
      to: "/notifications",
      icon: <Bell size={18} />,
      label: "Notifications",
    },
    {
      to: "/notepad",
      icon: <PanelLeft size={18} animateOnHover />,
      label: "My Notepad",
    },
    {
      to: "/profile",
      icon: <AnimatedUser size={18} animateOnHover />,
      label: "My Profile",
    },
    {
      type: "achievements",
      icon: <PartyPopper size={18} animateOnHover />,
      label: "Achievements",
    },
    {
      to: "/leads",
      icon: <ChevronUp size={18} animateOnHover />,
      label: "My Leads",
    },
   
    {
      to: "/callbacks",
      icon: <Gavel size={18} animateOnHover />,
      label: "My Callbacks",
    },
    
  ],
  hr: [
    {
      to: "/hrdashboard",
      icon: <Gauge size={18} animateOnHover />,
      label: "HR Dashboard",
    },
    {
      to: "/today-status",
      icon: <LogIn size={18} animateOnHover />,
      label: "Punch In/Out",
    },
    {
      to: "/tasks",
      icon: <CircleCheckBig size={18} animateOnHover />,
      label: "My Tasks",
    },
    {
      to: "/sheets",
      icon: <FileSpreadsheet size={18} />,
      label: "Shared Sheets",
    },
    {
      to: "/notepad",
      icon: <PanelLeft size={18} animateOnHover />,
      label: "My Notepad",
    },
    { to: "/todo", icon: <Brush size={18} animateOnHover />, label: "Todo" },
    {
      to: "/admin/leaves",
      icon: <Send size={18} animateOnHover />,
      label: "Leave Requests",
    },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    {
      to: "/attendance",
      icon: <AnimatedClock10 size={18} animateOnHover />,
      label: "My Attendance",
    },
    {
      to: "/directory",
      icon: <Users size={18} animateOnHover />,
      label: "Employee Details",
    },
    {
      to: "/admin/shifts",
      icon: <Clock size={18} />,
      label: "Shift Management",
    },
    {
      to: "/admin/manual-attendance",
      icon: <Disc3 size={18} animateOnHover />,
      label: "Manual Attendance",
    },
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    {
      to: "/admin/holidays",
      icon: <ChartBar size={18} animateOnHover />,
      label: "Holidays List",
    },
    {
      to: "/messages",
      icon: <MessageSquareQuote size={18} animateOnHover />,
      label: "Messages",
    },
    {
      to: "/notifications",
      icon: <Bell size={18} />,
      label: "Notifications",
    },
    {
      to: "/profile",
      icon: <AnimatedUser size={18} animateOnHover />,
      label: "My Profile",
    },
    {
      to: "/super-admin",
      icon: <ClipboardList size={18} />,
      label: "Employees Current Status",
    },
    {
      type: "achievements",
      icon: <PartyPopper size={18} animateOnHover />,
      label: "Achievements",
    },
  ],
  admin: [
    {
      to: "/today-status",
      icon: <LogIn size={18} animateOnHover />,
      label: "Punch In/Out",
    },
    {
      to: "/dashboard",
      icon: <Gauge size={18} animateOnHover />,
      label: "Admin Dashboard",
    },

    // Business Management Dropdown
    {
      label: "Business Management",
      icon: <Briefcase size={18} />,
      children: [
        {
          to: "/clients",
          icon: <Briefcase size={16} />,
          label: "Client Management",
        },
        {
          to: "/projects",
          icon: <FolderKanban size={16} />,
          label: "Project Management",
        },
        {
          to: "/leads",
          icon: <ChevronUp size={16} animateOnHover />,
          label: "Lead Management",
        },
        {
          to: "/callbacks",
          icon: <RotateCw size={16} animateOnHover />,
          label: "Callback Management",
        },
      ],
    },

    {
      to: "/sheets",
      icon: <FileSpreadsheet size={18} />,
      label: "Sheet Manager",
    },
    {
      to: "/employee-portal",
      icon: <FolderKanban size={18} />,
      label: "My Projects",
    },
    {
      to: "/notepad",
      icon: <PanelLeft size={18} animateOnHover />,
      label: "My Notepad",
    },
    { to: "/todo", icon: <Brush size={18} animateOnHover />, label: "Todo" },
    {
      to: "/tasks",
      icon: <CircleCheckBig size={18} animateOnHover />,
      label: "My Tasks",
    },
    { to: "/leaves", icon: <FileText size={18} />, label: "My Leaves" },
    {
      to: "/messages",
      icon: <MessageSquareQuote size={18} animateOnHover />,
      label: "Messages",
    },
    {
      to: "/notifications",
      icon: <Bell size={18} />,
      label: "Notifications",
    },
    {
      to: "/admin/holidays",
      icon: <Calendar size={18} />,
      label: "Holidays List",
    },
    {
      to: "/attendance",
      icon: <AnimatedClock10 size={18} animateOnHover />,
      label: "My Attendance",
    },
    {
      to: "/profile",
      icon: <AnimatedUser size={18} animateOnHover />,
      label: "My Profile",
    },
    {
      type: "achievements",
      icon: <PartyPopper size={18} animateOnHover />,
      label: "Achievements",
    },
  ],
  "super-admin": [
    {
      to: "/hrdashboard",
      icon: <Gauge size={18} animateOnHover />,
      label: "Dashboard",
    },
    {
      to: "/tasks",
      icon: <CircleCheckBig size={18} animateOnHover />,
      label: "My Tasks",
    },

    // 🧑‍💼 Employees Dropdown
    {
      label: "Employees",
      icon: <Users size={18} animateOnHover />,
      children: [
        {
          to: "/super-admin",
          icon: <ChartNoAxesColumnDecreasing size={16} animateOnHover />,
          label: "Current Status",
        },
        {
          to: "/super-admin/attendance",
          icon: <Pin size={16} animateOnHover />,
          label: "Attendance Portal",
        },
        {
          to: "/admin/tasks",
          icon: <ClipboardList size={16} animateOnHover />,
          label: "Task Management",
        },
        {
          to: "/admin/leaves",
          icon: <Send size={16} animateOnHover />,
          label: "Leave Requests",
        },
        {
          to: "/admin/shifts",
          icon: <Compass size={16} animateOnHover />,
          label: "Shift Management",
        },
        {
          to: "/admin/manual-attendance",
          icon: <Disc3 size={16} animateOnHover />,
          label: "Manual Attendance",
        },
        {
          to: "/admin/salary-management",
          icon: <Fingerprint size={16} animateOnHover />,
          label: "Salary Management",
        },
        
        {
          to: "/directory",
          icon: <Users size={16} animateOnHover />,
          label: "Employee Details",
        },
        {
          to: "/super-admin/notepad",
          icon: <BookOpen size={16} animateOnHover />,
          label: "Employee Notepads",
        },
        {
          to: "/super-admin/payments",
          icon: <DollarSign size={16} />,
          label: "Payment Management",
        },
      ],
    },

    // Business Management Dropdown
    {
      label: "Business Management",
      icon: <Briefcase size={18} />,
      children: [
        {
          to: "/clients",
          icon: <Briefcase size={16} />,
          label: "Client Management",
        },
        {
          to: "/projects",
          icon: <FolderKanban size={16} />,
          label: "Project Management",
        },
        {
          to: "/leads",
          icon: <ChevronUp size={16} animateOnHover />,
          label: "Lead Management",
        },
        {
          to: "/callbacks",
          icon: <RotateCw size={16} animateOnHover />,
          label: "Callback Management",
        },
      ],
    },

    {
      to: "/sheets",
      icon: <FileSpreadsheet size={18} />,
      label: "Sheet Manager",
    },
    { to: "/todo", icon: <Brush size={18} animateOnHover />, label: "Todo" },
    {
      to: "/messages",
      icon: <MessageSquareQuote size={18} animateOnHover />,
      label: "Messages",
    },
    {
      to: "/notifications",
      icon: <Bell size={18} />,
      label: "Notifications",
    },
    
    { to: "/admin/notices", icon: <Flag size={18} />, label: "Notice Board" },
    {
      to: "/admin/holidays",
      icon: <ChartBar size={18} animateOnHover />,
      label: "Holidays List",
    },
    {
      to: "/profile",
      icon: <AnimatedUser size={18} animateOnHover />,
      label: "My Profile",
    },
    {
      type: "achievements",
      icon: <PartyPopper size={18} animateOnHover />,
      label: "Achievements",
    },
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
  const location = useLocation();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [role, setRole] = useState("employee");
  const [chatUnread, setChatUnread] = useState(0);
  const [chatUnreadMap, setChatUnreadMap] = useState({});
  const [conversations, setConversations] = useState([]);
  const [showUnreadTooltip, setShowUnreadTooltip] = useState(false);
  const [userDepartment, setUserDepartment] = useState("");
  const [hoveredItem, setHoveredItem] = useState(null);
  const [expandedDropdowns, setExpandedDropdowns] = useState({});
  const {
    showAchievementsDashboard,
    openAchievementsDashboard,
    closeAchievementsDashboard,
  } = useAchievements();

  const toggleDropdown = (label) => {
    setExpandedDropdowns(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  // Auto-expand dropdowns that contain the current active route
  useEffect(() => {
    const rawMenuItems = menuConfig[role] || menuConfig["employee"];
    const newExpandedState = {};
    
    rawMenuItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => {
          // Exact match for routes
          if (child.to === location.pathname) return true;
          // Special handling for /super-admin to not match /super-admin/attendance etc
          if (child.to === "/super-admin" && location.pathname === "/super-admin") return true;
          if (child.to !== "/super-admin" && location.pathname.startsWith(child.to)) return true;
          return false;
        });
        
        if (hasActiveChild) {
          newExpandedState[item.label] = true;
        }
      }
    });
    
    setExpandedDropdowns(prev => ({ ...prev, ...newExpandedState }));
  }, [location.pathname, role]);

  useEffect(() => {
    let resolvedRole = normalizeRole(userRole || "employee");
    let department = "";
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.role) {
          resolvedRole = normalizeRole(parsed.role);
        }
        if (parsed.department) {
          department = parsed.department;
        }
      }
    } catch {
      // fallback silently
    }
    setRole(resolvedRole);
    setUserDepartment(department);
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
    const interval = setInterval(updateFromStorage, 3000);
    return () => {
      window.removeEventListener("chat-unread-total", handler);
      clearInterval(interval);
    };
  }, []);

  // Listen for chat unread map to show which conversations have unread messages
  useEffect(() => {
    const updateMapFromStorage = () => {
      try {
        const raw = sessionStorage.getItem("chat_unread_map");
        if (raw) {
          const map = JSON.parse(raw);
          setChatUnreadMap(map);
        }
      } catch {
        setChatUnreadMap({});
      }
    };
    updateMapFromStorage();
    const handler = (e) => {
      const map = e.detail?.map || {};
      setChatUnreadMap(map);
    };
    window.addEventListener("chat-unread-map", handler);
    const interval = setInterval(updateMapFromStorage, 3000);
    return () => {
      window.removeEventListener("chat-unread-map", handler);
      clearInterval(interval);
    };
  }, []);

  // Fetch conversations to map IDs to names
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const API_BASE =
          import.meta.env.VITE_API_BASE || "http://localhost:5000";
        const res = await fetch(`${API_BASE}/api/chat/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      }
    };
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter menu items based on role and department
  const rawMenuItems = menuConfig[role] || menuConfig["employee"];
  const menuItems = rawMenuItems.filter((item) => {
    // For items with children, filter the children
    if (item.children) {
      item.children = item.children.filter((child) => {
        if (
          child.to === "/leads" ||
          child.to === "/callbacks"
        ) {
          return (
            role === "super-admin" ||
            role === "admin" ||
            userDepartment === "marketingAndSales"
          );
        }
        return true;
      });
      // Only show the dropdown if it has children after filtering
      return item.children.length > 0;
    }
    
    // Allow access to leads/callbacks for super-admin, admin, or marketingAndSales employees
    if (
      item.to === "/leads" ||
      item.to === "/callbacks"
    ) {
      return (
        role === "super-admin" ||
        role === "admin" ||
        userDepartment === "marketingAndSales"
      );
    }
    return true;
  });

  // Helper to check if a route is active
  const isRouteActive = (path) => {
    if (path === "/super-admin") {
      return location.pathname === "/super-admin";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  // Helper to add hover trigger to animated icons
  const renderIconWithHover = (icon, isHovered) => {
    if (icon.props?.animateOnHover) {
      return React.cloneElement(icon, {
        animateOnHover: undefined,
        animate: isHovered,
      });
    }
    return icon;
  };

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
          {menuItems.map((item, index) => {
            if (item.type === "achievements") {
              return (
                <button
                  key={`achievements-${index}`}
                  onClick={openAchievementsDashboard}
                  className={`group flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-semibold
                    transition-all duration-150 w-full text-left
                    text-blue-100 hover:text-blue-300 hover:bg-white/10 hover:font-bold
                    ${collapsed ? "justify-center" : "justify-start"}`}
                  tabIndex={collapsed ? -1 : 0}
                >
                  <span className="flex items-center justify-center">
                    {item.icon}
                  </span>
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                </button>
              );
            }

            // Handle dropdown menus
            if (item.children) {
              const isExpanded = expandedDropdowns[item.label];
              const hasActiveChild = item.children.some(child => isRouteActive(child.to));
              
              return (
                <div key={`dropdown-${item.label}`}>
                  <button
                    onClick={() => !collapsed && toggleDropdown(item.label)}
                    className={`group flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-semibold
                      transition-all duration-150 w-full text-left
                      ${hasActiveChild && !isExpanded
                        ? "bg-gradient-to-r from-blue-600/50 to-blue-400/50 text-white"
                        : "text-blue-100 hover:text-blue-300 hover:bg-white/10 hover:font-bold"
                      }
                      ${collapsed ? "justify-center" : "justify-between"}`}
                    tabIndex={collapsed ? -1 : 0}
                    onMouseEnter={() => setHoveredItem(item.label)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex items-center justify-center">
                        {renderIconWithHover(item.icon, hoveredItem === item.label)}
                      </span>
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && (
                      <span className="transition-transform duration-200">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    )}
                  </button>
                  
                  {/* Dropdown Items */}
                  {!collapsed && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-blue-500/30 pl-2">
                      {item.children.map((child) => {
                        const isActive = isRouteActive(child.to);
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium
                              transition-all duration-150
                              ${
                                isActive
                                  ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-md"
                                  : "text-blue-100 hover:text-blue-300 hover:bg-white/5"
                              }`}
                            onMouseEnter={() => setHoveredItem(child.to)}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            <span className="flex items-center justify-center">
                              {renderIconWithHover(child.icon, hoveredItem === child.to)}
                            </span>
                            <span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular menu items
            return (
              <div
                key={item.to}
                className="relative"
                onMouseEnter={() => {
                  setHoveredItem(item.to);
                  if (item.to === "/messages" && chatUnread > 0)
                    setShowUnreadTooltip(true);
                }}
                onMouseLeave={() => {
                  setHoveredItem(null);
                  if (item.to === "/messages") setShowUnreadTooltip(false);
                }}
              >
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-semibold
                    transition-all duration-150
                    ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-md"
                        : "text-blue-100 hover:text-blue-300 hover:font-bold"
                    }
                    ${collapsed ? "justify-center" : "justify-start"}`
                  }
                  end={item.to === "/super-admin"}
                  tabIndex={collapsed ? -1 : 0}
                >
                  <span className="flex items-center justify-center relative">
                    {renderIconWithHover(item.icon, hoveredItem === item.to)}
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

                {/* Unread Messages Tooltip */}
                {item.to === "/messages" &&
                  showUnreadTooltip &&
                  chatUnread > 0 && (
                    <div
                      className={`absolute ${
                        collapsed ? "left-16" : "left-56"
                      } top-0 z-50 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-sm`}
                    >
                      <div className="font-semibold text-white mb-2 border-b border-gray-600 pb-2">
                        Unread Messages ({chatUnread})
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {Object.entries(chatUnreadMap)
                          .filter(([, count]) => count > 0)
                          .map(([convId, count]) => {
                            const conversation = conversations.find(
                              (c) => c._id === convId
                            );
                            const name = conversation?.name || "Unknown Group";
                            return (
                              <div
                                key={convId}
                                className="flex items-center justify-between py-1 px-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                              >
                                <span className="text-gray-200 truncate flex-1">
                                  {name}
                                </span>
                                <span className="ml-2 bg-blue-500 text-white text-[10px] px-2 py-1 rounded-full min-w-[20px] text-center">
                                  {count > 99 ? "99+" : count}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
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
              text-white shadow-lg hover:brightness-110 transition flex items-center justify-center py-2"
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

      {/* Achievements Dashboard Modal */}
      {showAchievementsDashboard && (
        <AchievementsDashboard onClose={closeAchievementsDashboard} />
      )}
    </>
  );
};

export default Sidebar;