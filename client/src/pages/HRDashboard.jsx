
// File: src/pages/HRDashboard.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  TrendingUp,
  RefreshCw,
  Activity,
  BarChart3,
  UserCheck,
  Building2,
  Gift,
  Heart,
  Zap,
  Star,
  Award
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Sidebar from "../components/dashboard/Sidebar";
import StatCard from "../components/humanResource/StatCard";
import UpcomingBirthdays from "../components/humanResource/UpcomingBirthdays";
import UpcomingAnniversaries from "../components/humanResource/UpcomingAnniversaries";
import RecentActivities from "../components/humanResource/RecentActivities";
import ActiveLeavesModal from "../components/humanResource/ActiveLeavesModal";
import WishingModal from "../components/humanResource/WishingModal";
import FlexibleRequestsModal from "../components/humanResource/FlexibleRequestsModal";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";

const SIDEBAR_WIDTH_EXPANDED = 288;
const SIDEBAR_WIDTH_COLLAPSED = 80;
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const HRDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeLeaves, setActiveLeaves] = useState([]);
  const [flexibleRequests, setFlexibleRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Celebration notifications
  const {
    celebrations,
    showPopup: showCelebrationPopup,
    loading: celebrationLoading,
    error: celebrationError,
    closePopup: closeCelebrationPopup
  } = useCelebrationNotifications();

  // modals
  const [showLeavesModal, setShowLeavesModal] = useState(false);
  const [showWishingModal, setShowWishingModal] = useState(false);
  const [wishingType, setWishingType] = useState(null); // "birthday" | "anniversary"
  const [showFlexModal, setShowFlexModal] = useState(false);

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  // Redirect if no token
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper: get next occurrence of a date (ignoring year)
  const getNextDate = (dateString) => {
    if (!dateString) return null;
    const parsed = new Date(dateString);
    if (isNaN(parsed)) return null;

    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let nextDate = new Date(todayMid.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (nextDate.getTime() < todayMid.getTime()) nextDate.setFullYear(nextDate.getFullYear() + 1);

    return nextDate;
  };

  // Enhanced manual refresh
  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDashboardData();
      toast.success("Dashboard refreshed successfully!");
    } catch (error) {
      toast.error("Failed to refresh dashboard");
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      if (!refreshing) setLoading(true);
      const [usersRes, leavesRes, flexRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/leaves`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/flexible-shifts`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const usersData = usersRes.data || [];
      setUsers(usersData);

      const leaves = leavesRes.data || [];
      const approvedLeaves = leaves.filter((l) => (l.status || "").toLowerCase() === "approved");
      setActiveLeaves(approvedLeaves);

      const flexRequests = flexRes.data || [];
      setFlexibleRequests(flexRequests);

      setStats([
        {
          title: "Total Employees",
          value: usersData.length,
          icon: <Users />,
          color: "from-blue-500 to-cyan-500",
          bgColor: "from-blue-500/20 to-cyan-500/20",
          textColor: "text-cyan-400",
          onClick: () => navigate("/directory"),
          trend: { value: "+2.1%", positive: true }
        },
        {
          title: "Active Leaves",
          value: approvedLeaves.length,
          icon: <Calendar />,
          color: "from-amber-500 to-orange-500",
          bgColor: "from-amber-500/20 to-orange-500/20",
          textColor: "text-amber-400",
          onClick: () => setShowLeavesModal(true),
          subtitle: "Currently away"
        },
        {
          title: "Pending Approvals",
          value: leaves.filter((l) => (l.status || "").toLowerCase() === "pending").length,
          subtitle: "Leave requests",
          icon: <AlertTriangle />,
          color: "from-red-500 to-pink-500",
          bgColor: "from-red-500/20 to-pink-500/20",
          textColor: "text-red-400",
          onClick: () => navigate("/admin/leaves"),
          urgent: true
        },
        {
          title: "Flexible Requests",
          value: flexRequests.filter((r) => (r.status || "").toLowerCase() === "pending").length,
          subtitle: "Shift changes",
          icon: <Clock />,
          color: "from-purple-500 to-violet-500",
          bgColor: "from-purple-500/20 to-violet-500/20",
          textColor: "text-purple-400",
          onClick: () => setShowFlexModal(true),
        },
      ]);

      setActivities(
        leaves
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
          .map((l) => ({
            title: `${l.employee?.name || l.employeeName || "Employee"} requested ${l.type} leave`,
            time: new Date(l.createdAt).toLocaleString(),
            icon: <Calendar size={16} />,
            bg:
              (l.status || "").toLowerCase() === "approved"
                ? "bg-green-500"
                : (l.status || "").toLowerCase() === "pending"
                ? "bg-yellow-500"
                : "bg-red-500",
          }))
      );
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount & refresh every 15s
  useEffect(() => {
    fetchDashboardData();
    const intervalId = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(intervalId);
  }, []);

  // Process birthdays & anniversaries
  useEffect(() => {
    if (!users.length) {
      setBirthdays([]);
      setAnniversaries([]);
      return;
    }

    const mappedBirthdays = users
      .map((u) => ({
        _id: u._id,
        name: u.name,
        role: u.designation || u.role,
        originalDob: u.dob || null,
        nextDate: getNextDate(u.dob),
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
      }))
      .filter((u) => u.nextDate)
      .sort((a, b) => a.nextDate - b.nextDate)
      .slice(0, 3);

    const mappedAnniversaries = users
      .map((u) => ({
        _id: u._id,
        name: u.name,
        designation: u.designation || u.role,
        originalDoj: u.doj || null,
        nextDate: getNextDate(u.doj),
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
      }))
      .filter((u) => u.nextDate)
      .sort((a, b) => a.nextDate - b.nextDate)
      .slice(0, 3);

    setBirthdays(mappedBirthdays);
    setAnniversaries(mappedAnniversaries);
  }, [users]);

  // Send wishes
  const handleSendWishes = async (selectedUsers, message, type) => {
    if (!selectedUsers.length || !message) return toast.warning("Select users and write a message");

    try {
      await Promise.all(
        selectedUsers.map((user) =>
          axios.post(
            `${API_BASE}/api/wishes`,
            { recipientId: user._id, type, message },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );
      toast.success(`Wishes sent to ${selectedUsers.map((u) => u.name).join(", ")}`);
    } catch (err) {
      console.error("Error sending wishes:", err.response?.data || err.message);
      toast.error("Failed to send wishes");
    }
  };

  return (
    <div className="flex bg-[#0f1419] min-h-screen text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-blue-900/10 to-purple-900/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="hr" onLogout={onLogout} />

      {/* Main Content */}
      <main className={`relative z-10 flex-1 transition-all duration-300 ${collapsed ? "ml-24" : "ml-72"} p-8`}>
        {/* Modern Header */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-2">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  HR Dashboard
                </span>
              </h1>
              <p className="text-xl text-gray-300 mb-4">
                Manage your workforce with intelligent insights 🚀
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 disabled:scale-100"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
              </button>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm text-gray-400">Live Time</p>
                    <p className="text-cyan-400 font-mono text-sm">
                      {currentTime.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-gray-400 text-lg">
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Enhanced Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, idx) => (
            <EnhancedStatCard key={idx} {...stat} />
          ))}
        </div>

        {/* Celebration Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Gift className="h-6 w-6 text-pink-400" />
                Upcoming Birthdays
              </h3>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105"
                onClick={() => {
                  setWishingType("birthday");
                  setShowWishingModal(true);
                }}
              >
                <Heart className="h-4 w-4" />
                Send Wishes
              </button>
            </div>
            <UpcomingBirthdays birthdays={birthdays} loading={loading} />
          </div>

          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Award className="h-6 w-6 text-amber-400" />
                Work Anniversaries
              </h3>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105"
                onClick={() => {
                  setWishingType("anniversary");
                  setShowWishingModal(true);
                }}
              >
                <Star className="h-4 w-4" />
                Celebrate
              </button>
            </div>
            <UpcomingAnniversaries anniversaries={anniversaries} loading={loading} />
          </div>
        </div>

        {/* Enhanced Recent Activities */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <Activity className="h-6 w-6 text-cyan-400" />
              Recent Activities
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Zap className="h-4 w-4" />
              Real-time updates
            </div>
          </div>
          <RecentActivities activities={activities} loading={loading} />
        </div>
      </main>

      {/* Modals */}
      <ActiveLeavesModal
        isOpen={showLeavesModal}
        onClose={() => setShowLeavesModal(false)}
        leaves={activeLeaves}
      />
      <WishingModal
        isOpen={showWishingModal}
        onClose={() => setShowWishingModal(false)}
        type={wishingType}
        birthdays={birthdays}
        anniversaries={anniversaries}
        onSend={handleSendWishes}
      />
      <FlexibleRequestsModal
        isOpen={showFlexModal}
        onClose={() => setShowFlexModal(false)}
        requests={flexibleRequests}
        refresh={fetchDashboardData} // ensures updated status reflects immediately
      />

      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Global Celebration Popup */}
      <CelebrationPopup
        celebrations={celebrations}
        isOpen={showCelebrationPopup}
        onClose={closeCelebrationPopup}
      />
    </div>
  );
};

// Enhanced Stat Card Component
const EnhancedStatCard = ({
  icon,
  title,
  value,
  subtitle,
  color,
  bgColor,
  textColor,
  onClick,
  trend,
  urgent
}) => (
  <div
    onClick={onClick}
    className={`bg-gradient-to-br ${bgColor} backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 relative overflow-hidden group hover:scale-105 transition-all duration-300 cursor-pointer ${urgent ? 'ring-2 ring-red-500/30 animate-pulse' : ''}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            <TrendingUp className={`h-3 w-3 ${trend.positive ? '' : 'rotate-180'}`} />
            {trend.value}
          </div>
        )}
        {urgent && (
          <div className="flex items-center gap-1 text-xs font-medium text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Urgent
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
        <p className="text-white font-bold text-3xl mb-1">{value}</p>
        {subtitle && <p className="text-gray-400 text-xs">{subtitle}</p>}
      </div>
    </div>
  </div>
);

export default HRDashboard;
