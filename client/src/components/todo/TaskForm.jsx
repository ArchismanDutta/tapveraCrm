import React, { useState, useEffect } from "react";

const TaskForm = ({ task, onSave, onClose }) => {
  const [title, setTitle] = useState(task?.title || "");
  const [label, setLabel] = useState(task?.label || "");
  const [time, setTime] = useState(task?.time || "");
  const [description, setDescription] = useState(task?.description || "");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setLabel(task.label || "");
      setTime(task.time || "");
      setDescription(task.description || "");
    }
  }, [task]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Normalize date to start of day if not present (new task)
    let taskDate = task?.date;
    if (!taskDate) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      taskDate = d.toISOString();
    }

    onSave({
      ...task,
      title: title.trim(),
      label,
      time,
      description,
      date: taskDate,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="taskFormTitle"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white max-w-lg w-full p-8 rounded-lg shadow-2xl flex flex-col space-y-6"
        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
      >
        <h3
          id="taskFormTitle"
          className="text-3xl font-extrabold text-gray-900 border-b border-yellow-500 pb-3 mb-6 select-none"
        >
          {task ? "Edit Task" : "Add New Task"}
        </h3>
        <div className="flex flex-col space-y-1">
          <label
            htmlFor="task-title"
            className="text-gray-700 font-semibold cursor-pointer"
          >
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            placeholder="Enter task title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="border border-gray-300 rounded-md px-4 py-3 text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          />
        </div>
        <div className="flex flex-col space-y-1">
          <label
            htmlFor="task-label"
            className="text-gray-700 font-semibold cursor-pointer"
          >
            Priority
          </label>
          <select
            id="task-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border border-gray-300 rounded-md px-4 py-3 text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          >
            <option value="">Select priority</option>
            <option value="High">🔥 High</option>
            <option value="Medium">⚠️ Medium</option>
            <option value="Low">🌿 Low</option>
          </select>
        </div>
        <div className="flex flex-col space-y-1">
          <label
            htmlFor="task-time"
            className="text-gray-700 font-semibold cursor-pointer"
          >
            Due Time
          </label>
          <input
            id="task-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border border-gray-300 rounded-md px-4 py-3 text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          />
        </div>
        <div className="flex flex-col space-y-1">
          <label
            htmlFor="task-desc"
            className="text-gray-700 font-semibold cursor-pointer"
          >
            Description
          </label>
          <textarea
            id="task-desc"
            rows={4}
            placeholder="Details about the task"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-gray-300 rounded-md px-4 py-3 resize-none text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          />
        </div>
        <div className="flex justify-end space-x-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-md bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 rounded-md bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white font-bold shadow-lg hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700 transition"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
