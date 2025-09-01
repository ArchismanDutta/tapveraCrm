import React, { useState } from "react";
import LeaveRequestDetails from "../components/adminleaves/LeaveRequestDetails";
import Sidebar from "../components/dashboard/Sidebar";
import DepartmentLeaveWarningModal from "../components/adminleaves/DepartmentLeaveWarningModal";
import PollingLeaveRequestsTable from "../components/adminleaves/PollingLeaveRequestsTable";
import { updateLeaveRequestStatus, fetchTeamLeaves } from "../api/leaveApi";

const AdminLeaveRequests = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLeaves, setModalLeaves] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);

  const updateStatus = async (id, status) => {
    try {
      // Find the request in the table (PollingLeaveRequestsTable already maintains it)
      const updatedReq = await updateLeaveRequestStatus(id, status, "");

      // Note: The PollingLeaveRequestsTable will auto-refresh the table on next poll
      console.log("Status updated", updatedReq);
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionClick = async (id, status) => {
    try {
      const leaves = await fetchTeamLeaves(null, null); // optionally pass department/email
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

  return (
    <div className="flex bg-gray-900 dark:bg-gray-900 min-h-screen text-gray-100">
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
            <PollingLeaveRequestsTable
              selectedId={selectedId}
              onSelect={setSelectedId}
              onApprove={(id) => handleActionClick(id, "Approved")}
              onReject={(id) => handleActionClick(id, "Rejected")}
            />
          </div>
          <div className="w-full max-w-[430px] flex-shrink-0 overflow-auto">
            {/* Details panel can fetch remarks from selected request in table */}
            <LeaveRequestDetails
              request={null}
              adminRemarks={""}
              onChangeRemarks={() => {}}
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
