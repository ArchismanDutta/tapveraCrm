import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import axios from "axios";

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const bellRef = useRef(null);
  const prevCount = useRef(0);

  // Helper: Safe decode JWT
  const decodeToken = (token) => {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  };

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

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const userData = decodeToken(token);
      if (!userData?.id) return;

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get("http://localhost:5000/api/tasks", config);

      const assignedTasks = res.data.filter(
        (task) =>
          task.assignedTo?._id === userData.id &&
          (task.status === "pending" || task.status === "in-progress")
      );

      const notifArray = assignedTasks.map((task) => ({
        id: task._id,
        message: `New Task: ${task.title} (Due: ${
          task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"
        })`,
      }));

      // Bell animation if new notifications
      if (notifArray.length > prevCount.current) {
        setIsRinging(true);
        setTimeout(() => setIsRinging(false), 1000);
      }
      prevCount.current = notifArray.length;

      setNotifications(notifArray);
    } catch (err) {
      console.error("Error fetching notifications", err.message);
    }
  }, []);

  // On mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="relative" ref={bellRef}>
      {/* Bell Icon */}
      <button
        className="relative p-2 rounded-full bg-white hover:bg-gray-200 transition"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <Bell
          className={`w-6 h-6 text-gray-800 ${isRinging ? "animate-shake" : ""}`}
        />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg shadow-lg z-50 border border-gray-300 bg-white/80 backdrop-blur-sm">
          <div className="p-3 border-b border-gray-300 text-black font-semibold">
            Notifications
          </div>
          {notifications.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto no-scrollbar">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition cursor-pointer"
                >
                  <span className="text-black">{n.message}</span>
                  <button
                    onClick={() => removeNotification(n.id)}
                    className="text-black hover:text-red-500"
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

      {/* CSS styles — removed `jsx` attribute */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes shake {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
          75% { transform: rotate(-10deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
