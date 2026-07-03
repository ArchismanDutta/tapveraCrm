import React, { useEffect, useState } from "react";
import { Clock3, Users } from "lucide-react";
import { fetchTeamLeaves, formatDuration, formatLeaveType } from "../../api/leaveApi";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const TeamLeaveCalendar = () => {
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserAndLeaves = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE}/api/users/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const leaves = await fetchTeamLeaves(response.data.department, response.data.email);
        setTeamLeaves(Array.isArray(leaves) ? leaves : []);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Failed to load team leave");
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndLeaves();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300"><Users className="h-4 w-4" /></div>
        <div><h3 className="text-base font-semibold text-slate-950 dark:text-white">Team leave</h3><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Approved leave within your department</p></div>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.05]" />)}</div>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>
      ) : teamLeaves.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No team leave is currently scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {teamLeaves.slice(0, 6).map((leave) => (
            <li key={leave._id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300"><Clock3 className="h-4 w-4" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-950 dark:text-white">{leave.employee?.name || "Team member"}</p><p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{leave.period?.start ? new Date(leave.period.start).toLocaleDateString() : "Unknown date"}{leave.period?.end && leave.period.end !== leave.period.start ? ` – ${new Date(leave.period.end).toLocaleDateString()}` : ""} · {formatLeaveType(leave.type)} · {formatDuration(leave.type, leave.period)}</p></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TeamLeaveCalendar;
