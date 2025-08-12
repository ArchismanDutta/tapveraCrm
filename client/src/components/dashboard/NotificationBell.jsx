import React, { useState, useRef, useEffect } from "react";
import { Bell, X } from "lucide-react";
import axios from "axios";

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const bellRef = useRef(null);
  const prevCount = useRef(0);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications only once on page load (component mount)
  useEffect(() => {
    fetchNotifications();
    // ✅ Removed setInterval — no polling
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get("http://localhost:5000/api/tasks", config);

      const myId = JSON.parse(atob(token.split(".")[1])).id;
      const assignedTasks = res.data.filter(
        (task) =>
          task.assignedTo?._id === myId &&
          (task.status === "pending" || task.status === "in-progress")
      );

      const notifArray = assignedTasks.map((task) => ({
        id: task._id,
        message: `New Task: ${task.title} (Due: ${
          task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"
        })`,
      }));

      // Bell ring animation if count increased
      if (notifArray.length > prevCount.current) {
        setIsRinging(true);
        setTimeout(() => setIsRinging(false), 1000);
      }
      prevCount.current = notifArray.length;

      setNotifications(notifArray);
    } catch (err) {
      console.error("Error fetching notifications", err.message);
    }
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="relative" ref={bellRef}>
      {/* Bell Icon */}
      <button
        className="relative p-2 rounded-full bg-surface hover:bg-border transition"
        onClick={() => setOpen(!open)}
      >
        <Bell
          className={`w-6 h-6 text-textMain ${isRinging ? "animate-shake" : ""}`}
        />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-yellow-500 text-background text-xs font-bold px-1.5 py-0.5 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg shadow-lg z-50 border border-border bg-[#ffffff]/80 backdrop-blur-sm">
          <div className="p-3 border-b border-border text-black font-semibold">
            Notifications
          </div>
          {notifications.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto no-scrollbar">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[#d9d9d9] transition cursor-pointer"
                >
                  <span className="text-black">{n.message}</span>
                  <button
                    onClick={() => removeNotification(n.id)}
                    className="text-black hover:text-primary"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-black text-sm">No notifications</div>
          )}
        </div>
      )}

      {/* CSS for hiding scrollbars */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
