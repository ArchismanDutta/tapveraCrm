import React, { useState, useEffect, useRef } from "react";
import LeaveRequestsTable from "./LeaveRequestsTable";
import { fetchAllLeaveRequests } from "../../api/leaveApi";

const POLL_INTERVAL = 10000; // 10 seconds

const PollingLeaveRequestsTable = ({
  selectedId,
  onSelect,
  onApprove,
  onReject,
  requests,
  setRequests,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

  const loadRequests = async () => {
    try {
      const data = await fetchAllLeaveRequests();
      const safeData = Array.isArray(data) ? data : [];

      // Use server data directly, preserving only local draft changes for unsaved requests
      setRequests(safeData);

      setLoading(false);
      setError(null);
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

  if (loading)
    return <div className="p-4 text-gray-200">Loading leave requests...</div>;
  if (error)
    return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <LeaveRequestsTable
      requests={requests}
      selectedId={selectedId}
      onSelect={onSelect}
      onApprove={onApprove}
      onReject={onReject}
      setRequests={setRequests}
    />
  );
};

export default PollingLeaveRequestsTable;
