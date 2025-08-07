// src/components/dashboard/RecentReports.jsx
import React from "react";
import PropTypes from "prop-types";

const RecentReports = ({ reports }) => (
  <div className="bg-white rounded-xl border p-6 shadow">
    <h2 className="text-lg font-semibold mb-4">Recent Reports</h2>
    <ul className="space-y-3">
      {reports.map(({ id, title, date, status }) => (
        <li key={id} className="flex justify-between items-center">
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-gray-500">{date}</p>
          </div>
          <span className="text-sm text-blue-600">{status}</span>
        </li>
      ))}
    </ul>
  </div>
);

RecentReports.propTypes = {
  reports: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      title: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default RecentReports;
