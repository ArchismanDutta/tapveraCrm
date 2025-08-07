const Task = require("../models/Task");

exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate } = req.body;
    const assignedBy = req.user._id; // from auth middleware

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

// Add more functions for updateTask, deleteTask, etc. as needed
