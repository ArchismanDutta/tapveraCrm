import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell, X, Volume2, VolumeX, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import notiSound from "../../assets/notisound.wav";

const NotificationBell = ({ notifications = [], onDismiss, onClearAll }) => {
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioRef = useRef(null);
  const prevNotificationIds = useRef(new Set()); 
  const navigate = useNavigate();

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

  // Play sound & animate bell on new notifications
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));
    const hasNew = [...currentIds].some((id) => !prevNotificationIds.current.has(id));

    if (hasNew && notifications.length > 0) {
      setIsRinging(true);
      if (soundEnabled && audioUnlocked && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => console.warn("Audio blocked:", err));
      }
      setTimeout(() => setIsRinging(false), 1000);
    }

    prevNotificationIds.current = currentIds;
  }, [notifications, soundEnabled, audioUnlocked]);

  const toggleSound = () => setSoundEnabled((prev) => !prev);

  const handleClickOutside = (e) => {
    if (!e.target.closest(".notification-bell-container")) {
      setOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative notification-bell-container">
      <audio ref={audioRef} src={notiSound} preload="auto" />

      <button
        className="relative p-2 rounded-full bg-gradient-to-r from-[#232945] via-[#17171c] to-[#181b2b] hover:from-orange-400 hover:to-orange-500 shadow-lg transition"
        onClick={() => setOpen((prev) => !prev)}
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
            <div className="flex items-center gap-2">
              <button onClick={toggleSound} className="p-1 rounded hover:bg-[#232945]/50" title={soundEnabled ? "Mute" : "Unmute"}>
                {soundEnabled ? <Volume2 className="text-orange-400" /> : <VolumeX className="text-orange-400" />}
              </button>
              {notifications.length > 0 && (
                <button onClick={onClearAll} className="p-1 rounded hover:bg-[#232945]/50" title="Clear All">
                  <Trash2 className="text-red-500" />
                </button>
              )}
            </div>
          </div>

          {notifications.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto no-scrollbar divide-y divide-[#232945]">
              {notifications.map((n) => (
                <li
                  key={n.id || n.message}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[#1a1f2a] cursor-pointer text-white transition"
                >
                  <span
                    className="flex-1"
                    onClick={() => {
                      navigate("/tasks");
                      setOpen(false);
                    }}
                  >
                    {n.message || n}
                  </span>
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(n.id)}
                      className="p-1 rounded hover:bg-red-700/40 focus:bg-red-800 transition"
                      aria-label="Dismiss notification"
                    >
                      <X className="text-red-500" />
                    </button>
                  )}
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default NotificationBell;
