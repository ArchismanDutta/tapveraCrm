import React, { useState } from "react";
import { FaPlus, FaEllipsisV } from "react-icons/fa";
import TaskItem from "./TaskItem";

const TaskKanban = ({ tasks, onStatusChange, loading }) => {
  const [draggedTask, setDraggedTask] = useState(null);
  const [draggedOver, setDraggedOver] = useState(null);

  // Define columns for the Kanban board
  const columns = [
    {
      id: 'pending',
      title: 'Pending',
      color: 'bg-gray-500',
      borderColor: 'border-gray-500',
      bgLight: 'bg-gray-500/10'
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      color: 'bg-blue-500',
      borderColor: 'border-blue-500',
      bgLight: 'bg-blue-500/10'
    },
    {
      id: 'completed',
      title: 'Completed',
      color: 'bg-green-500',
      borderColor: 'border-green-500',
      bgLight: 'bg-green-500/10'
    }
  ];

  // Group tasks by status
  const tasksByStatus = tasks.reduce((acc, task) => {
    const status = task.status || 'pending';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(task);
    return acc;
  }, {});

  // Handle drag start
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '';
    setDraggedTask(null);
    setDraggedOver(null);
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drag enter
  const handleDragEnter = (e, columnId) => {
    e.preventDefault();
    setDraggedOver(columnId);
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only remove draggedOver if we're actually leaving the column
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDraggedOver(null);
    }
  };

  // Handle drop
  const handleDrop = (e, newStatus) => {
    e.preventDefault();

    if (draggedTask && draggedTask.status !== newStatus) {
      onStatusChange(draggedTask._id, newStatus);
    }

    setDraggedTask(null);
    setDraggedOver(null);
  };

  // Get task count for a column
  const getTaskCount = (columnId) => {
    return tasksByStatus[columnId]?.length || 0;
  };

  // Handle task status update from TaskItem
  const handleTaskStatusUpdate = (updatedTask) => {
    if (onStatusChange) {
      onStatusChange(updatedTask._id, updatedTask.status);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 border border-blue-950">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff8000]"></div>
          <span className="ml-3 text-blue-400">Loading tasks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181d2a] rounded-lg shadow-lg p-4 border border-blue-950">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-blue-100 text-lg">Tasks (Kanban View)</h3>
        <div className="flex items-center gap-4 text-sm text-blue-400">
          <span>{tasks.length} total tasks</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <span>{getTaskCount('pending')} Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>{getTaskCount('in-progress')} In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>{getTaskCount('completed')} Completed</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div className="mb-6 bg-[#141a29] rounded-lg p-3 border border-blue-950">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-300 font-medium">Overall Progress</span>
            <span className="text-sm text-[#ff8000] font-bold">
              {Math.round((getTaskCount('completed') / tasks.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[#ff8000] to-[#ffb366] h-2 rounded-full transition-all duration-500"
              style={{
                width: `${(getTaskCount('completed') / tasks.length) * 100}%`
              }}
            ></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((column) => {
          const columnTasks = tasksByStatus[column.id] || [];
          const isDropTarget = draggedOver === column.id;

          return (
            <div
              key={column.id}
              className={`bg-[#141a29] rounded-lg border-2 transition-all duration-200 ${
                isDropTarget
                  ? `${column.borderColor} ${column.bgLight}`
                  : 'border-blue-950 hover:border-blue-900'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="p-4 border-b border-blue-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                    <h4 className="font-semibold text-blue-100">{column.title}</h4>
                    <span className="bg-blue-950 text-blue-300 text-xs px-2 py-1 rounded-full">
                      {getTaskCount(column.id)}
                    </span>
                  </div>
                  <button className="text-blue-400 hover:text-blue-300 transition">
                    <FaEllipsisV className="text-sm" />
                  </button>
                </div>
              </div>

              {/* Column Body */}
              <div className="p-4 space-y-3 min-h-[400px]">
                {columnTasks.length > 0 ? (
                  columnTasks.map((task) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-move transition-all duration-200 hover:scale-[1.02] ${
                        draggedTask && draggedTask._id === task._id
                          ? 'opacity-50 transform rotate-1 scale-105'
                          : 'opacity-100'
                      }`}
                    >
                      <TaskItem
                        task={task}
                        onStatusUpdated={handleTaskStatusUpdate}
                        isKanbanCard={true}
                      />
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-blue-400">
                    <div className="bg-blue-950/50 rounded-full p-4 mb-3">
                      <FaPlus className="text-2xl opacity-50" />
                    </div>
                    <p className="text-sm opacity-75">No {column.title.toLowerCase()} tasks</p>
                    <p className="text-xs opacity-50 mt-1">Drag tasks here to update status</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag Instructions */}
      {draggedTask && (
        <div className="mt-4 p-3 bg-[#ff8000]/10 border border-[#ff8000]/30 rounded-lg">
          <p className="text-sm text-[#ff8000]">
            💡 Drag the task to a different column to change its status
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskKanban;