const Task = require("../models/Task");
const { getIO } = require("../socket");

const populateTask = (query) =>
  query.populate("assignedTo", "name email").populate("assignedBy", "name email");

// Create Task
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority } = req.body;
    const assignedBy = req.user._id;

    if (!title || !Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res.status(400).json({ 
        message: "Title and at least one assigned user are required." 
      });
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
    });

    await task.save();
    const populated = await populateTask(Task.findById(task._id)).lean();

    // Emit to ALL connected clients
    getIO().emit("taskCreated", populated);
    console.log("✅ Task created and broadcasted:", populated.title);

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Edit Task - FIXED AUTHORIZATION BUG
exports.editTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, assignedTo, dueDate, status, priority } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    // FIXED: Only check admin role OR if user is the task creator
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
    if (status && ["pending", "in-progress", "completed"].includes(status)) {
      task.status = status;
    }
    if (priority && ["High", "Medium", "Low"].includes(priority)) {
      task.priority = priority;
    }

    await task.save();
    const populated = await populateTask(Task.findById(taskId)).lean();

    // Emit to ALL connected clients
    getIO().emit("taskUpdated", populated);
    console.log("✅ Task updated and broadcasted:", populated.title);

    res.json(populated);
  } catch (err) {
    console.error("Error editing task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Task Status
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!["pending", "in-progress", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (
      task.assignedBy.toString() !== req.user._id.toString() &&
      !task.assignedTo.some((id) => id.toString() === req.user._id.toString())
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    task.status = status;
    await task.save();
    const populated = await populateTask(Task.findById(taskId)).lean();

    // Emit to ALL connected clients
    getIO().emit("taskUpdated", populated);
    console.log("✅ Task status updated and broadcasted:", populated.title);

    res.json(populated);
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.taskId));
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (
      task.assignedBy._id.toString() !== req.user._id.toString() &&
      !task.assignedTo.some((u) => u._id.toString() === req.user._id.toString()) &&
      !["admin", "super-admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(task);
  } catch (err) {
    console.error("Error fetching task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all Tasks
exports.getTasks = async (req, res) => {
  try {
    let query = {};

    // Show all tasks if user is admin/super-admin, else only related tasks
    if (!["admin", "super-admin"].includes(req.user.role)) {
      query = {
        $or: [{ assignedTo: req.user._id }, { assignedBy: req.user._id }],
      };
    }

    const tasks = await populateTask(Task.find(query)).lean();
    res.json(tasks);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Delete Task
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

    // Emit to ALL connected clients
    getIO().emit("taskDeleted", req.params.taskId);
    console.log("✅ Task deleted and broadcasted:", req.params.taskId);

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ message: "Server error" });
  }
};
