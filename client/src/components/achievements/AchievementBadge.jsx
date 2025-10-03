import React from 'react';

const AchievementBadge = ({
  achievement,
  unlocked = false,
  progress = null,
  size = 'medium',
  showProgress = true,
  onClick = null
}) => {
  const Icon = achievement.icon;

  const sizeClasses = {
    small: {
      container: 'w-12 h-12',
      icon: 'text-lg',
      border: 'border-2'
    },
    medium: {
      container: 'w-16 h-16',
      icon: 'text-xl',
      border: 'border-2'
    },
    large: {
      container: 'w-20 h-20',
      icon: 'text-2xl',
      border: 'border-3'
    }
  };

  const tierGlow = {
    bronze: 'shadow-orange-500/20',
    silver: 'shadow-gray-300/20',
    gold: 'shadow-yellow-500/30',
    platinum: 'shadow-purple-500/30',
    diamond: 'shadow-cyan-500/40'
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={`relative ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Badge Container */}
      <div className={`
        ${classes.container}
        ${classes.border}
        rounded-full
        flex items-center justify-center
        transition-all duration-300
        ${unlocked
          ? `${achievement.bgColor} ${achievement.borderColor} ${achievement.color} shadow-lg ${tierGlow[achievement.tier]}`
          : 'bg-gray-800 border-gray-600 text-gray-500'
        }
        ${onClick ? 'hover:scale-110 hover:shadow-xl' : ''}
      `}>
        <Icon className={`${classes.icon} ${unlocked ? '' : 'opacity-50'}`} />

        {/* Locked Overlay */}
        {!unlocked && (
          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          </div>
        )}
      </div>

      {/* Progress Ring for Locked Achievements */}
      {!unlocked && progress && showProgress && progress.percentage > 0 && (
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            className="text-gray-700"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={`${progress.percentage * 2.83} ${283 - (progress.percentage * 2.83)}`}
            className="text-[#ff8000] transition-all duration-500"
          />
        </svg>
      )}

      {/* Points Badge */}
      {unlocked && size !== 'small' && (
        <div className="absolute -bottom-1 -right-1 bg-[#ff8000] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#141a29]">
          {achievement.points}
        </div>
      )}

      {/* New Badge Indicator */}
      {unlocked && achievement.isNew && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

export default AchievementBadge;