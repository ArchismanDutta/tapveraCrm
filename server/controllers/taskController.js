// File: controllers/taskController.js
const Task = require("../models/Task");
const { notifyAdmins } = require("../services/whatsappService");
const { sendNotificationToUser, sendNotificationToMultipleUsers } = require("../utils/websocket");

// ------------------- Helper: populate task fields -------------------
const populateTask = (query) =>
  query
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("lastEditedBy", "name email")
    .populate("remarks.user", "name email")
    .populate("statusHistory.changedBy", "name email");

// ------------------- CREATE TASK -------------------
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority } = req.body;
    const assignedBy = req.user._id;

    if (!title || !Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res
        .status(400)
        .json({ message: "Title and at least one assigned user are required." });
    }

    const allowedPriorities = ["High", "Medium", "Low"];
    const validatedPriority = allowedPriorities.includes(priority) ? priority : "Medium";

    const task = new Task({
      title,
      description,
      assignedTo,
      assignedBy,
      dueDate,
      priority: validatedPriority,
      statusHistory: [{
        status: "pending",
        changedBy: assignedBy,
        changedAt: new Date(),
        note: "Task created"
      }]
    });
    await task.save();

    const populated = await populateTask(Task.findById(task._id)).lean();

    // WhatsApp notification
    await notifyAdmins(
      `📝 *New Task Created*\n📌 Title: *${populated.title}*\n📅 Due: *${
        populated.dueDate || "N/A"
      }*\n🎯 Priority: *${populated.priority}*\n👤 Assigned By: *${req.user.name}*\n👥 Assigned To: ${
        populated.assignedTo.map((u) => u.name).join(", ") || "None"
      }`
    );

    // WebSocket notification to assigned users
    const assignedUserIds = populated.assignedTo.map(u => u._id.toString());
    sendNotificationToMultipleUsers(assignedUserIds, {
      channel: "task",
      title: "New Task Assigned",
      message: populated.title,
      body: `${populated.title}\nPriority: ${populated.priority}\nDue: ${populated.dueDate || "No due date"}`,
      taskId: populated._id,
      priority: populated.priority,
      dueDate: populated.dueDate,
      assignedBy: req.user.name,
      action: "task_assigned"
    });

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- EDIT TASK -------------------
exports.editTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, assignedTo, dueDate, status, priority } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    // Only admin/super-admin or creator can edit
    if (
      !["admin", "super-admin"].includes(req.user.role) &&
      task.assignedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (title) task.title = title;
    if (description) task.description = description;
    if (Array.isArray(assignedTo) && assignedTo.length) task.assignedTo = assignedTo;
    if (dueDate) task.dueDate = dueDate;

    if (status && ["pending", "in-progress", "completed", "rejected"].includes(status)) {
      const isAdmin = ["admin", "super-admin"].includes(req.user.role);

      // ✅ Prevent non-admin from changing status away from completed
      if (!isAdmin && task.status === "completed" && status !== "completed") {
        return res.status(403).json({
          message: "Cannot change status of completed task. Please wait for admin review."
        });
      }

      // Prevent manually setting rejected status
      if (status === "rejected" && !isAdmin) {
        return res.status(403).json({
          message: "Only admins can reject tasks"
        });
      }

      // ✅ Track status change if status is actually changing
      if (task.status !== status) {
        task.statusHistory.push({
          status: status,
          changedBy: req.user._id,
          changedAt: new Date(),
          note: `Status changed from ${task.status} to ${status} via edit`
        });
      }

      // ✅ handle completedAt field
      if (status === "completed" && task.status !== "completed") {
        task.completedAt = new Date();
      } else if (task.status === "completed" && status !== "completed") {
        task.completedAt = null;
      }
      task.status = status;
    }

    if (priority && ["High", "Medium", "Low"].includes(priority)) task.priority = priority;

    // Track who last edited the task
    task.lastEditedBy = req.user._id;

    // Ensure the field is marked as modified for existing documents
    task.markModified('lastEditedBy');

    await task.save();
    const populated = await populateTask(Task.findById(taskId)).lean();

    await notifyAdmins(
      `✏️ *Task Updated*\n📌 Title: *${populated.title}*\n📅 Due: *${
        populated.dueDate || "N/A"
      }*\n📊 Status: *${populated.status}*\n🎯 Priority: *${populated.priority}*\n👤 Updated By: *${req.user.name}*`
    );

    // WebSocket notification to assigned users and creator
    const notifyUserIds = [
      ...populated.assignedTo.map(u => u._id.toString()),
      populated.assignedBy._id.toString()
    ];
    const uniqueUserIds = [...new Set(notifyUserIds)].filter(id => id !== req.user._id.toString());

    sendNotificationToMultipleUsers(uniqueUserIds, {
      channel: "task",
      title: "Task Updated",
      message: `${populated.title} was updated`,
      body: `${populated.title}\nStatus: ${populated.status}\nPriority: ${populated.priority}\nUpdated by: ${req.user.name}`,
      taskId: populated._id,
      status: populated.status,
      priority: populated.priority,
      action: "task_updated"
    });

    res.json(populated);
  } catch (err) {
    console.error("Error editing task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- UPDATE TASK STATUS -------------------
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!["pending", "in-progress", "completed", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    // Only creator or assigned users can change status
    if (
      task.assignedBy.toString() !== req.user._id.toString() &&
      !task.assignedTo.some((id) => id.toString() === req.user._id.toString())
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ✅ Prevent non-admin employees from changing status once task is completed
    // Only admin/super-admin can change status away from "completed" or "rejected"
    const isAdmin = ["admin", "super-admin"].includes(req.user.role);
    if (!isAdmin && task.status === "completed" && status !== "completed") {
      return res.status(403).json({
        message: "Cannot change status of completed task. Please wait for admin review."
      });
    }

    // Prevent anyone from manually setting rejected status (must use reject endpoint)
    if (status === "rejected") {
      return res.status(400).json({
        message: "Use the reject endpoint to reject tasks"
      });
    }

    // ✅ Track status change
    if (task.status !== status) {
      task.statusHistory.push({
        status: status,
        changedBy: req.user._id,
        changedAt: new Date(),
        note: `Status updated by ${req.user.role === 'employee' ? 'employee' : 'admin'}`
      });
    }

    // ✅ set/unset completedAt
    if (status === "completed" && !task.completedAt) {
      task.completedAt = new Date();
    } else if (status !== "completed" && task.completedAt) {
      task.completedAt = null;
    }

    task.status = status;
    // Track who last edited the task
    task.lastEditedBy = req.user._id;

    // Ensure the field is marked as modified for existing documents
    task.markModified('lastEditedBy');

    await task.save();

    const populated = await populateTask(Task.findById(taskId)).lean();

    await notifyAdmins(
      `✅ *Task Status Changed*\n📌 Title: *${populated.title}*\n📊 New Status: *${status}*\n👤 Changed By: *${req.user.name}*`
    );

    // WebSocket notification to assigned users and creator
    const notifyUserIds = [
      ...populated.assignedTo.map(u => u._id.toString()),
      populated.assignedBy._id.toString()
    ];
    const uniqueUserIds = [...new Set(notifyUserIds)].filter(id => id !== req.user._id.toString());

    sendNotificationToMultipleUsers(uniqueUserIds, {
      channel: "task",
      title: "Task Status Changed",
      message: `${populated.title} is now ${status}`,
      body: `${populated.title}\nNew Status: ${status}\nChanged by: ${req.user.name}`,
      taskId: populated._id,
      status: populated.status,
      action: "task_status_changed"
    });

    res.json(populated);
  } catch (err) {
    console.error("Error updating status:", err);
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
      ["admin", "super-admin"].includes(req.user.role);

    if (!isAuthorized) return res.status(403).json({ message: "Not authorized" });

    // ✅ Initialize statusHistory for old tasks that don't have it
    if (!task.statusHistory || task.statusHistory.length === 0) {
      task.statusHistory = [{
        status: task.status || "pending",
        changedBy: task.assignedBy,
        changedAt: task.createdAt || new Date(),
        note: "Initial status (migrated)"
      }];
      await task.save();
    }

    res.json(task);
  } catch (err) {
    console.error("Error fetching task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- GET ALL TASKS -------------------
exports.getTasks = async (req, res) => {
  try {
    let query = {};
    if (!["admin", "super-admin"].includes(req.user.role)) {
      query = { $or: [{ assignedTo: req.user._id }, { assignedBy: req.user._id }] };
    }

    const tasks = await populateTask(Task.find(query)).lean();
    res.json(tasks);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- DELETE TASK -------------------
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (
      !["admin", "super-admin"].includes(req.user.role) &&
      task.assignedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await task.deleteOne();

    await notifyAdmins(
      `🗑️ *Task Deleted*\n📌 Title: *${task.title}*\n👤 Deleted By: *${req.user.name}*`
    );

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- ADD REMARK -------------------
exports.addRemark = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;

    if (!comment?.trim()) {
      return res.status(400).json({ message: "Remark cannot be empty" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    task.remarks.push({ user: req.user._id, comment });
    await task.save();

    const populated = await populateTask(Task.findById(taskId)).lean();
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
    res.json(task.remarks || []);
  } catch (err) {
    console.error("Error fetching remarks:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- REJECT TASK -------------------
exports.rejectTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;

    // ✅ Require rejection reason
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    // Only admin/super-admin can reject tasks
    if (!["admin", "super-admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admins can reject tasks" });
    }

    // Only reject tasks that are marked as completed
    if (task.status !== "completed") {
      return res.status(400).json({ message: "Only completed tasks can be rejected" });
    }

    // ✅ Track status change to rejected
    task.statusHistory.push({
      status: "rejected",
      changedBy: req.user._id,
      changedAt: new Date(),
      note: `Task rejected: ${reason.trim()}`
    });

    // Update task status to rejected
    task.status = "rejected";
    task.rejectedAt = new Date();
    task.rejectionReason = reason.trim();
    task.completedAt = null; // Clear completed timestamp
    task.lastEditedBy = req.user._id;

    // Mark fields as modified to ensure they're saved
    task.markModified('status');
    task.markModified('rejectedAt');
    task.markModified('rejectionReason');
    task.markModified('completedAt');
    task.markModified('lastEditedBy');

    await task.save();

    // Log to verify the data is being saved
    console.log('Task rejected:', {
      id: task._id,
      status: task.status,
      rejectionReason: task.rejectionReason,
      rejectedAt: task.rejectedAt
    });

    const populated = await populateTask(Task.findById(taskId)).lean();

    // Log to verify the populated data includes rejection fields
    console.log('Returning rejected task to client:', {
      id: populated._id,
      status: populated.status,
      rejectionReason: populated.rejectionReason,
      rejectedAt: populated.rejectedAt
    });

    await notifyAdmins(
      `❌ *Task Rejected*\n📌 Title: *${populated.title}*\n📝 Reason: *${populated.rejectionReason}*\n👤 Rejected By: *${req.user.name}*`
    );

    res.json(populated);
  } catch (err) {
    console.error("Error rejecting task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------- GET EMPLOYEE TASK ANALYTICS -------------------
exports.getEmployeeTaskAnalytics = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Check if the employee exists
    const User = require("../models/User");
    const employee = await User.findById(employeeId).select("name email role");
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Get all tasks assigned to this employee
    const tasks = await Task.find({
      assignedTo: { $in: [employeeId] }
    })
    .populate("assignedBy", "name email")
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 });

    // Calculate analytics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === "completed").length;
    const inProgressTasks = tasks.filter(task => task.status === "in-progress").length;
    const pendingTasks = tasks.filter(task => task.status === "pending").length;
    const overdueTasks = tasks.filter(task => {
      const now = new Date();
      const dueDate = new Date(task.dueDate);
      return task.status !== "completed" && dueDate < now;
    }).length;

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Group tasks by priority
    const highPriorityTasks = tasks.filter(task => task.priority === "high").length;
    const mediumPriorityTasks = tasks.filter(task => task.priority === "medium").length;
    const lowPriorityTasks = tasks.filter(task => task.priority === "low").length;

    // Recent tasks (last 10)
    const recentTasks = tasks.slice(0, 10).map(task => ({
      _id: task._id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      assignedBy: task.assignedBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));

    // Tasks by status with details
    const tasksByStatus = {
      completed: tasks.filter(task => task.status === "completed").map(task => ({
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        completedAt: task.updatedAt
      })),
      inProgress: tasks.filter(task => task.status === "in-progress").map(task => ({
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt
      })),
      pending: tasks.filter(task => task.status === "pending").map(task => ({
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt
      })),
      overdue: tasks.filter(task => {
        const now = new Date();
        const dueDate = new Date(task.dueDate);
        return task.status !== "completed" && dueDate < now;
      }).map(task => ({
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        daysPastDue: Math.ceil((new Date() - new Date(task.dueDate)) / (1000 * 60 * 60 * 24))
      }))
    };

    const analytics = {
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role
      },
      summary: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        overdueTasks,
        completionRate,
        highPriorityTasks,
        mediumPriorityTasks,
        lowPriorityTasks
      },
      recentTasks,
      tasksByStatus
    };

    res.json(analytics);
  } catch (err) {
    console.error("Error fetching employee task analytics:", err);
    res.status(500).json({ message: "Server error" });
  }
};
