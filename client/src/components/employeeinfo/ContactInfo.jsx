import React from "react";

const rows = [
  ["Email", "email"],
  ["Phone", "phone"],
  ["Address", "address"],
  ["Emergency Contact", "emergencyContact"],
];

const ContactInfo = ({ info }) => (
  <div className="app-panel rounded-2xl p-5">
    <p className="app-eyebrow">Communication</p>
    <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Contact Info</h3>
    <div className="mt-4 space-y-3">
      {rows.map(([label, key]) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{info[key] || "N/A"}</p>
        </div>
      ))}
    </div>
  </div>
);

export default ContactInfo;
