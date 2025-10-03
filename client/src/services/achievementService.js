// Achievement System Service
// Handles all achievement tracking, badge awarding, and progress monitoring

import { FaTrophy, FaFire, FaStar, FaCrown, FaRocket, FaBullseye, FaBolt, FaGem, FaMedal, FaShieldAlt, FaLightbulb, FaHeart } from "react-icons/fa";

class AchievementService {
  constructor() {
    this.achievements = this.initializeAchievements();
    this.userAchievements = this.loadUserAchievements();
  }

  // Define all available achievements
  initializeAchievements() {
    return {
      // Completion-based achievements
      FIRST_TASK: {
        id: 'FIRST_TASK',
        name: 'Getting Started',
        description: 'Complete your first task',
        icon: FaBullseye,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500',
        tier: 'bronze',
        points: 10,
        requirement: { type: 'tasks_completed', value: 1 }
      },
      TASK_WARRIOR: {
        id: 'TASK_WARRIOR',
        name: 'Task Warrior',
        description: 'Complete 10 tasks',
        icon: FaMedal,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500',
        tier: 'silver',
        points: 50,
        requirement: { type: 'tasks_completed', value: 10 }
      },
      TASK_MASTER: {
        id: 'TASK_MASTER',
        name: 'Task Master',
        description: 'Complete 50 tasks',
        icon: FaCrown,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500',
        tier: 'gold',
        points: 200,
        requirement: { type: 'tasks_completed', value: 50 }
      },
      CENTURION: {
        id: 'CENTURION',
        name: 'Centurion',
        description: 'Complete 100 tasks',
        icon: FaTrophy,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500',
        tier: 'platinum',
        points: 500,
        requirement: { type: 'tasks_completed', value: 100 }
      },

      // Streak-based achievements
      ON_FIRE: {
        id: 'ON_FIRE',
        name: 'On Fire',
        description: 'Complete tasks 3 days in a row',
        icon: FaFire,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500',
        tier: 'bronze',
        points: 30,
        requirement: { type: 'daily_streak', value: 3 }
      },
      UNSTOPPABLE: {
        id: 'UNSTOPPABLE',
        name: 'Unstoppable',
        description: 'Complete tasks 7 days in a row',
        icon: FaRocket,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        borderColor: 'border-orange-500',
        tier: 'gold',
        points: 100,
        requirement: { type: 'daily_streak', value: 7 }
      },
      LEGENDARY: {
        id: 'LEGENDARY',
        name: 'Legendary',
        description: 'Complete tasks 30 days in a row',
        icon: FaGem,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20',
        borderColor: 'border-cyan-500',
        tier: 'diamond',
        points: 300,
        requirement: { type: 'daily_streak', value: 30 }
      },

      // Priority-based achievements
      HIGH_PRIORITY_HERO: {
        id: 'HIGH_PRIORITY_HERO',
        name: 'Priority Hero',
        description: 'Complete 5 high-priority tasks',
        icon: FaStar,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500',
        tier: 'silver',
        points: 75,
        requirement: { type: 'high_priority_completed', value: 5 }
      },

      // Speed-based achievements
      SPEED_DEMON: {
        id: 'SPEED_DEMON',
        name: 'Speed Demon',
        description: 'Complete 5 tasks in one day',
        icon: FaBolt,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500',
        tier: 'silver',
        points: 60,
        requirement: { type: 'daily_tasks', value: 5 }
      },

      // Perfect performance achievements
      PERFECTIONIST: {
        id: 'PERFECTIONIST',
        name: 'Perfectionist',
        description: 'Complete 10 tasks without any overdue',
        icon: FaShieldAlt,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500',
        tier: 'gold',
        points: 150,
        requirement: { type: 'perfect_completion', value: 10 }
      },

      // Collaboration achievements
      TEAM_PLAYER: {
        id: 'TEAM_PLAYER',
        name: 'Team Player',
        description: 'Add comments to 10 different tasks',
        icon: FaHeart,
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/20',
        borderColor: 'border-pink-500',
        tier: 'bronze',
        points: 40,
        requirement: { type: 'comments_added', value: 10 }
      },

      // Innovation achievements
      INNOVATOR: {
        id: 'INNOVATOR',
        name: 'Innovator',
        description: 'Create your first custom task filter',
        icon: FaLightbulb,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500',
        tier: 'bronze',
        points: 25,
        requirement: { type: 'custom_filter_created', value: 1 }
      }
    };
  }

  // Load user achievements from localStorage
  loadUserAchievements() {
    try {
      const saved = localStorage.getItem('userAchievements');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading user achievements:', error);
    }

    return {
      unlockedAchievements: [],
      stats: {
        tasksCompleted: 0,
        highPriorityCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastTaskDate: null,
        dailyTaskCounts: {},
        commentsAdded: 0,
        customFiltersCreated: 0,
        perfectStreak: 0
      },
      totalPoints: 0,
      level: 1,
      nextLevelPoints: 100
    };
  }

  // Save user achievements to localStorage
  saveUserAchievements() {
    try {
      localStorage.setItem('userAchievements', JSON.stringify(this.userAchievements));
    } catch (error) {
      console.error('Error saving user achievements:', error);
    }
  }

