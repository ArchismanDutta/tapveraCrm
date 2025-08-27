import React, { useState, useEffect } from "react";
import axios from "axios";
import { Users, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import StatCard from "../components/humanResource/StatCard";
import UpcomingBirthdays from "../components/humanResource/UpcomingBirthdays";
import UpcomingAnniversaries from "../components/humanResource/UpcomingAnniversaries";
import RecentActivities from "../components/humanResource/RecentActivities";
const SIDEBAR_WIDTH_EXPANDED = 288; // w-72
const SIDEBAR_WIDTH_COLLAPSED = 80; // w-20
const HRDashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState([
    {
      title: "Total Employees",
      value: "--",
      subtitle: "",
      icon: <Users />,
      color: "bg-blue-500",
    },
    {
      title: "Active Leaves",
      value: "--",
      subtitle: "",
      icon: <Calendar />,
      color: "bg-orange-500",
    },
    {
      title: "Attendance Rate",
      value: "--",
      subtitle: "",
      icon: <CheckCircle />,
      color: "bg-green-500",
    },
    {
      title: "Pending Approvals",
      value: "--",
      subtitle: "Requires attention",
      icon: <AlertTriangle />,
      color: "bg-red-500",
    },
  ]);
  const [users, setUsers] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [activities, setActivities] = useState([]);
  const token = localStorage.getItem("token");
  // Helper: get next occurrence of a date ignoring year
  const getNextDate = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    const date = new Date(dateString);
    let nextDate = new Date(
      today.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    if (nextDate < today) {
      nextDate.setFullYear(today.getFullYear() + 1);
    }
    return nextDate;
  };
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Load all necessary data in parallel
        const [usersRes, leavesRes, attRes, activitiesRes] = await Promise.all([
          axios.get("/api/users", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/leaves", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/summary/week", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/activities", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const usersData = usersRes.data || [];
        setUsers(usersData);
        // Stats calculation
        const activeLeavesCount = (leavesRes.data || []).filter(
          (l) => l.status === "Approved"
        ).length;
        const pendingApprovalsCount = (leavesRes.data || []).filter(
          (l) => l.status === "Pending"
        ).length;
        setStats([
          {
            title: "Total Employees",
            value: usersData.length,
            subtitle: "+5.2% from last month",
            icon: <Users />,
            color: "bg-blue-500",
          },
          {
            title: "Active Leaves",
            value: activeLeavesCount,
            subtitle: `+${activeLeavesCount - 20 || 0} from yesterday`,
            icon: <Calendar />,
            color: "bg-orange-500",
          },
          {
            title: "Attendance Rate",
            value: attRes?.data?.weeklySummary?.onTimeRate || "--",
            subtitle: `+${
              attRes?.data?.weeklySummary?.change || "0"
            } this week`,
            icon: <CheckCircle />,
            color: "bg-green-500",
          },
          {
            title: "Pending Approvals",
            value: pendingApprovalsCount,
            subtitle: "Requires attention",
            icon: <AlertTriangle />,
            color: "bg-red-500",
          },
        ]);
        // Activities
        setActivities(activitiesRes.data || []);
        // Prepare upcoming birthdays and anniversaries: sort all by next occurrence and pick nearest 3
        // Birthdays
        const upcomingBdays = usersData
          .map((user) => ({
            ...user,
            nextDate: getNextDate(user.dob),
          }))
          .filter((u) => u.nextDate !== null)
          .sort((a, b) => a.nextDate - b.nextDate)
          .slice(0, 3)
          .map((u) => ({
            name: u.name,
            role: u.designation || u.role,
            date: u.nextDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
            avatar:
              u.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
          }));
        setBirthdays(upcomingBdays);
        // Anniversaries (doj)
        const upcomingAnni = usersData
          .map((user) => ({
            ...user,
            nextDate: getNextDate(user.doj),
          }))
          .filter((u) => u.nextDate !== null)
          .sort((a, b) => a.nextDate - b.nextDate)
          .slice(0, 3)
          .map((u) => ({
            name: u.name,
            designation: u.designation || u.role,
            date: u.nextDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
          }));
        setAnniversaries(upcomingAnni);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      }
    };
    fetchDashboardData();
  }, [token]);
  return (
    <div className="bg-[#101525] text-gray-100 min-h-screen flex">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="hr"
        onLogout={onLogout}
      />
      <main
        className="flex-1 p-6 space-y-6 overflow-auto transition-all duration-300"
        style={{
          marginLeft: collapsed
            ? SIDEBAR_WIDTH_COLLAPSED
            : SIDEBAR_WIDTH_EXPANDED,
          minHeight: "100vh",
        }}
      >
        {/* Top stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((s, idx) => (
            <StatCard key={idx} {...s} />
          ))}
        </div>
        {/* Middle section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <UpcomingBirthdays birthdays={birthdays} />
          <UpcomingAnniversaries anniversaries={anniversaries} />
        </div>
        {/* Recent activities */}
        <RecentActivities activities={activities} />
      </main>
    </div>
  );
};
export default HRDashboard;
