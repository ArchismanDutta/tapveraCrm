import React from "react";
import { Users, CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";

const TeamMemberList = ({ teamMembers, selectedMember, onSelectMember, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!teamMembers || teamMembers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Users className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">No team members found</p>
      </div>
    );
  }

  // Calculate total high priority tasks
  const totalHighPriority = teamMembers.reduce((sum, member) => sum + (member.stats?.highPriorityTasks || 0), 0);

  return (
    <div className="space-y-2">
      {/* High Priority Summary Banner */}
      {totalHighPriority > 0 && (
        <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm text-orange-700 dark:text-orange-300 font-medium flex items-center gap-2">
            <span>⚠</span>
            {totalHighPriority} high priority task{totalHighPriority !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {teamMembers.map((member) => {
        const isSelected = selectedMember?.userId === member.userId;
        const { stats } = member;

        return (
          <div
            key={member.userId}
            onClick={() => onSelectMember(member)}
            className={`
              p-4 rounded-lg border cursor-pointer transition-all
              ${
                isSelected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 shadow-md"
                  : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-sm"
              }
            `}
          >
            {/* Member Info */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {member.designation || "N/A"} • {member.employeeId || "N/A"}
                </p>
              </div>
              {stats.overdueTasks > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {stats.overdueTasks} overdue
                </span>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Total:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.totalTasks}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                <span className="text-gray-600 dark:text-gray-400">Done:</span>
                <span className="font-semibold text-green-700 dark:text-green-400">{stats.completedTasks}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                <span className="text-gray-600 dark:text-gray-400">In Progress:</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">{stats.inProgressTasks}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400" />
                <span className="text-gray-600 dark:text-gray-400">Pending:</span>
                <span className="font-semibold text-yellow-700 dark:text-yellow-400">{stats.pendingTasks}</span>
              </div>
            </div>

            {/* High Priority Badge */}
            {stats.highPriorityTasks > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="inline-flex items-center text-xs text-orange-600 dark:text-orange-400">
                  <span className="mr-1">⚠</span>
                  {stats.highPriorityTasks} high priority task{stats.highPriorityTasks !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TeamMemberList;
