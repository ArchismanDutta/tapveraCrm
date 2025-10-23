// File: services/workloadService.js
const Task = require("../models/Task");
const User = require("../models/User");

/**
 * Calculate workload for a specific employee
 * @param {String} userId - Employee ID
 * @returns {Object} Workload data
 */
const calculateWorkload = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return null;
    }

    // Get all active tasks for this employee
    const activeTasks = await Task.find({
      assignedTo: { $in: [userId] },
      status: { $in: ['pending', 'in-progress'] }
    }).select('title priority dueDate status');

    // Calculate workload score based on:
    // 1. Number of tasks
    // 2. Task priorities (High = 3 points, Medium = 2, Low = 1)
    // 3. Overdue tasks (double the points)

    let workloadScore = 0;
    const now = new Date();

    activeTasks.forEach(task => {
      let taskWeight = 0;

      // Priority weight
      if (task.priority === 'High') taskWeight = 3;
      else if (task.priority === 'Medium') taskWeight = 2;
      else taskWeight = 1;

      // Overdue penalty (double the weight)
      if (task.dueDate && new Date(task.dueDate) < now) {
        taskWeight *= 2;
      }

      workloadScore += taskWeight;
    });

    // Convert to percentage (max comfortable load = 10 points)
    // 0-5 points = available (0-50%)
    // 6-8 points = busy (51-80%)
    // 9+ points = overloaded (81-100%+)
    const workloadPercentage = Math.min(Math.round((workloadScore / 10) * 100), 100);

    // Determine capacity status
    let capacity = 'available';
    if (workloadPercentage > 80) {
      capacity = 'overloaded';
    } else if (workloadPercentage > 50) {
      capacity = 'busy';
    }

    // Calculate next available date (simple estimation)
    let nextAvailable = new Date();
    if (capacity !== 'available' && activeTasks.length > 0) {
      // Estimate: 2 days per task on average
      const estimatedDays = Math.ceil(activeTasks.length * 1.5);
      nextAvailable.setDate(nextAvailable.getDate() + estimatedDays);
    }

    // Update user workload in database
    user.workload = {
      capacity,
      workloadPercentage,
      nextAvailable,
      activeTaskCount: activeTasks.length,
      lastCalculated: new Date()
    };

    await user.save();

    return {
      _id: user._id,           // Use _id for consistency
      userId: user._id,        // Keep userId for backwards compatibility
      name: user.name,
      email: user.email,
      role: user.role,         // Include role to show in UI
      capacity,
      workloadPercentage,
      activeTaskCount: activeTasks.length,
      activeTasks,
      nextAvailable
    };
  } catch (error) {
    console.error('Error calculating workload:', error);
    return null;
  }
};

/**
 * Update workload for all employees assigned to a task
 * @param {String} taskId - Task ID
 */
const updateWorkloadOnTaskChange = async (taskId) => {
  try {
    const task = await Task.findById(taskId).populate('assignedTo');
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      return;
    }

    // Update workload for all assigned users
    const updatePromises = task.assignedTo.map(user =>
      calculateWorkload(user._id)
    );

    await Promise.all(updatePromises);

    console.log(`✅ Updated workload for ${task.assignedTo.length} employees on task: ${task.title}`);
  } catch (error) {
    console.error('Error updating workload on task change:', error);
  }
};

/**
 * Get all employees with their current workload
 * @returns {Array} Employees with workload data
 */
const getAllEmployeesWithWorkload = async () => {
  try {
    // Get all active users (employees, admins, hr, super-admin)
    const employees = await User.find({
      role: { $in: ['employee', 'admin', 'hr', 'super-admin'] },
      status: 'active'
    }).select('name email role workload');

    console.log(`📊 Found ${employees.length} active users:`, employees.map(e => `${e.name} (${e.role})`));

    // Recalculate workload for each employee to ensure fresh data
    const employeesWithWorkload = await Promise.all(
      employees.map(async (emp) => {
        try {
          const workload = await calculateWorkload(emp._id);
          // If workload calculation succeeded, return it
          if (workload) {
            return workload;
          }
        } catch (error) {
          console.error(`Error calculating workload for ${emp.name}:`, error);
        }

        // If workload calculation failed, return employee with default values
        // This ensures ALL employees show up, even if workload calc fails
        return {
          _id: emp._id,
          userId: emp._id,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          capacity: 'available',
          workloadPercentage: 0,
          activeTaskCount: 0,
          activeTasks: [],
          nextAvailable: new Date()
        };
      })
    );

    console.log(`✅ Returning ${employeesWithWorkload.length} employees with workload:`,
      employeesWithWorkload.map(e => `${e.name} (${e.capacity})`));

    // Sort by availability (available first, then busy, then overloaded)
    // This is just for display order, NOT filtering anyone out
    const sortOrder = { available: 0, busy: 1, overloaded: 2, offline: 3 };
    employeesWithWorkload.sort((a, b) => {
      return sortOrder[a.capacity] - sortOrder[b.capacity];
    });

    return employeesWithWorkload;
  } catch (error) {
    console.error('Error getting employees with workload:', error);
    return [];
  }
};

/**
 * Recalculate workload for all employees
 * Useful for periodic updates or manual refresh
 */
const recalculateAllWorkloads = async () => {
  try {
    const employees = await User.find({
      role: 'employee',
      status: 'active'
    });

    console.log(`🔄 Recalculating workload for ${employees.length} employees...`);

    const updatePromises = employees.map(emp => calculateWorkload(emp._id));
    await Promise.all(updatePromises);

    console.log('✅ All workloads recalculated successfully');
  } catch (error) {
    console.error('Error recalculating all workloads:', error);
  }
};

module.exports = {
  calculateWorkload,
  updateWorkloadOnTaskChange,
  getAllEmployeesWithWorkload,
  recalculateAllWorkloads
};
