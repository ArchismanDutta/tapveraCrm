// src/components/dashboard/TodayTasks.jsx
import React from "react";
import PropTypes from "prop-types";

const TodayTasks = ({ tasks }) => (
  <div className="bg-white rounded-xl border p-6 shadow mb-6">
    <h2 className="text-lg font-semibold mb-4">Today's Tasks</h2>
    <ul className="space-y-3">
      {tasks.map(({ id, title, time, statusDot }) => (
        <li key={id} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${statusDot}`} aria-hidden="true" />
            <span>{title}</span>
          </div>
          <span className="text-sm text-gray-500">{time}</span>
        </li>
      ))}
    </ul>
  </div>
);

TodayTasks.propTypes = {
  tasks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      title: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
      statusDot: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default TodayTasks;
