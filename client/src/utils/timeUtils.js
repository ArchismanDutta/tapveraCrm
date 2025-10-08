/**
 * Centralized Time Utilities for Timezone-Safe Date/Time Handling
 *
 * PROPER APPROACH:
 * 1. Backend stores actual UTC timestamps
 * 2. Frontend displays times in user's local timezone
 * 3. Uses Intl.DateTimeFormat for timezone-aware formatting
 * 4. Duration calculations use UTC timestamps (timezone-independent)
 */

// Get user's timezone from browser or default to Asia/Kolkata
export const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch (error) {
    return 'Asia/Kolkata';
  }
};

/**
 * Format time from UTC timestamp to 12-hour format in user's timezone (e.g., "09:30 AM")
 * @param {string|Date} dateTime - ISO string or Date object
 * @param {string} timezone - IANA timezone (default: user's browser timezone)
 * @returns {string} Formatted time or "--"
 */
export const formatTime = (dateTime, timezone = null) => {
  if (!dateTime) return "--";

  try {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return "--";

    // Use Intl.DateTimeFormat for proper timezone handling
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || getUserTimezone()
    }).format(date);
  } catch (error) {
    console.error('Error formatting time:', error);
    return "--";
  }
};

/**
 * Format time to 24-hour format in user's timezone (e.g., "09:30")
 * @param {string|Date} dateTime - ISO string or Date object
 * @param {string} timezone - IANA timezone (default: user's browser timezone)
 * @returns {string} Formatted time or "--"
 */
export const formatTime24 = (dateTime, timezone = null) => {
  if (!dateTime) return "--";

  try {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return "--";

    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || getUserTimezone()
    }).format(date);
  } catch (error) {
    console.error('Error formatting time:', error);
    return "--";
  }
};

/**
 * Format date in user's timezone (e.g., "Mon, Jan 15, 2025")
 * @param {string|Date} dateTime - ISO string or Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @param {string} timezone - IANA timezone (default: user's browser timezone)
 * @returns {string} Formatted date or "--"
 */
export const formatDate = (dateTime, options = {}, timezone = null) => {
  if (!dateTime) return "--";

  try {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return "--";

    const defaultOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone || getUserTimezone()
    };

    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return "--";
  }
};

/**
 * Format datetime with both date and time (e.g., "Jan 15, 2025, 09:30 AM")
 * @param {string|Date} dateTime - ISO string or Date object
 * @returns {string} Formatted datetime or "--"
 */
export const formatDateTime = (dateTime) => {
  if (!dateTime) return "--";

  const dateStr = formatDate(dateTime, { weekday: undefined });
  const timeStr = formatTime(dateTime);

  if (dateStr === "--" || timeStr === "--") return "--";
  return `${dateStr}, ${timeStr}`;
};

/**
 * Get date string in YYYY-MM-DD format in user's timezone
 * @param {string|Date} dateTime - ISO string or Date object
 * @param {string} timezone - IANA timezone (default: user's browser timezone)
 * @returns {string|null} Date string or null
 */
export const getDateString = (dateTime, timezone = null) => {
  if (!dateTime) return null;

  try {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return null;

    // Format date in user's timezone
    const formatted = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone || getUserTimezone()
    }).format(date);

    return formatted; // Already in YYYY-MM-DD format
  } catch (error) {
    console.error('Error getting date string:', error);
    return null;
  }
};

/**
 * Parse date string (YYYY-MM-DD) and create Date at midnight UTC
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date|null} Date object or null
 */
export const parseDateString = (dateString) => {
  if (!dateString) return null;

  try {
    // Parse as YYYY-MM-DD and create at midnight UTC
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  } catch (error) {
    console.error('Error parsing date string:', error);
    return null;
  }
};

/**
 * Create datetime in UTC from local date and time components
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @param {string} timeString - Time string (HH:MM or HH:MM:SS)
 * @returns {Date|null} Date object or null
 */
export const createUTCDateTime = (dateString, timeString) => {
  if (!dateString || !timeString) return null;

  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const timeParts = timeString.split(':').map(Number);
    const [hours, minutes, seconds = 0] = timeParts;

    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  } catch (error) {
    console.error('Error creating UTC datetime:', error);
    return null;
  }
};

/**
 * Calculate duration between two datetimes in seconds
 * @param {string|Date} startTime - Start datetime
 * @param {string|Date} endTime - End datetime
 * @returns {number} Duration in seconds
 */
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    return Math.max(0, Math.floor((end - start) / 1000));
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
};

/**
 * Format duration in seconds to human-readable format (e.g., "8h 30m")
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return "0h 0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
};

/**
 * Check if date is today in user's timezone
 * @param {string|Date} dateTime - Date to check
 * @param {string} timezone - IANA timezone (default: user's browser timezone)
 * @returns {boolean}
 */
export const isToday = (dateTime, timezone = null) => {
  if (!dateTime) return false;

  try {
    const date = new Date(dateTime);
    const today = new Date();

    // Compare date strings in user's timezone
    const dateStr = getDateString(date, timezone);
    const todayStr = getDateString(today, timezone);

    return dateStr === todayStr;
  } catch (error) {
    return false;
  }
};

/**
 * Get current datetime as ISO string in UTC
 * @returns {string} ISO datetime string
 */
export const getCurrentUTCTime = () => {
  return new Date().toISOString();
};

/**
 * Get today's date at midnight UTC as ISO string
 * @returns {string} ISO date string
 */
export const getTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  )).toISOString();
};

/**
 * Legacy support: Convert local date input to UTC datetime
 * Used for form inputs where user enters local date/time
 * @param {string} dateString - Local date (YYYY-MM-DD)
 * @param {string} timeString - Local time (HH:MM)
 * @returns {string} ISO datetime string in UTC
 */
export const localToUTC = (dateString, timeString = '00:00') => {
  const dt = createUTCDateTime(dateString, timeString);
  return dt ? dt.toISOString() : null;
};

// Export all functions as default object for easier imports
export default {
  getUserTimezone,
  formatTime,
  formatTime24,
  formatDate,
  formatDateTime,
  getDateString,
  parseDateString,
  createUTCDateTime,
  calculateDuration,
  formatDuration,
  isToday,
  getCurrentUTCTime,
  getTodayUTC,
  localToUTC
};
