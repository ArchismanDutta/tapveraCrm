import React from "react";
import { AlertTriangle, X } from "lucide-react";

const ImportantNoticeModal = ({ notices, onClose }) => {
  if (!notices || notices.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-policy-title"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 id="leave-policy-title" className="text-base font-semibold text-slate-950 dark:text-white">Leave policy</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Important information before applying</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white" aria-label="Close leave policy">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="space-y-2 p-5">
          {notices.map((notice, index) => (
            <li key={index} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              {notice}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ImportantNoticeModal;
