import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import axios from "axios";

const HolidayList = ({ shift = "ALL" }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch holidays from backend
  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/holidays?shift=${shift}`);
      const data = res.data.map((h) => ({
        name: h.name,
        date: new Date(h.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        type: h.type,
      }));
      setHolidays(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch holidays:", err);
      setError("Failed to load holidays");
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [shift]);

  return (
    <div
      className="bg-[rgba(22,28,48,0.68)] border border-[rgba(84,123,209,0.13)] rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(10,40,100,0.14),_inset_0_1.5px_10px_0_rgba(84,123,209,0.08)] backdrop-blur-[10px]"
    >
      <h3 className="text-xl font-semibold mb-5 text-blue-100">Holidays This Month</h3>

      {loading ? (
        <p className="text-blue-100">Loading holidays...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : holidays.length > 0 ? (
        <ul className="space-y-3">
          {holidays.map((h, i) => (
            <li
              key={i}
              className="flex items-center gap-3 p-4 border rounded-xl hover:bg-[rgba(36,44,92,0.2)] transition shadow-sm hover:shadow-md text-blue-100"
            >
              <div className="p-2 rounded-lg bg-[#262e4a] text-[#ff8000]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-sm text-blue-300">
                  {h.date} • {h.type}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-blue-300">No holidays available.</p>
      )}
    </div>
  );
};

export default HolidayList;
