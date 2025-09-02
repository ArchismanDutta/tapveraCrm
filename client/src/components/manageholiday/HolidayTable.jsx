import React from "react";

const HolidayTable = ({ holidays, onDelete }) => {
  return (
    <table className="w-full border-collapse border border-gray-300 mt-6">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-2">Name</th>
          <th className="border p-2">Date</th>
          <th className="border p-2">Type</th>
          <th className="border p-2">Shifts</th>
          <th className="border p-2">Recurring</th>
          <th className="border p-2">Optional</th>
          <th className="border p-2">Action</th>
        </tr>
      </thead>
      <tbody>
        {holidays.map((holiday) => (
          <tr key={holiday._id}>
            <td className="border p-2">{holiday.name}</td>
            <td className="border p-2">
              {new Date(holiday.date).toLocaleDateString()}
            </td>
            <td className="border p-2">{holiday.type}</td>
            <td className="border p-2">{holiday.shifts.join(", ")}</td>
            <td className="border p-2">{holiday.recurring ? "Yes" : "No"}</td>
            <td className="border p-2">{holiday.optional ? "Yes" : "No"}</td>
            <td className="border p-2">
              <button
                onClick={() => onDelete(holiday._id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
        {holidays.length === 0 && (
          <tr>
            <td colSpan="7" className="text-center p-4 text-gray-500">
              No holidays found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default HolidayTable;
