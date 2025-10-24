import React, { useState, useEffect, useRef } from "react";
import API from "../../api";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { X, Calendar, Clock, Users, FileText, AlertCircle } from "lucide-react";

const ProjectTaskModal = ({ projectId, projectEmployees, onClose, onTaskCreated }) => {
  const [task, setTask] = useState({
    title: "",
    assignedTo: [],
    dueDate: null,
    dueTime: "",
    priority: "Medium",
    status: "pending",
    description: "",
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);
  const timeRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (timeRef.current && !timeRef.current.contains(e.target)) {
        setTimeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleUserSelection = (userId) => {
    setTask((prev) => {
      const alreadySelected = prev.assignedTo.includes(userId);
      return {
        ...prev,
        assignedTo: alreadySelected
          ? prev.assignedTo.filter((id) => id !== userId)
          : [...prev.assignedTo, userId],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!task.title.trim()) {
      setError("Task title is required");
      return;
    }

    if (task.assignedTo.length === 0) {
      setError("Please assign at least one employee");
      return;
    }

    if (!task.dueDate) {
      setError("Please select a due date");
      return;
    }

    if (!task.priority) {
      setError("Please select a priority");
      return;
    }

    setLoading(true);

    try {
      const dueDateOnly = task.dueDate;
      let combinedDueDate;

      if (task.dueTime) {
        const [hours, minutes] = task.dueTime.split(":");
        combinedDueDate = new Date(dueDateOnly);
        combinedDueDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      } else {
        combinedDueDate = dueDateOnly;
      }

      const taskData = {
        title: task.title,
        description: task.description,
        assignedTo: task.assignedTo,
        dueDate: combinedDueDate,
        priority: task.priority,
        status: task.status,
        project: projectId, // Link task to project
      };

      const response = await API.post("/api/tasks", taskData);
      onTaskCreated(response.data);
      onClose();
    } catch (err) {
      console.error("Failed to create task", err);
      setError(err.response?.data?.message || "Failed to create task. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = projectEmployees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateTimeSlots = () => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = h.toString().padStart(2, "0");
        const min = m.toString().padStart(2, "0");
        slots.push(`${hour}:${min}`);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const commonInputClasses =
    "bg-[#0f1419] border border-[#232945] p-3 rounded-lg text-sm text-white w-full focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#191f2b] border-b border-[#232945] p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-purple-400" />
              Create New Task
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Assign a task to team members in this project
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#0f1419] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Task Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter task title"
              className={commonInputClasses}
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Assign To */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-white mb-2">
              Assign To <span className="text-red-400">*</span>
            </label>
            <div
              className={`${commonInputClasses} cursor-pointer flex items-center justify-between ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={() => !loading && setDropdownOpen((prev) => !prev)}
            >
              <span>
                {task.assignedTo.length > 0
                  ? `${task.assignedTo.length} employee(s) selected`
                  : "Select employees from project team..."}
              </span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-2 border border-[#232945] bg-[#0f1419] rounded-lg shadow-xl w-full z-50 max-h-60 overflow-hidden">
                <div className="p-3 border-b border-[#232945] bg-[#191f2b]">
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-[#0f1419] border border-[#232945] rounded-lg p-2 text-white w-full text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="overflow-y-auto max-h-48">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => (
                      <label
                        key={emp._id}
                        className="flex items-center px-4 py-3 hover:bg-purple-600/20 cursor-pointer transition-colors border-l-2 border-transparent hover:border-purple-500"
                      >
                        <input
                          type="checkbox"
                          checked={task.assignedTo.includes(emp._id)}
                          onChange={() => toggleUserSelection(emp._id)}
                          className="mr-3 cursor-pointer w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{emp.name}</p>
                            <p className="text-gray-400 text-xs">{emp.email}</p>
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No employees found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selected employees display */}
            {task.assignedTo.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {task.assignedTo.map((userId) => {
                  const emp = projectEmployees.find((e) => e._id === userId);
                  if (!emp) return null;
                  return (
                    <div
                      key={userId}
                      className="flex items-center gap-2 bg-purple-600/20 border border-purple-500/50 rounded-full px-3 py-1"
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm">{emp.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleUserSelection(userId)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date + Time Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Due Date <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <ReactDatePicker
                  selected={task.dueDate}
                  onChange={(date) => setTask({ ...task, dueDate: date })}
                  className={commonInputClasses}
                  placeholderText="Select due date"
                  minDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  isClearable
                  wrapperClassName="w-full"
                  disabled={loading}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Time Picker */}
            <div className="relative" ref={timeRef}>
              <label className="block text-sm font-medium text-white mb-2">
                Due Time (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  placeholder="Select time"
                  className={`${commonInputClasses} cursor-pointer ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  value={task.dueTime}
                  onClick={() => !loading && setTimeOpen((prev) => !prev)}
                />
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {timeOpen && (
                <div className="absolute top-full mt-2 bg-[#0f1419] border border-[#232945] rounded-lg shadow-xl max-h-60 overflow-y-auto w-full z-50">
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      className="px-4 py-2 hover:bg-purple-600/20 cursor-pointer transition-colors text-sm text-white"
                      onClick={() => {
                        setTask({ ...task, dueTime: time });
                        setTimeOpen(false);
                      }}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Priority <span className="text-red-400">*</span>
            </label>
            <select
              className={commonInputClasses}
              value={task.priority}
              onChange={(e) => setTask({ ...task, priority: e.target.value })}
              disabled={loading}
            >
              <option value="">Select priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Description (Optional)
            </label>
            <textarea
              placeholder="Enter task description"
              className={`${commonInputClasses} resize-none`}
              rows={4}
              value={task.description}
              onChange={(e) => setTask({ ...task, description: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-[#232945]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg font-semibold bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 border border-gray-500/30 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectTaskModal;
