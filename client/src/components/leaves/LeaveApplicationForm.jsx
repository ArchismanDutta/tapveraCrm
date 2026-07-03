import React, { useMemo, useState } from "react";
import { AlertCircle, FileUp, Send } from "lucide-react";
import InfoModal from "../InfoModal";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400";

const LeaveApplicationForm = ({ onSubmitLeave }) => {
  const [type, setType] = useState("paid");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [document, setDocument] = useState(null);
  const [showHalfDayModal, setShowHalfDayModal] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const isHalfDay = type === "halfDay";

  const resetForm = () => {
    setType("paid");
    setStartDate("");
    setEndDate("");
    setReason("");
    setDocument(null);
    setError("");
  };

  const submitLeave = async (submission) => {
    if (!onSubmitLeave) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("type", submission.type);
      formData.append("startDate", submission.startDate);
      formData.append("endDate", submission.endDate);
      formData.append("reason", submission.reason);
      if (document) formData.append("document", document);
      await onSubmitLeave(formData);
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to submit leave request.");
    } finally {
      setLoading(false);
    }
  };

  const handleHalfDayConfirm = async () => {
    const submission = pendingSubmission;
    setShowHalfDayModal(false);
    setPendingSubmission(null);
    if (submission) await submitLeave(submission);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    if (!startDate) return setError("Start date is required.");
    if (!reason.trim()) return setError("Please add a reason for your request.");
    if (!isHalfDay && !endDate) return setError("End date is required for this leave type.");
    if (!isHalfDay && endDate < startDate) return setError("End date cannot be before the start date.");

    const submission = { type, startDate, endDate: isHalfDay ? startDate : endDate, reason: reason.trim() };
    if (isHalfDay) {
      setPendingSubmission(submission);
      setShowHalfDayModal(true);
      return;
    }
    submitLeave(submission);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-slate-950 dark:text-white">Apply for leave</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Submit dates and supporting details for approval</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Leave type</span>
          <select className={fieldClass} value={type} onChange={(event) => { const nextType = event.target.value; setType(nextType); if (nextType === "halfDay" && startDate) setEndDate(startDate); }}>
            <option value="paid">Paid leave</option>
            <option value="unpaid">Unpaid leave</option>
            <option value="sick">Sick leave</option>
            <option value="maternity">Maternity leave</option>
            <option value="workFromHome">Work from home</option>
            <option value="halfDay">Half day</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Start date</span>
            <input type="date" min={todayStr} className={fieldClass} value={startDate} onChange={(event) => { setStartDate(event.target.value); if (isHalfDay) setEndDate(event.target.value); }} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">End date</span>
            <input type="date" min={startDate || todayStr} className={fieldClass} value={isHalfDay ? startDate : endDate} onChange={(event) => setEndDate(event.target.value)} disabled={isHalfDay} />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Reason</span>
          <textarea rows="4" placeholder="Briefly explain your leave request" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>

        <div>
          <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Supporting document <span className="font-normal text-slate-400">(optional)</span></span>
          <label htmlFor="documentUpload" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-blue-400/[0.06]">
            <FileUp className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
            <span className="truncate">{document ? document.name : "PDF, Word document, or image"}</span>
          </label>
          <input type="file" id="documentUpload" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setDocument(event.target.files?.[0] || null)} className="hidden" />
        </div>

        <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:border-blue-700 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          <Send className="h-4 w-4" /> {loading ? "Submitting..." : "Submit request"}
        </button>
      </form>

      <InfoModal show={showHalfDayModal} onClose={handleHalfDayConfirm} title="Half-day leave confirmation" message="Half-day leave means you will work 4–4.5 hours on this day. Please ensure you complete at least 4 hours of work to avoid being marked absent." cancelButton onCancel={() => { setShowHalfDayModal(false); setPendingSubmission(null); }} />
    </section>
  );
};

export default LeaveApplicationForm;
