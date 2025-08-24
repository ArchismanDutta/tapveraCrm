import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { fetchTeamLeaves } from "../../api/leaveApi"; // make sure path is correct
import axios from "axios";

const TeamLeaveCalendar = () => {
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUserAndLeaves = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        // Get current logged-in user
        const meRes = await axios.get("/api/users/me", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setUser(meRes.data);

        // Fetch team leaves for the user's department, excluding self
        const leaves = await fetchTeamLeaves(meRes.data.department, meRes.data.email);
        setTeamLeaves(leaves);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndLeaves();
  }, []);

  if (loading) return <div className="p-6">Loading team leaves...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="bg-white backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-5 text-gray-800">Team Leave Calendar</h3>
      {teamLeaves.length === 0 ? (
        <p className="text-gray-500 text-sm">No team leaves from your department.</p>
      ) : (
        <ul className="space-y-4">
          {teamLeaves.map((t) => (
            <li
              key={t._id}
              className="flex items-start gap-3 p-4 rounded-lg hover:bg-gray-50 transition shadow-sm border hover:shadow-md"
            >
              <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  {t.employee?.name || "Unknown Employee"}
                </p>
                <p className="text-sm text-gray-500">
                  {t.period?.start
                    ? new Date(t.period.start).toLocaleDateString()
                    : "Unknown"}{" "}
                  {t.period?.end && t.period.end !== t.period.start
                    ? ` - ${new Date(t.period.end).toLocaleDateString()}`
                    : ""}{" "}
                  • {t.type || "Unknown Type"}
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
