import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  fetchTeamLeaves,
  formatLeaveType,
  formatDuration,
} from "../../api/leaveApi";
import axios from "axios";

const TeamLeaveCalendar = () => {
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  useEffect(() => {
    const fetchUserAndLeaves = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        // Get current logged-in user
        const meRes = await axios.get(`${API_BASE}/api/users/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setUser(meRes.data);

        // Fetch team leaves for the user's department, excluding self
        const leaves = await fetchTeamLeaves(
          meRes.data.department,
          meRes.data.email
        );
        setTeamLeaves(leaves);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndLeaves();
  }, []);

  if (loading)
    return (
      <div className="p-6 text-blue-100 flex justify-center items-center">
        Loading team leaves...
      </div>
    );
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="bg-[rgba(22,28,48,0.68)] border border-[rgba(84,123,209,0.13)] rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(10,40,100,0.14),_inset_0_1.5px_10px_0_rgba(84,123,209,0.08)] backdrop-blur-[10px]">
      <h3 className="text-xl font-semibold mb-5 text-blue-100">
        Team Leave Calendar
      </h3>
      {teamLeaves.length === 0 ? (
        <p className="text-blue-300 text-sm">
          No team leaves from your department.
        </p>
      ) : (
        <ul className="space-y-4">
          {teamLeaves.map((t) => (
            <li
              key={t._id}
              className="flex items-start gap-3 p-4 rounded-xl hover:bg-[rgba(36,44,92,0.2)] transition shadow-sm border border-[rgba(84,123,209,0.13)] hover:shadow-md text-blue-100"
            >
              <div className="p-2 rounded-lg bg-[#262e4a] text-[#ff8000]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">
                  {t.employee?.name || "Unknown Employee"}
                </p>
                <p className="text-sm text-blue-300">
                  {t.period?.start
                    ? new Date(t.period.start).toLocaleDateString()
                    : "Unknown"}{" "}
                  {t.period?.end && t.period.end !== t.period.start
                    ? ` - ${new Date(t.period.end).toLocaleDateString()}`
                    : ""}{" "}
                  • {formatLeaveType(t.type)} •{" "}
                  {formatDuration(t.type, t.period)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TeamLeaveCalendar;
