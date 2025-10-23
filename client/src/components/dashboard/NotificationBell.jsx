import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import notiSound from "../../assets/notisound.wav";
import NotificationDropdown from "../notifications/NotificationDropdown";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef(null);
  const prevUnreadCount = useRef(0);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Listen for notification read events
  useEffect(() => {
    const handleNotificationRead = (e) => {
      // Immediately decrement the local count for instant feedback
      if (e.detail?.notificationId) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else if (e.detail?.markAllRead) {
        setUnreadCount(0);
      }

      // Then fetch the actual count from server to ensure accuracy
      setTimeout(() => {
        fetchUnreadCount();
      }, 200);
    };

    window.addEventListener("notification-read", handleNotificationRead);
    return () => window.removeEventListener("notification-read", handleNotificationRead);
  }, []);

  // Listen for new WebSocket notifications
  useEffect(() => {
    const handleWsNotification = (e) => {
      const data = e.detail;
      if (data && data.type === "notification") {
        // Increment unread count
        setUnreadCount((prev) => prev + 1);

        // Ring the bell
        setIsRinging(true);
        if (soundEnabled && audioUnlocked && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((err) => console.warn("Audio blocked:", err));
        }
        setTimeout(() => setIsRinging(false), 1000);
      }
    };

    window.addEventListener("ws-notification", handleWsNotification);
    return () => window.removeEventListener("ws-notification", handleWsNotification);
  }, [soundEnabled, audioUnlocked]);

  // Unlock audio on first user interaction
  const attemptAudioUnlock = useCallback(() => {
    if (audioUnlocked) return;
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setAudioUnlocked(true);
        })
        .catch(() => {
          console.log("Audio unlock blocked, waiting for user interaction...");
        });
    }
  }, [audioUnlocked]);

  useEffect(() => {
    document.addEventListener("click", attemptAudioUnlock, { once: true });
    document.addEventListener("keydown", attemptAudioUnlock, { once: true });
    return () => {
      document.removeEventListener("click", attemptAudioUnlock);
      document.removeEventListener("keydown", attemptAudioUnlock);
    };
  }, [attemptAudioUnlock]);

  const toggleSound = (e) => {
    e.stopPropagation();
    setSoundEnabled((prev) => !prev);
  };

  return (
    <div className="relative notification-bell-container">
      <audio ref={audioRef} src={notiSound} preload="auto" />

      <div className="flex items-center gap-2">
        {/* Sound Toggle */}
        <button
          onClick={toggleSound}
          className="p-2 rounded-full hover:bg-slate-700/50 transition"
          title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
        >
          {soundEnabled ? (
            <Volume2 className="w-5 h-5 text-gray-400" />
          ) : (
            <VolumeX className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-full bg-gradient-to-r from-[#232945] via-[#17171c] to-[#181b2b] hover:from-orange-400 hover:to-orange-500 shadow-lg transition"
          onClick={() => setOpen((prev) => !prev)}
        >
          <Bell className={`w-6 h-6 text-orange-400 ${isRinging ? "animate-shake" : ""}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown */}
      <NotificationDropdown
        isOpen={open}
        onClose={() => setOpen(false)}
      />

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
      `}</style>
    </div>
  );
};

export default NotificationBell;
