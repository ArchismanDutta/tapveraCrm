import React, { useState } from "react";
import { Calendar, Clock, Hourglass } from "lucide-react";
import ImportantNoticeModal from "./ImportantNoticeModal";

// Map color names to Tailwind classes tailored for your theme
const colorMap = {
  green: { bg: "bg-[rgba(46,170,102,0.15)]", text: "text-green-500" },
  blue: { bg: "bg-[rgba(91,122,201,0.15)]", text: "text-blue-500" },
  yellow: { bg: "bg-[rgba(255,128,0,0.15)]", text: "text-[#ff8000]" },
};

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div
    className={`flex flex-col items-center justify-center p-6 rounded-3xl bg-[rgba(22,28,48,0.68)] border border-[rgba(84,123,209,0.13)] shadow-[0_8px_32px_0_rgba(10,40,100,0.14),_inset_0_1.5px_10px_0_rgba(84,123,209,0.08)] backdrop-blur-[10px] cursor-default select-none transition hover:-translate-y-1`}
  >
    <div className={`p-3 rounded-full mb-3 ${colorMap[color].bg} ${colorMap[color].text} shadow-md`}>
      <Icon className="h-6 w-6" />
    </div>
    <p className="text-4xl font-extrabold text-blue-100">{value}</p>
    <p className="text-lg text-blue-300">{label}</p>
  </div>
);

const LeaveSummary = ({ available, taken, pending, importantNotices = [] }) => {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <div
      className="bg-[rgba(22,28,48,0.68)] border border-[rgba(84,123,209,0.13)] rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(10,40,100,0.14),_inset_0_1.5px_10px_0_rgba(84,123,209,0.08)] backdrop-blur-[10px] relative z-10"
    >
      {/* Header with button */}
      <div className="flex justify-between items-center mb-5 relative">
        <h2 className="text-xl font-semibold text-blue-100">Leave Overview</h2>

        <div className="relative">
          <button
            onClick={() => setShowPopover(true)}
            className="bg-[#ffb347]/80 border-2 border-[#ff8000] text-black text-sm font-bold px-3 py-1 rounded-xl shadow hover:bg-[#ff8000] hover:text-white transition cursor-pointer"
          >
            Important Leave Update
          </button>

          {showPopover && (
            <ImportantNoticeModal notices={importantNotices} onClose={() => setShowPopover(false)} />
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
