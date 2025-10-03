import React, { createContext, useContext, useState, useEffect } from 'react';
import achievementService from '../services/achievementService';

const AchievementContext = createContext();

export const useAchievements = () => {
  const context = useContext(AchievementContext);
  if (!context) {
    throw new Error('useAchievements must be used within an AchievementProvider');
  }
  return context;
};

export const AchievementProvider = ({ children }) => {
  const [userProgress, setUserProgress] = useState(null);
  const [achievementNotifications, setAchievementNotifications] = useState([]);
  const [showAchievementsDashboard, setShowAchievementsDashboard] = useState(false);

  useEffect(() => {
    // Load initial user progress
    loadUserProgress();
  }, []);

  const loadUserProgress = () => {
    const progress = achievementService.getUserProgress();
    setUserProgress(progress);
  };

  const triggerAchievement = (actionType, actionData = {}) => {
    const newlyUnlocked = achievementService.checkAchievements(actionType, actionData);

    if (newlyUnlocked.length > 0) {
      // Add notifications for newly unlocked achievements
      newlyUnlocked.forEach(achievement => {
        addAchievementNotification(achievement);
      });
    }

    // Update user progress
    loadUserProgress();

    return newlyUnlocked;
  };

  const addAchievementNotification = (achievement) => {
    const id = Date.now() + Math.random();
    const notification = {
      id,
      achievement: { ...achievement, isNew: true }
    };

    setAchievementNotifications(prev => [...prev, notification]);

    // Auto remove notification after 6 seconds
    setTimeout(() => {
      removeAchievementNotification(id);
    }, 6000);
  };

  const removeAchievementNotification = (id) => {
    setAchievementNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const openAchievementsDashboard = () => {
    setShowAchievementsDashboard(true);
  };

  const closeAchievementsDashboard = () => {
    setShowAchievementsDashboard(false);
  };

  const getUnlockedAchievements = () => {
    return achievementService.getUnlockedAchievements();
  };

  const getLockedAchievements = () => {
    return achievementService.getLockedAchievements();
  };

  const resetAchievements = () => {
    achievementService.resetAchievements();
    loadUserProgress();
  };

  const value = {
    userProgress,
    achievementNotifications,
    showAchievementsDashboard,
    triggerAchievement,
    addAchievementNotification,
    removeAchievementNotification,
    openAchievementsDashboard,
    closeAchievementsDashboard,
    getUnlockedAchievements,
    getLockedAchievements,
    resetAchievements,
    loadUserProgress
  };

  return (
    <AchievementContext.Provider value={value}>
      {children}
    </AchievementContext.Provider>
  );
};

export default AchievementContext;