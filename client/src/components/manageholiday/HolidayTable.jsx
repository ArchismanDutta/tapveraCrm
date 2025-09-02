import React from "react";

const HolidayTable = ({ holidays, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-xl shadow-lg bg-[#1b2439]">
      <table className="min-w-full border-collapse text-white">
        <thead className="bg-gradient-to-r from-[#485fc7] to-[#58a6ff]">
          <tr>
            {["Name", "Date", "Type", "Shifts", "Recurring", "Optional", "Action"].map(
              (col) => (
                <th key={col} className="p-3 text-left font-semibold">
                  {col}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {holidays.length > 0 ? (
            holidays.map((holiday) => (
              <tr
                key={holiday._id}
                className="even:bg-[#223157] hover:bg-[#242e47]/80 transition-colors"
              >
                <td className="p-3">{holiday.name}</td>
                <td className="p-3">
                  {new Date(holiday.date).toLocaleDateString()}
                </td>
                <td className="p-3">{holiday.type}</td>
                <td className="p-3">{holiday.shifts.join(", ")}</td>
                <td className="p-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      holiday.recurring
                        ? "bg-[#82aaff] text-[#19233b]"
                        : "bg-gray-600 text-white"
                    }`}
                  >
                    {holiday.recurring ? "Yes" : "No"}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      holiday.optional
                        ? "bg-[#58e1c6] text-[#132a2f]"
                        : "bg-gray-600 text-white"
                    }`}
                  >
                    {holiday.optional ? "Yes" : "No"}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => onDelete(holiday._id)}
                    className="bg-[#ff6384] hover:bg-[#e0486c] text-white px-4 py-1 rounded-full shadow transition-colors font-semibold"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center p-6 text-[#58a6ff] italic">
                No holidays found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HolidayTable;
