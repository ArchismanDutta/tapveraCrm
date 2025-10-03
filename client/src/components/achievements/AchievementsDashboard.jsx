import React, { useState, useEffect } from 'react';
import { FaTrophy, FaStar, FaFire, FaGem, FaTimes, FaLevelUpAlt } from 'react-icons/fa';
import AchievementBadge from './AchievementBadge';
import achievementService from '../../services/achievementService';

const AchievementsDashboard = ({ onClose }) => {
  const [userProgress, setUserProgress] = useState(null);
  const [selectedTab, setSelectedTab] = useState('unlocked');
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  useEffect(() => {
    loadUserProgress();
  }, []);

  const loadUserProgress = () => {
    const progress = achievementService.getUserProgress();
    setUserProgress(progress);
  };

  if (!userProgress) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8000]"></div>
      </div>
    );
  }

  const unlockedAchievements = achievementService.getUnlockedAchievements();
  const lockedAchievements = achievementService.getLockedAchievements();

  const tabs = [
    { id: 'unlocked', label: 'Earned', count: unlockedAchievements.length },
    { id: 'locked', label: 'Available', count: lockedAchievements.length },
    { id: 'stats', label: 'Stats', count: null }
  ];

  const handleAchievementClick = (achievement) => {
    setSelectedAchievement(achievement);
  };

  const renderAchievementDetail = () => {
    if (!selectedAchievement) return null;

    const isUnlocked = userProgress.unlockedAchievements.includes(selectedAchievement.id);
    const progress = !isUnlocked ? achievementService.getAchievementProgress(selectedAchievement) : null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
        <div className="bg-[#181d2a] border border-blue-950 rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-blue-100 font-bold text-lg">Achievement Details</h3>
            <button
              onClick={() => setSelectedAchievement(null)}
              className="text-blue-400 hover:text-blue-300 transition"
            >
              <FaTimes />
            </button>
          </div>

          <div className="text-center mb-4">
            <AchievementBadge
              achievement={selectedAchievement}
              unlocked={isUnlocked}
              progress={progress}
              size="large"
            />
          </div>

          <div className="text-center mb-4">
            <h4 className="text-blue-100 font-semibold text-xl mb-2">
              {selectedAchievement.name}
            </h4>
            <p className="text-blue-400 text-sm mb-3">
              {selectedAchievement.description}
            </p>
            <div className="flex items-center justify-center gap-4">
              <span className="text-[#ff8000] font-bold">
                {selectedAchievement.points} points
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                selectedAchievement.tier === 'bronze' ? 'bg-orange-500/20 text-orange-300' :
                selectedAchievement.tier === 'silver' ? 'bg-gray-400/20 text-gray-300' :
                selectedAchievement.tier === 'gold' ? 'bg-yellow-500/20 text-yellow-300' :
                selectedAchievement.tier === 'platinum' ? 'bg-purple-500/20 text-purple-300' :
                'bg-cyan-500/20 text-cyan-300'
              }`}>
                {selectedAchievement.tier}
              </span>
            </div>
          </div>

          {!isUnlocked && progress && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-blue-400">Progress</span>
                <span className="text-blue-300">{progress.current} / {progress.required}</span>
              </div>
              <div className="bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#ff8000] to-[#ffb366] h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
            </div>
          )}

          {isUnlocked && (
            <div className="text-center">
              <div className="text-green-400 text-sm font-medium">
                ✅ Achievement Unlocked!
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUnlockedTab = () => (
    <div className="space-y-4">
      {unlockedAchievements.length > 0 ? (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {unlockedAchievements.map((achievement) => (
            <div key={achievement.id} className="flex flex-col items-center">
              <AchievementBadge
                achievement={achievement}
                unlocked={true}
                onClick={() => handleAchievementClick(achievement)}
              />
              <span className="text-blue-400 text-xs mt-1 text-center">
                {achievement.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FaTrophy className="text-4xl text-gray-600 mx-auto mb-4" />
          <p className="text-blue-400">No achievements unlocked yet.</p>
          <p className="text-blue-500 text-sm mt-2">Start completing tasks to earn your first badge!</p>
        </div>
      )}
    </div>
  );

  const renderLockedTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {lockedAchievements.map((achievement) => (
          <div key={achievement.id} className="flex flex-col items-center">
            <AchievementBadge
              achievement={achievement}
              unlocked={false}
              progress={achievement.progress}
              onClick={() => handleAchievementClick(achievement)}
            />
            <span className="text-gray-500 text-xs mt-1 text-center">
              {achievement.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-6">
      {/* Level Progress */}
      <div className="bg-[#141a29] rounded-lg p-4 border border-blue-950">
        <div className="flex items-center gap-3 mb-3">
          <FaLevelUpAlt className="text-[#ff8000] text-xl" />
          <div>
            <h4 className="text-blue-100 font-semibold">Level {userProgress.level}</h4>
            <p className="text-blue-400 text-sm">
              {userProgress.totalPoints} / {userProgress.nextLevelPoints} points
            </p>
          </div>
        </div>
        <div className="bg-gray-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-[#ff8000] to-[#ffb366] h-3 rounded-full transition-all duration-500"
            style={{ width: `${userProgress.progressToNextLevel}%` }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#141a29] rounded-lg p-4 border border-blue-950 text-center">
          <div className="text-2xl font-bold text-blue-100 mb-1">
            {userProgress.stats.tasksCompleted}
          </div>
          <div className="text-blue-400 text-sm">Tasks Completed</div>
        </div>

        <div className="bg-[#141a29] rounded-lg p-4 border border-blue-950 text-center">
          <div className="text-2xl font-bold text-red-400 mb-1">
            {userProgress.stats.highPriorityCompleted}
          </div>
          <div className="text-blue-400 text-sm">High Priority</div>
        </div>

        <div className="bg-[#141a29] rounded-lg p-4 border border-blue-950 text-center">
          <div className="text-2xl font-bold text-orange-400 mb-1">
            {userProgress.stats.currentStreak}
          </div>
          <div className="text-blue-400 text-sm">Current Streak</div>
        </div>

        <div className="bg-[#141a29] rounded-lg p-4 border border-blue-950 text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">
            {userProgress.stats.longestStreak}
          </div>
          <div className="text-blue-400 text-sm">Best Streak</div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#141a29] rounded-lg p-4 border border-blue-950">
          <h5 className="text-blue-100 font-semibold mb-3">Recent Activity</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-400">Comments Added:</span>
              <span className="text-blue-300">{userProgress.stats.commentsAdded}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">Perfect Streak:</span>
              <span className="text-blue-300">{userProgress.stats.perfectStreak}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">Custom Filters:</span>
              <span className="text-blue-300">{userProgress.stats.customFiltersCreated}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#141a29] rounded-lg p-4 border border-blue-950">
          <h5 className="text-blue-100 font-semibold mb-3">Achievement Progress</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-400">Unlocked:</span>
              <span className="text-green-400 font-medium">{unlockedAchievements.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">Remaining:</span>
              <span className="text-yellow-400">{lockedAchievements.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">Completion:</span>
              <span className="text-[#ff8000] font-medium">
                {Math.round((unlockedAchievements.length / (unlockedAchievements.length + lockedAchievements.length)) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#181d2a] border border-blue-950 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-blue-950">
            <div className="flex items-center gap-3">
              <FaTrophy className="text-[#ff8000] text-2xl" />
              <div>
                <h2 className="text-blue-100 font-bold text-xl">Achievements</h2>
                <p className="text-blue-400 text-sm">
                  Level {userProgress.level} • {userProgress.totalPoints} points
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-blue-400 hover:text-blue-300 transition"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-blue-950">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                  selectedTab === tab.id
                    ? 'text-[#ff8000] border-b-2 border-[#ff8000] bg-[#ff8000]/5'
                    : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="ml-2 bg-blue-950 text-blue-300 px-2 py-1 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {selectedTab === 'unlocked' && renderUnlockedTab()}
            {selectedTab === 'locked' && renderLockedTab()}
            {selectedTab === 'stats' && renderStatsTab()}
          </div>
        </div>
      </div>

      {renderAchievementDetail()}
    </>
  );
};

export default AchievementsDashboard;