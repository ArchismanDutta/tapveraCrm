import React, { useState, useEffect } from "react";

const gradientBorder =
  "border border-transparent bg-clip-padding bg-origin-border bg-gradient-to-r from-orange-400 to-yellow-500 p-1";

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
        backgroundColor: "rgba(19,23,32,0.93)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: "1rem"
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="taskFormTitle"
    >
      <form
        onSubmit={handleSubmit}
        className={`max-w-lg w-full p-9 rounded-[1rem] shadow-2xl ${gradientBorder} bg-[#161c2c] flex flex-col space-y-6`}
        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
      >
        <h3
          id="taskFormTitle"
          className="text-2xl font-extrabold text-yellow-400 border-b border-yellow-500 pb-3 mb-2 select-none"
        >
          {task ? "Edit Task" : "Add New Task"}
        </h3>
        <div className="flex flex-col space-y-2">
          <label
            htmlFor="task-title"
            className="text-gray-200 font-semibold cursor-pointer"
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
            className="border border-[#232945] rounded-md px-4 py-3 text-lg placeholder-gray-500 bg-[#181c28] text-gray-100 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          />
        </div>
        <div className="flex flex-col space-y-2">
          <label
            htmlFor="task-label"
            className="text-gray-200 font-semibold cursor-pointer"
          >
            Priority
          </label>
          <select
            id="task-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border border-[#232945] rounded-md px-4 py-3 text-lg bg-[#181c28] text-gray-100 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          >
            <option value="">Select priority</option>
            <option value="High">🔥 High</option>
            <option value="Medium">⚠️ Medium</option>
            <option value="Low">🌿 Low</option>
          </select>
        </div>
        <div className="flex flex-col space-y-2">
          <label
            htmlFor="task-time"
            className="text-gray-200 font-semibold cursor-pointer"
          >
            Due Time
          </label>
          <input
            id="task-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border border-[#232945] rounded-md px-4 py-3 text-lg bg-[#181c28] text-gray-100 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          />
        </div>
        <div className="flex flex-col space-y-2">
          <label
            htmlFor="task-desc"
            className="text-gray-200 font-semibold cursor-pointer"
          >
            Description
          </label>
          <textarea
            id="task-desc"
            rows={4}
            placeholder="Details about the task"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-[#232945] rounded-md px-4 py-3 resize-none text-lg bg-[#181c28] text-gray-100 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 transition"
          />
        </div>
        <div className="flex justify-end space-x-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-md bg-[#232945] text-gray-300 font-semibold hover:bg-[#444c6a] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 rounded-md bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-gray-900 font-bold shadow hover:from-yellow-500 hover:via-amber-600 hover:to-orange-600 transition"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
