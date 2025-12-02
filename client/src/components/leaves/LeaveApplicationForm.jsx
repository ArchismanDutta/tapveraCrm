import React, { useState, useMemo } from "react";
import InfoModal from "../InfoModal"; // Adjust path if needed

const LeaveApplicationForm = ({ onSubmitLeave }) => {
  const [type, setType] = useState("paid");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [document, setDocument] = useState(null);
  const [showHalfDayModal, setShowHalfDayModal] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [loading, setLoading] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const resetForm = () => {
    setType("paid");
    setStartDate("");
    setEndDate("");
    setReason("");
    setDocument(null);
  };

  const handleHalfDayConfirm = () => {
    if (pendingSubmission) submitLeave(pendingSubmission);
    setShowHalfDayModal(false);
    setPendingSubmission(null);
  };

  const handleHalfDayCancel = () => {
    setShowHalfDayModal(false);
    setPendingSubmission(null);
  };

  const submitLeave = async ({ type, startDate, endDate, reason }) => {
    if (!onSubmitLeave) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("reason", reason);
      if (document) formData.append("document", document);

      await onSubmitLeave(formData); // Send FormData to parent
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Failed to submit leave request");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!startDate) return alert("Start date is required.");

    const isHalfDay = type === "halfDay";
    if (!isHalfDay && !endDate) return alert("End date is required for this leave type.");
    if (!isHalfDay && endDate < startDate) return alert("End date cannot be before start date.");

    if (isHalfDay) {
      setPendingSubmission({ type, startDate, endDate: startDate, reason });
      setShowHalfDayModal(true);
      return;
    }

    submitLeave({ type, startDate, endDate: isHalfDay ? startDate : endDate, reason });
  };

  const isHalfDay = type === "halfDay";

  return (
    <div
      className="flex-1 flex flex-col bg-[rgba(22,28,48,0.68)] border border-[rgba(84,123,209,0.13)] rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(10,40,100,0.14),_inset_0_1.5px_10px_0_rgba(84,123,209,0.08)] backdrop-blur-[10px]"
    >
      <h3 className="text-xl font-semibold mb-5 text-blue-100">Apply for Leave</h3>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-4 h-full">
        {/* Leave Type */}
        <select
          className="border border-[rgba(84,123,209,0.3)] rounded-2xl p-3 w-full shadow-sm focus:ring-2 focus:ring-[#ff8000] focus:outline-none bg-[#141a29] text-blue-100"
          value={type}
          onChange={(e) => {
            const next = e.target.value;
            setType(next);
            if (next === "halfDay" && startDate) setEndDate(startDate);
          }}
        >
          <option value="paid">Paid Leave</option>
          <option value="unpaid">Unpaid Leave</option>
          <option value="sick">Sick Leave</option>
          <option value="maternity">Maternity Leave</option>
          <option value="workFromHome">Work From Home</option>
          <option value="halfDay">Half Day</option>
        </select>

        {/* Dates */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <input
            type="date"
            min={todayStr}
            className="border border-[rgba(84,123,209,0.3)] rounded-2xl p-3 w-full shadow-sm focus:ring-2 focus:ring-[#ff8000] focus:outline-none bg-[#141a29] text-blue-100"
            value={startDate}
            onChange={(e) => {
              const v = e.target.value;
              setStartDate(v);
              if (isHalfDay) setEndDate(v);
            }}
          />
          <input
            type="date"
            min={startDate || todayStr}
            className={`border border-[rgba(84,123,209,0.3)] rounded-2xl p-3 w-full shadow-sm focus:ring-2 focus:ring-[#ff8000] focus:outline-none bg-[#141a29] text-blue-100 ${
              isHalfDay ? "bg-[#262e4a] cursor-not-allowed" : ""
            }`}
            value={isHalfDay ? startDate : endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isHalfDay}
          />
        </div>

        {/* Reason */}
        <textarea
          placeholder="Enter your reason..."
          className="border border-[rgba(84,123,209,0.3)] rounded-2xl p-3 w-full shadow-sm focus:ring-2 focus:ring-[#ff8000] focus:outline-none flex-1 resize-none bg-[#141a29] text-blue-100"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {/* Upload Document */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="documentUpload"
            className="cursor-pointer bg-[#141a29] border border-[rgba(84,123,209,0.3)] text-white font-semibold px-4 py-2 rounded-2xl shadow hover:opacity-90 transition"
          >
            {document ? "Change Document" : "Upload Supporting Document"}
          </label>
          {document && <span className="text-blue-200 truncate">{document.name}</span>}
          <input
            type="file"
            id="documentUpload"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => setDocument(e.target.files[0])}
            className="hidden"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="mt-3 w-full bg-gradient-to-r from-[#ad7237] to-[#bb863d] text-black font-semibold px-4 py-3 rounded-2xl hover:opacity-90 shadow-lg transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Submitting..." : "Submit Request"}
        </button>
      </form>

      {/* Half Day Modal */}
      <InfoModal
        show={showHalfDayModal}
        onClose={handleHalfDayConfirm}
        title="Half Day Leave Confirmation"
        message="Half-day leave means you will work 4-4.5 hours on this day. Please ensure you complete at least 4 hours of work to avoid being marked absent."
        cancelButton={true}
        onCancel={handleHalfDayCancel}
      />
    </div>
  );
};

export default LeaveApplicationForm;
