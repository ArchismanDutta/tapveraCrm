import React, { useState, useEffect } from "react";
import LeaveRequestsTable from "../components/adminleaves/LeaveRequestsTable";
import LeaveRequestDetails from "../components/adminleaves/LeaveRequestDetails";
import Sidebar from "../components/dashboard/Sidebar";
import DepartmentLeaveWarningModal from "../components/adminleaves/DepartmentLeaveWarningModal";
import { fetchAllLeaveRequests, updateLeaveRequestStatus, fetchTeamLeaves } from "../api/leaveApi";

const AdminLeaveRequests = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLeaves, setModalLeaves] = useState([]);
  const [pendingAction, setPendingAction] = useState(null); // { id, status }

  useEffect(() => {
    setLoading(true);
    fetchAllLeaveRequests()
      .then((data) => {
        setRequests(data);
        setSelectedId(data[0]?.id || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const selectedRequest = requests.find((r) => r.id === selectedId);

  const onChangeRemarks = (value) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === selectedId ? { ...r, adminRemarks: value } : r))
    );
  };

  const updateStatus = async (id, status) => {
    try {
      const requestToUpdate = requests.find((r) => r.id === id);
      const remarksToSend = requestToUpdate?.adminRemarks || "";
      const updatedReq = await updateLeaveRequestStatus(id, status, remarksToSend);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? updatedReq : r))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // ✅ New: handle approve/reject click with department leave check
  const handleActionClick = async (id, status) => {
  const req = requests.find((r) => r.id === id);
  if (!req) return;

  try {
    // fetch current approved leaves for the same department (excluding requester)
    const leaves = await fetchTeamLeaves(req.employee.department, req.employee.email);
    setModalLeaves(leaves);
    setPendingAction({ id, status });
    setModalOpen(true);
  } catch (err) {
    console.error(err);
    updateStatus(id, status); // fallback
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
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

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

      {/* ✅ Department leave warning modal */}
      <DepartmentLeaveWarningModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onProceed={handleModalProceed}
        department={selectedRequest?.employee.department}
        currentLeaves={modalLeaves}
        selectedEmployee={selectedRequest?.employee}
      />
    </div>
  );
};

export default AdminLeaveRequests;
