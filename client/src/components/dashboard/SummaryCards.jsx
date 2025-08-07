// src/components/dashboard/SummaryCards.jsx
import React from "react";
import PropTypes from "prop-types";

const SummaryCards = ({ summary }) => {
  return (
    <>
      <Card title="Tasks Due Today" value={summary.tasksDue} color="bg-blue-50" />
      <Card title="Pending Reports" value={summary.pendingReports} color="bg-green-50" />
      <Card title="Unread Messages" value={summary.unreadMsgs} color="bg-indigo-50" />
      <Card title="Open Issues" value={summary.openIssues} color="bg-red-50" />
    </>
  );
};

const Card = ({ title, value, color }) => (
  <div className={`${color} p-5 rounded-xl shadow-sm text-center`}>
    <p className="text-2xl font-bold mb-1">{value}</p>
    <p className="text-gray-600">{title}</p>
  </div>
);

SummaryCards.propTypes = {
  summary: PropTypes.shape({
    tasksDue: PropTypes.number.isRequired,
    pendingReports: PropTypes.number.isRequired,
    unreadMsgs: PropTypes.number.isRequired,
    openIssues: PropTypes.number.isRequired,
  }).isRequired,
};

Card.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
};

export default SummaryCards;
