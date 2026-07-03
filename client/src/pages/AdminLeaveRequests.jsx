import React, { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const updateStatus = async (id, status) => {
    try {
      const updatedRequest = await updateLeaveRequestStatus(
        id,
        status,
        adminRemarks,
      );
      setRequests((current) =>
        current.map((request) =>
          String(request._id) === String(id) ? updatedRequest : request,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const saveRemarks = async (id) => {
    try {
      const currentRequest = requests.find(
        (request) => String(request._id) === String(id),
      );
      if (!currentRequest) return;

      const updatedRequest = await updateLeaveRequestStatus(
        id,
        currentRequest.status,
        adminRemarks,
      );
      setRequests((current) =>
        current.map((request) =>
          String(request._id) === String(id) ? updatedRequest : request,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleActionClick = async (id, status) => {
    try {
      const leaves = await fetchTeamLeaves(null, null);
      setModalLeaves(Array.isArray(leaves) ? leaves : []);
      setPendingAction({ id, status });
      setModalOpen(true);
    } catch (error) {
      console.error(error);
      updateStatus(id, status);
    }
  };

  const handleModalProceed = () => {
    if (pendingAction) updateStatus(pendingAction.id, pendingAction.status);
    setModalOpen(false);
    setPendingAction(null);
  };

  const selectedRequest =
    requests.find((request) => String(request._id) === String(selectedId)) ||
    null;

  const handleSelectRequest = (id) => {
    setSelectedId(id);
    const nextRequest = requests.find(
      (request) => String(request._id) === String(id),
    );
    setAdminRemarks(nextRequest?.adminRemarks || "");
  };

  const totalRequests = requests.length;
  const pendingRequests = requests.filter(
    (request) => request.status === "Pending",
  ).length;
  const approvedRequests = requests.filter(
    (request) => request.status === "Approved",
  ).length;
  const rejectedRequests = requests.filter(
    (request) => request.status === "Rejected",
  ).length;

  const summaryMetrics = [
    ["Total requests", totalRequests, FileText, "text-blue-600 dark:text-blue-300"],
    ["Pending", pendingRequests, Clock, "text-amber-600 dark:text-amber-300"],
    [
      "Approved",
      approvedRequests,
      CheckCircle2,
      "text-emerald-600 dark:text-emerald-300",
    ],
    ["Rejected", rejectedRequests, XCircle, "text-rose-600 dark:text-rose-300"],
  ];

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Leave operations
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Leave requests
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review employee requests, supporting documents, and approval history.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right dark:border-white/10 dark:bg-white/[0.025]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentTime.toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {currentTime.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </header>

          <section
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="Leave request summary"
          >
            {summaryMetrics.map(([label, value, Icon, tone]) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                      {value}
                    </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05]">
                    {React.createElement(Icon, {
                      className: `h-4 w-4 ${tone}`,
                    })}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
              <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Request queue
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Select a request to review its details.
                </p>
              </div>
              <div className="h-[min(660px,calc(100dvh-330px))] min-h-[440px] p-4 sm:p-5">
                <PollingLeaveRequestsTable
                  selectedId={selectedId}
                  onSelect={handleSelectRequest}
                  onApprove={(id) => handleActionClick(id, "Approved")}
                  onReject={(id) => handleActionClick(id, "Rejected")}
                  requests={requests}
                  setRequests={setRequests}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
              <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Request details
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Review the request and record a decision.
                </p>
              </div>
              <div className="max-h-[min(660px,calc(100dvh-330px))] min-h-[440px] overflow-y-auto p-4 sm:p-5">
                <LeaveRequestDetails
                  request={selectedRequest}
                  adminRemarks={adminRemarks}
                  onChangeRemarks={setAdminRemarks}
                  onApprove={(id) => handleActionClick(id, "Approved")}
                  onReject={(id) => handleActionClick(id, "Rejected")}
                  onSaveRemarks={saveRemarks}
                />
              </div>
            </section>
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
      </main>
    </div>
  );
};

export default AdminLeaveRequests;
