import React from 'react';
import { useAchievements } from '../../contexts/AchievementContext';
import AchievementNotification from './AchievementNotification';

const AchievementNotificationContainer = () => {
  const { achievementNotifications, removeAchievementNotification } = useAchievements();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {achievementNotifications.map((notification) => (
        <AchievementNotification
          key={notification.id}
          achievement={notification.achievement}
          onClose={() => removeAchievementNotification(notification.id)}
          autoClose={true}
        />
      ))}
    </div>
  );
};

export default AchievementNotificationContainer;