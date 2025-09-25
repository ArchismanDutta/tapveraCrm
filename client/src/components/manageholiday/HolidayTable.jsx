import React from "react";

const HolidayTable = ({ holidays, onDelete, onEdit }) => {
  return (
    <div className="overflow-x-auto rounded-lg shadow-lg bg-[#141a21] border border-[#232945]">
      <table className="min-w-full border-collapse text-blue-100">
        <thead className="bg-[#1f252e] border-b border-[#232945]">
          <tr>
            {["Name", "Date", "Type", "Shifts", "Recurring", "Optional", "Actions"].map(
              (col) => (
                <th key={col} className="p-4 text-left font-semibold text-white text-sm">
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
                className="border-b border-[#232945]/50 hover:bg-[#1f252e]/50 transition-colors"
              >
                <td className="p-4 text-sm">{holiday.name}</td>
                <td className="p-4 text-sm text-blue-300">
                  {new Date(holiday.date).toLocaleDateString()}
                </td>
                <td className="p-4 text-sm">{holiday.type}</td>
                <td className="p-4 text-sm text-blue-300">{holiday.shifts.join(", ")}</td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      holiday.recurring
                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                        : "bg-gray-600/20 text-gray-400 border border-gray-500/30"
                    }`}
                  >
                    {holiday.recurring ? "Yes" : "No"}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      holiday.optional
                        ? "bg-green-600/20 text-green-400 border border-green-500/30"
                        : "bg-gray-600/20 text-gray-400 border border-gray-500/30"
                    }`}
                  >
                    {holiday.optional ? "Yes" : "No"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(holiday)}
                      className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(holiday._id)}
                      className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 hover:border-red-500/50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center p-8 text-blue-300 italic">
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
