import { X } from "lucide-react";

const InfoModal = ({ show, onClose, title, message, cancelButton, onCancel }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="info-modal-title" className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
          <button type="button" onClick={onCancel || onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {message.split("\n").map((line, index) => <p key={index}>{line}</p>)}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {cancelButton && <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]">Cancel</button>}
          <button type="button" onClick={onClose} className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">Confirm</button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