  // Check if user has earned any new achievements
  checkAchievements(actionType, actionData = {}) {
    const newlyUnlocked = [];
    const stats = this.userAchievements.stats;

    // Update stats based on action
    switch (actionType) {
      case 'TASK_COMPLETED':
        stats.tasksCompleted++;
        if (actionData.priority === 'High') {
          stats.highPriorityCompleted++;
        }
        this.updateStreak();
        this.updateDailyTaskCount();
        this.updatePerfectStreak(actionData.wasOverdue === false);
        break;

      case 'COMMENT_ADDED':
        stats.commentsAdded++;
        break;

      case 'CUSTOM_FILTER_CREATED':
        stats.customFiltersCreated++;
        break;
    }

    // Check each achievement
    Object.values(this.achievements).forEach(achievement => {
      if (this.userAchievements.unlockedAchievements.includes(achievement.id)) {
        return; // Already unlocked
      }

      if (this.checkAchievementRequirement(achievement.requirement, stats)) {
        newlyUnlocked.push(achievement);
        this.userAchievements.unlockedAchievements.push(achievement.id);
        this.userAchievements.totalPoints += achievement.points;
      }
    });

    // Update level based on points
    this.updateLevel();

    // Save progress
    this.saveUserAchievements();

    return newlyUnlocked;
  }

  // Check if achievement requirement is met
  checkAchievementRequirement(requirement, stats) {
    switch (requirement.type) {
      case 'tasks_completed':
        return stats.tasksCompleted >= requirement.value;
      case 'high_priority_completed':
        return stats.highPriorityCompleted >= requirement.value;
      case 'daily_streak':
        return stats.currentStreak >= requirement.value;
      case 'daily_tasks': {
        const today = new Date().toDateString();
        return (stats.dailyTaskCounts[today] || 0) >= requirement.value;
      }
      case 'perfect_completion':
        return stats.perfectStreak >= requirement.value;
      case 'comments_added':
        return stats.commentsAdded >= requirement.value;
      case 'custom_filter_created':
        return stats.customFiltersCreated >= requirement.value;
      default:
        return false;
    }
  }

  // Update daily streak
  updateStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (this.userAchievements.stats.lastTaskDate === yesterdayStr) {
      // Continuing streak
      this.userAchievements.stats.currentStreak++;
    } else if (this.userAchievements.stats.lastTaskDate !== today) {
      // Starting new streak
      this.userAchievements.stats.currentStreak = 1;
    }

    this.userAchievements.stats.lastTaskDate = today;
    this.userAchievements.stats.longestStreak = Math.max(
      this.userAchievements.stats.longestStreak,
      this.userAchievements.stats.currentStreak
    );
  }

  // Update daily task count
  updateDailyTaskCount() {
    const today = new Date().toDateString();
    if (!this.userAchievements.stats.dailyTaskCounts[today]) {
      this.userAchievements.stats.dailyTaskCounts[today] = 0;
    }
    this.userAchievements.stats.dailyTaskCounts[today]++;
  }

  // Update perfect completion streak
  updatePerfectStreak(wasOnTime) {
    if (wasOnTime) {
      this.userAchievements.stats.perfectStreak++;
    } else {
      this.userAchievements.stats.perfectStreak = 0;
    }
  }

  // Update user level based on points
  updateLevel() {
    const points = this.userAchievements.totalPoints;

    // Level calculation: exponential growth
    const newLevel = Math.floor(Math.sqrt(points / 50)) + 1;
    const nextLevelPoints = Math.pow(newLevel, 2) * 50;

    this.userAchievements.level = newLevel;
    this.userAchievements.nextLevelPoints = nextLevelPoints;
  }

  // Get user's progress
  getUserProgress() {
    return {
      ...this.userAchievements,
      achievements: this.achievements,
      progressToNextLevel: this.calculateLevelProgress()
    };
  }

  // Calculate progress to next level
  calculateLevelProgress() {
    const currentLevelPoints = Math.pow(this.userAchievements.level - 1, 2) * 50;
    const nextLevelPoints = this.userAchievements.nextLevelPoints;
    const currentPoints = this.userAchievements.totalPoints;

    const progressPoints = currentPoints - currentLevelPoints;
    const totalNeeded = nextLevelPoints - currentLevelPoints;

    return Math.min(100, Math.max(0, (progressPoints / totalNeeded) * 100));
  }

  // Get achievement by ID
  getAchievement(id) {
    return this.achievements[id];
  }

  // Get all unlocked achievements
  getUnlockedAchievements() {
    return this.userAchievements.unlockedAchievements.map(id => this.achievements[id]);
  }

  // Get locked achievements with progress
  getLockedAchievements() {
    return Object.values(this.achievements)
      .filter(achievement => !this.userAchievements.unlockedAchievements.includes(achievement.id))
      .map(achievement => ({
        ...achievement,
        progress: this.getAchievementProgress(achievement)
      }));
  }

  // Get progress towards a specific achievement
  getAchievementProgress(achievement) {
    const requirement = achievement.requirement;
    const stats = this.userAchievements.stats;
    let current = 0;

    switch (requirement.type) {
      case 'tasks_completed':
        current = stats.tasksCompleted;
        break;
      case 'high_priority_completed':
        current = stats.highPriorityCompleted;
        break;
      case 'daily_streak':
        current = stats.currentStreak;
        break;
      case 'perfect_completion':
        current = stats.perfectStreak;
        break;
      case 'comments_added':
        current = stats.commentsAdded;
        break;
      case 'custom_filter_created':
        current = stats.customFiltersCreated;
        break;
      default:
        current = 0;
    }

    return {
      current: Math.min(current, requirement.value),
      required: requirement.value,
      percentage: Math.min(100, (current / requirement.value) * 100)
    };
  }

  // Reset achievements (for testing)
  resetAchievements() {
    this.userAchievements = {
      unlockedAchievements: [],
      stats: {
        tasksCompleted: 0,
        highPriorityCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastTaskDate: null,
        dailyTaskCounts: {},
        commentsAdded: 0,
        customFiltersCreated: 0,
        perfectStreak: 0
      },
      totalPoints: 0,
      level: 1,
      nextLevelPoints: 100
    };
    this.saveUserAchievements();
  }
}

// Create singleton instance
const achievementService = new AchievementService();

export default achievementService;