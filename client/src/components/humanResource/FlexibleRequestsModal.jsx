// File: src/components/humanResource/FlexibleRequestsModal.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const statusColors = {
  approved: "bg-green-600 text-white",
  rejected: "bg-red-600 text-white",
  pending: "bg-yellow-500 text-black",
};

const FlexibleRequestsModal = ({ isOpen, onClose, requests = [], refresh }) => {
  const [updatingIds, setUpdatingIds] = useState([]);
  const [token, setToken] = useState("");

  // Get token when modal opens
  useEffect(() => {
    const t = localStorage.getItem("token");
    setToken(t);
    if (isOpen && !t) toast.error("You are not authenticated!");
  }, [isOpen]);

  if (!isOpen || !token) return null;

  const updateStatus = async (request, newStatus) => {
    const { _id } = request;
    if (updatingIds.includes(_id)) return;

    if (
      !window.confirm(
        `Are you sure you want to ${newStatus.toLowerCase()} the request for ${
          request.employee?.name || request.employee?.email || "this employee"
        }?`
      )
    )
      return;

    setUpdatingIds((prev) => [...prev, _id]);

    try {
      await axios.put(
        `${API_BASE}/api/flexible-shifts/${_id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Request ${newStatus}`);
      refresh?.(); // refresh parent dashboard data
    } catch (err) {
      console.error("Failed to update flexible shift status:", err.response || err);
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingIds((prev) => prev.filter((i) => i !== _id));
    }
  };

  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.requestedDate) - new Date(a.requestedDate)
  );

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const pendingRequests = sortedRequests.filter(
    (r) => r.status?.toLowerCase() === "pending"
  );
  const previousRequests = sortedRequests.filter(
    (r) => r.status?.toLowerCase() !== "pending"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-auto">
      <div className="bg-[#1a1f36] rounded-xl shadow-xl w-full max-w-4xl p-6 overflow-auto max-h-[80vh] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Flexible Shift Requests</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white font-medium transition"
          >
            Close
          </button>
        </div>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="mb-6 p-4 bg-[#252b46] rounded">
            <h4 className="text-md font-semibold text-white mb-3">Pending Requests</h4>
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
                  {pendingRequests.map((r) => {
                    const isUpdating = updatingIds.includes(r._id);
                    const statusLower = r.status?.toLowerCase() || "pending";

                    return (
                      <tr
                        key={r._id}
                        className="hover:bg-gray-800 transition-colors"
                      >
                        <td className="p-2">{r.employee?.name || r.employee?.email || "Unknown"}</td>
                        <td className="p-2">{formatDate(r.requestedDate)}</td>
                        <td className="p-2">{r.requestedStartTime}</td>
                        <td className="p-2">{r.durationHours}h</td>
                        <td className="p-2">{r.reason || "-"}</td>
                        <td
                          className={`p-2 capitalize px-2 py-1 rounded text-sm ${statusColors[statusLower]}`}
                        >
                          {r.status}
                        </td>
                        <td className="p-2 flex gap-2 flex-wrap">
                          <button
                            onClick={() => updateStatus(r, "approved")}
                            disabled={isUpdating}
                            className="px-2 py-1 bg-green-600 rounded text-sm hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1"
                          >
                            Approve {isUpdating && <span className="animate-spin">⏳</span>}
                          </button>
                          <button
                            onClick={() => updateStatus(r, "rejected")}
                            disabled={isUpdating}
                            className="px-2 py-1 bg-red-600 rounded text-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1"
                          >
                            Reject {isUpdating && <span className="animate-spin">⏳</span>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Previous Requests Section */}
        {previousRequests.length > 0 && (
          <div className="mb-6 p-4 bg-[#252b46] rounded">
            <h4 className="text-md font-semibold text-white mb-3">Previous Requests</h4>
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
                  </tr>
                </thead>
                <tbody>
                  {previousRequests.map((r) => {
                    const statusLower = r.status?.toLowerCase();
                    return (
                      <tr key={r._id} className="hover:bg-gray-800 transition-colors">
                        <td className="p-2">{r.employee?.name || r.employee?.email || "Unknown"}</td>
                        <td className="p-2">{formatDate(r.requestedDate)}</td>
                        <td className="p-2">{r.requestedStartTime}</td>
                        <td className="p-2">{r.durationHours}h</td>
                        <td className="p-2">{r.reason || "-"}</td>
                        <td
                          className={`p-2 capitalize px-2 py-1 rounded text-sm ${statusColors[statusLower]}`}
                        >
                          {r.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pendingRequests.length === 0 && previousRequests.length === 0 && (
          <p className="text-gray-400 text-center py-4">No flexible shift requests found.</p>
        )}
      </div>
    </div>
  );
};

export default FlexibleRequestsModal;
