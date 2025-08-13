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
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/users");
        if (Array.isArray(res.data)) {
          setUsers(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
    };
    fetchUsers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
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

    let combinedDueDate = task.dueDate && task.dueTime
      ? new Date(`${task.dueDate}T${task.dueTime}:00`)
      : new Date(`${task.dueDate}T00:00:00`);

    const formattedTask = {
      ...task,
      dueDate: combinedDueDate,
    };

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
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-100 rounded-xl shadow-lg p-6 border border-yellow-200 space-y-5"
    >
      <h3 className="text-xl font-bold text-orange-500 flex items-center gap-2">
        📝 Create New Task
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Task Title
          </label>
          <input
            type="text"
            placeholder="Enter task title"
            className="border border-yellow-200 p-2 rounded-lg w-full text-sm"
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
            required
          />
        </div>

        {/* Multi-select Dropdown */}
        <div ref={dropdownRef}>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Assign To (Multiple)
          </label>
          <div
            className="border border-yellow-200 p-2 rounded-lg bg-white text-sm cursor-pointer"
            onClick={() => setDropdownOpen((prev) => !prev)}
          >
            {task.assignedTo.length > 0
              ? `${task.assignedTo.length} user(s) selected`
              : "Select users..."}
          </div>

          {dropdownOpen && (
            <div className="border border-yellow-200 bg-white rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto absolute z-10 w-[calc(50%-0.5rem)]">
              {users.map((user) => (
                <label
                  key={user._id}
                  className="flex items-center px-3 py-2 hover:bg-yellow-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={task.assignedTo.includes(user._id)}
                    onChange={() => toggleUserSelection(user._id)}
                    className="mr-2"
                  />
                  {user.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Due Date
          </label>
          <input
            type="date"
            className="border border-yellow-200 p-2 rounded-lg w-full text-sm"
            value={task.dueDate}
            onChange={(e) => setTask({ ...task, dueDate: e.target.value })}
            required
          />
        </div>

        {/* Due Time */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Due Time
          </label>
          <input
            type="time"
            className="border border-yellow-200 p-2 rounded-lg w-full text-sm"
            value={task.dueTime}
            onChange={(e) => setTask({ ...task, dueTime: e.target.value })}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Priority
          </label>
          <select
            className="border border-yellow-200 p-2 rounded-lg w-full text-sm bg-white"
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
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-orange-600 mb-1">
          Description
        </label>
        <textarea
          placeholder="Enter task description"
          className="border border-yellow-200 p-2 rounded-lg w-full text-sm"
          rows={3}
          value={task.description}
          onChange={(e) => setTask({ ...task, description: e.target.value })}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full p-3 rounded-lg font-semibold bg-gradient-to-r from-yellow-300 to-orange-400"
      >
        Create Task
      </button>
    </form>
  );
};

export default TaskForm;
