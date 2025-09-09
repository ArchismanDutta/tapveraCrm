import React, { useState, useEffect, useRef } from "react";
import API from "../../api";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const TaskForm = ({ onCreate }) => {
  const [task, setTask] = useState({
    title: "",
    assignedTo: [],
    dueDate: null, // use Date object here, not string
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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/api/users");
        if (Array.isArray(res.data)) setUsers(res.data);
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
    };
    fetchUsers();
  }, []);

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

    const dueDateOnly = task.dueDate;
    // Combine dueDate date part with dueTime string part into one Date object
    let combinedDueDate;
    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(":");
      combinedDueDate = new Date(dueDateOnly);
      combinedDueDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    } else {
      combinedDueDate = dueDateOnly;
    }

    const formattedTask = { ...task, dueDate: combinedDueDate };
    onCreate(formattedTask);

    setTask({
      title: "",
      assignedTo: [],
      dueDate: null,
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
    "bg-[#141a29] border border-[rgba(84,123,209,0.4)] p-2 rounded-lg shadow-sm text-sm text-blue-100 w-full focus:ring-2 focus:ring-[#ff8000] outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Task Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Task Title</label>
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
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium mb-1">Assign To (Multiple)</label>
        <div
          className={`${commonInputClasses} cursor-pointer`}
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          {task.assignedTo.length > 0
            ? `${task.assignedTo.length} user(s) selected`
            : "Select users..."}
        </div>

        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1 border border-[rgba(84,123,209,0.4)] bg-[#141a29] rounded-lg shadow-lg w-full z-50 text-blue-100 max-h-60 overflow-y-auto">
            <div className="p-2 border-b border-[rgba(84,123,209,0.4)]">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#141a29] border border-[rgba(84,123,209,0.4)] rounded-2xl p-2 text-blue-100 w-full focus:ring-2 focus:ring-[#ff8000] outline-none"
              />
            </div>

            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <label
                  key={user._id}
                  className="flex items-center px-3 py-2 hover:bg-[rgba(255,128,0,0.15)] cursor-pointer rounded-md"
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
              <div className="px-3 py-2 text-sm text-blue-300">No users found</div>
            )}
          </div>
        )}
      </div>

      {/* Date + Time Picker */}
      <div className="flex gap-3">
        {/* Custom Date Picker */}
        <div className="w-full">
          <label className="block text-sm font-medium mb-1 text-blue-100">Due Date</label>
          <ReactDatePicker
            selected={task.dueDate}
            onChange={(date) => setTask({ ...task, dueDate: date })}
            className={commonInputClasses}
            placeholderText="Select due date"
            minDate={new Date()}
            dateFormat="yyyy-MM-dd"
            isClearable
            wrapperClassName="w-full"
          />
        </div>

        {/* Time */}
        <div className="relative w-full" ref={timeRef}>
          <label className="block text-sm font-medium mb-1 text-blue-100">Due Time</label>
          <input
            type="text"
            readOnly
            placeholder="Select Time"
            className={`${commonInputClasses} cursor-pointer`}
            value={task.dueTime}
            onClick={() => setTimeOpen((prev) => !prev)}
          />
          {timeOpen && (
            <div className="absolute top-full mt-1 bg-[#141a29] border border-[rgba(84,123,209,0.4)] rounded-2xl shadow-lg max-h-60 overflow-y-auto w-full z-50 text-blue-100">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="px-3 py-1 hover:bg-[#ff8000]/50 cursor-pointer rounded-md text-sm"
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
        <label className="block text-sm font-medium mb-1">Priority</label>
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
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          placeholder="Enter task description"
          className={`${commonInputClasses} resize-none`}
          rows={3}
          value={task.description}
          onChange={(e) => setTask({ ...task, description: e.target.value })}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full p-3 rounded-lg font-semibold bg-gradient-to-r from-[#ff8000] to-[#ffa733] text-black hover:opacity-90 transition cursor-pointer"
      >
        Create Task
      </button>
    </form>
  );
};

export default TaskForm;
