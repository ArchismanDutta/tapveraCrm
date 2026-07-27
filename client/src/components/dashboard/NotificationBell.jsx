import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Bell, Volume2, VolumeX } from "lucide-react";
import notiSound from "../../assets/notisound.wav";
import NotificationDropdown from "../notifications/NotificationDropdown";
import { fetchUnreadCount, selectUnreadCount } from "../../store/slices/notificationSlice";

const NotificationBell = () => {
  const dispatch = useDispatch();
  const unreadCount = useSelector(selectUnreadCount);
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioRef = useRef(null);
  const prevUnreadCount = useRef(0);

  // Initial load — the Redux store (fed by WebSocketContext's
  // `notification:new` handler in real time) is the single source of truth
  // for the unread count from here on; no more independent polling.
  useEffect(() => {
    dispatch(fetchUnreadCount());
  }, [dispatch]);

  // Listen for notification read events (dispatched by the dropdown /
  // notification centre) to reconcile the count with the server.
  useEffect(() => {
    const handleNotificationRead = () => {
      setTimeout(() => dispatch(fetchUnreadCount()), 200);
    };

    window.addEventListener("notification-read", handleNotificationRead);
    return () => window.removeEventListener("notification-read", handleNotificationRead);
  }, [dispatch]);

  // Ring + sound on new real-time notifications. The Redux store already
  // updates the count itself (via WebSocketContext -> receiveRealtime), so
  // this only owns the bell animation/sound side effect.
  useEffect(() => {
    const handleWsNotification = (e) => {
      const data = e.detail;
      if (data && data.type === "notification") {
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
