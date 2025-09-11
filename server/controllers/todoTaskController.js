const TodoTask = require("../models/TodoTask");

// Normalize date to start of day (00:00:00)
const normalizeDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// GET /api/todos?date=YYYY-MM-DD => Today tasks only
exports.getTodoTasksByDate = async (req, res) => {
  try {
    const userId = req.user._id;
    const dateParam = req.query.date || new Date();
    const date = normalizeDate(dateParam);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    // Return tasks for the given day
    const tasks = await TodoTask.find({
      userId,
      date: { $gte: date, $lt: nextDate },
    }).sort({ createdAt: 1 });

    res.json(tasks);
  } catch (err) {
    console.error("Error fetching todo tasks:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// NEW API: GET /api/todos/upcoming?startDate=YYYY-MM-DD
exports.getUpcomingTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const startDateParam = req.query.startDate || new Date();
    const startDate = normalizeDate(startDateParam);

    // Return incomplete tasks from startDate onwards
    const tasks = await TodoTask.find({
      userId,
      date: { $gte: startDate },
      completed: false,
    }).sort({ date: 1, createdAt: 1 });

    res.json(tasks);
  } catch (err) {
    console.error("Error fetching upcoming todo tasks:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/todos (Create new task)
exports.createTodoTask = async (req, res) => {
  try {
    const userId = req.user._id;
    let { title, description, label, time, date } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    date = date ? normalizeDate(date) : normalizeDate(new Date());

    const task = new TodoTask({
      userId,
      title: title.trim(),
      description: description || "",
      label: label || null,
      time: time || "",
      date: date,
    });

    await task.save();
    res.status(201).json(task);
  } catch (err) {
    console.error("Error creating todo task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/todos/:id (Update task fields)
exports.updateTodoTask = async (req, res) => {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;
    const { title, description, label, time, completed } = req.body;

    const task = await TodoTask.findOne({ _id: taskId, userId });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (label !== undefined) task.label = label;
    if (time !== undefined) task.time = time;
    if (completed !== undefined) task.completed = !!completed;

    await task.save();
    res.json(task);
  } catch (err) {
    console.error("Error updating todo task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/todos/:id (Delete a task)
exports.deleteTodoTask = async (req, res) => {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;

    const task = await TodoTask.findOneAndDelete({ _id: taskId, userId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/todos/:id/move (Move task to another date)
exports.moveTodoTask = async (req, res) => {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;
    let { newDate } = req.body;

    if (!newDate) {
      return res.status(400).json({ message: "New date is required" });
    }

    newDate = normalizeDate(newDate);

    const task = await TodoTask.findOne({ _id: taskId, userId });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.date = newDate;
    await task.save();

    res.json(task);
  } catch (err) {
    console.error("Error moving todo task:", err);
    res.status(500).json({ message: "Server error" });
  }
};
