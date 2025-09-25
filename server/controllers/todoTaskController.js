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

// GET /api/todos/analytics (Get productivity analytics)
exports.getTodoAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = normalizeDate(new Date());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    // Get all tasks for analytics
    const allTasks = await TodoTask.find({ userId });
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(task => task.completed).length;
    const pendingTasks = totalTasks - completedTasks;

    // Today's tasks
    const todayTasks = allTasks.filter(task => {
      const taskDate = normalizeDate(task.date);
      return taskDate.getTime() === today.getTime();
    });
    const todayCompleted = todayTasks.filter(task => task.completed).length;

    // This week's tasks
    const weekTasks = allTasks.filter(task => {
      const taskDate = normalizeDate(task.date);
      return taskDate >= weekAgo && taskDate <= today;
    });
    const weekCompleted = weekTasks.filter(task => task.completed).length;

    // This month's tasks
    const monthTasks = allTasks.filter(task => {
      const taskDate = normalizeDate(task.date);
      return taskDate >= monthAgo && taskDate <= today;
    });
    const monthCompleted = monthTasks.filter(task => task.completed).length;

    // Calculate completion rates
    const weeklyCompletionRate = weekTasks.length > 0 ? Math.round((weekCompleted / weekTasks.length) * 100) : 0;
    const monthlyCompletionRate = monthTasks.length > 0 ? Math.round((monthCompleted / monthTasks.length) * 100) : 0;
    const overallCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Task distribution by label
    const labelDistribution = {};
    allTasks.forEach(task => {
      const label = task.label || 'No Label';
      labelDistribution[label] = (labelDistribution[label] || 0) + 1;
    });

    // Daily completion trend for the last 7 days
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayTasks = allTasks.filter(task => {
        const taskDate = normalizeDate(task.date);
        return taskDate.getTime() === normalizeDate(date).getTime();
      });

      const dayCompleted = dayTasks.filter(task => task.completed).length;

      dailyTrend.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        completed: dayCompleted,
        total: dayTasks.length
      });
    }

    // Productivity score (based on completion rate and consistency)
    const consistencyScore = dailyTrend.filter(day => day.total > 0 && day.completed > 0).length;
    const productivityScore = Math.round((overallCompletionRate * 0.7) + (consistencyScore * 4.3));

    const analytics = {
      totalTasks,
      completedTasks,
      pendingTasks,
      todayTasks: todayTasks.length,
      todayCompleted,
      weeklyCompletionRate,
      monthlyCompletionRate,
      overallCompletionRate,
      productivityScore: Math.min(productivityScore, 100),
      labelDistribution,
      dailyTrend,
      streakData: {
        current: calculateCurrentStreak(allTasks, today),
        longest: calculateLongestStreak(allTasks)
      }
    };

    res.json(analytics);
  } catch (err) {
    console.error("Error fetching todo analytics:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper function to calculate current streak
const calculateCurrentStreak = (tasks, today) => {
  let streak = 0;
  let currentDate = new Date(today);

  while (true) {
    const dayTasks = tasks.filter(task => {
      const taskDate = normalizeDate(task.date);
      return taskDate.getTime() === normalizeDate(currentDate).getTime();
    });

    const dayCompleted = dayTasks.filter(task => task.completed).length;

    if (dayTasks.length > 0 && dayCompleted > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }

    // Prevent infinite loop
    if (streak > 365) break;
  }

  return streak;
};

// Helper function to calculate longest streak
const calculateLongestStreak = (tasks) => {
  const completionDates = new Set();

  tasks.filter(task => task.completed).forEach(task => {
    const dateStr = normalizeDate(task.date).toISOString().split('T')[0];
    completionDates.add(dateStr);
  });

  const sortedDates = Array.from(completionDates).sort();
  let longestStreak = 0;
  let currentStreak = 0;

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
  }

  return Math.max(longestStreak, currentStreak);
};
