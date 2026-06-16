// client/src/utils/safeDateParser.js
/**
 * Safari-compatible date parsing utility
 * Handles iOS Safari's strict date parsing requirements
 */

/**
 * Parse date string to Date object (Safari-safe)
 * @param {string} dateString - Date string in various formats
 * @returns {Date|null} - Parsed date or null if invalid
 */
export function parseDate(dateString) {
  if (!dateString) return null;

  try {
    // If already ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ), use directly
    if (typeof dateString === 'string' && dateString.includes('T') && dateString.includes('Z')) {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    }

    // If YYYY-MM-DD format, convert to ISO 8601 and validate
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);

      // Validate month
      if (month < 1 || month > 12) return null;

      // Create date and validate the day
      const date = new Date(dateString + 'T00:00:00.000Z');
      if (isNaN(date.getTime())) return null;

      // Verify the date wasn't adjusted (e.g., Feb 30 -> Mar 2)
      if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) {
        return null;
      }

      return date;
    }

    // If YYYY-MM format, convert to first day of month
    if (/^\d{4}-\d{2}$/.test(dateString)) {
      const [year, month] = dateString.split('-').map(Number);

      // Validate month
      if (month < 1 || month > 12) return null;

      const date = new Date(dateString + '-01T00:00:00.000Z');
      return isNaN(date.getTime()) ? null : date;
    }

    // For other formats, try parsing with Date.parse
    const timestamp = Date.parse(dateString);
    if (isNaN(timestamp)) return null;

    return new Date(timestamp);
  } catch (error) {
    console.error('Date parsing error:', error, dateString);
    return null;
  }
}

/**
 * Get today's date in YYYY-MM-DD format (Safari-safe)
 * @returns {string} - Today's date
 */
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date to YYYY-MM-DD (Safari-safe)
 * @param {Date|string} date - Date to format
 * @returns {string|null} - Formatted date or null
 */
export function formatDateString(date) {
  if (!date) return null;

  try {
    const dateObj = date instanceof Date ? date : parseDate(date);
    if (!dateObj) return null;

    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return null;
  }
}

/**
 * Check if date string is valid (Safari-safe)
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if valid
 */
export function isValidDate(dateString) {
  const date = parseDate(dateString);
  return date !== null;
}

/**
 * Parse date for display (Safari-safe)
 * @param {string} dateString - Date string
 * @param {string} locale - Locale string (default: 'en-US')
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export function formatDateForDisplay(dateString, locale = 'en-US', options = {}) {
  const date = parseDate(dateString);
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch (error) {
    console.error('Date display formatting error:', error);
    return dateString;
  }
}
