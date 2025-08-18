import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { fetchTeamLeaves } from "../../api/leaveApi";

const TeamLeaveCalendar = () => {
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeamLeaves()
      .then(setTeamLeaves)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading team leaves...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="bg-white backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-5 text-gray-800">Team Leave Calendar</h3>
      {teamLeaves.length === 0 ? (
        <p className="text-gray-500 text-sm">No team leaves.</p>
      ) : (
        <ul className="space-y-4">
          {teamLeaves.map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-4 rounded-lg hover:bg-gray-50 transition shadow-sm border hover:shadow-md"
            >
              <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{t.name}</p>
                <p className="text-sm text-gray-500">
                  {t.dates} • {t.type}
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
