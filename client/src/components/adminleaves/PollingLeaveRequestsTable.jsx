import React, { useCallback, useEffect, useState } from "react";
import LeaveRequestsTable from "./LeaveRequestsTable";
import { fetchAllLeaveRequests } from "../../api/leaveApi";

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

  const loadRequests = useCallback(async () => {
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
  }, [setRequests]);

  // One fetch on mount, then event-driven: the server emits "leave:updated"
  // (bridged to this window event by WebSocketContext.jsx) whenever a leave
  // request is created or approved/rejected, so a 10s re-poll of the whole
  // queue is redundant with it.
  useEffect(() => {
    loadRequests();
    window.addEventListener("leave-updated", loadRequests);
    return () => window.removeEventListener("leave-updated", loadRequests);
  }, [loadRequests]);

  if (loading)
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
        ))}
      </div>
    );
  if (error)
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">Error: {error}</div>;

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
