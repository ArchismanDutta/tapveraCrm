// src/components/leaves/HolidayList.jsx
import React from "react";
import { Calendar } from "lucide-react";

const HolidayList = ({ holidays = [] }) => {
  return (
    <div className="bg-white backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-5 text-gray-800">
        Holidays This Month
      </h3>

      {holidays.length > 0 ? (
        <ul className="space-y-3">
          {holidays.map((h, i) => (
            <li
              key={i}
              className="flex items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 transition shadow-sm hover:shadow-md"
            >
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{h.name}</p>
                <p className="text-sm text-gray-500">
                  {h.date} • {h.type}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No holidays available.</p>
      )}
    </div>
  );
};

export default HolidayList;
