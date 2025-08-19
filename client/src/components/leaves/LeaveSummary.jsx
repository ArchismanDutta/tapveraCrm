import React, { useState } from "react";
import { Calendar, Clock, Hourglass } from "lucide-react";
import ImportantNoticeModal from "./ImportantNoticeModal";

// Map color names to Tailwind classes
const colorMap = {
  green: { bg: "bg-green-100", text: "text-green-600" },
  blue: { bg: "bg-blue-100", text: "text-blue-600" },
  yellow: { bg: "bg-yellow-100", text: "text-yellow-600" },
};

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-gradient-to-tr from-white to-gray-50 shadow-md hover:shadow-xl transition hover:-translate-y-1 border border-gray-100">
    <div className={`p-3 rounded-full ${colorMap[color].bg} ${colorMap[color].text} mb-3`}>
      <Icon className="h-6 w-6" />
    </div>
    <p className="text-2xl font-bold text-gray-800">{value}</p>
    <p className="text-sm text-gray-500">{label}</p>
  </div>
);

const LeaveSummary = ({ available, taken, pending, importantNotices = [] }) => {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <div className="bg-white backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-6 relative">
      {/* Header with button */}
      <div className="flex justify-between items-center mb-5 relative">
        <h2 className="text-xl font-semibold text-gray-800">Leave Overview</h2>

        <div className="relative">
          <button
            onClick={() => setShowPopover(true)}
            className="bg-yellow-200 border-2 border-orange-500 text-black text-sm font-medium px-3 py-1 rounded-lg shadow hover:bg-orange-500 hover:text-white transition"
          >
            Important Leave Update
          </button>

          {showPopover && (
            <ImportantNoticeModal
              notices={importantNotices}
              onClose={() => setShowPopover(false)}
            />
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard icon={Calendar} value={available} label="Available" color="green" />
        <StatCard icon={Clock} value={taken} label="Taken" color="blue" />
        <StatCard icon={Hourglass} value={pending} label="Pending" color="yellow" />
      </div>
    </div>
  );
};

export default LeaveSummary;
