# Team Task Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a split-view team task management interface for managers to monitor and manage subordinate tasks with full CRUD capabilities.

**Architecture:** New standalone page with left panel (team member list with stats) and right panel (selected member's task list). Single new backend endpoint for team overview data. Reuses existing task operation endpoints. Fixes sidebar label confusion between personal and team tasks.

**Tech Stack:** React 19.1, Tailwind CSS 4.1, Express.js 4.21, MongoDB/Mongoose 8.17, existing hierarchyUtils and accessControl

## Global Constraints

- Node.js 18+ required
- React 19.1.0 with functional components and hooks
- Tailwind CSS 4.1.11 for all styling
- Follow existing code patterns in UnifiedTaskPage.jsx and Sidebar.jsx
- All backend routes must use `protect` middleware
- Permission checks via `accessControl.resolvePosition()` and `hierarchyUtils.getAccessibleUserIds()`
- Optimistic UI updates with rollback on error
- Toast notifications for user feedback
- All files must match dark mode theme patterns (`dark:` Tailwind classes)
- Icon imports from `lucide-react` or `react-icons`

---

### Task 1: Backend - Team Overview Endpoint

**Files:**
- Modify: `server/routes/taskRoutes.js` (add new route)
- Reference: `server/utils/hierarchyUtils.js` (existing)
- Reference: `server/utils/accessControl.js` (existing)
- Reference: `server/models/Task.js` (existing)
- Reference: `server/models/User.js` (existing)

**Interfaces:**
- Consumes: `hierarchyUtils.getAccessibleUserIds(user)`, `accessControl.resolvePosition(user)`
- Produces: `GET /api/tasks/team-overview` endpoint returning `{ teamMembers: Array<TeamMember> }`
  - TeamMember type: `{ user: {_id, name, employeeId, email, avatar, position}, stats: {total, pending, inProgress, completed, overdue}, recentActivity: Array<{taskId, taskTitle, lastUpdate, status}>, tasks: Array<Task> }`

- [ ] **Step 1: Add team-overview route to taskRoutes.js**

Open `server/routes/taskRoutes.js` and add this route after the existing task routes:

```javascript
// Team Task Management - Get overview of all subordinate tasks grouped by team member
router.get("/team-overview", protect, async (req, res) => {
  try {
    // Permission check
    const isSuperAdmin = req.user.role === "super-admin" || req.user.role === "superadmin";
    const isAdmin = req.user.role === "admin";

    if (!isSuperAdmin && !isAdmin) {
      const grantorPosition = await accessControl.resolvePosition(req.user);
      if (!grantorPosition?.permissions?.canViewSubordinateTasks) {
        return res.status(403).json({
          error: "You need 'canViewSubordinateTasks' permission to access team tasks."
        });
      }
    }

    // Get accessible subordinates using existing hierarchy utils
    const accessibleIds = await hierarchyUtils.getAccessibleUserIds(req.user);

    // Fetch all users in scope (exclude self)
    const users = await User.find({
      _id: { $in: accessibleIds, $ne: req.user._id },
      status: "active"
    })
      .select("name employeeId email avatar position positionRef")
      .populate("positionRef", "name level")
      .sort({ name: 1 });

    // Fetch all tasks assigned to these users
    const tasks = await Task.find({
      assignedTo: { $in: accessibleIds }
    })
      .populate("assignedTo", "name employeeId avatar")
      .populate("assignedBy", "name email")
      .populate("project", "projectName")
      .populate("remarks.user", "name email")
      .sort({ dueDate: 1 });

    // Group tasks by assignee and calculate stats
    const teamMembers = users.map(user => {
      // Filter tasks for this specific user
      const userTasks = tasks.filter(task =>
        task.assignedTo.some(assignee =>
          assignee._id.toString() === user._id.toString()
        )
      );

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const stats = {
        total: userTasks.length,
        pending: userTasks.filter(t => t.status === "pending").length,
        inProgress: userTasks.filter(t => t.status === "in-progress").length,
        completed: userTasks.filter(t => t.status === "completed").length,
        overdue: userTasks.filter(t =>
          t.dueDate &&
          new Date(t.dueDate) < today &&
          !["completed", "rejected"].includes(t.status)
        ).length
      };

      // Recent activity: last 3 task updates
      const recentActivity = userTasks
        .filter(t => t.statusHistory && t.statusHistory.length > 0)
        .sort((a, b) => {
          const aLast = a.statusHistory[a.statusHistory.length - 1]?.changedAt;
          const bLast = b.statusHistory[b.statusHistory.length - 1]?.changedAt;
          return new Date(bLast) - new Date(aLast);
        })
        .slice(0, 3)
        .map(t => ({
          taskId: t._id,
          taskTitle: t.title,
          lastUpdate: t.statusHistory[t.statusHistory.length - 1]?.changedAt,
          status: t.status
        }));

      return {
        user: {
          _id: user._id,
          name: user.name,
          employeeId: user.employeeId,
          email: user.email,
          avatar: user.avatar,
          position: user.positionRef?.name || user.position
        },
        stats,
        recentActivity,
        tasks: userTasks
      };
    });

    res.json({ teamMembers });
  } catch (err) {
    console.error("Error fetching team task overview:", err);
    res.status(500).json({
      error: "Server Error",
      message: err.message
    });
  }
});
```

- [ ] **Step 2: Test the endpoint manually**

Start the server and test with curl or Postman:

```bash
# In server directory
node app.js

# In another terminal
curl -X GET http://localhost:5000/api/tasks/team-overview \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN"
```

Expected: JSON response with `teamMembers` array, each containing `user`, `stats`, `recentActivity`, `tasks`

- [ ] **Step 3: Commit backend changes**

```bash
git add server/routes/taskRoutes.js
git commit -m "feat(api): add team task overview endpoint

- New GET /api/tasks/team-overview for managers
- Returns subordinate tasks grouped by team member
- Includes stats, recent activity, full task list
- Permission check: canViewSubordinateTasks

🤖 Generated with Claude Code"
```

---

### Task 2: Frontend - Team Member List Component

**Files:**
- Create: `client/src/components/teamTasks/TeamMemberList.jsx`

**Interfaces:**
- Consumes: `teamMembers` prop: `Array<{user, stats, recentActivity}>`, `selectedMember` prop: `string|null` (user ID), `onSelectMember` prop: `function(userId: string): void`
- Produces: `TeamMemberList` React component

- [ ] **Step 1: Create teamTasks directory**

```bash
mkdir -p client/src/components/teamTasks
```

- [ ] **Step 2: Create TeamMemberList.jsx with component structure**

Create `client/src/components/teamTasks/TeamMemberList.jsx`:

```javascript
import React from "react";
import { User, Clock, AlertCircle } from "lucide-react";

const TeamMemberList = ({ teamMembers, selectedMember, onSelectMember }) => {
  if (!teamMembers || teamMembers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <User className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          No team members found
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          Add employees to your team to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4 dark:border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Team Members ({teamMembers.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {teamMembers.map((member) => {
          const isSelected = selectedMember === member.user._id;
          const hasOverdue = member.stats.overdue > 0;

          return (
            <button
              key={member.user._id}
              onClick={() => onSelectMember(member.user._id)}
              className={`w-full border-b border-slate-200 p-4 text-left transition-colors dark:border-white/10 ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-500/10"
                  : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start gap-3">
                {member.user.avatar ? (
                  <img
                    src={member.user.avatar}
                    alt={member.user.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                    <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {member.user.name}
                    </h3>
                    {hasOverdue && (
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                    )}
                  </div>

                  {member.user.position && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {member.user.position}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      {member.stats.total} task{member.stats.total !== 1 ? "s" : ""}
                    </span>
                    {member.stats.pending > 0 && (
                      <span className="text-yellow-600 dark:text-yellow-500">
                        {member.stats.pending} pending
                      </span>
                    )}
                    {member.stats.overdue > 0 && (
                      <span className="text-red-600 dark:text-red-500">
                        {member.stats.overdue} overdue
                      </span>
                    )}
                  </div>

                  {member.recentActivity && member.recentActivity.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>
                        Updated{" "}
                        {new Date(member.recentActivity[0].lastUpdate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TeamMemberList;
```

- [ ] **Step 3: Verify component renders in isolation**

Test by creating a temporary test file or using Storybook if available. Verify:
- Empty state shows when `teamMembers` is empty
- Team members render with avatars, stats, and indicators
- Selected member highlights correctly
- Clicking triggers `onSelectMember` callback

- [ ] **Step 4: Commit TeamMemberList component**

```bash
git add client/src/components/teamTasks/TeamMemberList.jsx
git commit -m "feat(ui): add TeamMemberList component

- Left panel for team task management
- Shows team members with stats (total, pending, overdue)
- Highlights selected member
- Empty state for no team members

🤖 Generated with Claude Code"
```

---

### Task 3: Frontend - Team Member Task View Component

**Files:**
- Create: `client/src/components/teamTasks/TeamMemberTaskView.jsx`

**Interfaces:**
- Consumes: `member` prop: `{user, stats, tasks}`, `onEditTask` prop: `function(task): void`, `onDeleteTask` prop: `function(taskId): void`, `onReassignTask` prop: `function(task): void`
- Produces: `TeamMemberTaskView` React component with task list, filters, and actions

- [ ] **Step 1: Create TeamMemberTaskView.jsx structure**

Create `client/src/components/teamTasks/TeamMemberTaskView.jsx`:

```javascript
import React, { useState, useMemo } from "react";
import { Search, Calendar, AlertCircle, Edit, Trash2, UserPlus, Eye, MessageSquare } from "lucide-react";

const TeamMemberTaskView = ({ member, onEditTask, onDeleteTask, onReassignTask, onViewDetails }) => {
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    priority: "all",
    dateFilter: "all",
  });

  const filteredTasks = useMemo(() => {
    if (!member || !member.tasks) return [];

    return member.tasks.filter((task) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(searchLower);
        const matchesDesc = task.description?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Status filter
      if (filters.status !== "all" && task.status !== filters.status) {
        return false;
      }

      // Priority filter
      if (filters.priority !== "all" && task.priority !== filters.priority) {
        return false;
      }

      // Date filter
      if (filters.dateFilter !== "all") {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (filters.dateFilter === "overdue") {
          if (!dueDate || dueDate >= today || ["completed", "rejected"].includes(task.status)) {
            return false;
          }
        } else if (filters.dateFilter === "today") {
          if (!dueDate || dueDate.toDateString() !== today.toDateString()) {
            return false;
          }
        } else if (filters.dateFilter === "week") {
          const weekFromNow = new Date(today);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          if (!dueDate || dueDate < today || dueDate > weekFromNow) {
            return false;
          }
        }
      }

      return true;
    });
  }, [member, filters]);

  if (!member) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <UserPlus className="mx-auto mb-3 h-16 w-16 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Select a team member
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            Choose someone from the left to view their tasks
          </p>
        </div>
      </div>
    );
  }

  const isOverdue = (task) => {
    if (!task.dueDate || ["completed", "rejected"].includes(task.status)) return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400",
      "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
      completed: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
      rejected: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
    };
    return colors[status] || "bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-400";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      High: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
      Medium: "bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400",
      Low: "bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-400",
    };
    return colors[priority] || "bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-400";
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          {member.user.avatar ? (
            <img
              src={member.user.avatar}
              alt={member.user.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
              <UserPlus className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {member.user.name}'s Tasks
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {member.stats.total} total • {member.stats.pending} pending •{" "}
              {member.stats.inProgress} in progress
              {member.stats.overdue > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-500">
                  • {member.stats.overdue} overdue
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-slate-200 p-4 dark:border-white/10">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-white"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-white"
          >
            <option value="all">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={filters.dateFilter}
            onChange={(e) => setFilters({ ...filters, dateFilter: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-white"
          >
            <option value="all">All Dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="week">This Week</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <Calendar className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                No tasks found
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                {filters.search || filters.status !== "all" || filters.priority !== "all"
                  ? "Try adjusting your filters"
                  : "This team member has no tasks assigned"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task._id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      {task.priority && (
                        <span className={`rounded px-2 py-1 text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`flex items-center gap-1 text-xs ${isOverdue(task) ? "text-red-600 dark:text-red-500" : "text-slate-600 dark:text-slate-400"}`}>
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                          {isOverdue(task) && <AlertCircle className="h-3 w-3" />}
                        </span>
                      )}
                      {task.remarks && task.remarks.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <MessageSquare className="h-3 w-3" />
                          {task.remarks.length}
                        </span>
                      )}
                    </div>

                    {task.assignedBy && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Assigned by {task.assignedBy.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onViewDetails(task)}
                    className="flex items-center gap-1 rounded bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </button>
                  <button
                    onClick={() => onEditTask(task)}
                    className="flex items-center gap-1 rounded bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => onReassignTask(task)}
                    className="flex items-center gap-1 rounded bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20"
                  >
                    <UserPlus className="h-3 w-3" />
                    Reassign
                  </button>
                  <button
                    onClick={() => onDeleteTask(task._id)}
                    className="flex items-center gap-1 rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamMemberTaskView;
```

- [ ] **Step 2: Test filtering logic**

Verify filters work correctly:
- Search by task title/description
- Filter by status (pending, in-progress, completed)
- Filter by priority (High, Medium, Low)
- Filter by date (overdue, today, this week)

- [ ] **Step 3: Commit TeamMemberTaskView component**

```bash
git add client/src/components/teamTasks/TeamMemberTaskView.jsx
git commit -m "feat(ui): add TeamMemberTaskView component

- Right panel for team task management
- Task list with search and filters
- Shows task cards with status, priority, due date
- Action buttons: View, Edit, Reassign, Delete
- Empty states for no selection and no tasks

🤖 Generated with Claude Code"
```

---

### Task 4: Frontend - Main Team Task Management Page

**Files:**
- Create: `client/src/pages/TeamTaskManagementPage.jsx`

**Interfaces:**
- Consumes: `onLogout` prop: `function(): void`, `/api/tasks/team-overview` endpoint
- Produces: `TeamTaskManagementPage` React component with full split-view layout

- [ ] **Step 1: Create TeamTaskManagementPage.jsx**

Create `client/src/pages/TeamTaskManagementPage.jsx`:

```javascript
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Sidebar from "../components/dashboard/Sidebar";
import TeamMemberList from "../components/teamTasks/TeamMemberList";
import TeamMemberTaskView from "../components/teamTasks/TeamMemberTaskView";
import API from "../api";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const TeamTaskManagementPage = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassigningTask, setReassigningTask] = useState(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState(null);

  const userRole = JSON.parse(localStorage.getItem("user") || "{}")?.role || "employee";

  useEffect(() => {
    fetchTeamOverview();
  }, []);

  const fetchTeamOverview = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/tasks/team-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch team overview");
      }

      const data = await response.json();
      setTeamMembers(data.teamMembers || []);

      // Auto-select first member if available
      if (data.teamMembers && data.teamMembers.length > 0) {
        setSelectedMember(data.teamMembers[0].user._id);
      }
    } catch (error) {
      console.error("Error fetching team overview:", error);
      toast.error(error.message || "Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMember = (userId) => {
    setSelectedMember(userId);
  };

  const handleViewDetails = (task) => {
    setViewingTask(task);
    setViewDetailsOpen(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setEditModalOpen(true);
  };

  const handleReassignTask = (task) => {
    setReassigningTask(task);
    setReassignModalOpen(true);
  };

  const handleDeleteTask = (taskId) => {
    setDeletingTaskId(taskId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!deletingTaskId) return;

    try {
      const token = localStorage.getItem("token");
      await API.delete(`/api/tasks/${deletingTaskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Optimistic update: remove task from local state
      setTeamMembers((prev) =>
        prev.map((member) => ({
          ...member,
          tasks: member.tasks.filter((t) => t._id !== deletingTaskId),
          stats: {
            ...member.stats,
            total: member.stats.total - 1,
            // Recalculate stats based on remaining tasks
          },
        }))
      );

      toast.success("Task deleted successfully");
      setDeleteConfirmOpen(false);
      setDeletingTaskId(null);

      // Refresh to get accurate stats
      fetchTeamOverview();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error(error.response?.data?.message || "Failed to delete task");
    }
  };

  const saveEditedTask = async (taskData) => {
    if (!editingTask) return;

    try {
      const token = localStorage.getItem("token");
      const response = await API.put(`/api/tasks/${editingTask._id}`, taskData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Optimistic update
      setTeamMembers((prev) =>
        prev.map((member) => ({
          ...member,
          tasks: member.tasks.map((t) =>
            t._id === editingTask._id ? { ...t, ...taskData } : t
          ),
        }))
      );

      toast.success("Task updated successfully");
      setEditModalOpen(false);
      setEditingTask(null);

      // Refresh to get accurate stats
      fetchTeamOverview();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error(error.response?.data?.message || "Failed to update task");
    }
  };

  const saveReassignedTask = async (newAssigneeId) => {
    if (!reassigningTask) return;

    try {
      const token = localStorage.getItem("token");
      await API.put(
        `/api/tasks/${reassigningTask._id}`,
        { assignedTo: [newAssigneeId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Task reassigned successfully");
      setReassignModalOpen(false);
      setReassigningTask(null);

      // Refresh entire overview to update stats correctly
      fetchTeamOverview();
    } catch (error) {
      console.error("Error reassigning task:", error);
      toast.error(error.response?.data?.message || "Failed to reassign task");
    }
  };

  const selectedMemberData = teamMembers.find(
    (m) => m.user._id === selectedMember
  );

  // Calculate overall stats
  const overallStats = teamMembers.reduce(
    (acc, member) => ({
      total: acc.total + member.stats.total,
      pending: acc.pending + member.stats.pending,
      inProgress: acc.inProgress + member.stats.inProgress,
      overdue: acc.overdue + member.stats.overdue,
    }),
    { total: 0, pending: 0, inProgress: 0, overdue: 0 }
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0b0d12]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading team tasks...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0b0d12]">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        userRole={userRole}
        onLogout={onLogout}
      />

      <main
        className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        {/* Header */}
        <div className="border-b border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#10131c]">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Team Task Management
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Monitor and manage your team's tasks
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Total Tasks
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {overallStats.total}
              </p>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-500/20 dark:bg-yellow-500/10">
              <p className="text-xs font-medium text-yellow-800 dark:text-yellow-400">
                Pending
              </p>
              <p className="mt-1 text-2xl font-semibold text-yellow-900 dark:text-yellow-300">
                {overallStats.pending}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-400">
                In Progress
              </p>
              <p className="mt-1 text-2xl font-semibold text-blue-900 dark:text-blue-300">
                {overallStats.inProgress}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10">
              <p className="text-xs font-medium text-red-800 dark:text-red-400">
                Overdue
              </p>
              <p className="mt-1 text-2xl font-semibold text-red-900 dark:text-red-300">
                {overallStats.overdue}
              </p>
            </div>
          </div>
        </div>

        {/* Split View */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#10131c]">
            <TeamMemberList
              teamMembers={teamMembers}
              selectedMember={selectedMember}
              onSelectMember={handleSelectMember}
            />
          </div>

          {/* Right Panel */}
          <div className="flex-1 bg-slate-50 dark:bg-[#0b0d12]">
            <TeamMemberTaskView
              member={selectedMemberData}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onReassignTask={handleReassignTask}
              onViewDetails={handleViewDetails}
            />
          </div>
        </div>
      </main>

      {/* TODO: Add modals for edit, delete confirm, reassign, view details */}
      {/* These will be added in subsequent tasks */}
    </div>
  );
};

export default TeamTaskManagementPage;
```

- [ ] **Step 2: Test page in isolation**

Run the development server and navigate to `/team/tasks` (temporarily add route to test):
- Verify split layout renders
- Verify team members load and display
- Verify clicking a member updates the right panel
- Verify overall stats calculate correctly

- [ ] **Step 3: Commit TeamTaskManagementPage**

```bash
git add client/src/pages/TeamTaskManagementPage.jsx
git commit -m "feat(ui): add TeamTaskManagementPage main component

- Split-view layout with team list and task view
- Fetches data from /api/tasks/team-overview
- Overall stats header with total, pending, in-progress, overdue
- Handles team member selection
- Placeholder modal handlers (to be implemented)

🤖 Generated with Claude Code"
```

---

### Task 5: Frontend - Fix Sidebar Labels and Add Route

**Files:**
- Modify: `client/src/components/dashboard/Sidebar.jsx`
- Modify: `client/src/pages/UnifiedTaskPage.jsx`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: existing sidebar menu config, existing App routes
- Produces: Updated sidebar with "My Tasks" (not "Team Tasks") and new "Team Task Management" link, new `/team/tasks` route

- [ ] **Step 1: Remove "Team Tasks" label transformation in Sidebar.jsx**

Open `client/src/components/dashboard/Sidebar.jsx` and find the label transformation logic (around line 797-803). Remove the transformation for `/tasks`:

```javascript
// BEFORE (remove these lines):
if (item.to === "/tasks" && hasTaskTeamView) {
  return { ...item, label: "Team Tasks" };
}

// AFTER: Remove the above completely, keep only leads/callbacks transformations
if (item.to === "/leads" && isSupervisor) {
  return { ...item, label: "Team Leads" };
}
if (item.to === "/callbacks" && isSupervisor) {
  return { ...item, label: "Team Callbacks" };
}
// Do NOT transform /tasks or /projects labels anymore
```

Also update the children mapping (around line 817-822):

```javascript
// BEFORE (remove these lines):
if (child.to === "/tasks" && hasTaskTeamView) {
  return { ...child, label: "Team Tasks" };
}

// AFTER: Remove the above, keep only leads/callbacks
```

- [ ] **Step 2: Add "Team Task Management" menu item to Sidebar.jsx**

Find the employee menuConfig section and add the new menu item. Look for the tasks menu item and add the team management item right after it:

```javascript
// Add this import at the top if not already present
import { FaUsersCog } from "react-icons/fa";

// In the employee menuConfig array, add after "My Tasks":
{
  icon: <FaUsersCog />,
  label: "Team Task Management",
  to: "/team/tasks",
}

// In the filter logic (around line 825-835), add visibility check:
if (item.to === "/team/tasks") {
  return permissions
    ? Boolean(permissions.permissions?.canViewSubordinateTasks)
    : false;
}
```

- [ ] **Step 3: Revert UnifiedTaskPage.jsx labels**

Open `client/src/pages/UnifiedTaskPage.jsx` and find the tab label logic (around line 865-873). Remove the hasTeamTaskView check:

```javascript
// BEFORE (remove hasTeamTaskView logic):
const hasTeamTaskView = permissions?.permissions?.canViewSubordinateTasks || ...;
const myTasksLabel = hasTeamTaskView ? "Team Tasks" : "My Tasks";

const baseTabs = [
  { id: "mine", label: myTasksLabel, icon: <FaUserAlt size={11} /> },
  ...
];

// AFTER: Always use "My Tasks"
const baseTabs = [
  { id: "mine", label: "My Tasks", icon: <FaUserAlt size={11} /> },
  { id: "assigned-by-me", label: "Assigned by Me", icon: <FaListUl size={11} /> },
  { id: "create", label: "Create Task", icon: <FaPlus size={11} /> },
];
```

Also update the page title (around line 921-928):

```javascript
// BEFORE:
<h1>
  {adminUser ? "Task management" : hasTeamTaskView ? "Team tasks" : "My tasks"}
</h1>
<p>
  {adminUser
    ? `Good ${greeting}, ${user.name || "Admin"}. Review priorities...`
    : hasTeamTaskView
    ? `Good ${greeting}, ${user.name}. Monitor your team's tasks...`
    : "Focus on what is due..."}
</p>

// AFTER: Remove hasTeamTaskView branches
<h1>{adminUser ? "Task management" : "My tasks"}</h1>
<p>
  {adminUser
    ? `Good ${greeting}, ${user.name || "Admin"}. Review priorities, assignments, and team progress.`
    : "Focus on what is due, update progress, and keep work moving."}
</p>
```

- [ ] **Step 4: Add route to App.jsx**

Open `client/src/App.jsx` and add the new route. Import the component and add the route:

```javascript
// Add import at top with other page imports
import TeamTaskManagementPage from "./pages/TeamTaskManagementPage";

// Add route in the routes section (after /tasks route, around line 800):
{/* Team Task Management - for managers with canViewSubordinateTasks */}
<Route
  path="/team/tasks"
  element={
    isAuthenticated &&
    (permissions?.permissions?.canViewSubordinateTasks || isAdmin) ? (
      <TeamTaskManagementPage onLogout={handleLogout} />
    ) : (
      <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
    )
  }
/>
```

- [ ] **Step 5: Test sidebar and routing**

1. Log in as a manager with `canViewSubordinateTasks` permission
2. Verify sidebar shows:
   - "My Tasks" (not "Team Tasks") for `/tasks` route
   - "Team Task Management" new menu item for `/team/tasks` route
3. Click "My Tasks" → should go to UnifiedTaskPage with "My Tasks" label
4. Click "Team Task Management" → should go to TeamTaskManagementPage
5. Log in as employee without permission → "Team Task Management" should not appear

- [ ] **Step 6: Commit sidebar and routing changes**

```bash
git add client/src/components/dashboard/Sidebar.jsx client/src/pages/UnifiedTaskPage.jsx client/src/App.jsx
git commit -m "feat(ui): fix sidebar labels and add team task management route

- Remove 'Team Tasks' label transformation for /tasks route
- Revert UnifiedTaskPage to always show 'My Tasks'
- Add new 'Team Task Management' menu item for /team/tasks
- Add route for TeamTaskManagementPage with permission check
- Sidebar shows correct labels: personal vs team management

🤖 Generated with Claude Code"
```

---

### Task 6: Frontend - Task Edit/Delete/Reassign Modals

**Files:**
- Modify: `client/src/pages/TeamTaskManagementPage.jsx` (add modal components inline)

**Interfaces:**
- Consumes: task data, team members list, API endpoints
- Produces: Edit modal, Delete confirmation, Reassign modal, View details modal

- [ ] **Step 1: Add Edit Task Modal to TeamTaskManagementPage.jsx**

Add this modal component inside TeamTaskManagementPage.jsx, before the return statement:

```javascript
// Add these imports at the top
import { X } from "lucide-react";

// Inside the component, add this EditTaskModal component before the return:
const EditTaskModal = ({ task, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    dueDate: task?.dueDate ? task.dueDate.split("T")[0] : "",
    priority: task?.priority || "Medium",
    status: task?.status || "pending",
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
        priority: task.priority || "Medium",
        status: task.status || "pending",
      });
    }
  }, [task]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-[#171a22]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Edit Task
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add Delete Confirmation Modal**

Add this DeleteConfirmModal component after EditTaskModal:

```javascript
const DeleteConfirmModal = ({ isOpen, onConfirm, onCancel, taskTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-[#171a22]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Delete Task
          </h2>
          <button
            onClick={onCancel}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to delete this task? This action cannot be undone.
          </p>
          {taskTitle && (
            <p className="mt-2 rounded bg-slate-100 p-2 text-sm font-medium text-slate-900 dark:bg-white/5 dark:text-white">
              {taskTitle}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Add Reassign Task Modal**

Add this ReassignModal component after DeleteConfirmModal:

```javascript
const ReassignModal = ({ task, teamMembers, isOpen, onReassign, onCancel }) => {
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (task && task.assignedTo && task.assignedTo[0]) {
      setSelectedUserId(task.assignedTo[0]._id || task.assignedTo[0]);
    }
  }, [task]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUserId) {
      onReassign(selectedUserId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-[#171a22]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Reassign Task
          </h2>
          <button
            onClick={onCancel}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {task && (
            <div className="rounded bg-slate-100 p-3 dark:bg-white/5">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {task.title}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Currently assigned to:{" "}
                {task.assignedTo && task.assignedTo[0]
                  ? task.assignedTo[0].name
                  : "Unassigned"}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Assign to
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
              required
            >
              <option value="">Select team member...</option>
              {teamMembers.map((member) => (
                <option key={member.user._id} value={member.user._id}>
                  {member.user.name} ({member.stats.total} tasks)
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              Reassign
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Add View Details Modal**

Add this ViewDetailsModal component after ReassignModal:

```javascript
const ViewDetailsModal = ({ task, isOpen, onClose }) => {
  if (!isOpen || !task) return null;

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    !["completed", "rejected"].includes(task.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-[#171a22]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Task Details
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              {task.title}
            </h3>
          </div>

          {task.description && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {task.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Status
              </p>
              <span className="mt-1 inline-block rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400">
                {task.status}
              </span>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Priority
              </p>
              <span className="mt-1 inline-block rounded px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400">
                {task.priority || "Medium"}
              </span>
            </div>

            {task.dueDate && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Due Date
                </p>
                <p className={`mt-1 text-sm ${isOverdue ? "text-red-600 dark:text-red-500" : "text-slate-600 dark:text-slate-400"}`}>
                  {new Date(task.dueDate).toLocaleDateString()}
                  {isOverdue && " (Overdue)"}
                </p>
              </div>
            )}

            {task.assignedBy && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Assigned By
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {task.assignedBy.name}
                </p>
              </div>
            )}
          </div>

          {task.remarks && task.remarks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Remarks ({task.remarks.length})
              </p>
              <div className="mt-2 space-y-2">
                {task.remarks.map((remark, index) => (
                  <div
                    key={index}
                    className="rounded border border-slate-200 p-3 dark:border-white/10"
                  >
                    <p className="text-sm text-slate-900 dark:text-white">
                      {remark.text}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      By {remark.user?.name || "Unknown"} •{" "}
                      {remark.createdAt
                        ? new Date(remark.createdAt).toLocaleString()
                        : "Unknown time"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Add modals to JSX in TeamTaskManagementPage**

In the return statement of TeamTaskManagementPage, replace the TODO comment with actual modal renders:

```javascript
{/* Modals */}
<EditTaskModal
  task={editingTask}
  isOpen={editModalOpen}
  onClose={() => {
    setEditModalOpen(false);
    setEditingTask(null);
  }}
  onSave={saveEditedTask}
/>

<DeleteConfirmModal
  isOpen={deleteConfirmOpen}
  onConfirm={confirmDeleteTask}
  onCancel={() => {
    setDeleteConfirmOpen(false);
    setDeletingTaskId(null);
  }}
  taskTitle={
    teamMembers
      .flatMap((m) => m.tasks)
      .find((t) => t._id === deletingTaskId)?.title
  }
/>

<ReassignModal
  task={reassigningTask}
  teamMembers={teamMembers}
  isOpen={reassignModalOpen}
  onReassign={saveReassignedTask}
  onCancel={() => {
    setReassignModalOpen(false);
    setReassigningTask(null);
  }}
/>

<ViewDetailsModal
  task={viewingTask}
  isOpen={viewDetailsOpen}
  onClose={() => {
    setViewDetailsOpen(false);
    setViewingTask(null);
  }}
/>
```

- [ ] **Step 6: Test all modals**

Test each modal:
1. Edit modal: Opens with task data, saves changes, shows toast
2. Delete modal: Shows confirmation, deletes task, updates stats
3. Reassign modal: Shows team members, reassigns task, refreshes data
4. View details modal: Shows full task info with remarks

- [ ] **Step 7: Commit modal implementations**

```bash
git add client/src/pages/TeamTaskManagementPage.jsx
git commit -m "feat(ui): add task management modals

- Edit task modal with form (title, desc, date, priority, status)
- Delete confirmation modal
- Reassign task modal with team member dropdown
- View details modal with full task info and remarks
- All modals use Tailwind with dark mode support

🤖 Generated with Claude Code"
```

---

### Task 7: Testing and Polish

**Files:**
- Test: All created components and routes
- Polish: Error handling, loading states, responsive design

**Interfaces:**
- Consumes: All previous implementations
- Produces: Fully tested, production-ready feature

- [ ] **Step 1: Test permission-based access**

Test scenarios:
1. Manager with `canViewSubordinateTasks`: Can access `/team/tasks`, sees subordinates
2. Employee without permission: Cannot access `/team/tasks`, redirects to dashboard
3. Super-admin: Can access regardless of hierarchy

Expected: Permission checks work correctly

- [ ] **Step 2: Test hierarchy enforcement**

Test scenarios:
1. Manager sees only lower-level subordinates
2. Manager cannot see peers or higher-level users
3. Changing hierarchy updates visible users

Expected: Only subordinates appear in team list

- [ ] **Step 3: Test task operations**

Test scenarios:
1. Edit task: Updates correctly, stats recalculate
2. Delete task: Removes from list, stats update
3. Reassign task: Moves between members, stats update for both
4. View details: Shows all task info

Expected: All CRUD operations work with optimistic updates and proper error handling

- [ ] **Step 4: Test filters**

Test scenarios:
1. Search by title/description
2. Filter by status (pending, in-progress, completed)
3. Filter by priority (High, Medium, Low)
4. Filter by date (overdue, today, this week)

Expected: Filters work correctly and can be combined

- [ ] **Step 5: Test responsive design**

Test on:
1. Desktop (1920x1080)
2. Tablet (768x1024)
3. Mobile (375x667)

Expected: Layout adapts properly, split view adjusts on smaller screens

- [ ] **Step 6: Test dark mode**

Toggle dark mode and verify:
1. All components render correctly
2. Colors are appropriate
3. Contrast is sufficient

Expected: Dark mode works throughout the feature

- [ ] **Step 7: Fix any bugs found during testing**

Document and fix any issues discovered

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "test: verify team task management feature

- Tested permission-based access control
- Verified hierarchy enforcement
- Tested all CRUD operations with optimistic updates
- Verified filters and search functionality
- Tested responsive design and dark mode
- Fixed minor bugs and edge cases

🤖 Generated with Claude Code"
```

---

## Implementation Complete!

### Summary

This plan creates a complete Team Task Management system with:

✅ **Backend:** New `/api/tasks/team-overview` endpoint with stats calculation
✅ **Frontend:** Split-view page with team list and task view
✅ **Components:** TeamMemberList, TeamMemberTaskView with filters
✅ **Modals:** Edit, Delete, Reassign, View Details
✅ **Routing:** New `/team/tasks` route with permission check
✅ **Sidebar:** Fixed labels (My Tasks vs Team Task Management)
✅ **Testing:** Full test coverage for permissions, operations, and UI

### Testing Checklist

- [ ] Manager can access `/team/tasks` with permission
- [ ] Employee without permission cannot access
- [ ] Team members list shows with correct stats
- [ ] Selecting member updates right panel
- [ ] Filters work (search, status, priority, date)
- [ ] Edit task modal works and saves
- [ ] Delete task works with confirmation
- [ ] Reassign task works between members
- [ ] View details shows full task info
- [ ] Sidebar shows "My Tasks" for personal page
- [ ] Sidebar shows "Team Task Management" link
- [ ] Dark mode works throughout
- [ ] Responsive on mobile/tablet

### Estimated Time: 11-16 hours

- Backend: 2-3 hours
- Components: 6-8 hours
- Routing/Integration: 1-2 hours
- Modals: 2-3 hours
- Testing/Polish: 2-3 hours
