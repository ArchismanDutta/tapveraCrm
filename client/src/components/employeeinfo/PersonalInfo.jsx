import React from "react";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
};

const PersonalInfo = ({ info }) => {
  const rows = [
    ["Date of Birth", formatDate(info.dob)],
    ["Gender", info.gender || "N/A"],
    ["Location", info.location || "N/A"],
    ["Blood Group", info.bloodGroup || "N/A"],
  ];

  return (
    <div className="app-panel rounded-2xl p-5">
      <p className="app-eyebrow">Identity</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Personal Info</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-medium capitalize text-slate-900 dark:text-slate-100">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonalInfo;
