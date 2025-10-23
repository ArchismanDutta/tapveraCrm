// Centralized error handling for notification system

class NotificationErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 50; // Keep last 50 errors
  }

  /**
   * Log an error with context
   * @param {Error|string} error - The error object or message
   * @param {string} context - Context where error occurred
   * @param {object} metadata - Additional metadata
   */
  logError(error, context, metadata = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      context,
      message: error?.message || error,
      stack: error?.stack,
      metadata,
      userAgent: navigator.userAgent,
    };

    // Add to error history
    this.errors.push(errorEntry);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift(); // Remove oldest
    }

    // Console logging with proper formatting
    console.error(`[Notification Error - ${context}]`, {
      message: errorEntry.message,
      metadata,
      timestamp: errorEntry.timestamp,
    });

    // Optional: Send to error tracking service (e.g., Sentry, LogRocket)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        tags: { context },
        extra: metadata,
      });
    }
  }

  /**
   * Log a warning
   * @param {string} message - Warning message
   * @param {string} context - Context where warning occurred
   * @param {object} metadata - Additional metadata
   */
  logWarning(message, context, metadata = {}) {
    console.warn(`[Notification Warning - ${context}]`, message, metadata);
  }

  /**
   * Get error history
   * @returns {Array} Array of error entries
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Clear error history
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Get errors for a specific context
   * @param {string} context - The context to filter by
   * @returns {Array} Filtered errors
   */
  getErrorsByContext(context) {
    return this.errors.filter((err) => err.context === context);
  }

  /**
   * Check if there are recent errors
   * @param {number} minutes - Number of minutes to look back
   * @returns {boolean} True if there are recent errors
   */
  hasRecentErrors(minutes = 5) {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.errors.some(
      (err) => new Date(err.timestamp).getTime() > cutoff
    );
  }
}

// Create singleton instance
const errorHandler = new NotificationErrorHandler();

// Export both the class and the instance
export { NotificationErrorHandler };
export default errorHandler;
