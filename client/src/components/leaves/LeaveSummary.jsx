// src/components/leaves/LeaveSummary.jsx
import React from "react";
import { Calendar, Clock, Hourglass } from "lucide-react";

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-gradient-to-tr from-white to-gray-50 shadow-md hover:shadow-xl transition hover:-translate-y-1 border border-gray-100">
    <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600 mb-3`}>
      <Icon className="h-6 w-6" />
    </div>
    <p className="text-2xl font-bold text-gray-800">{value}</p>
    <p className="text-sm text-gray-500">{label}</p>
  </div>
);

const LeaveSummary = ({ available, taken, pending }) => {
  return (
    <div className="bg-white backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Leave Overview</h2>
      <div className="grid grid-cols-3 gap-6">
        <StatCard icon={Calendar} value={available} label="Available" color="green" />
        <StatCard icon={Clock} value={taken} label="Taken" color="blue" />
        <StatCard icon={Hourglass} value={pending} label="Pending" color="yellow" />
      </div>
    </div>
  );
};

export default LeaveSummary;
