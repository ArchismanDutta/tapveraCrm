import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bell, X, Volume2, VolumeX } from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false); // track unlock state
  const bellRef = useRef(null);
  const audioRef = useRef(null);
  const prevCount = useRef(0);
  const intervalRef = useRef(null);

  const decodeToken = (token) => {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  };

  const attemptAudioUnlock = useCallback(() => {
    if (audioUnlocked) return;
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setAudioUnlocked(true);
          console.log("Audio unlocked successfully");
        })
        .catch((err) => {
          console.warn("Audio unlock failed, will retry on next user interaction:", err);
        });
    }
  }, [audioUnlocked]);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const userData = decodeToken(token);
      if (!userData?.id) return;

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BASE}/api/tasks`, config);

      const dismissed = JSON.parse(sessionStorage.getItem("dismissedNotifications") || "[]");

      const assignedTasks = res.data.filter(
        (task) =>
          Array.isArray(task.assignedTo) &&
          task.assignedTo.some((u) => u._id === userData.id) &&
          (task.status === "pending" || task.status === "in-progress") &&
          !dismissed.includes(task._id)
      );

      const notifArray = assignedTasks.map((task) => ({
        id: task._id,
        message: `Task: ${task.title} (Due: ${
          task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"
        })`,
      })).reverse();

      if (notifArray.length > prevCount.current) {
        setIsRinging(true);
        if (soundEnabled && audioUnlocked && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((err) => {
            console.warn("Audio play blocked:", err);
          });
        }
        setTimeout(() => setIsRinging(false), 1000);
      }
      prevCount.current = notifArray.length;
      setNotifications(notifArray);
    } catch (err) {
      console.error("Error fetching notifications", err);
    }
  }, [soundEnabled, audioUnlocked]);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleDocumentClick = () => {
      attemptAudioUnlock();
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentClick);
    };
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentClick);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentClick);
    };
  }, [attemptAudioUnlock]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const dismissed = JSON.parse(sessionStorage.getItem("dismissedNotifications") || "[]");
    sessionStorage.setItem("dismissedNotifications", JSON.stringify([...dismissed, id]));
    prevCount.current = prevCount.current - 1;
  };

  return (
    <div className="relative" ref={bellRef}>
      {/* Audio element */}
      <audio
  ref={audioRef}
  src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
  preload="auto"
/>

      <button
        className={`relative p-2 rounded-full bg-gradient-to-r from-[#232945] via-[#17171c] to-[#181b2b] hover:from-orange-400 hover:to-orange-500 shadow-lg transition`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
          attemptAudioUnlock();
        }}
        aria-label="Toggle notifications"
      >
        <Bell className={`w-6 h-6 text-orange-400 ${isRinging ? "animate-shake" : ""}`} />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl z-50 border border-[#232945] bg-gradient-to-b from-[#1c1f26]/95 to-[#232945]/90 backdrop-blur-lg">
          <div className="p-3 border-b border-[#232945] text-orange-400 font-bold text-base flex justify-between items-center">
            <span>Notifications</span>
            <button
              onClick={toggleSound}
              className="p-1 rounded hover:bg-[#232945]/50"
              title={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? <Volume2 className="text-orange-400" /> : <VolumeX className="text-orange-400" />}
            </button>
          </div>

          {notifications.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto no-scrollbar divide-y divide-[#232945]">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[#1a1f2a] cursor-pointer text-white transition"
                >
                  <span>{n.message}</span>
                  <button
                    onClick={() => removeNotification(n.id)}
                    className="p-1 rounded hover:bg-red-700/40 focus:bg-red-800 transition"
                    aria-label="Dismiss notification"
                  >
                    <X className="text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-gray-400 text-center">No notifications</div>
          )}
        </div>
      )}

      <style>{`
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        @keyframes shake {
          0% { transform: rotate(0deg);}
          25% { transform: rotate(-15deg);}
          50% { transform: rotate(15deg);}
          75% { transform: rotate(-10deg);}
          100% { transform: rotate(0deg);}
        }
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
