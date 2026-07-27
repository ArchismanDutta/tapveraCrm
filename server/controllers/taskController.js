// File: controllers/taskController.js
const Task = require("../models/Task");
const User = require("../models/User");
const Project = require("../models/Project");
const { notifyAdmins } = require("../services/whatsappService");
const { updateWorkloadOnTaskChange } = require("../services/workloadService");
const notificationService = require("../services/notificationService");
// Access-management rework (2026-07-03) - Phase 4.1.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can, scopeQuery } = require("../utils/accessControl");
const { canAccessUserData } = require("../utils/hierarchyUtils");

// ------------------- Constants -------------------
const STATUSES = ["pending", "in-progress", "completed", "rejected"];
const PRIORITIES = ["High", "Medium", "Low"];
const ADMIN_ROLES = ["admin", "super-admin"];

// ------------------- Helpers -------------------
const isAdminRole = (user) => ADMIN_ROLES.includes(user.role);

const isCreator = (task, user) =>
  task.assignedBy && task.assignedBy.toString() === user._id.toString();

const isAssignee = (task, user) =>
  task.assignedTo.some((id) => (id._id || id).toString() === user._id.toString());

// Access-management rework (2026-07-03): additive expansion, never a
// narrowing - admin/super-admin keep exactly the access they had before.
// A user whose Position grants task-assign authority (Project
// Manager/Supervisor/Team Lead by default - see seedCanonicalHierarchy.js)
// now ALSO qualifies, so "TL" etc. stop being purely cosmetic labels here.
// Until real hierarchy data is assigned to real users this is a no-op:
// `can()` returns false for anyone with no resolved Position, exactly
// matching today's behavior.
const hasTaskAssignAuthority = async (user) => isAdminRole(user) || (await can(user, "tasks:assign"));
const hasTaskViewAuthority = async (user) => isAdminRole(user) || (await can(user, "tasks:view"));

// Can this user see / comment on this task?
const canAccessTask = async (task, user) =>
  isAdminRole(user) || isCreator(task, user) || isAssignee(task, user) || (await hasTaskViewAuthority(user));

// Can this user edit / delete this task?
const canManageTask = async (task, user) =>
  isAdminRole(user) || isCreator(task, user) || (await hasTaskAssignAuthority(user));

const mapTaskPriorityToNotification = (taskPriority) => {
  const priorityMap = { High: "high", Medium: "normal", Low: "low" };
  return priorityMap[taskPriority] || "normal";
};

const populateTask = (query) =>
  query
    .populate("assignedTo", "name email employeeId designation")
    .populate("assignedBy", "name email")
    .populate("lastEditedBy", "name email")
    .populate("remarks.user", "name email")
    .populate("statusHistory.changedBy", "name email")
    .populate("project", "projectName type clients client");

// Validate all assignees exist and are active. Returns error message or null.
const validateAssigneesActive = async (assignedTo) => {
  const inactive = await User.find({
    _id: { $in: assignedTo },
    status: { $ne: "active" },
  }).select("name status");
  if (inactive.length > 0) {
    const names = inactive.map((e) => `${e.name} (${e.status})`).join(", ");
    return `Cannot assign task to inactive employees: ${names}. Please select only active employees.`;
  }
  return null;
};

// Fire-and-forget notifications: never let a notification failure fail the request.
const safeNotifyAdmins = (message) => {
  Promise.resolve(notifyAdmins(message)).catch((err) =>
    console.error("WhatsApp notify failed:", err.message || err)
  );
};

const pushStatusHistory = (task, status, userId, note) => {
  task.statusHistory.push({
    status,
    changedBy: userId,
    changedAt: new Date(),
    note,
  });
};

