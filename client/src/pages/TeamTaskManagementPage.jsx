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
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} />

      {/* Main Content
          The offset was `ml-20`/`ml-64` — 80px and 256px — against a sidebar
          that is 64px and 224px wide. Every other page in the app uses the
          matching values, so this one sat 16px (collapsed) or 32px (expanded)
          out of alignment at every screen size. Now on the shared `.app-offset`
          class along with the rest, which also gives it the mobile drawer
          behaviour it never had. */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 sm:py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Team Task Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 sm:text-sm">
            Monitor and manage tasks for your team members
          </p>
        </div>

        {/* Split View Layout
            Was a hard `grid-cols-12` with a 4/8 split, which on a 375px screen
            gave the member list 125px — narrower than the names it holds — and
            the task panel 250px. Below `lg` the two panels stack instead: the
            member list takes its natural height (capped, so it can't push the
            tasks off-screen) and the task view fills what's left. */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:overflow-hidden">
          <div className="flex h-full flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-6">
            {/* Left Panel - Team Member List */}
            <div className="max-h-[40vh] shrink-0 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-4 lg:max-h-none lg:shrink">
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
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6 lg:col-span-8">
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
