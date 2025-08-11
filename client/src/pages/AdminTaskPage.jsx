import React, { useState, useEffect } from "react";
import StatsCard from "../components/admintask/StatsCard"; // ✅ Ensure filename matches
import TaskForm from "../components/admintask/TaskForm";
import TaskTable from "../components/admintask/TaskTable";

const AdminTaskPage = () => {
  const [tasks, setTasks] = useState([]);

  // Load initial mock tasks
  useEffect(() => {
    setTasks([
      {
        id: 1,
        title: "Client Meeting - Project Alpha",
        assignedTo: "Sarah Johnson",
        assignedAvatar: "https://i.pravatar.cc/40?img=1",
        dueDate: "2025-08-08",
        priority: "High",
        status: "Pending",
      },
      {
        id: 2,
        title: "Report Submission - Q3 Review",
        assignedTo: "Mike Wilson",
        assignedAvatar: "https://i.pravatar.cc/40?img=2",
        dueDate: "2025-08-08",
        priority: "Medium",
        status: "Completed",
      },
      {
        id: 3,
        title: "Team Sync",
        assignedTo: "Emily Davis",
        assignedAvatar: "https://i.pravatar.cc/40?img=3",
        dueDate: "2025-08-08",
        priority: "Low",
        status: "Overdue",
      },
    ]);
  }, []);

  // Add new task
  const handleCreateTask = (newTask) => {
    setTasks((prev) => [...prev, { ...newTask, id: Date.now() }]);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Tasks" value={tasks.length} color="text-gray-900" />
        <StatsCard
          title="Pending Tasks"
          value={tasks.filter((t) => t.status === "Pending").length}
          color="text-yellow-500"
        />
        <StatsCard
          title="Completed Tasks"
          value={tasks.filter((t) => t.status === "Completed").length}
          color="text-green-500"
        />
        <StatsCard
          title="Overdue Tasks"
          value={tasks.filter((t) => t.status === "Overdue").length}
          color="text-red-500"
        />
      </div>

      {/* Create New Task */}
      <TaskForm onCreate={handleCreateTask} />

      {/* Task List */}
      <TaskTable tasks={tasks} />
    </div>
  );
};

export default AdminTaskPage;
