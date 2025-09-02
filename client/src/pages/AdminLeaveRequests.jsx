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
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />

      {/* Main Content shifted left */}
      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } p-4 md:p-6 flex flex-col mr-0 lg:mr-[430px]`} // <- Add right margin for desktop
      >
        <div className="flex flex-1 flex-col gap-6 overflow-hidden">
          <PollingLeaveRequestsTable
            selectedId={selectedId}
            onSelect={setSelectedId}
            onApprove={(id) => handleActionClick(id, "Approved")}
            onReject={(id) => handleActionClick(id, "Rejected")}
            requests={requests}
            setRequests={setRequests}
          />
        </div>
      </main>

      {/* Fixed right panel */}
      <div className="fixed top-0 right-0 h-screen w-full lg:w-[430px] p-4 overflow-auto z-20 shadow-lg bg-gray-900">
        <LeaveRequestDetails
          request={selectedRequest}
          adminRemarks={adminRemarks}
          onChangeRemarks={setAdminRemarks}
          onApprove={(id) => handleActionClick(id, "Approved")}
          onReject={(id) => handleActionClick(id, "Rejected")}
        />
      </div>

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
