// File: src/pages/HRDashboard.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Users, Calendar, AlertTriangle } from "lucide-react";
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

const SIDEBAR_WIDTH_EXPANDED = 288;
const SIDEBAR_WIDTH_COLLAPSED = 80;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const HRDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeLeaves, setActiveLeaves] = useState([]);
  const [showLeavesModal, setShowLeavesModal] = useState(false);
  const [showWishingModal, setShowWishingModal] = useState(false);

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const getNextDate = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    const date = new Date(dateString);
    if (isNaN(date)) return null;

    let nextDate = new Date(today.getFullYear(), date.getMonth(), date.getDate());
    if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
    return nextDate;
  };

  const fetchDashboardData = async () => {
    try {
      const [usersRes, leavesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/leaves`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const usersData = usersRes.data || [];
      setUsers(usersData);

      const leaves = leavesRes.data || [];
      setActiveLeaves(leaves.filter((l) => l.status === "Approved"));

      const activeLeavesCount = leaves.filter((l) => l.status === "Approved").length;
      const pendingApprovalsCount = leaves.filter((l) => l.status === "Pending").length;

      setStats([
        {
          title: "Total Employees",
          value: usersData.length,
          subtitle: "",
          icon: <Users />,
          color: "bg-blue-500",
          onClick: () => navigate("/directory"),
        },
        {
          title: "Active Leaves",
          value: activeLeavesCount,
          subtitle: "",
          icon: <Calendar />,
          color: "bg-orange-500",
          onClick: () => setShowLeavesModal(true),
        },
        {
          title: "Pending Approvals",
          value: pendingApprovalsCount,
          subtitle: "Requires attention",
          icon: <AlertTriangle />,
          color: "bg-red-500",
          onClick: () => navigate("/leaves"),
        },
      ]);

      const recentActs = leaves
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((l) => ({
          title: `${l.employee.name} requested ${l.type} leave`,
          time: new Date(l.createdAt).toLocaleString(),
          icon: <Calendar size={16} />,
          bg:
            l.status === "Approved"
              ? "bg-green-500"
              : l.status === "Pending"
              ? "bg-yellow-500"
              : "bg-red-500",
        }));
      setActivities(recentActs);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      toast.error("Failed to load dashboard data");
    }
  };

  useEffect(() => {
    if (!token) return navigate("/login");
    fetchDashboardData();
    const intervalId = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    if (!users.length) return;

    const upcomingBdays = users
      .map((u) => ({ ...u, nextDate: getNextDate(u.dob) }))
      .filter((u) => u.nextDate)
      .sort((a, b) => a.nextDate - b.nextDate)
      .slice(0, 3)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        role: u.designation || u.role,
        dob: u.nextDate,
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
      }));

    const upcomingAnni = users
      .map((u) => ({ ...u, nextDate: getNextDate(u.doj) }))
      .filter((u) => u.nextDate)
      .sort((a, b) => a.nextDate - b.nextDate)
      .slice(0, 3)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        designation: u.designation || u.role,
        doj: u.nextDate,
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
      }));

    setBirthdays(upcomingBdays);
    setAnniversaries(upcomingAnni);
  }, [users]);

  const handleSendWishes = async (selectedUsers, message, type) => {
    if (!selectedUsers.length || !message)
      return toast.warning("Select users and write a message");

    try {
      const promises = selectedUsers.map((user) =>
        axios.post(
          `${API_BASE}/api/wishes`,
          { recipientId: user._id, type, message },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      await Promise.all(promises);
      toast.success(`Wishes sent to ${selectedUsers.map((u) => u.name).join(", ")}`);
    } catch (err) {
      console.error("Error sending wishes:", err.response?.data || err.message);
      toast.error("Failed to send wishes");
    }
  };

  return (
    <div className="bg-[#101525] text-gray-100 min-h-screen flex">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="hr" onLogout={onLogout} />

      <main
        className="flex-1 p-6 space-y-6 overflow-auto transition-all duration-300"
        style={{ marginLeft: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((s, idx) => (
            <StatCard key={idx} {...s} />
          ))}
        </div>

        {/* Birthdays & Anniversaries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Birthdays */}
          <div className="bg-[#1a1f36] p-4 rounded shadow">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Upcoming Birthdays</h3>
              <button
                className="px-3 py-1 bg-blue-600/70 hover:bg-blue-300 text-gray rounded text-sm font-medium transition-colors"
                onClick={() => setShowWishingModal(true)}
              >
                Send Wishes
              </button>
            </div>
            <UpcomingBirthdays birthdays={birthdays} />
          </div>

          {/* Anniversaries */}
          <div className="bg-[#1a1f36] p-4 rounded shadow">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Upcoming Anniversaries</h3>
              <button
                className="px-3 py-1 bg-blue-600/70 hover:bg-blue-300 text-gray rounded text-sm font-medium transition-colors"
                onClick={() => setShowWishingModal(true)}
              >
                Send Wishes
              </button>
            </div>
            <UpcomingAnniversaries anniversaries={anniversaries} />
          </div>
        </div>

        {/* Recent Activities */}
        <RecentActivities activities={activities} />
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
        birthdays={birthdays}
        anniversaries={anniversaries}
        onSend={handleSendWishes}
      />

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
};

export default HRDashboard;
