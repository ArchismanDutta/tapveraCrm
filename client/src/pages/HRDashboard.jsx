import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  Calendar,
  Cake,
  Clock,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Sidebar from "../components/dashboard/Sidebar";
import UpcomingBirthdays from "../components/humanResource/UpcomingBirthdays";
import UpcomingAnniversaries from "../components/humanResource/UpcomingAnniversaries";
import RecentActivities from "../components/humanResource/RecentActivities";
import ActiveLeavesModal from "../components/humanResource/ActiveLeavesModal";
import WishingModal from "../components/humanResource/WishingModal";
import FlexibleRequestsModal from "../components/humanResource/FlexibleRequestsModal";
import CelebrationPopup from "../components/common/CelebrationPopup";
import useCelebrationNotifications from "../hooks/useCelebrationNotifications";
import { useTheme } from "../contexts/ThemeContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const getNextOccurrence = (value) => {
  if (!value) return null;
  const source = new Date(value);
  if (Number.isNaN(source.getTime())) return null;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const next = new Date(
    startOfToday.getFullYear(),
    source.getMonth(),
    source.getDate(),
  );

  if (next < startOfToday) next.setFullYear(next.getFullYear() + 1);
  return next;
};

const getLeaveStart = (leave) =>
  leave.period?.start || leave.startDate || leave.fromDate;
const getLeaveEnd = (leave) =>
  leave.period?.end || leave.endDate || leave.toDate || getLeaveStart(leave);

const isLeaveActiveToday = (leave) => {
  if (String(leave.status || "").toLowerCase() !== "approved") return false;

  const start = new Date(getLeaveStart(leave));
  const end = new Date(getLeaveEnd(leave));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return start <= todayEnd && end >= todayStart;
};

const TONE_STYLES = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  violet:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
};

