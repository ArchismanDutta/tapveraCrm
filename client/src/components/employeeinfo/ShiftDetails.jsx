import React, { useState, useEffect } from "react";
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
        headers: { Authorization: `Bearer ${token}` }
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
      window.location.reload(); // Refresh to show updated data
    } catch (err) {
      console.error("Failed to assign shift:", err);
      toast.error(err.response?.data?.message || "Failed to assign shift");
    }
  };
  if (!shift) {
    return (
      <div className="p-6 rounded-2xl shadow-md border border-[#283255] bg-[#181f34] text-blue-400 text-center font-semibold">
        <div className="mb-4">No shift assigned</div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          Assign Shift
        </button>
      </div>
    );
  }
  
  return (
    <>
      <div
        className={`p-6 rounded-2xl shadow-md border 
        ${shift.isFlexible
          ? "bg-gradient-to-r from-[#25c289]/10 via-[#181f34] to-[#181f34] border-green-300"
          : "bg-blue-900/25 border-blue-400"}
        text-blue-100`}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-cyan-300 flex items-center gap-2">
            <span role="img" aria-label="Shift">⏰</span> Shift Details
          </h3>
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
          >
            Change Shift
          </button>
        </div>
        <div className="space-y-2">
          <p>
            <span className="font-semibold">Shift Name:</span>{" "}
            <span className="text-cyan-200">{shift.name || "N/A"}</span>
          </p>
          <p>
            <span className="font-semibold">Start Time:</span>{" "}
            <span className="text-cyan-200">{shift.start || "N/A"}</span>
          </p>
          <p>
            <span className="font-semibold">End Time:</span>{" "}
            <span className="text-cyan-200">{shift.end || "N/A"}</span>
          </p>
          <p>
            <span className="font-semibold">Duration:</span>{" "}
            <span className="text-cyan-200">{shift.durationHours ?? "N/A"} hours</span>
          </p>
          <p>
            <span className="font-semibold">Type:</span>{" "}
            {shiftType === "flexiblePermanent" ? (
              <span className="text-green-400 font-medium">Flexible Permanent</span>
            ) : shift.isFlexible ? (
              <span className="text-green-400 font-medium">Flexible</span>
            ) : (
              <span className="text-pink-400 font-medium">Standard</span>
            )}
          </p>
        </div>
      </div>

      {/* Assign Shift Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1e253b] rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Assign Shift</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-1">Select Shift</label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0f1724] border border-[#334065] text-white"
                >
                  <option value="">Choose a shift</option>
                  {shifts.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.start} - {s.end})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignShift}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
                >
                  Assign Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShiftDetails;
