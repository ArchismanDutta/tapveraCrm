// src/pages/AdminLeaveRequests.jsx
import React, { useState, useEffect, useRef } from "react";
import LeaveRequestsTable from "../components/adminleaves/LeaveRequestsTable";
import LeaveRequestDetails from "../components/adminleaves/LeaveRequestDetails";
import Sidebar from "../components/dashboard/Sidebar";
import DepartmentLeaveWarningModal from "../components/adminleaves/DepartmentLeaveWarningModal";
import {
  fetchAllLeaveRequests,
  updateLeaveRequestStatus,
  fetchTeamLeaves,
} from "../api/leaveApi";

const POLL_INTERVAL = 10000; // 10 seconds

const AdminLeaveRequests = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLeaves, setModalLeaves] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);

  const pollingRef = useRef(null);

  // Load all leave requests
  const loadLeaveRequests = async () => {
    try {
      const data = await fetchAllLeaveRequests();
      const safeData = Array.isArray(data) ? data : [];

      setRequests((prev) => {
        // preserve adminRemarks from local state if request exists
        return safeData.map((req) => {
          const existing = prev.find(
            (r) => r.id === req.id || r._id === req._id
          );
          if (existing?.adminRemarks) {
            return { ...req, adminRemarks: existing.adminRemarks };
          }
          return req;
        });
      });

      // preserve selection if still exists, else select first
      if (!selectedId && safeData[0]) {
        setSelectedId(safeData[0].id || safeData[0]._id);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch leave requests");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaveRequests();
    pollingRef.current = setInterval(loadLeaveRequests, POLL_INTERVAL);

    return () => clearInterval(pollingRef.current);
  }, []);

  const selectedRequest = requests.find(
    (r) => r.id === selectedId || r._id === selectedId
  );

  const onChangeRemarks = (value) => {
    if (!selectedRequest) return;
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id || r._id === selectedRequest._id
          ? { ...r, adminRemarks: value }
          : r
      )
    );
  };

  const updateStatus = async (id, status) => {
    try {
      const requestToUpdate =
        requests.find((r) => r.id === id || r._id === id) || {};
      const remarksToSend = requestToUpdate.adminRemarks || "";

      const updatedReq = await updateLeaveRequestStatus(id, status, remarksToSend);

      // Ensure updated request replaces old one
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id || r._id === id ? { ...r, ...updatedReq } : r
        )
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update leave request");
    }
  };

  const handleActionClick = async (id, status) => {
    const req = requests.find((r) => r.id === id || r._id === id);
    if (!req) return;

    try {
      const leaves = await fetchTeamLeaves(req.employee?.department, req.employee?.email);
      setModalLeaves(Array.isArray(leaves) ? leaves : []);
      setPendingAction({ id, status });
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      // fallback: directly update if fetching leaves fails
      updateStatus(id, status);
    }
  };

  const handleModalProceed = () => {
    if (pendingAction) {
      updateStatus(pendingAction.id, pendingAction.status);
    }
    setModalOpen(false);
    setPendingAction(null);
  };

  if (loading) return <div className="p-8">Loading leave requests...</div>;
  if (error)
    return <div className="p-8 text-red-600">Error: {error || "Unknown error"}</div>;

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />
      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } p-6 flex flex-col`}
      >
        <div className="flex flex-1 gap-8 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <LeaveRequestsTable
              requests={requests}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onApprove={(id) => handleActionClick(id, "Approved")}
              onReject={(id) => handleActionClick(id, "Rejected")}
            />
          </div>
          <div className="w-full max-w-[430px] flex-shrink-0 overflow-auto">
            <LeaveRequestDetails
              request={selectedRequest}
              adminRemarks={selectedRequest?.adminRemarks || ""}
              onChangeRemarks={onChangeRemarks}
              onApprove={(id) => handleActionClick(id, "Approved")}
              onReject={(id) => handleActionClick(id, "Rejected")}
            />
          </div>
        </div>
      </main>

      <DepartmentLeaveWarningModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onProceed={handleModalProceed}
        department={selectedRequest?.employee?.department}
        currentLeaves={modalLeaves}
        selectedEmployee={selectedRequest?.employee}
      />
    </div>
  );
};

export default AdminLeaveRequests;