const MetricCard = ({ icon, label, value, helper, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-[#10131c] dark:hover:border-white/20"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      </div>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${TONE_STYLES[tone]}`}
      >
        {React.createElement(icon, { className: "h-4 w-4" })}
      </span>
    </div>
  </button>
);

const QueueItem = ({ icon, title, description, count, tone, actionLabel, onClick }) => (
  <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center">
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${TONE_STYLES[tone]}`}
    >
      {React.createElement(icon, { className: "h-4 w-4" })}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
          {count}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-blue-400/20 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
    >
      {actionLabel}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

const HRDashboard = ({ onLogout }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [flexibleRequests, setFlexibleRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showLeavesModal, setShowLeavesModal] = useState(false);
  const [showWishingModal, setShowWishingModal] = useState(false);
  const [wishingType, setWishingType] = useState("birthday");
  const [showFlexModal, setShowFlexModal] = useState(false);

  const {
    celebrations,
    showPopup: showCelebrationPopup,
    closePopup: closeCelebrationPopup,
  } = useCelebrationNotifications();

  const fetchDashboardData = useCallback(
    async ({ background = false } = {}) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login", { replace: true });
          return false;
        }

        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [usersResponse, leavesResponse, flexibleResponse] =
          await Promise.all([
            axios.get(`${API_BASE}/api/users`, config),
            axios.get(`${API_BASE}/api/leaves`, config),
            axios.get(`${API_BASE}/api/flexible-shifts`, config),
          ]);

        const usersData = Array.isArray(usersResponse.data)
          ? usersResponse.data
          : usersResponse.data?.data;
        const leavesData = Array.isArray(leavesResponse.data)
          ? leavesResponse.data
          : leavesResponse.data?.data;
        const flexibleData = Array.isArray(flexibleResponse.data)
          ? flexibleResponse.data
          : flexibleResponse.data?.data;

        setUsers(Array.isArray(usersData) ? usersData : []);
        setLeaves(Array.isArray(leavesData) ? leavesData : []);
        setFlexibleRequests(Array.isArray(flexibleData) ? flexibleData : []);
        setLastUpdated(new Date());
        return true;
      } catch (requestError) {
        console.error("Unable to load HR dashboard:", requestError);
        setError(
          requestError.response?.data?.message ||
            "HR dashboard data could not be loaded. Please try again.",
        );
        return false;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    fetchDashboardData();
    const refreshTimer = window.setInterval(
      () => fetchDashboardData({ background: true }),
      60000,
    );
    return () => window.clearInterval(refreshTimer);
  }, [fetchDashboardData]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const workforceUsers = useMemo(
    () =>
      users.filter((user) =>
        ["employee", "admin", "hr"].includes(
          String(user.role || "").toLowerCase(),
        ),
      ),
    [users],
  );

  const pendingLeaves = useMemo(
    () =>
      leaves.filter(
        (leave) => String(leave.status || "").toLowerCase() === "pending",
      ),
    [leaves],
  );

  const activeLeaves = useMemo(
    () => leaves.filter(isLeaveActiveToday),
    [leaves],
  );

  const pendingFlexibleRequests = useMemo(
    () =>
      flexibleRequests.filter(
        (request) =>
          String(request.status || "").toLowerCase() === "pending",
      ),
    [flexibleRequests],
  );

  const birthdays = useMemo(
    () =>
      workforceUsers
        .map((user) => ({
          _id: user._id,
          name: user.name || "Unknown employee",
          role: user.designation || user.role || "Employee",
          originalDob: user.dob,
          nextDate: getNextOccurrence(user.dob),
          avatar: user.avatar,
        }))
        .filter((user) => user.nextDate)
        .sort((left, right) => left.nextDate - right.nextDate)
        .slice(0, 4),
    [workforceUsers],
  );

  const anniversaries = useMemo(
    () =>
      workforceUsers
        .map((user) => ({
          _id: user._id,
          name: user.name || "Unknown employee",
          designation: user.designation || user.role || "Employee",
          originalDoj: user.doj,
          nextDate: getNextOccurrence(user.doj),
          avatar: user.avatar,
        }))
        .filter((user) => user.nextDate)
        .sort((left, right) => left.nextDate - right.nextDate)
        .slice(0, 4),
    [workforceUsers],
  );

  const recentActivities = useMemo(
    () =>
      [...leaves]
        .filter((leave) => leave.createdAt)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 6)
        .map((leave) => ({
          id: leave._id,
          title: `${
            leave.employee?.name || leave.employeeName || "An employee"
          } requested ${leave.type || "time off"}`,
          time: new Date(leave.createdAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: String(leave.status || "pending").toLowerCase(),
        })),
    [leaves],
  );

  const handleRefresh = async () => {
    const refreshed = await fetchDashboardData({ background: true });
    if (refreshed) toast.success("HR dashboard refreshed");
  };

  const handleSendWishes = async (selectedUsers, message, type) => {
    const token = localStorage.getItem("token");
    await Promise.all(
      selectedUsers.map((user) =>
        axios.post(
          `${API_BASE}/api/wishes`,
          {
            recipientId: user._id,
            type,
            message: message.replaceAll("[name]", user.name),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ),
    );
    toast.success(
      `Wish${selectedUsers.length === 1 ? "" : "es"} sent successfully`,
    );
  };

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="hr"
        onLogout={onLogout}
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
                  <Users className="h-3.5 w-3.5" />
                  People operations
                </div>
                {/* The "HR workspace" heading was removed — the "People
                    operations" eyebrow above already names the section, so the
                    two were saying the same thing twice. The description keeps
                    its top margin off the eyebrow instead. */}
                <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  Review employee requests, see who is away, and keep important people moments visible.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 lg:px-5">
              <span>
                {currentTime.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span>
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Preparing today’s overview"}
              </span>
            </div>
          </section>

          {error && (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => fetchDashboardData()}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold dark:border-rose-400/20 dark:bg-transparent"
              >
                Try again
              </button>
            </div>
          )}

          <section
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="HR summary"
          >
            <MetricCard
              icon={Users}
              label="Team members"
              value={loading ? "—" : workforceUsers.length}
              helper="Active workforce"
              tone="blue"
              onClick={() => navigate("/directory")}
            />
            <MetricCard
              icon={AlertCircle}
              label="Pending leave"
              value={loading ? "—" : pendingLeaves.length}
              helper="Awaiting review"
              tone="rose"
              onClick={() => navigate("/admin/leaves")}
            />
            <MetricCard
              icon={Calendar}
              label="Away today"
              value={loading ? "—" : activeLeaves.length}
              helper="Approved active leave"
              tone="amber"
              onClick={() => setShowLeavesModal(true)}
            />
            <MetricCard
              icon={Clock}
              label="Flexible shifts"
              value={loading ? "—" : pendingFlexibleRequests.length}
              helper="Pending requests"
              tone="violet"
              onClick={() => setShowFlexModal(true)}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                Action queue
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The HR items most likely to need attention today.
              </p>
            </div>
            <div className="mt-4 space-y-3">
              <QueueItem
                icon={AlertCircle}
                title="Leave approvals"
                description="Review pending time-off requests and employee notes."
                count={pendingLeaves.length}
                tone="rose"
                actionLabel="Review"
                onClick={() => navigate("/admin/leaves")}
              />
              <QueueItem
                icon={Clock}
                title="Flexible-shift requests"
                description="Approve or reject requested schedule adjustments."
                count={pendingFlexibleRequests.length}
                tone="violet"
                actionLabel="Open"
                onClick={() => setShowFlexModal(true)}
              />
              <QueueItem
                icon={Calendar}
                title="Employees away today"
                description="Check the approved leave affecting today's availability."
                count={activeLeaves.length}
                tone="amber"
                actionLabel="View"
                onClick={() => setShowLeavesModal(true)}
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                    <Cake className="h-4 w-4 text-pink-500" />
                    Upcoming birthdays
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    The next team birthdays on the calendar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWishingType("birthday");
                    setShowWishingModal(true);
                  }}
                  disabled={birthdays.length === 0}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-3 text-xs font-semibold text-pink-700 transition hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-pink-400/20 dark:bg-pink-400/10 dark:text-pink-200 dark:hover:bg-pink-400/15"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send wish
                </button>
              </div>
              <div className="mt-4">
                <UpcomingBirthdays birthdays={birthdays} loading={loading} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                    <Award className="h-4 w-4 text-amber-500" />
                    Work anniversaries
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Recognise upcoming employee milestones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWishingType("anniversary");
                    setShowWishingModal(true);
                  }}
                  disabled={anniversaries.length === 0}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/15"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send wish
                </button>
              </div>
              <div className="mt-4">
                <UpcomingAnniversaries
                  anniversaries={anniversaries}
                  loading={loading}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              Recent leave activity
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              The latest time-off requests received by HR.
            </p>
            <div className="mt-4">
              <RecentActivities activities={recentActivities} loading={loading} />
            </div>
          </section>
        </div>
      </main>

      <ActiveLeavesModal
        isOpen={showLeavesModal}
        onClose={() => setShowLeavesModal(false)}
        leaves={activeLeaves}
      />
      <WishingModal
        isOpen={showWishingModal}
        onClose={() => setShowWishingModal(false)}
        defaultType={wishingType}
        birthdays={birthdays}
        anniversaries={anniversaries}
        onSend={handleSendWishes}
      />
      <FlexibleRequestsModal
        isOpen={showFlexModal}
        onClose={() => setShowFlexModal(false)}
        requests={flexibleRequests}
        refresh={() => fetchDashboardData({ background: true })}
      />

      <ToastContainer position="top-right" autoClose={3000} theme={theme} />
      <CelebrationPopup
        celebrations={celebrations}
        isOpen={showCelebrationPopup}
        onClose={closeCelebrationPopup}
      />
    </div>
  );
};

export default HRDashboard;
