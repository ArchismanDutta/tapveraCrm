import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const ShiftDetails = ({ shift, shiftType, employeeId }) => {
  const [shifts, setShifts] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState("");

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/api/shifts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShifts(response.data);
    } catch (err) {
      console.error("Failed to fetch shifts:", err);
    }
  };

  const handleAssignShift = async () => {
    if (!selectedShift) {
      toast.error("Please select a shift");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/shifts/assign/${employeeId}`,
        { shiftId: selectedShift, shiftType: "standard" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Shift assigned successfully");
      setShowAssignModal(false);
      window.location.reload();
    } catch (err) {
      console.error("Failed to assign shift:", err);
      toast.error(err.response?.data?.message || "Failed to assign shift");
    }
  };

  const typeLabel =
    shiftType === "flexiblePermanent"
      ? "Flexible Permanent"
      : shift?.isFlexible
      ? "Flexible"
      : "Standard";

  const renderAssignModal = () =>
    showAssignModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="app-panel w-full max-w-md rounded-2xl p-5 shadow-2xl">
          <div className="mb-5">
            <p className="app-eyebrow">Schedule</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Assign Shift</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose the shift this employee should follow.</p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Select Shift</span>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="app-control w-full px-3 py-2"
              >
                <option value="">Choose a shift</option>
                {shifts.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} ({item.start} - {item.end})
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="app-secondary-button px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignShift}
                className="app-primary-button px-4 py-2 text-sm font-semibold"
              >
                Assign Shift
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  if (!shift) {
    return (
      <>
        <div className="app-panel rounded-2xl p-5 text-center">
          <p className="app-eyebrow">Schedule</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">No shift assigned</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Assign a shift to keep attendance and working-hour reports aligned.
          </p>
          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="app-primary-button mt-4 px-4 py-2 text-sm font-semibold"
          >
            Assign Shift
          </button>
        </div>
        {renderAssignModal()}
      </>
    );
  }

  return (
    <>
      <div className="app-panel rounded-2xl p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="app-eyebrow">Schedule</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Shift Details</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="app-secondary-button px-3 py-2 text-sm font-semibold"
          >
            Change Shift
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Shift Name", shift.name || "N/A"],
            ["Start Time", shift.start || "N/A"],
            ["End Time", shift.end || "N/A"],
            ["Duration", `${shift.durationHours ?? "N/A"} hours`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {typeLabel}
        </div>
      </div>

      {renderAssignModal()}
    </>
  );
};

export default ShiftDetails;
