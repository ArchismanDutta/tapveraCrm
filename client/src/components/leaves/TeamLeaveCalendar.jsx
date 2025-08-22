import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import axios from "axios";

const TeamLeaveCalendar = () => {
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeamLeaves = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        const res = await axios.get("/api/leaves/team", {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        setTeamLeaves(res.data); // backend already filters by department
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamLeaves();
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
