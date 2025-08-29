import React, { useState, useEffect, useRef } from "react";
import LeaveRequestsTable from "./LeaveRequestsTable";
import { fetchAllLeaveRequests } from "../../api/leaveApi";

const POLL_INTERVAL = 10000; // 10 seconds

const PollingLeaveRequestsTable = ({ selectedId, onSelect, onApprove, onReject }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

  // Load leave requests with remark preservation
  const loadRequests = async () => {
    try {
      const data = await fetchAllLeaveRequests();
      const safeData = Array.isArray(data) ? data : [];

      setRequests((prev) => {
        return safeData.map((req) => {
          const existing = prev.find((r) => r.id === req.id || r._id === req._id);
          if (existing?.adminRemarks) {
            return { ...req, adminRemarks: existing.adminRemarks };
          }
          return req;
        });
      });

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch leave requests");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    pollingRef.current = setInterval(loadRequests, POLL_INTERVAL);
    return () => clearInterval(pollingRef.current);
  }, []);

  if (loading) return <div className="p-4 text-gray-200">Loading leave requests...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <LeaveRequestsTable
      requests={requests}
      selectedId={selectedId}
      onSelect={onSelect}
      onApprove={onApprove}
      onReject={onReject}
      setRequests={setRequests} // pass setter to allow remark updates
    />
  );
};

export default PollingLeaveRequestsTable;
