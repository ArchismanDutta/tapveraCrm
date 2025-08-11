import React, { useState } from "react";

const TaskForm = ({ onCreate }) => {
  const [task, setTask] = useState({
    title: "",
    assignedTo: "",
    assignedAvatar: "",
    dueDate: "",
    priority: "",
    status: "Pending",
    description: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!task.title || !task.assignedTo) return;
    onCreate(task);
    setTask({
      title: "",
      assignedTo: "",
      assignedAvatar: "",
      dueDate: "",
      priority: "",
      status: "Pending",
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
        {/* Task Title */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Task Title
          </label>
          <input
            type="text"
            placeholder="Enter task title"
            className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg w-full text-sm"
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
          />
        </div>

        {/* Assign To */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Assign To
          </label>
          <select
            className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg w-full text-sm bg-white"
            value={task.assignedTo}
            onChange={(e) =>
              setTask({
                ...task,
                assignedTo: e.target.value,
                assignedAvatar: `https://i.pravatar.cc/40?u=${e.target.value}`,
              })
            }
          >
            <option value="">Select employee</option>
            <option>Sarah Johnson</option>
            <option>Mike Wilson</option>
            <option>Emily Davis</option>
          </select>
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Due Date
          </label>
          <input
            type="date"
            className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg w-full text-sm"
            value={task.dueDate}
            onChange={(e) => setTask({ ...task, dueDate: e.target.value })}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-semibold text-orange-600 mb-1">
            Priority
          </label>
          <select
            className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg w-full text-sm bg-white"
            value={task.priority}
            onChange={(e) => setTask({ ...task, priority: e.target.value })}
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
          className="border border-yellow-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 p-2 rounded-lg w-full text-sm"
          rows={3}
          value={task.description}
          onChange={(e) => setTask({ ...task, description: e.target.value })}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full p-3 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200 bg-gradient-to-r from-yellow-300 via-orange-300 to-orange-400 text-black hover:from-orange-400 hover:to-yellow-300 transform active:scale-95"
      >
        Create Task
      </button>
    </form>
  );
};

export default TaskForm;
