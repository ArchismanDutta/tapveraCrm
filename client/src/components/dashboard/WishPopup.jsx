import React, { useState, useEffect } from "react";
import ConfettiExplosion from "react-confetti-explosion";

const emojis = ["🎉", "🥳", "🎂", "✨", "💖"];

const WishPopup = ({ isOpen, wishes = [], onClose }) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  useEffect(() => {
    if (isOpen && wishes.length > 0) {
      setShowConfetti(true);
      setFloatingEmojis(
        Array.from({ length: 20 }).map(() => ({
          id: Math.random(),
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
          left: Math.random() * 90 + "%",
          animationDuration: 4000 + Math.random() * 2000,
          animationDelay: Math.random() * 1500,
          rotate: Math.random() * 360,
        }))
      );
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, wishes]);

  if (!isOpen || wishes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/20 overflow-hidden" style={{background: 'rgba(255, 255, 255, 0.25)'}}>
      {/* Confetti explosion */}
      {showConfetti && (
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-40">
          <ConfettiExplosion
            force={1}
            duration={3000}
            particleCount={160}
            colors={["#FDE68A", "#FFD6E8", "#B5EAEA", "#A0CED9", "#FFC6FF"]}
            width={window.innerWidth}
            height={window.innerHeight}
          />
        </div>
      )}

      {/* Floating emojis */}
      {floatingEmojis.map((f) => (
        <span
          key={f.id}
          className="absolute text-4xl pointer-events-none select-none"
          style={{
            left: f.left,
            animationDuration: `${f.animationDuration}ms`,
            animationDelay: `${f.animationDelay}ms`,
            bottom: 0,
            transform: `rotate(${f.rotate}deg)`,
            animationName: "floatUp",
            animationTimingFunction: "cubic-bezier(0.42, 0, 0.58, 1)",
            animationFillMode: "forwards",
            position: "absolute",
            userSelect: "none",
          }}
        >
          {f.emoji}
        </span>
      ))}

      {/* Popup */}
      <div
        className="relative w-full max-w-lg p-8 rounded-3xl bg-gradient-to-tr from-white/80 via-white/60 to-white/40 shadow-xl text-gray-900"
        style={{ animation: "scaleFadeIn 0.45s ease forwards" }}
      >
        <h2 className="text-3xl font-extrabold mb-8 text-center drop-shadow-sm" style={{ color: "#70163cff" }}>
          🎉 You Have New Wishes! 🎉
        </h2>

        <div className="max-h-96 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-pink-300 scrollbar-track-pink-50 rounded-lg p-2 bg-white/40 backdrop-blur-sm">
          {wishes.map((wish, idx) => (
            <div
              key={wish._id}
              className="flex items-center gap-5 p-4 rounded-xl bg-white/60 border border-pink-200 shadow-md hover:scale-105 hover:bg-pink-100 transition-transform duration-300 cursor-default"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <img
                src={wish.senderId?.avatar || "https://i.pravatar.cc/40?img=5"}
                alt={wish.senderId?.name || "HR"}
                className="w-14 h-14 rounded-full border-4 border-pink-300 shadow-lg"
              />
              <div>
                <p className="font-bold text-lg" style={{ color: "#D6336C", textShadow: "0 0 4px #FFBDD6" }}>
                  {wish.senderId?.name || "HR"}
                </p>
                <p className="text-pink-700/90 font-medium">{wish.message}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-10">
          <button
            onClick={onClose}
            className="px-10 py-3 bg-pink-700 hover:bg-pink-500 rounded-full font-bold shadow-lg text-white transition-transform duration-300 hover:scale-105 focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleFadeIn {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes floatUp {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-280px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default WishPopup;
