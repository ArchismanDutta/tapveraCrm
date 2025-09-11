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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="taskFormTitle"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 rounded-3xl bg-gradient-to-br from-blue-900/80 to-blue-800/70 backdrop-blur-sm shadow-2xl flex flex-col gap-6"
      >
        <h3
          id="taskFormTitle"
          className="text-2xl font-extrabold text-white border-b border-white/20 pb-3 mb-4 select-none"
        >
          {task ? "Edit Task" : "Add New Task"}
        </h3>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <label htmlFor="task-title" className="text-gray-200 font-semibold">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            placeholder="Enter task title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg px-4 py-3 bg-blue-950/20 border border-blue-700 text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-2">
          <label htmlFor="task-label" className="text-gray-200 font-semibold">
            Priority
          </label>
          <select
            id="task-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg px-4 py-3 bg-blue-950/20 border border-blue-700 text-black focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer"
          >
            <option value="" className="text-gray/70">
              Select priority
            </option>
            <option value="High">🔥 High</option>
            <option value="Medium">⚠️ Medium</option>
            <option value="Low">🌿 Low</option>
          </select>
        </div>

        {/* Due Time */}
        <div className="flex flex-col gap-2">
          <label htmlFor="task-time" className="text-gray-200 font-semibold">
            Due Time
          </label>
          <input
            id="task-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg px-4 py-3 bg-blue-950/20 border border-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <label htmlFor="task-desc" className="text-gray-200 font-semibold">
            Description
          </label>
          <textarea
            id="task-desc"
            rows={4}
            placeholder="Details about the task"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg px-4 py-3 bg-blue-950/20 border border-blue-700 text-white placeholder-blue-200/50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-lg bg-blue-800/40 text-white font-semibold hover:bg-blue-800/70 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-400 to-blue-600 text-black font-bold shadow-lg hover:from-blue-500 hover:to-blue-700 transition"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
