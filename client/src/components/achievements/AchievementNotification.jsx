import React, { useState, useEffect } from 'react';
import { FaTimes, FaTrophy } from 'react-icons/fa';
import AchievementBadge from './AchievementBadge';

const AchievementNotification = ({ achievement, onClose, autoClose = true }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);

    // Auto close after 5 seconds
    if (autoClose) {
      const closeTimer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(closeTimer);
      };
    }

    return () => clearTimeout(timer);
  }, [autoClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose && onClose();
    }, 300);
  };

  return (
    <div className={`
      fixed top-4 right-4 z-50
      transform transition-all duration-500 ease-out
      ${isVisible && !isLeaving
        ? 'translate-x-0 opacity-100 scale-100'
        : 'translate-x-full opacity-0 scale-95'
      }
    `}>
      <div className="bg-gradient-to-r from-[#181d2a] to-[#1e2442] border border-[#ff8000] rounded-lg shadow-2xl p-4 max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FaTrophy className="text-[#ff8000] text-lg" />
            <span className="text-[#ff8000] font-bold text-sm">Achievement Unlocked!</span>
          </div>
          <button
            onClick={handleClose}
            className="text-blue-400 hover:text-blue-300 transition"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Achievement Content */}
        <div className="flex items-center gap-3">
          <AchievementBadge
            achievement={achievement}
            unlocked={true}
            size="medium"
            showProgress={false}
          />
          <div className="flex-1">
            <h4 className="text-blue-100 font-semibold text-sm mb-1">
              {achievement.name}
            </h4>
            <p className="text-blue-400 text-xs mb-2">
              {achievement.description}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[#ff8000] text-xs font-bold">
                +{achievement.points} points
              </span>
              <span className="text-blue-500 text-xs bg-blue-500/20 px-2 py-1 rounded-full">
                {achievement.tier}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar Animation */}
        <div className="mt-3 bg-gray-700 rounded-full h-1 overflow-hidden">
          <div className="bg-gradient-to-r from-[#ff8000] to-[#ffb366] h-full rounded-full transform transition-all duration-1000 delay-500 -translate-x-full animate-[slideIn_1s_0.5s_forwards]"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AchievementNotification;