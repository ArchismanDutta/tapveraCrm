// File: src/components/admintask/TaskTable.jsx
import React, { useState, useMemo } from "react";
import axios from "axios";
import { XCircle } from "lucide-react";
import TaskRow from "./TaskRow";
import TaskRemarksModal from "../task/TaskRemarksModal";
import TaskDetailModal from "./TaskDetailModal";

const TaskTable = ({ tasks = [], onViewTask, onEditTask, onDeleteTask, onRejectTask }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingRemarks, setLoadingRemarks] = useState(false);
  const [rejectingTask, setRejectingTask] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [detailTask, setDetailTask] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // Apply search + local status filter
  const filteredTasks = useMemo(() => {
    return safeTasks.filter((task) => {
      const titleMatch =
        (task?.title || "").toLowerCase().includes(search.toLowerCase());
      const statusMatch =
        filter === "All Status" || (task?.status || "") === filter;
      return titleMatch && statusMatch;
    });
  }, [safeTasks, search, filter]);

  const formatDateTime = (dateValue) => {
    if (!dateValue) return null;
    const dateObj = new Date(dateValue);
    if (isNaN(dateObj.getTime())) return null;
    return `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const openRemarksModal = async (task) => {
    setLoadingRemarks(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No auth token found");

      const res = await axios.get(`${API_BASE}/api/tasks/${task._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data) {
        setSelectedTask(res.data);
      } else {
        alert("Could not fetch latest remarks.");
      }
    } catch (err) {
      console.error("Failed to fetch task remarks:", err);
      alert("Could not fetch latest remarks.");
    } finally {
      setLoadingRemarks(false);
    }
  };

  const handleAddRemark = async (comment) => {
    if (!selectedTask || !comment.trim()) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No auth token found");

      const res = await axios.post(
        `${API_BASE}/api/tasks/${selectedTask._id}/remarks`,
        { comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data && res.data.remarks) {
        setSelectedTask((prev) => ({ ...prev, remarks: res.data.remarks }));
      } else {
        alert("Failed to update remarks.");
      }
    } catch (err) {
      console.error("Failed to add remark:", err);
      alert("Could not add remark.");
    }
  };

  const handleRejectTask = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }
    setRejectLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/tasks/${rejectingTask._id}/reject`,
        { reason: rejectionReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRejectingTask(null);
      setRejectionReason("");
      if (onRejectTask) onRejectTask(rejectingTask._id);
      alert("Task rejected successfully");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to reject task");
    } finally {
      setRejectLoading(false);
    }
  };

  const openDetailModal = async (task) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No auth token found");

      // Fetch full task details with statusHistory
      const res = await axios.get(`${API_BASE}/api/tasks/${task._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data) {
        console.log("Task details fetched:", res.data);
        console.log("Status History:", res.data.statusHistory);
        setDetailTask(res.data);
      } else {
        alert("Could not fetch task details.");
      }
    } catch (err) {
      console.error("Failed to fetch task details:", err);
      alert("Could not fetch task details.");
    }
  };

  return (
    <div className="rounded-xl relative">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <input
          type="text"
          placeholder="🔍 Search tasks..."
          className="bg-[rgba(22,28,48,0.8)] border border-[rgba(84,123,209,0.4)] rounded-2xl px-4 py-2 w-full md:w-1/3 text-sm text-blue-100 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-[#bf6f2f] transition duration-200"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-[rgba(22,28,48,0.8)] border border-[rgba(84,123,209,0.4)] rounded-xl px-2 py-1 text-xs w-full md:w-auto text-blue-100 focus:outline-none focus:ring-2 focus:ring-[#bf6f2f] transition duration-200"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All Status</option>
          <option>pending</option>
          <option>in-progress</option>
          <option>completed</option>
          <option>rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-s border border-[rgba(84,123,209,0.4)] shadow-lg overflow-x-auto">
        <table className="w-full border-collapse text-blue-100">
          <thead className="bg-[rgba(191,111,47,0.15)]">
            <tr className="text-left text-[10px] uppercase tracking-wide text-[#bf6f2f]">
              <th className="px-1.5 py-2">Task Title</th>
              <th className="px-1.5 py-2">Assigned To</th>
              <th className="px-1.5 py-2">Assigned By</th>
              <th className="px-1.5 py-2">Last Edited</th>
              <th className="px-1.5 py-2">Due Date</th>
              <th className="px-1.5 py-2">Completed</th>
              <th className="px-1.5 py-2">Priority</th>
              <th className="px-1.5 py-2">Status</th>
              <th className="px-1.5 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, index) => (
                <TaskRow
                  key={task._id || index}
                  task={{
                    ...task,
                    assignedTo: Array.isArray(task.assignedTo)
                      ? task.assignedTo
                      : [],
                    assignedBy: task.assignedBy || null,
                    lastEditedBy: task.lastEditedBy || null,
                    dueDate: formatDateTime(task?.dueDate),
                    completedAt: formatDateTime(task?.completedAt),
                  }}
                  onView={() => onViewTask(task)}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task._id)}
                  onRemarks={openRemarksModal}
                  onReject={setRejectingTask}
                  onViewDetails={() => openDetailModal(task)}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="p-4 text-center text-blue-400 italic"
                >
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Remarks Modal */}
      {selectedTask && (
        <TaskRemarksModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onAddRemark={handleAddRemark}
        />
      )}

      {/* Reject Modal */}
      {rejectingTask && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-xl">
          <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-red-600/50 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
                  Reject Task
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectingTask(null);
                  setRejectionReason("");
                }}
                className="p-2 hover:bg-red-500/20 rounded-xl transition-colors text-gray-400 hover:text-red-400"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                Task: <span className="font-semibold text-blue-200">{rejectingTask.title}</span>
              </p>
              <p className="text-gray-400 text-sm">
                Please provide a reason for rejecting this task. The employee will be able to see this feedback.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Rejection Reason
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 w-full text-white resize-none focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all duration-300"
                placeholder="Enter the reason for rejection..."
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => {
                  setRejectingTask(null);
                  setRejectionReason("");
                }}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectTask}
                disabled={rejectLoading}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25 disabled:opacity-50"
              >
                {rejectLoading ? "Rejecting..." : "Reject Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
        />
      )}
    </div>
  );
};

export default TaskTable;
