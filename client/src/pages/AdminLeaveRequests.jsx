import React, { useState, useEffect } from "react";
import LeaveRequestDetails from "../components/adminleaves/LeaveRequestDetails";
import Sidebar from "../components/dashboard/Sidebar";
import DepartmentLeaveWarningModal from "../components/adminleaves/DepartmentLeaveWarningModal";
import PollingLeaveRequestsTable from "../components/adminleaves/PollingLeaveRequestsTable";
import { updateLeaveRequestStatus, fetchTeamLeaves } from "../api/leaveApi";

const AdminLeaveRequests = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLeaves, setModalLeaves] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);

  const updateStatus = async (id, status) => {
    try {
      const updatedReq = await updateLeaveRequestStatus(id, status, adminRemarks);
      console.log("Status updated", updatedReq);
      // Optionally refresh or update local state
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionClick = async (id, status) => {
    try {
      const leaves = await fetchTeamLeaves(null, null);
      setModalLeaves(Array.isArray(leaves) ? leaves : []);
      setPendingAction({ id, status });
      setModalOpen(true);
    } catch (err) {
      console.error(err);
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

  const selectedRequest = requests.find((req) => String(req._id) === String(selectedId)) || null;

  useEffect(() => {
    setAdminRemarks(selectedRequest?.adminRemarks || "");
  }, [selectedRequest]);

  return (
    <div className="flex bg-gray-900 min-h-screen text-gray-100">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="admin" onLogout={onLogout} />

      <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} p-4 md:p-6 flex flex-col`}>
        <div className="flex flex-1 flex-col lg:flex-row gap-6 overflow-hidden">
          <div className="flex-1 min-w-0">
            <PollingLeaveRequestsTable
              selectedId={selectedId}
              onSelect={setSelectedId}
              onApprove={(id) => handleActionClick(id, "Approved")}
              onReject={(id) => handleActionClick(id, "Rejected")}
              requests={requests}
              setRequests={setRequests}
            />
          </div>

          <div className="w-full lg:w-[430px] flex-shrink-0 overflow-auto">
            <LeaveRequestDetails
              request={selectedRequest}
              adminRemarks={adminRemarks}
              onChangeRemarks={setAdminRemarks}
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
        department={null}
        currentLeaves={modalLeaves}
        selectedEmployee={null}
      />
    </div>
  );
};

export default AdminLeaveRequests;
