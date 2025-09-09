import React, { useState, useMemo } from "react";
import axios from "axios";
import TaskRow from "./TaskRow";
import TaskRemarksModal from "../task/TaskRemarksModal";

const TaskTable = ({ tasks = [], onViewTask, onEditTask, onDeleteTask }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingRemarks, setLoadingRemarks] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  const filteredTasks = useMemo(() => {
    return safeTasks.filter((task) => {
      const titleMatch =
        task?.title?.toLowerCase().includes(search.toLowerCase()) ?? false;
      const statusMatch = filter === "All Status" || task?.status === filter;
      return titleMatch && statusMatch;
    });
  }, [safeTasks, search, filter]);

  const formatDueDateTime = (dateValue) => {
    if (!dateValue) return "No due date";
    const dateObj = new Date(dateValue);
    if (isNaN(dateObj.getTime())) return "Invalid date";
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
        </select>
      </div>

      {/* Table */}
      <div className="rounded-s border border-[rgba(84,123,209,0.4)] shadow-lg overflow-hidden">
        <table className="w-full border-collapse text-blue-100 table-fixed">
          <thead className="bg-[rgba(191,111,47,0.15)]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#bf6f2f]">
              <th className="p-2 w-[130px] max-w-[130px]">Task Title</th>
              <th className="p-2 w-[100px] max-w-[100px]">Assigned To</th>
              <th className="p-2 w-[100px] max-w-[100px]">Assigned By</th>
              <th className="p-2 w-[90px] max-w-[90px]">Due Date & Time</th>
              <th className="p-2 w-[50px] max-w-[50px]">Priority</th>
              <th className="p-2 w-[60px] max-w-[60px]">Status</th>
              <th className="p-2 w-[80px] max-w-[80px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs">
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
                    dueDate: formatDueDateTime(task?.dueDate),
                  }}
                  onView={() => onViewTask(task)}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task._id)}
                  onRemarks={openRemarksModal}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
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
    </div>
  );
};

export default TaskTable;
