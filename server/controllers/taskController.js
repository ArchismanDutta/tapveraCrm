const Task = require("../models/Task");

exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate } = req.body;
    const assignedBy = req.user._id; // from auth middleware
    console.log("req.user in createTask:", req.user);

    if (!title || !assignedTo) {
      return res
        .status(400)
        .json({ message: "Title and assignedTo are required." });
    }

    const task = new Task({
      title,
      description,
      assignedTo,
      assignedBy,
      dueDate,
    });

    await task.save();
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTasks = async (req, res) => {
  try {
    // Return tasks related to the user: assignedTo or assignedBy
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

// Update task status
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

    // Optional: Only assignedBy or assignedTo may update status (you can adjust)
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

// Edit task - only admin / super-admin who assigned it
exports.editTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, assignedTo, dueDate, status } = req.body;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Check if current user is admin or super-admin and assignedBy the task
    if (
      !["admin", "super-admin"].includes(req.user.role) ||
      task.assignedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this task." });
    }

    // Update allowed fields if provided
    if (title) task.title = title;
    if (description) task.description = description;
    if (assignedTo) task.assignedTo = assignedTo;
    if (dueDate) task.dueDate = dueDate;
    if (status && ["pending", "in-progress", "completed"].includes(status)) {
      task.status = status;
    }

    await task.save();

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Delete task - only admin / super-admin who assigned it
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

    await task.remove();
    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get task details by ID - authenticated user if assignedBy or assignedTo
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


// Add more functions for updateTask, deleteTask, etc. as needed
