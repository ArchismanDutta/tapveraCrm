import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import TaskList from "../components/todo/TaskList";
import TaskForm from "../components/todo/TaskForm";

const TodoPage = ({ onLogout }) => {
  const token = localStorage.getItem("token");
  const [collapsed, setCollapsed] = useState(false);
  const [todayTasks, setTodayTasks] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const fetchTasks = async () => {
    try {
      const todayISO = normalizeDate(new Date());
      const tomorrowISO = normalizeDate(new Date(new Date().getTime() + 24 * 3600000));
      const todayRes = await axios.get("/api/todos", {
        headers: { Authorization: `Bearer ${token}` },
        params: { date: todayISO },
      });
      const upcomingRes = await axios.get("/api/todos/upcoming", {
        headers: { Authorization: `Bearer ${token}` },
        params: { startDate: tomorrowISO },
      });
      const allTasks = [...todayRes.data, ...upcomingRes.data];
      const completed = allTasks.filter((t) => t.completed);
      const todayPending = todayRes.data.filter((t) => !t.completed);
      const upcomingPending = upcomingRes.data.filter((t) => !t.completed);
      const normalize = (arr) =>
        arr.map((t) => ({
          ...t,
          date: t.date ? new Date(t.date).toISOString() : null,
          completedAtStr: t.completedAt ? new Date(t.completedAt).toLocaleString() : null,
        }));
      setTodayTasks(normalize(todayPending));
      setUpcomingTasks(normalize(upcomingPending));
      setCompletedTasks(normalize(completed));
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSaveTask = async (task) => {
    try {
      if (task._id) {
        await axios.put(`/api/todos/${task._id}`, task, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        if (!task.date) {
          task.date = normalizeDate(new Date());
        }
        await axios.post("/api/todos", task, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setShowForm(false);
      setEditTask(null);
      await fetchTasks();
    } catch (err) {
      console.error("Failed to save task:", err);
    }
  };

  const handleMarkDone = async (task) => {
    try {
      const response = await axios.put(
        `/api/todos/${task._id}`,
        { completed: !task.completed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedTaskRaw = response.data;
      const updatedTask = {
        ...updatedTaskRaw,
        date: updatedTaskRaw.date ? new Date(updatedTaskRaw.date).toISOString() : null,
        completedAtStr: updatedTaskRaw.completedAt ? new Date(updatedTaskRaw.completedAt).toLocaleString() : null,
      };
      if (updatedTask.completed) {
        setTodayTasks((prev) => prev.filter((t) => t._id !== updatedTask._id));
        setUpcomingTasks((prev) => prev.filter((t) => t._id !== updatedTask._id));
        setCompletedTasks((prev) => [updatedTask, ...prev]);
      } else {
        setCompletedTasks((prev) => prev.filter((t) => t._id !== updatedTask._id));
        const taskDate = new Date(updatedTask.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (taskDate.getTime() === today.getTime()) {
          setTodayTasks((prev) => [updatedTask, ...prev]);
        } else {
          setUpcomingTasks((prev) => [updatedTask, ...prev]);
        }
      }
    } catch (err) {
      console.error("Failed to toggle completed:", err);
    }
  };

  const totalTasks = todayTasks.length + upcomingTasks.length + completedTasks.length;
  const completedCount =
    completedTasks.length + todayTasks.filter((t) => t.completed).length + upcomingTasks.filter((t) => t.completed).length;
  const completionPercent = totalTasks ? (completedCount / totalTasks) * 100 : 0;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#131720] via-[#161c2c] to-black text-gray-100">
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" />
      <main className={`flex-1 pt-10 ${collapsed ? "ml-20" : "ml-64"}`}>
        <div className="max-w-3xl mx-auto">
          <header className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-100">Tasks Overview</h1>
              <p className="text-sm text-gray-500 mt-1">Personal productivity progress</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-400 text-gray-900 rounded shadow font-semibold hover:from-yellow-500 hover:via-amber-600 hover:to-orange-500 transition"
            >
              + Add New Task
            </button>
          </header>
          {/* Progress Bar */}
          <div className="mb-8 max-w-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-400">Completion</span>
              <span className="text-xs text-gray-300">
                {completedCount} / {totalTasks} tasks
              </span>
            </div>
            <div className="h-2 bg-[#161c2c] rounded-md overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-green-400 transition duration-700"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
          <TaskList
            todayTasks={todayTasks}
            upcomingTasks={upcomingTasks}
            completedTasks={completedTasks}
            onEdit={(task) => {
              setEditTask(task);
              setShowForm(true);
            }}
            onMarkDone={handleMarkDone}
          />
        </div>
        {showForm && (
          <TaskForm
            task={editTask}
            onClose={() => {
              setShowForm(false);
              setEditTask(null);
            }}
            onSave={handleSaveTask}
          />
        )}
      </main>
    </div>
  );
};

export default TodoPage;
