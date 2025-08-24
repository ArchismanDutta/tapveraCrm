// src/components/admintask/TaskForm.jsx
import React, { useState, useEffect, useRef } from "react";
import API from "../../api";

const TaskForm = ({ onCreate }) => {
  const [task, setTask] = useState({
    title: "",
    assignedTo: [],
    dueDate: "",
    dueTime: "",
    priority: "",
    status: "pending",
    description: "",
  });

  const [users, setUsers] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const [timeOpen, setTimeOpen] = useState(false);
  const timeRef = useRef(null);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/users");
        if (Array.isArray(res.data)) setUsers(res.data);
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
    };
    fetchUsers();
  }, []);

  // Close dropdown and time picker when clicking outside
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!task.title || task.assignedTo.length === 0 || !task.dueDate) return;

    const combinedDueDate =
      task.dueDate && task.dueTime
        ? new Date(`${task.dueDate}T${task.dueTime}:00`)
        : new Date(`${task.dueDate}T00:00:00`);

    const formattedTask = { ...task, dueDate: combinedDueDate };
    onCreate(formattedTask);

    setTask({
      title: "",
      assignedTo: [],
      dueDate: "",
      dueTime: "",
      priority: "",
      status: "pending",
      description: "",
    });
    setSearchTerm("");
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Generate time slots for time picker
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
    "border border-gray-300 p-2 rounded-xl shadow-sm text-sm w-full focus:ring-2 focus:ring-pinkAccent focus:border-pinkAccent outline-none cursor-pointer";

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white rounded-xl shadow-md">
      {/* Task Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Task Title
        </label>
        <input
          type="text"
          placeholder="Enter task title"
          className={commonInputClasses}
          value={task.title}
          onChange={(e) => setTask({ ...task, title: e.target.value })}
          required
        />
      </div>

      {/* Assign To */}
      <div ref={dropdownRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assign To (Multiple)
        </label>
        <div
          className={commonInputClasses}
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          {task.assignedTo.length > 0
            ? `${task.assignedTo.length} user(s) selected`
            : "Select users..."}
        </div>

        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1 border border-gray-200 bg-white rounded-xl shadow-lg w-full z-10">
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={commonInputClasses}
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <label
                    key={user._id}
                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer rounded-xl"
                  >
                    <input
                      type="checkbox"
                      checked={task.assignedTo.includes(user._id)}
                      onChange={() => toggleUserSelection(user._id)}
                      className="mr-2 cursor-pointer"
                    />
                    {user.name}
                  </label>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Date + Time Picker */}
      <div className="flex gap-3">
        {/* Date */}
        <input
          type="date"
          className={commonInputClasses}
          value={task.dueDate}
          onChange={(e) => setTask({ ...task, dueDate: e.target.value })}
          required
        />

        {/* Time */}
        <div className="relative w-full" ref={timeRef}>
          <input
            type="text"
            readOnly
            placeholder="Select Time"
            className={commonInputClasses}
            value={task.dueTime}
            onClick={() => setTimeOpen(!timeOpen)}
          />
          {timeOpen && (
            <div className="absolute top-full mt-1 bg-white shadow-lg rounded-xl p-2 max-h-40 overflow-y-auto w-full z-20">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="px-3 py-1 hover:bg-pinkAccent/20 cursor-pointer rounded-md text-sm"
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority
        </label>
        <select
          className={commonInputClasses}
          value={task.priority}
          onChange={(e) => setTask({ ...task, priority: e.target.value })}
          required
        >
          <option value="">Select priority</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          placeholder="Enter task description"
          className={commonInputClasses + " resize-none"}
          rows={3}
          value={task.description}
          onChange={(e) => setTask({ ...task, description: e.target.value })}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full p-3 rounded-xl font-semibold bg-gradient-to-r from-pinkAccent to-orange-500 text-black hover:opacity-90 transition cursor-pointer"
      >
        Create Task
      </button>
    </form>
  );
};

export default TaskForm;
