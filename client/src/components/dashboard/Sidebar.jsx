import React, { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchThreads, selectTotalUnread } from "../../store/slices/threadsSlice";
import {
  ClipboardList,
  FileText,
  Flag,
  Calendar,
  Clock,
  PhoneCall,
  BookOpen,
  Briefcase,
  FolderKanban,
  Bell,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
  ArrowLeftRight,
  LogOut,
  Mail,
  Shield,
} from "lucide-react";
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
import ThemeToggle from "../common/ThemeToggle";
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
      to: "/communication-tracking",
      icon: <MessageSquareQuote size={18} animateOnHover />,
      label: "Project Communication",
    },
    {
      to: "/tasks",
      icon: <CircleCheckBig size={18} animateOnHover />,
      label: "My Tasks",
    },
    {
      to: "/team/tasks",
      icon: <Users size={18} animateOnHover />,
      label: "Team Task Management",
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
    {
      to: "/my-payslips",
      icon: <FileText size={18} />,
      label: "My Payslips",
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
    {
      to: "/call-intelligence",
      icon: <PhoneCall size={18} animateOnHover />,
      label: "My Call Summaries",
    },
    {
      to: "/my-transfers",
      icon: <ArrowLeftRight size={18} animateOnHover />,
      label: "My Transfers",
    },
    {
      // Role & Department Hierarchy Revamp v2 (2026-07-27): present in this
      // array (and hr/admin's) so the item can appear for ANY Position later
      // granted canManageSubordinateAccess, not just today's Admin-only
      // seeding — visibility is decided by the permission-gated filter below,
      // not by which role array it's listed in.
      to: "/my-team/access",
      icon: <Shield size={18} />,
      label: "My Team's Access",
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
      to: "/communication-tracking",
      icon: <MessageSquareQuote size={18} animateOnHover />,
      label: "Project Communication",
    },
    {
      to: "/tasks",
      icon: <CircleCheckBig size={18} animateOnHover />,
      label: "My Tasks",
    },
    {
      to: "/team/tasks",
      icon: <Users size={18} animateOnHover />,
      label: "Team Task Management",
    },
    {
      to: "/super-admin/attendance",
      icon: <Pin size={16} animateOnHover />,
      label: "Attendance Portal",
    },
    {
      to: "/admin/auto-payroll",
      icon: <DollarSign size={18} />,
      label: "Salary Generation",
    },
    {
      to: "/admin/salary-management",
      icon: <FileText size={18} />,
      label: "Salary Management",
    },
    {
      to: "/my-payslips",
      icon: <DollarSign size={16} />,
      label: "My Payslips",
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
    {
      to: "/admin/biometric-attendance",
      icon: <Fingerprint size={18} animateOnHover />,
      label: "Biometric Device",
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
      to: "/my-team/access",
      icon: <Shield size={18} />,
      label: "My Team's Access",
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
          to: "/communication-tracking",
          icon: <MessageSquareQuote size={16} animateOnHover />,
          label: "Communication Tracking",
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
        {
          to: "/call-intelligence",
          icon: <PhoneCall size={16} animateOnHover />,
          label: "Call Intelligence",
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
    {
      to: "/team/tasks",
      icon: <Users size={18} animateOnHover />,
      label: "Team Task Management",
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
      to: "/my-payslips",
      icon: <DollarSign size={18} />,
      label: "My Payslips",
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
      to: "/my-team/access",
      icon: <Shield size={18} />,
      label: "My Team's Access",
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
          to: "/tasks",
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
          to: "/admin/biometric-attendance",
          icon: <Fingerprint size={16} animateOnHover />,
          label: "Biometric Device",
        },
        {
          to: "/admin/auto-payroll",
          icon: <DollarSign size={16} />,
          label: "Salary Generation",
        },
        {
          to: "/admin/salary-management",
          icon: <FileText size={16} />,
          label: "Salary Management",
        },
        {
          to: "/admin/access-management",
          icon: <Shield size={16} />,
          label: "Access Management",
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
          to: "/admin/client-requests",
          icon: <Mail size={16} />,
          label: "Client Requests",
        },
        {
          to: "/projects",
          icon: <FolderKanban size={16} />,
          label: "Project Management",
        },
        {
          to: "/communication-tracking",
          icon: <MessageSquareQuote size={16} animateOnHover />,
          label: "Communication Tracking",
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
        {
          to: "/call-intelligence",
          icon: <PhoneCall size={16} />,
          label: "Call Intelligence",
        },
        {
          to: "/admin/transfer-management",
          icon: <ArrowLeftRight size={16} />,
          label: "Transfer Management",
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

const Sidebar = ({
  collapsed: requestedCollapsed = false,
  setCollapsed = () => {},
  onLogout,
  userRole,
}) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false
  );
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [role, setRole] = useState("employee");
  // Phase 5: unread comes from the store, not sessionStorage.
  //
  // This component was one of FOUR independent writers of `chat_unread_total`
  // (with ChatPage, WebSocketContext and App.jsx). Each maintained its own idea
  // of the number and broadcast it to the others via window events, so whoever
  // wrote last won. That is why the badge drifted.
  const threadsById = useSelector((s) => s.threads.threads);
  const unreadByKey = useSelector((s) => s.threads.unreadByKey);

  const chatUnread = useSelector(selectTotalUnread("chat"));

  // { conversationId: count } — the shape the dropdown below already expects.
  const chatUnreadMap = useMemo(() => {
    const map = {};
    Object.entries(unreadByKey).forEach(([key, count]) => {
      if (key.startsWith("chat:") && count > 0) map[key.slice(5)] = count;
    });
    return map;
  }, [unreadByKey]);

  const conversations = useMemo(
    () =>
      Object.entries(threadsById)
        .filter(([key]) => key.startsWith("chat:"))
        .map(([, thread]) => thread),
    [threadsById]
  );
  const [showUnreadTooltip, setShowUnreadTooltip] = useState(false);
  const [userDepartment, setUserDepartment] = useState("");
  const [userPosition, setUserPosition] = useState("");
  // Access-management rework (2026-07-03, Phase 5) - resolved permissions
  // from GET /api/users/me/permissions, the server-computed single source of
  // truth. null until the fetch resolves; every consumer below falls back to
  // the old localStorage-derived role/department/position logic until then
  // (or if the fetch fails), so nothing regresses.
  const [permissions, setPermissions] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [expandedDropdowns, setExpandedDropdowns] = useState({});
  const {
    showAchievementsDashboard,
    openAchievementsDashboard,
    closeAchievementsDashboard,
  } = useAchievements();
  const collapsed = Boolean(requestedCollapsed || isMobile);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const handleViewportChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleViewportChange);
      return () => mediaQuery.removeEventListener("change", handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  const toggleDropdown = (label) => {
    setExpandedDropdowns((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  // Auto-expand dropdowns that contain the current active route
  useEffect(() => {
    const rawMenuItems = menuConfig[role] || menuConfig["employee"];
    const newExpandedState = {};

    rawMenuItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => {
          // Exact match for routes
          if (child.to === location.pathname) return true;
          // Special handling for /super-admin to not match /super-admin/attendance etc
          if (
            child.to === "/super-admin" &&
            location.pathname === "/super-admin"
          )
            return true;
          if (
            child.to !== "/super-admin" &&
            location.pathname.startsWith(child.to)
          )
            return true;
          return false;
        });

        if (hasActiveChild) {
          newExpandedState[item.label] = true;
        }
      }
    });

    setExpandedDropdowns((prev) => ({ ...prev, ...newExpandedState }));
  }, [location.pathname, role]);

  useEffect(() => {
    let resolvedRole = normalizeRole(userRole || "employee");
    let department = "";
    let position = "";
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
        if (parsed.position) {
          position = parsed.position;
        }
      }
    } catch {
      // fallback silently
    }
    setRole(resolvedRole);
    setUserDepartment(department);
    setUserPosition(position);
  }, [userRole]);

  // Access-management rework (2026-07-03, Phase 5.1/5.2): fetch resolved
  // permissions from the server instead of re-deriving access from the
  // department/position strings cached in localStorage. See
  // docs/superpowers/plans/2026-07-03-access-management-rework.md
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const API_BASE =
          import.meta.env.VITE_API_BASE || "http://localhost:5000";
        const res = await fetch(`${API_BASE}/api/users/me/permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPermissions(data);
        }
      } catch (error) {
        console.error("Failed to fetch permissions:", error);
      }
    };
    fetchPermissions();
  }, [userRole]);

  // Seed conversations + unread counts app-wide.
  //
  // The sidebar is the right place for this — it is mounted on every page,
  // whereas ChatPage only exists while the user is in the message portal. The
  // server returns unreadCount per conversation, which is the authoritative
  // number; this is what makes the badge correct on a fresh login, in a second
  // tab, or after messages arrived overnight.
  //
  // It used to fetch /api/chat/groups itself, write sessionStorage, and
  // broadcast two window events for other components to adopt. Now it dispatches
  // one thunk and everyone reads the same store.
  useEffect(() => {
    if (!localStorage.getItem("token")) return undefined;
    const load = () => dispatch(fetchThreads("chat"));
    load();
    window.addEventListener("conversation-updated", load);
    return () => window.removeEventListener("conversation-updated", load);
  }, [dispatch]);

  // Check if user has supervisor/team lead position
  // Access-management rework (2026-07-03, Phase 5.3): prefer the
  // server-resolved permission flags over fragile position-string substring
  // matching. Falls back to the old substring check until permissions load
  // (or if the fetch fails), so nothing regresses.
  const isSupervisor = permissions
    ? Boolean(
        permissions.permissions?.canViewSubordinateLeads ||
        permissions.permissions?.canViewDepartmentLeads ||
        permissions.permissions?.canViewSubordinateCallbacks ||
        permissions.permissions?.canViewDepartmentCallbacks
      )
    : Boolean(
        userPosition &&
        (userPosition.toLowerCase().includes("supervisor") ||
         userPosition.toLowerCase().includes("team lead") ||
         userPosition.toLowerCase().includes("manager"))
      );

  // Check if user has task/project team viewing permissions
  const hasTaskTeamView = permissions
    ? Boolean(
        permissions.permissions?.canViewSubordinateTasks ||
        permissions.permissions?.canViewDepartmentTasks
      )
    : Boolean(
        userPosition &&
        (userPosition.toLowerCase().includes("supervisor") ||
         userPosition.toLowerCase().includes("team lead") ||
         userPosition.toLowerCase().includes("manager"))
      );

  const hasProjectTeamView = permissions
    ? Boolean(
        permissions.permissions?.canViewSubordinateProjects ||
        permissions.permissions?.canViewDepartmentProjects
      )
    : Boolean(
        userPosition &&
        (userPosition.toLowerCase().includes("supervisor") ||
         userPosition.toLowerCase().includes("team lead") ||
         userPosition.toLowerCase().includes("manager"))
      );

  // Filter menu items based on role, department, and position
  const rawMenuItems = menuConfig[role] || menuConfig["employee"];
  const menuItems = rawMenuItems.map((item) => {
    // Update labels for leads/callbacks based on position
    if (item.to === "/leads" && isSupervisor) {
      return { ...item, label: "Team Leads" };
    }
    if (item.to === "/callbacks" && isSupervisor) {
      return { ...item, label: "Team Callbacks" };
    }
    // Update labels for projects based on permissions (tasks label stays "My Tasks")
    if (item.to === "/projects" && hasProjectTeamView) {
      return { ...item, label: "Team Projects" };
    }
    return item;
  }).filter((item) => {
    // For items with children, filter and update labels
    if (item.children) {
      item.children = item.children.map((child) => {
        // Update labels for leads/callbacks in dropdowns
        if (child.to === "/leads" && isSupervisor) {
          return { ...child, label: "Team Leads" };
        }
        if (child.to === "/callbacks" && isSupervisor) {
          return { ...child, label: "Team Callbacks" };
        }
        // Update labels for projects in dropdowns (tasks label stays "My Tasks")
        if (child.to === "/projects" && hasProjectTeamView) {
          return { ...child, label: "Team Projects" };
        }
        return child;
      }).filter((child) => {
        if (
          child.to === "/leads" ||
          child.to === "/callbacks" ||
          child.to === "/call-intelligence" ||
          child.to === "/my-transfers"
        ) {
          return permissions
            ? permissions.canAccessLeadManagement
            : (
                role === "super-admin" ||
                role === "admin" ||
                userDepartment === "marketingAndSales" ||
                (userPosition && userPosition.trim() !== "")
              );
        }
        return true;
      });
      // Only show the dropdown if it has children after filtering
      return item.children.length > 0;
    }

    // Leads, callbacks, call intelligence, and transfers are all part of the
    // CRM/sales workflow — show them only to users who have lead management
    // access. Routes for /call-intelligence and /my-transfers already enforce
    // canAccessLeadManagement on the route level; this keeps the sidebar
    // consistent so HR/non-sales employees don't see irrelevant CRM items.
    if (
      item.to === "/leads" ||
      item.to === "/callbacks" ||
      item.to === "/call-intelligence" ||
      item.to === "/my-transfers"
    ) {
      return permissions
        ? permissions.canAccessLeadManagement
        : (
            role === "super-admin" ||
            role === "admin" ||
            userDepartment === "marketingAndSales" ||
            (userPosition && userPosition.trim() !== "")
          );
    }

    // Role & Department Hierarchy Revamp v2 (2026-07-27): "My Team's Access"
    // is gated on the server-resolved canManageSubordinateAccess flag, not a
    // hardcoded role check — seeded true on Admin only today, but any
    // Position can get it later from the Access Management page with no
    // further code change. Falls back to role === "admin"/"super-admin"
    // until permissions load (or if the fetch fails), same
    // never-lock-someone-out pattern as isSupervisor/canAccessLeadManagement
    // above.
    if (item.to === "/my-team/access") {
      return permissions
        ? Boolean(permissions.permissions?.canManageSubordinateAccess)
        : (role === "super-admin" || role === "admin");
    }

    // Team Task Management: show for any task-related supervisory flag.
    // Uses server-resolved permission flags as single source of truth.
    // Falls back to position-string check until permissions load.
    if (item.to === "/team/tasks") {
      return permissions
        ? Boolean(
            permissions.permissions?.canViewSubordinateTasks ||
            permissions.permissions?.canViewDepartmentTasks ||
            permissions.permissions?.canAssignTasks ||
            permissions.permissions?.canAssignToSubordinates
          )
        : (userPosition && (
            userPosition.toLowerCase().includes("manager") ||
            userPosition.toLowerCase().includes("supervisor") ||
            userPosition.toLowerCase().includes("team lead")
          ));
    }

    return true;
  });

  // For employees assigned to positions with elevated permissions via Access
  // Management, inject the matching pages into their sidebar after permissions
  // load. Only fires for role === "employee" — HR/admin/super-admin already
  // have these pages in their respective menuConfig arrays.
  if (role === "employee" && permissions) {
    const perms = permissions.permissions || {};
    const existingRoutes = new Set(menuItems.map((i) => i.to).filter(Boolean));

    // ── HR & operations ──────────────────────────────────────────────────
    if (perms.canManageUsers && !existingRoutes.has("/directory")) {
      menuItems.push({
        to: "/directory",
        icon: <Users size={18} animateOnHover />,
        label: "Employee Directory",
      });
    }
    if (perms.canApproveLeaves && !existingRoutes.has("/admin/leaves")) {
      menuItems.push({
        to: "/admin/leaves",
        icon: <Send size={18} animateOnHover />,
        label: "Leave Approvals",
      });
    }
    if (perms.canApproveShifts && !existingRoutes.has("/admin/shifts")) {
      menuItems.push({
        to: "/admin/shifts",
        icon: <Clock size={18} />,
        label: "Shift Management",
      });
    }
    if (perms.canManageSalary) {
      if (!existingRoutes.has("/admin/auto-payroll")) {
        menuItems.push({
          to: "/admin/auto-payroll",
          icon: <DollarSign size={18} />,
          label: "Salary Generation",
        });
      }
      if (!existingRoutes.has("/admin/salary-management")) {
        menuItems.push({
          to: "/admin/salary-management",
          icon: <FileText size={18} />,
          label: "Salary Management",
        });
      }
    }
    if (perms.canManageAttendance) {
      if (!existingRoutes.has("/super-admin")) {
        menuItems.push({
          to: "/super-admin",
          icon: <ClipboardList size={18} />,
          label: "Employees Current Status",
        });
      }
      if (!existingRoutes.has("/super-admin/attendance")) {
        menuItems.push({
          to: "/super-admin/attendance",
          icon: <Pin size={16} animateOnHover />,
          label: "Attendance Portal",
        });
      }
      if (!existingRoutes.has("/admin/manual-attendance")) {
        menuItems.push({
          to: "/admin/manual-attendance",
          icon: <Disc3 size={18} animateOnHover />,
          label: "Manual Attendance",
        });
      }
      if (!existingRoutes.has("/admin/biometric-attendance")) {
        menuItems.push({
          to: "/admin/biometric-attendance",
          icon: <Fingerprint size={18} animateOnHover />,
          label: "Biometric Device",
        });
      }
    }

    // ── Business management ───────────────────────────────────────────────
    if (perms.canViewCommunicationTracking && !existingRoutes.has("/communication-tracking")) {
      menuItems.push({
        to: "/communication-tracking",
        icon: <MessageSquareQuote size={18} animateOnHover />,
        label: "Project Communication",
      });
    }
    if (perms.canManageClients && !existingRoutes.has("/clients")) {
      menuItems.push({
        to: "/clients",
        icon: <Briefcase size={18} />,
        label: "Client Management",
      });
    }
    if (perms.canManageClients && !existingRoutes.has("/admin/client-requests")) {
      menuItems.push({
        to: "/admin/client-requests",
        icon: <Mail size={18} />,
        label: "Client Requests",
      });
    }
    if (
      (perms.canManageProjects || perms.canViewSubordinateProjects) &&
      !existingRoutes.has("/projects")
    ) {
      menuItems.push({
        to: "/projects",
        icon: <FolderKanban size={18} />,
        label: perms.canManageProjects ? "Project Management" : "Team Projects",
      });
    }

    // ── Team task management ──────────────────────────────────────────────
    // canViewSubordinateTasks is already handled by the filter above.
    // Add the Team Tasks page for the other task-related flags that also
    // warrant visibility into subordinates' work.
    const needsTeamTasks =
      (perms.canAssignTasks || perms.canViewDepartmentTasks || perms.canAssignToSubordinates) &&
      !existingRoutes.has("/team/tasks");
    if (needsTeamTasks) {
      menuItems.push({
        to: "/team/tasks",
        icon: <Users size={18} animateOnHover />,
        label: "Team Task Management",
      });
    }

  }

  // Helper to check if a route is active
  const isRouteActive = (path) => {
    if (path === "/super-admin") {
      return location.pathname === "/super-admin";
    }
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
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

  const sidebarWidthClass = collapsed ? "w-16" : "w-56";
  const navItemBase =
    "group relative flex min-h-10 items-center rounded-lg text-sm font-medium transition-all duration-200";
  const getNavItemClass = (isActive) =>
    `${navItemBase} ${
      collapsed ? "justify-center px-0" : "gap-3 px-3"
    } ${
      isActive
        ? "border border-white/10 bg-white/[0.07] text-white"
        : "border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-100"
    }`;
  const getDropdownClass = (isActive) =>
    `${navItemBase} w-full text-left ${
      collapsed ? "justify-center px-0" : "justify-between gap-3 px-3"
    } ${
      isActive
        ? "border border-white/10 bg-white/[0.07] text-white"
        : "border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-100"
    }`;
  const iconShellClass =
    "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-current transition group-hover:bg-white/[0.06]";
  const activeRailClass =
    "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-cyan-200/70";

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col overflow-hidden
          border-r border-white/10 bg-[#0b0d14]/95 text-slate-100 shadow-xl shadow-black/20
          backdrop-blur-xl transition-all duration-300 ease-in-out ${sidebarWidthClass}`}
      >
        <div className={`relative z-10 flex items-center gap-2 border-b border-white/10 p-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          <NavLink
            to="/dashboard"
            className={`flex min-w-0 items-center gap-3 ${collapsed ? "justify-center" : ""}`}
            tabIndex={collapsed ? -1 : 0}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
              <img
                src={tapveraLogo}
                alt="Tapvera"
                className={`${collapsed ? "h-6 w-6 object-contain" : "h-7 w-auto"}`}
              />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-wide text-white">
                  Tapvera
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {role.replace("-", " ")}
                </span>
              </span>
            )}
          </NavLink>

          <button
            aria-label="Toggle Sidebar"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.07] hover:text-white sm:inline-flex"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronRight
              size={17}
              className={`transition-transform duration-300 ${collapsed ? "rotate-0" : "rotate-180"}`}
            />
          </button>
        </div>

        <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
          {menuItems.map((item, index) => {
            if (item.type === "achievements") {
              return (
                <button
                  key={`achievements-${index}`}
                  onClick={openAchievementsDashboard}
                  className={getNavItemClass(false)}
                  tabIndex={collapsed ? -1 : 0}
                  title={collapsed ? item.label : undefined}
                  onMouseEnter={() => setHoveredItem(item.label)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span className={iconShellClass}>
                    {renderIconWithHover(item.icon, hoveredItem === item.label)}
                  </span>
                  {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                </button>
              );
            }

            // Handle dropdown menus
            if (item.children) {
              const isExpanded = expandedDropdowns[item.label];
              const hasActiveChild = item.children.some((child) =>
                isRouteActive(child.to)
              );

              return (
                <div key={`dropdown-${item.label}`} className="relative">
                  {hasActiveChild && <span className={activeRailClass} />}
                  <button
                    onClick={() => !collapsed && toggleDropdown(item.label)}
                    className={getDropdownClass(hasActiveChild)}
                    tabIndex={collapsed ? -1 : 0}
                    onMouseEnter={() => setHoveredItem(item.label)}
                    onMouseLeave={() => setHoveredItem(null)}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-3"}`}>
                      <span className={iconShellClass}>
                        {renderIconWithHover(
                          item.icon,
                          hoveredItem === item.label
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!collapsed && (
                      <span className="text-slate-500 transition-transform duration-200 group-hover:text-slate-200">
                        {isExpanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Items */}
                  {!collapsed && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const isActive = isRouteActive(child.to);
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={`group relative flex min-h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-all duration-200 ${
                              isActive
                                ? "border-white/10 bg-white/[0.06] text-white"
                                : "border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200"
                            }`}
                            onMouseEnter={() => setHoveredItem(child.to)}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-current">
                              {renderIconWithHover(
                                child.icon,
                                hoveredItem === child.to
                              )}
                            </span>
                            <span className="truncate">{child.label}</span>
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
                    getNavItemClass(isActive)
                  }
                  end={item.to === "/super-admin"}
                  tabIndex={collapsed ? -1 : 0}
                  title={collapsed ? item.label : undefined}
                >
                  {isRouteActive(item.to) && <span className={activeRailClass} />}
                  <span className={iconShellClass}>
                    {renderIconWithHover(item.icon, hoveredItem === item.to)}
                    {item.to === "/messages" && chatUnread > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-rose-400 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                        {chatUnread > 99 ? "99+" : chatUnread}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      {item.to === "/messages" && chatUnread > 0 && (
                        <span className="min-w-[18px] rounded-full border border-rose-300/20 bg-rose-400/15 px-1.5 py-[1px] text-center text-[10px] font-semibold text-rose-100">
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
                      } top-0 z-50 w-64 rounded-lg border border-white/10 bg-[#0b0d14]/95 p-3 text-sm shadow-xl shadow-black/20 backdrop-blur`}
                    >
                      <div className="mb-2 border-b border-white/10 pb-2 font-semibold text-white">
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
                                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 transition-colors hover:bg-white/[0.08]"
                              >
                                <span className="flex-1 truncate text-slate-200">
                                  {name}
                                </span>
                                <span className="ml-2 min-w-5 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-center text-[10px] font-semibold text-slate-100">
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
          <div className="relative z-10 border-t border-white/10 px-3 py-3">
            <button
              onClick={() => setShowEmailModal(true)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
            >
              <Mail className="h-4 w-4" />
              Send Daily Updates
            </button>
          </div>
        )}

        <div className="relative z-10 border-t border-white/10 px-3 py-3">
          <ThemeToggle compact={collapsed} className={collapsed ? "mx-auto" : "w-full"} />
        </div>

        {/* Logout Button */}
        <div className="relative z-10 border-t border-gray-200 dark:border-white/10 px-3 py-3">
          <button
            onClick={onLogout}
            className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-300 dark:border-rose-300/20 bg-rose-100 dark:bg-rose-400/10 px-3 text-sm font-semibold text-rose-700 dark:text-rose-100 transition hover:bg-rose-200 dark:hover:bg-rose-400/15 ${
              collapsed ? "px-0" : ""
            }`}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {collapsed ? (
              <span className="hidden" aria-label="Logout" role="img" style={{ fontSize: 20 }}>
                ⏻
              </span>
            ) : (
              <span>Logout</span>
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
