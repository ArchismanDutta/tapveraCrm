import React from "react";
import TaskList from "../components/task/TaskList";
import RequirementsForm from "../components/task/RequirementsForm";
import ChatBox from "../components/task/ChatBox";

const Tasks = () => {
  return (
    <div className="flex h-screen bg-gray-50 p-6 gap-6">
      {/* Middle Section - Task List */}
      <div className="flex-1 bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-semibold mb-4">My Tasks</h2>
        <TaskList />
      </div>

      {/* Right Section - Requirements & Chat */}
      <div className="w-1/3 flex flex-col bg-white rounded-xl shadow">
        <div className="border-b p-4">
          <RequirementsForm />
        </div>
        <div className="flex-1">
          <ChatBox />
        </div>
      </div>
    </div>
  );
};

export default Tasks;