// Apply a status transition with consistent rules. Returns error message or null.
const applyStatusChange = async (task, newStatus, user, note) => {
  if (!STATUSES.includes(newStatus)) return "Invalid status";
  if (task.status === newStatus) return null; // no-op

  const admin = isAdminRole(user) || (await can(user, "tasks:assign"));

  // "rejected" must always go through the reject endpoint (requires a reason)
  if (newStatus === "rejected") {
    return "Use the reject endpoint to reject tasks";
  }

  // Once completed, only admins can move it back
  if (!admin && task.status === "completed") {
    return "Cannot change status of completed task. Please wait for admin review.";
  }

  pushStatusHistory(
    task,
    newStatus,
    user._id,
    note || `Status changed from ${task.status} to ${newStatus}`
  );

  if (newStatus === "completed") {
    task.completedAt = new Date();
  } else {
    task.completedAt = null;
  }

  // Leaving rejected state clears rejection info
  if (task.status === "rejected") {
    task.rejectedAt = null;
    task.rejectionReason = null;
  }

  task.status = newStatus;
  return null;
};

// ------------------- CREATE TASK -------------------
// Admin / Super-admin only (enforced in routes)
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority, project } = req.body;
    const assignedBy = req.user._id;

    if (!title || !Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res
        .status(400)
        .json({ message: "Title and at least one assigned user are required." });
    }

    const assigneeError = await validateAssigneesActive(assignedTo);
    if (assigneeError) return res.status(400).json({ message: assigneeError });

    if (dueDate && isNaN(new Date(dueDate).getTime())) {
      return res.status(400).json({ message: "Invalid due date." });
    }

    const task = new Task({
      title,
      description,
      assignedTo,
      assignedBy,
      dueDate,
      priority: PRIORITIES.includes(priority) ? priority : "Medium",
      project: project || null,
      statusHistory: [
        {
          status: "pending",
          changedBy: assignedBy,
          changedAt: new Date(),
          note: "Task created",
        },
      ],
    });
    await task.save();

    if (project) {
      await Project.findByIdAndUpdate(project, { $addToSet: { tasks: task._id } });
    }

    const populated = await populateTask(Task.findById(task._id)).lean();

    updateWorkloadOnTaskChange(task._id).catch((err) =>
      console.error("Error updating workload:", err)
    );

    safeNotifyAdmins(
      `📝 *New Task Created*\n📌 Title: *${populated.title}*\n📅 Due: *${
        populated.dueDate || "N/A"
      }*\n🎯 Priority: *${populated.priority}*\n👤 Assigned By: *${req.user.name}*\n👥 Assigned To: ${
        populated.assignedTo.map((u) => u.name).join(", ") || "None"
      }`
    );

    // In-app notifications to assignees (non-blocking)
    for (const u of populated.assignedTo) {
      notificationService
        .createAndSend({
          userId: u._id.toString(),
          type: "task",
          channel: "task",
          title: "New Task Assigned",
          body: `${populated.title}\nPriority: ${populated.priority}\nDue: ${
            populated.dueDate || "No due date"
          }`,
          priority: mapTaskPriorityToNotification(populated.priority),
          relatedData: { taskId: populated._id, url: "/tasks" },
        })
        .catch((err) => console.error("Task notification failed:", err));
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- EDIT TASK -------------------
// Admin / Super-admin or task creator
exports.editTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, assignedTo, dueDate, status, priority, project } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!(await canManageTask(task, req.user))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty." });
      task.title = title;
    }

    // Allow clearing description by sending "" / null
    if (description !== undefined) task.description = description || "";

    if (assignedTo !== undefined) {
      if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one assigned user is required." });
      }
      const assigneeError = await validateAssigneesActive(assignedTo);
      if (assigneeError) return res.status(400).json({ message: assigneeError });
      task.assignedTo = assignedTo;
    }

    // Allow clearing dueDate by sending null
    if (dueDate !== undefined) {
      if (dueDate && isNaN(new Date(dueDate).getTime())) {
        return res.status(400).json({ message: "Invalid due date." });
      }
      task.dueDate = dueDate || null;
    }

    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({ message: "Invalid priority." });
      }
      task.priority = priority;
    }

    if (status !== undefined) {
      const statusError = await applyStatusChange(
        task,
        status,
        req.user,
        `Status changed from ${task.status} to ${status} via edit`
      );
      if (statusError) return res.status(400).json({ message: statusError });
    }

    // Project change: keep both projects' tasks arrays in sync
    if (project !== undefined) {
      const newProject = project || null;
      const oldProject = task.project ? task.project.toString() : null;
      const newProjectId = newProject ? newProject.toString() : null;
      if (oldProject !== newProjectId) {
        if (oldProject) {
          await Project.findByIdAndUpdate(oldProject, { $pull: { tasks: task._id } });
        }
        if (newProjectId) {
          await Project.findByIdAndUpdate(newProjectId, {
            $addToSet: { tasks: task._id },
          });
        }
        task.project = newProject;
      }
    }

    task.lastEditedBy = req.user._id;
    await task.save();

    const populated = await populateTask(Task.findById(taskId)).lean();

    updateWorkloadOnTaskChange(taskId).catch((err) =>
      console.error("Error updating workload:", err)
    );

    safeNotifyAdmins(
      `✏️ *Task Updated*\n📌 Title: *${populated.title}*\n📅 Due: *${
        populated.dueDate || "N/A"
      }*\n📊 Status: *${populated.status}*\n🎯 Priority: *${populated.priority}*\n👤 Updated By: *${req.user.name}*`
    );

    const notifyUserIds = [
      ...populated.assignedTo.map((u) => u._id.toString()),
      populated.assignedBy._id.toString(),
    ];
    const uniqueUserIds = [...new Set(notifyUserIds)].filter(
      (id) => id !== req.user._id.toString()
    );

    notificationService
      .notifyUsers(uniqueUserIds, {
        type: "task",
        channel: "task",
        title: "Task Updated",
        message: `${populated.title} was updated`,
        body: `${populated.title}\nStatus: ${populated.status}\nPriority: ${populated.priority}\nUpdated by: ${req.user.name}`,
        priority: mapTaskPriorityToNotification(populated.priority),
        relatedData: { taskId: populated._id, url: "/tasks" },
      })
      .catch((err) => console.error("Task-updated notification failed:", err));

    res.json(populated);
  } catch (err) {
    console.error("Error editing task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- UPDATE TASK STATUS -------------------
// Admin / Super-admin, creator, or assignee
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!(await canAccessTask(task, req.user))) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const statusError = await applyStatusChange(
      task,
      status,
      req.user,
      `Status updated by ${req.user.name}`
    );
    if (statusError) return res.status(400).json({ message: statusError });

    task.lastEditedBy = req.user._id;
    await task.save();

    const populated = await populateTask(Task.findById(taskId)).lean();

    updateWorkloadOnTaskChange(taskId).catch((err) =>
      console.error("Error updating workload:", err)
    );

    safeNotifyAdmins(
      `✅ *Task Status Changed*\n📌 Title: *${populated.title}*\n📊 New Status: *${status}*\n👤 Changed By: *${req.user.name}*`
    );

    const notifyUserIds = [
      ...populated.assignedTo.map((u) => u._id.toString()),
      populated.assignedBy._id.toString(),
    ];
    const uniqueUserIds = [...new Set(notifyUserIds)].filter(
      (id) => id !== req.user._id.toString()
    );

    notificationService
      .notifyUsers(uniqueUserIds, {
        type: "task",
        channel: "task",
        title: "Task Status Changed",
        message: `${populated.title} is now ${status}`,
        body: `${populated.title}\nNew Status: ${status}\nChanged by: ${req.user.name}`,
        priority: mapTaskPriorityToNotification(populated.priority),
        relatedData: { taskId: populated._id, url: "/tasks" },
      })
      .catch((err) => console.error("Task-status notification failed:", err));

    res.json(populated);
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- REJECT TASK -------------------
// Admin / Super-admin, or a user with task-assign authority (e.g. PM/Supervisor/TL
// with the "tasks:assign" permission - see accessControl.js). Requires a reason.
// Route-level authorize("admin","super-admin") was moved here (2026-07-03) so this
// module's authorization is enforced consistently in the controller, matching the
// rest of this file.
exports.rejectTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!(await hasTaskAssignAuthority(req.user))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (task.status !== "completed") {
      return res.status(400).json({ message: "Only completed tasks can be rejected" });
    }

    pushStatusHistory(task, "rejected", req.user._id, `Task rejected: ${reason.trim()}`);
    task.status = "rejected";
    task.rejectedAt = new Date();
    task.rejectionReason = reason.trim();
    task.completedAt = null;
    task.lastEditedBy = req.user._id;
    await task.save();

    const populated = await populateTask(Task.findById(taskId)).lean();

    updateWorkloadOnTaskChange(taskId).catch((err) =>
      console.error("Error updating workload:", err)
    );

    safeNotifyAdmins(
      `❌ *Task Rejected*\n📌 Title: *${populated.title}*\n📝 Reason: *${populated.rejectionReason}*\n👤 Rejected By: *${req.user.name}*`
    );

    const assignedUserIds = populated.assignedTo.map((u) => u._id.toString());
    notificationService
      .notifyUsers(assignedUserIds, {
        type: "task",
        channel: "task",
        title: "Task Rejected",
        message: `"${populated.title}" was rejected and needs rework`,
        body: `Task rejected by ${req.user.name}\nReason: ${populated.rejectionReason}`,
        priority: "high",
        relatedData: { taskId: populated._id, url: "/tasks" },
      })
      .catch((err) => console.error("Task-rejected notification failed:", err));

    res.json(populated);
  } catch (err) {
    console.error("Error rejecting task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- GET TASK BY ID -------------------
exports.getTaskById = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.taskId));
    if (!task) return res.status(404).json({ message: "Task not found." });

    const userId = req.user._id.toString();
    const isAuthorized =
      task.assignedBy._id.toString() === userId ||
      task.assignedTo.some((u) => u._id.toString() === userId) ||
      isAdminRole(req.user) ||
      (await hasTaskViewAuthority(req.user));

    if (!isAuthorized) return res.status(403).json({ message: "Not authorized" });

    // Initialize statusHistory for old tasks that don't have it
    if (!task.statusHistory || task.statusHistory.length === 0) {
      task.statusHistory = [
        {
          status: task.status || "pending",
          changedBy: task.assignedBy,
          changedAt: task.createdAt || new Date(),
          note: "Initial status (migrated)",
        },
      ];
      await task.save();
    }

    res.json(task);
  } catch (err) {
    console.error("Error fetching task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- GET ALL TASKS -------------------
// Admin / Super-admin: all tasks. Client: tasks of their projects.
// Everyone else (employee, hr): tasks assigned to or created by them.
// Supports pagination via ?page=1&limit=10 — returns { tasks, total, page, totalPages }.
exports.getTasks = async (req, res) => {
  try {
    let query = {};

    if (req.query.project) {
      // Project-scoped request — show ALL tasks for that project to every role.
      // Clients are still restricted to their own projects.
      if (req.user.role === "client") {
        const projectExists = await Project.findOne({
          _id: req.query.project,
          $or: [{ client: req.user._id }, { clients: req.user._id }],
        });
        if (!projectExists) {
          return res.json({ tasks: [], total: 0, page: 1, totalPages: 0 });
        }
      }
      query.project = req.query.project;
      // Do NOT add assignedTo filter — all roles see all tasks within the project
    } else if (req.user.role === "client") {
      const clientProjects = await Project.find({
        $or: [{ client: req.user._id }, { clients: req.user._id }],
      }).select("_id");
      query.project = { $in: clientProjects.map((p) => p._id) };
    } else if (req.query.scope === "assigned-by-me") {
      // Tasks this user created — regardless of role
      query = { assignedBy: req.user._id };
    } else if (req.query.scope === "mine") {
      // "My Tasks" = only tasks directly assigned TO this user
      query = { assignedTo: req.user._id };
    } else if (!isAdminRole(req.user)) {
      // Access-management rework (2026-07-03): additive replacement for the old
      // blunt "non-admins only ever see tasks assigned to them" rule. scopeQuery()
      // reuses the same hierarchyUtils scoping already trusted in production for
      // leads/callbacks: it returns {assignedTo:{$in:[self]}} (identical to the
      // line above) for anyone with no hierarchical Position configured, and
      // widens to include a supervisor/TL/PM's team when their Position's
      // dataScope says so. This is how "TL"/"Supervisor" become meaningful for
      // task visibility instead of just a label.
      const scope = await scopeQuery(req.user, "assignedTo");
      query = { ...query, ...scope };
    }

    if (req.query.status && STATUSES.includes(req.query.status)) {
      query.status = req.query.status;
    }
    if (req.query.priority && PRIORITIES.includes(req.query.priority)) {
      query.priority = req.query.priority;
    }
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: "i" };
    }

    // Date filter (UnifiedTaskPage's always-visible date-preset pills —
    // Today/This Week/This Month resolve to dueDateFrom+dueDateTo client-side;
    // "Custom" sends the same two params from raw date inputs; "Overdue" sends
    // its own flag instead since it also has to exclude completed/rejected
    // tasks, which a plain date range can't express).
    if (req.query.dueDateFrom || req.query.dueDateTo) {
      query.dueDate = query.dueDate || {};
      if (req.query.dueDateFrom) query.dueDate.$gte = new Date(req.query.dueDateFrom);
      if (req.query.dueDateTo) query.dueDate.$lte = new Date(req.query.dueDateTo);
    }
    if (req.query.overdue === "true") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      query.dueDate = { ...(query.dueDate || {}), $lt: startOfToday };
      // Don't clobber an explicit status filter the caller also asked for.
      if (!query.status) {
        query.status = { $nin: ["completed", "rejected"] };
      }
    }

    // Pagination — project-scoped fetches (or admin/elevated-view fetches) allow a
    // higher limit. Expanded alongside the scope change above so a Supervisor/TL
    // who can now see their team's tasks isn't silently capped at the low limit
    // meant for single-user scopes.
    const isProjectScoped = !!req.query.project;
    const isPrivileged = isAdminRole(req.user) || (await hasTaskViewAuthority(req.user));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = (isProjectScoped || isPrivileged)
      ? Math.min(10000, Math.max(1, parseInt(req.query.limit) || 10))
      : Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      populateTask(Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)).lean(),
      Task.countDocuments(query),
    ]);

    res.json({ tasks, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- DELETE TASK -------------------
// Admin / Super-admin or task creator
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!(await canManageTask(task, req.user))) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (task.project) {
      await Project.findByIdAndUpdate(task.project, { $pull: { tasks: task._id } });
    }

    await task.deleteOne();

    safeNotifyAdmins(
      `🗑️ *Task Deleted*\n📌 Title: *${task.title}*\n👤 Deleted By: *${req.user.name}*`
    );

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- ADD REMARK -------------------
// Only people involved with the task (or admins) can comment
exports.addRemark = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;

    if (!comment?.trim()) {
      return res.status(400).json({ message: "Remark cannot be empty" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!(await canAccessTask(task, req.user))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    task.remarks.push({ user: req.user._id, comment: comment.trim() });
    await task.save();

    const populated = await populateTask(Task.findById(taskId)).lean();

    try {
      const { broadcastTaskRemark } = require("../utils/websocket");
      const memberIds = new Set(
        [...(task.assignedTo || []), task.assignedBy]
          .filter(Boolean)
          .map((id) => String(id))
      );
      const newRemark = populated.remarks[populated.remarks.length - 1];
      broadcastTaskRemark(taskId, Array.from(memberIds), { remark: newRemark });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (task remark added):", wsError.message);
    }

    res.json(populated);
  } catch (err) {
    console.error("Error adding remark:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- GET REMARKS -------------------
exports.getRemarks = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId).populate("remarks.user", "name email");
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!(await canAccessTask(task, req.user))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(task.remarks || []);
  } catch (err) {
    console.error("Error fetching remarks:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- GET EMPLOYEE TASK ANALYTICS -------------------
// Admin / Super-admin, or a user with "reports:view" permission who also has
// hierarchical oversight of this specific employee. Route-level
// authorize("admin","super-admin") was moved here (2026-07-03) so this
// module's authorization is enforced consistently in the controller.
exports.getEmployeeTaskAnalytics = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await User.findById(employeeId).select("name email role");
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const isAuthorized =
      isAdminRole(req.user) ||
      ((await can(req.user, "reports:view")) &&
        (await canAccessUserData(req.user, employeeId)));
    if (!isAuthorized) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const tasks = await Task.find({ assignedTo: { $in: [employeeId] } })
      .populate("assignedBy", "name email")
      .populate("assignedTo", "name email employeeId designation")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
    const pendingTasks = tasks.filter((t) => t.status === "pending").length;
    const rejectedTasks = tasks.filter((t) => t.status === "rejected").length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        t.status !== "completed" &&
        t.status !== "rejected" &&
        new Date(t.dueDate) < now
    ).length;

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const highPriorityTasks = tasks.filter((t) => t.priority === "High").length;
    const mediumPriorityTasks = tasks.filter((t) => t.priority === "Medium").length;
    const lowPriorityTasks = tasks.filter((t) => t.priority === "Low").length;

    // Quality metrics from status history
    const rejectionRate =
      totalTasks > 0 ? Math.round((rejectedTasks / totalTasks) * 100) : 0;

    const reopenedTasks = tasks.filter((t) => {
      if (!t.statusHistory || t.statusHistory.length < 2) return false;
      let wasCompleted = false;
      for (const entry of t.statusHistory) {
        if (entry.status === "completed") {
          wasCompleted = true;
        } else if (wasCompleted && entry.status !== "rejected") {
          return true;
        }
      }
      return false;
    }).length;

    const reopenedRate =
      totalTasks > 0 ? Math.round((reopenedTasks / totalTasks) * 100) : 0;
    const firstTimeCompletedTasks = Math.max(completedTasks - reopenedTasks, 0);
    const firstTimeSuccessRate =
      completedTasks > 0
        ? Math.round((firstTimeCompletedTasks / completedTasks) * 100)
        : 0;

    const qualityMetrics = {
      rejectedTasks,
      rejectionRate,
      reopenedTasks,
      reopenedRate,
      firstTimeSuccessRate,
    };

    const recentTasks = tasks.slice(0, 10).map((t) => ({
      _id: t._id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      assignedBy: t.assignedBy,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    const taskSummary = (t) => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
    });

    const tasksByStatus = {
      completed: tasks
        .filter((t) => t.status === "completed")
        .map((t) => ({ ...taskSummary(t), completedAt: t.completedAt || t.updatedAt })),
      inProgress: tasks.filter((t) => t.status === "in-progress").map(taskSummary),
      pending: tasks.filter((t) => t.status === "pending").map(taskSummary),
      overdue: tasks
        .filter(
          (t) =>
            t.dueDate &&
            t.status !== "completed" &&
            t.status !== "rejected" &&
            new Date(t.dueDate) < now
        )
        .map((t) => ({
          ...taskSummary(t),
          daysPastDue: Math.ceil((now - new Date(t.dueDate)) / (1000 * 60 * 60 * 24)),
        })),
    };

    res.json({
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
      },
      summary: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        rejectedTasks,
        overdueTasks,
        completionRate,
        highPriorityTasks,
        mediumPriorityTasks,
        lowPriorityTasks,
      },
      qualityMetrics,
      recentTasks,
      tasksByStatus,
    });
  } catch (err) {
    console.error("Error fetching employee task analytics:", err);
    res.status(500).json({ message: "Server error" });
  }
};
