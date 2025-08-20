// TodoPage.jsx with debugging and fixed handleMarkDone

import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/dashboard/Sidebar";
import TaskList from "../components/todo/TaskList";
import TaskForm from "../components/todo/TaskForm";

const TodoPage = () => {
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
      console.log(`Toggling completed for task ${task._id} from ${task.completed} to ${!task.completed}`);
      const response = await axios.put(
        `/api/todos/${task._id}`,
        { completed: !task.completed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("Response from toggle:", response.data);
      await fetchTasks();
    } catch (err) {
      console.error("Failed to toggle completed:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="employee" />
      <main className={`flex-1 p-6 ${collapsed ? "ml-20" : "ml-64"}`}>
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-semibold">My Tasks</h1>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
            >
              + Add New Task
            </button>
          </header>
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
