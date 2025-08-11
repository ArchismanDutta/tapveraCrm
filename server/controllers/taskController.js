const Task = require("../models/Task");

// Create Task (admin/super-admin)
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority } = req.body;
    const assignedBy = req.user._id;

    if (!title || !assignedTo) {
      return res
        .status(400)
        .json({ message: "Title and assignedTo are required." });
    }

    // Optional: Validate priority
    const allowedPriorities = ["High", "Medium", "Low"];
    let validatedPriority = "Medium"; // Default
    if (priority && allowedPriorities.includes(priority)) {
      validatedPriority = priority;
    }

    const task = new Task({
      title,
      description,
      assignedTo,
      assignedBy,
      dueDate,
      priority: validatedPriority,
    });

    await task.save();
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Edit task (admin/super-admin who assigned)
exports.editTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, assignedTo, dueDate, status, priority } =
      req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Must be admin/super-admin and assignedBy
    if (
      !["admin", "super-admin"].includes(req.user.role) ||
      task.assignedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this task." });
    }

    // Update fields if provided
    if (title) task.title = title;
    if (description) task.description = description;
    if (assignedTo) task.assignedTo = assignedTo;
    if (dueDate) task.dueDate = dueDate;
    if (status && ["pending", "in-progress", "completed"].includes(status)) {
      task.status = status;
    }
    if (priority && ["High", "Medium", "Low"].includes(priority)) {
      task.priority = priority;
    }

    await task.save();
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update task status (assignedBy or assignedTo)
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!["pending", "in-progress", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Only assignedBy or assignedTo may update status
    if (
      task.assignedBy.toString() !== req.user._id.toString() &&
      task.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this task." });
    }

    task.status = status;
    await task.save();

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Delete Task (admin/super-admin who assigned)
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }
    if (
      !["admin", "super-admin"].includes(req.user.role) ||
      task.assignedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this task." });
    }

    await task.deleteOne();
    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get Task by ID (authorized user)
exports.getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId)
      .populate("assignedBy", "name email role")
      .populate("assignedTo", "name email role");

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    if (
      task.assignedBy._id.toString() !== req.user._id.toString() &&
      task.assignedTo._id.toString() !== req.user._id.toString() &&
      !["admin", "super-admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this task." });
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get all tasks for logged-in user
exports.getTasks = async (req, res) => {
  try {
    const userId = req.user._id;

    const tasks = await Task.find({
      $or: [{ assignedTo: userId }, { assignedBy: userId }],
    })
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email");

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
