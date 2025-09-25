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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const updateStatus = async (id, status) => {
    try {
      const updatedReq = await updateLeaveRequestStatus(id, status, adminRemarks);
      console.log("Status updated", updatedReq);

      // Update local state with the new data
      setRequests(prev =>
        prev.map(req =>
          String(req._id) === String(id) ? updatedReq : req
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const saveRemarks = async (id) => {
    try {
      const currentRequest = requests.find(req => String(req._id) === String(id));
      if (!currentRequest) return;

      const updatedReq = await updateLeaveRequestStatus(id, currentRequest.status, adminRemarks);
      console.log("Remarks saved", updatedReq);

      // Update local state with the new data
      setRequests(prev =>
        prev.map(req =>
          String(req._id) === String(id) ? updatedReq : req
        )
      );
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

  // Calculate stats
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(req => req.status === "Pending").length;
  const approvedRequests = requests.filter(req => req.status === "Approved").length;
  const rejectedRequests = requests.filter(req => req.status === "Rejected").length;

  return (
    <div className="flex bg-[#0f1419] min-h-screen text-white relative">
      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        /* Custom Scrollbar Styles */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 20, 25, 0.3);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          border-radius: 10px;
          border: 1px solid rgba(15, 20, 25, 0.2);
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #0891b2, #2563eb);
        }

        ::-webkit-scrollbar-corner {
          background: rgba(15, 20, 25, 0.3);
        }

        /* Firefox Scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: #06b6d4 rgba(15, 20, 25, 0.3);
        }

        /* Hide scrollbar for specific elements when needed */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }

        /* Custom focus styles */
        .focus-ring:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.5);
        }
      `}</style>

      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-blue-900/10 to-purple-900/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />

      {/* Main Content */}
      <main
        className={`relative z-10 flex-1 transition-all duration-300 ${
          collapsed ? "ml-24" : "ml-72"
        } p-6 overflow-y-auto max-h-screen`}
      >
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Leave Management
                </span>
              </h1>
              <p className="text-lg text-gray-300 mb-4">
                Review and manage employee leave requests 📋
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm text-gray-400">Live Status</p>
                    <p className="text-cyan-400 font-mono text-sm">
                      {currentTime.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-gray-400 text-base">
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Requests */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-cyan-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl">
                <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{totalRequests}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Total Requests</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"></div>
          </div>

          {/* Pending */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-yellow-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-orange-600/20 rounded-xl relative">
                <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {pendingRequests > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{pendingRequests}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Pending</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full"></div>
          </div>

          {/* Approved */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-green-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl">
                <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{approvedRequests}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Approved</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"></div>
          </div>

          {/* Rejected */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/25">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500/20 to-pink-600/20 rounded-xl">
                <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{rejectedRequests}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Rejected</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-red-500 to-pink-600 rounded-full"></div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Panel - Table */}
          <div className="xl:col-span-2">
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-slate-600/30 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-xl">
                  <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h4v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Leave Requests
                  </h2>
                  <p className="text-gray-400">Click on a request to view details</p>
                </div>
              </div>
              <div className="h-[calc(100vh-400px)] min-h-[400px]">
                <PollingLeaveRequestsTable
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onApprove={(id) => handleActionClick(id, "Approved")}
                  onReject={(id) => handleActionClick(id, "Rejected")}
                  requests={requests}
                  setRequests={setRequests}
                />
              </div>
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="xl:col-span-1">
            <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-xl">
                  <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Request Details
                  </h2>
                  <p className="text-gray-400">Review and take action</p>
                </div>
              </div>
              <div className="h-[calc(100vh-400px)] min-h-[400px] overflow-y-auto pr-2">
                <LeaveRequestDetails
                  request={selectedRequest}
                  adminRemarks={adminRemarks}
                  onChangeRemarks={setAdminRemarks}
                  onApprove={(id) => handleActionClick(id, "Approved")}
                  onReject={(id) => handleActionClick(id, "Rejected")}
                  onSaveRemarks={saveRemarks}
                />
              </div>
            </div>
          </div>
        </div>

        <DepartmentLeaveWarningModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onProceed={handleModalProceed}
          department={null}
          currentLeaves={modalLeaves}
          selectedEmployee={null}
        />
      </main>
    </div>
  );
};

export default AdminLeaveRequests;