// File: FlexibleRequestsModal.jsx

import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const FlexibleRequestsModal = ({ isOpen, onClose, requests = [], refresh }) => {
  const token = localStorage.getItem("token");
  const [updatingIds, setUpdatingIds] = useState([]);

  if (!isOpen) return null;

  if (!token) {
    toast.error("You are not authenticated!");
    return null;
  }

  const updateStatus = async (id, status) => {
    if (updatingIds.includes(id)) return;
    setUpdatingIds((prev) => [...prev, id]);

    try {
      await axios.put(
        `${API_BASE}/api/flexible-shift/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Request ${status}`);
      refresh?.(); // refresh list if function is provided
    } catch (err) {
      console.error("Failed to update flexible shift status:", err.response || err);
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingIds((prev) => prev.filter((i) => i !== id));
    }
  };

  // Sort requests by requestedDate descending
  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.requestedDate) - new Date(a.requestedDate)
  );

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString("en-GB");

  const statusBadgeClass = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-600 text-white";
      case "rejected":
        return "bg-red-600 text-white";
      case "pending":
      default:
        return "bg-yellow-500 text-black";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-auto">
      <div className="bg-[#1a1f36] rounded-xl shadow-xl w-full max-w-4xl p-6 overflow-auto max-h-[80vh]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Flexible Shift Requests</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white font-medium"
          >
            Close
          </button>
        </div>

        {/* No Requests */}
        {sortedRequests.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-gray-200 min-w-max">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Start Time</th>
                  <th className="p-2">Duration</th>
                  <th className="p-2">Reason</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRequests.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-800 transition-colors">
                    <td className="p-2">{r.employee?.name || "Unknown"}</td>
                    <td className="p-2">{formatDate(r.requestedDate)}</td>
                    <td className="p-2">{r.requestedStartTime}</td>
                    <td className="p-2">{r.durationHours}h</td>
                    <td className="p-2">{r.reason || "-"}</td>
                    <td className={`p-2 capitalize px-2 py-1 rounded text-sm ${statusBadgeClass(r.status)}`}>
                      {r.status}
                    </td>
                    <td className="p-2 flex gap-2 flex-wrap">
                      {r.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateStatus(r._id, "approved")}
                            className="px-2 py-1 bg-green-600 rounded text-sm hover:bg-green-700 transition disabled:opacity-50"
                            disabled={updatingIds.includes(r._id)}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(r._id, "rejected")}
                            className="px-2 py-1 bg-red-600 rounded text-sm hover:bg-red-700 transition disabled:opacity-50"
                            disabled={updatingIds.includes(r._id)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlexibleRequestsModal;
