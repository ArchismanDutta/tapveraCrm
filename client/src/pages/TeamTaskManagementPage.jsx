import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import TeamMemberList from "../components/teamtasks/TeamMemberList";
import TeamMemberTaskView from "../components/teamtasks/TeamMemberTaskView";
import ViewTaskDetailsModal from "../components/teamtasks/ViewTaskDetailsModal";
import {
  EditTaskModal,
  DeleteTaskModal,
  ReassignTaskModal,
} from "../components/teamtasks/TaskActionModals";
import API from "../api";
import { toast } from "react-hot-toast";

const TeamTaskManagementPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Fetch team overview data
  const fetchTeamOverview = useCallback(async () => {
    setLoading(true);
    try {
      // API instance from api.js already adds token via interceptor
      const response = await API.get("/api/tasks/team-overview");

      setTeamMembers(response.data.teamMembers || []);

      // Auto-select first member if available
      if (response.data.teamMembers && response.data.teamMembers.length > 0 && !selectedMember) {
        setSelectedMember(response.data.teamMembers[0]);
      }
    } catch (error) {
      console.error("Error fetching team overview:", error);
      if (error.response?.status === 403) {
        toast.error("You don't have permission to view team tasks");
      } else {
        toast.error("Failed to load team overview");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedMember]);

  useEffect(() => {
    fetchTeamOverview();
  }, []);

  // Handle member selection
  const handleSelectMember = (member) => {
    setSelectedMember(member);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchTeamOverview();
  };

  // Task action handlers
  const handleEditTask = (task) => {
    setSelectedTask(task);
    setEditModalOpen(true);
  };

  const handleDeleteTask = (task) => {
    setSelectedTask(task);
    setDeleteModalOpen(true);
  };

  const handleReassignTask = (task) => {
    setSelectedTask(task);
    setReassignModalOpen(true);
  };

  const handleViewDetails = (task) => {
    setSelectedTask(task);
    setViewDetailsModalOpen(true);
  };

  // Close all modals
  const closeAllModals = () => {
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    setReassignModalOpen(false);
    setViewDetailsModalOpen(false);
    setSelectedTask(null);
  };

  // Handle modal success (refresh data)
  const handleModalSuccess = () => {
    fetchTeamOverview();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} />

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Task Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage tasks for your team members
          </p>
        </div>

        {/* Split View Layout */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-12 gap-6 h-full">
            {/* Left Panel - Team Member List */}
            <div className="col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
              <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}
                </p>
              </div>
              <TeamMemberList
                teamMembers={teamMembers}
                selectedMember={selectedMember}
                onSelectMember={handleSelectMember}
                loading={loading}
              />
            </div>

            {/* Right Panel - Task View */}
            <div className="col-span-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
              <TeamMemberTaskView
                selectedMember={selectedMember}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onReassignTask={handleReassignTask}
                onViewDetails={handleViewDetails}
                onRefresh={handleRefresh}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {viewDetailsModalOpen && selectedTask && (
        <ViewTaskDetailsModal task={selectedTask} onClose={closeAllModals} />
      )}
      {editModalOpen && selectedTask && (
        <EditTaskModal
          task={selectedTask}
          onClose={closeAllModals}
          onSuccess={handleModalSuccess}
        />
      )}
      {deleteModalOpen && selectedTask && (
        <DeleteTaskModal
          task={selectedTask}
          onClose={closeAllModals}
          onSuccess={handleModalSuccess}
        />
      )}
      {reassignModalOpen && selectedTask && (
        <ReassignTaskModal
          task={selectedTask}
          onClose={closeAllModals}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default TeamTaskManagementPage;
