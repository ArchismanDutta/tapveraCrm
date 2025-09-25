import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const useCelebrationNotifications = () => {
  const [celebrations, setCelebrations] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has already seen today's celebrations
  const hasSeenToday = () => {
    const today = new Date().toISOString().split('T')[0];
    const lastSeen = localStorage.getItem('celebrationsSeenDate');

    // Get user ID from token or user data
    const token = localStorage.getItem('token');
    let userId = localStorage.getItem('userId');

    // If no userId stored, try to get it from token payload
    if (!userId && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.id || payload.userId || payload._id;
        if (userId) localStorage.setItem('userId', userId);
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }

    const lastSeenUserId = localStorage.getItem('celebrationsSeenUserId');

    return lastSeen === today && lastSeenUserId === userId;
  };

  // Mark celebrations as seen for today
  const markAsSeen = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Get user ID from token or storage
    const token = localStorage.getItem('token');
    let userId = localStorage.getItem('userId');

    if (!userId && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.id || payload.userId || payload._id;
        if (userId) localStorage.setItem('userId', userId);
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }

    localStorage.setItem('celebrationsSeenDate', today);
    localStorage.setItem('celebrationsSeenUserId', userId);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE}/api/celebrations/mark-seen`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error('Error marking celebrations as seen:', err);
      // Don't throw error - marking as seen locally is sufficient
    }
  };

  // Fetch today's celebrations
  const fetchCelebrations = async () => {
    // Don't fetch if user has already seen today's celebrations
    if (hasSeenToday()) {
      console.log('User has already seen celebrations today');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, skipping celebration fetch');
        return;
      }

      console.log('Fetching today\'s celebrations...');
      const response = await axios.get(
        `${API_BASE}/api/celebrations/today`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;
      console.log('Celebrations response:', data);

      if (data.hasCelebrations && data.celebrations.length > 0) {
        setCelebrations(data.celebrations);
        setShowPopup(true);
        console.log(`Found ${data.celebrations.length} celebrations today`);
      } else {
        console.log('No celebrations today');
      }
    } catch (err) {
      console.error('Error fetching celebrations:', err);
      setError(err.response?.data?.message || 'Failed to fetch celebrations');
    } finally {
      setLoading(false);
    }
  };

  // Close popup and mark as seen
  const closePopup = async () => {
    setShowPopup(false);
    await markAsSeen();
  };

  // Auto-fetch celebrations when hook is initialized
  useEffect(() => {
    // Small delay to ensure user is logged in and token is available
    const timer = setTimeout(() => {
      fetchCelebrations();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return {
    celebrations,
    showPopup,
    loading,
    error,
    closePopup,
    refetchCelebrations: fetchCelebrations
  };
};

export default useCelebrationNotifications;