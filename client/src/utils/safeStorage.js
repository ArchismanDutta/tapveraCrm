/**
 * Safe storage wrapper for localStorage and sessionStorage
 * Handles iOS private browsing mode where storage throws exceptions
 *
 * iOS PRIVATE BROWSING ISSUE:
 * When an iOS app is in private browsing mode, accessing localStorage/sessionStorage
 * throws a QuotaExceededError or SecurityError. This wrapper safely catches those
 * exceptions and provides a graceful fallback.
 *
 * USAGE:
 * import { safeLocalStorage, safeSessionStorage } from './utils/safeStorage';
 *
 * // Use like normal storage, but with error handling built-in
 * safeLocalStorage.setItem('key', 'value');
 * const value = safeLocalStorage.getItem('key');
 */

class SafeStorage {
  constructor(storage, storageName = 'Storage') {
    this.storage = storage;
    this.storageName = storageName;
    this.available = this.checkAvailability();

    // In-memory fallback for when storage is unavailable
    this.memoryStore = new Map();
  }

  /**
   * Check if storage is available
   * This detects iOS private browsing and other storage restrictions
   */
  checkAvailability() {
    try {
      const test = '__storage_test__';
      this.storage.setItem(test, test);
      this.storage.removeItem(test);
      return true;
    } catch (e) {
      const errorMsg = e?.message || 'Unknown error';
      console.warn(
        `Storage not available (${this.storageName}): ${errorMsg} ` +
        '(likely iOS private browsing or quota exceeded)',
        e
      );
      return false;
    }
  }

  /**
   * Get value from storage
   * Falls back to memory store if storage is unavailable
   */
  getItem(key) {
    if (!key) return null;

    if (this.available) {
      try {
        return this.storage.getItem(key);
      } catch (e) {
        console.error(`Storage getItem error (${this.storageName}):`, e);
        // Mark as unavailable and fall back to memory
        this.available = false;
        return this.memoryStore.get(key) || null;
      }
    }

    // Fallback to in-memory storage
    return this.memoryStore.get(key) || null;
  }

  /**
   * Set value in storage
   * Falls back to memory store if storage is unavailable
   */
  setItem(key, value) {
    if (!key) return false;

    if (this.available) {
      try {
        this.storage.setItem(key, value);
        // Also update memory store as backup
        this.memoryStore.set(key, value);
        return true;
      } catch (e) {
        const errorMsg = e?.message || 'Unknown error';
        console.error(
          `Storage setItem error (${this.storageName}): ${errorMsg}`,
          e
        );
        // Mark as unavailable and fall back to memory
        this.available = false;
        this.memoryStore.set(key, value);
        return false;
      }
    }

    // Fallback to in-memory storage
    this.memoryStore.set(key, value);
    return false;
  }

  /**
   * Remove value from storage
   */
  removeItem(key) {
    if (!key) return;

    if (this.available) {
      try {
        this.storage.removeItem(key);
      } catch (e) {
        console.error(`Storage removeItem error (${this.storageName}):`, e);
        this.available = false;
      }
    }

    // Also remove from memory store
    this.memoryStore.delete(key);
  }

  /**
   * Clear all storage
   */
  clear() {
    if (this.available) {
      try {
        this.storage.clear();
      } catch (e) {
        console.error(`Storage clear error (${this.storageName}):`, e);
        this.available = false;
      }
    }

    // Also clear memory store
    this.memoryStore.clear();
  }

  /**
   * Check if storage is available
   */
  isAvailable() {
    return this.available;
  }

  /**
   * Get number of items in storage
   */
  get length() {
    if (this.available) {
      try {
        return this.storage.length;
      } catch (e) {
        return this.memoryStore.size;
      }
    }
    return this.memoryStore.size;
  }

  /**
   * Get key by index
   */
  key(index) {
    if (this.available) {
      try {
        return this.storage.key(index);
      } catch (e) {
        const keys = Array.from(this.memoryStore.keys());
        return keys[index] || null;
      }
    }

    const keys = Array.from(this.memoryStore.keys());
    return keys[index] || null;
  }
}

// Create singleton instances
export const safeLocalStorage = new SafeStorage(
  typeof window !== 'undefined' ? window.localStorage : null,
  'localStorage'
);

export const safeSessionStorage = new SafeStorage(
  typeof window !== 'undefined' ? window.sessionStorage : null,
  'sessionStorage'
);

/**
 * Authentication token helper
 * Maintains backwards compatibility with existing code
 */
const SafeStorageAuthHelper = {
  /**
   * Set authentication token
   * @param {string} token - Auth token
   * @param {boolean} rememberMe - Whether to persist in localStorage (default: false)
   * @returns {boolean} - Success status
   */
  setToken(token, rememberMe = false) {
    if (!token) return false;

    const storage = rememberMe ? safeLocalStorage : safeSessionStorage;
    const tokenData = {
      token,
      timestamp: Date.now(),
      rememberMe
    };

    return storage.setItem('auth_token', JSON.stringify(tokenData));
  },

  /**
   * Get authentication token
   * @returns {string|null} - Token or null if not found
   */
  getToken() {
    // Try sessionStorage first, then localStorage
    const sessionToken = safeSessionStorage.getItem('auth_token');
    const localToken = safeLocalStorage.getItem('auth_token');
    const tokenString = sessionToken || localToken;

    if (!tokenString) return null;

    try {
      const tokenData = JSON.parse(tokenString);
      return tokenData?.token || null;
    } catch (e) {
      console.error('Failed to parse token:', e);
      return null;
    }
  },

  /**
   * Remove authentication token
   */
  removeToken() {
    safeLocalStorage.removeItem('auth_token');
    safeSessionStorage.removeItem('auth_token');
  },

  /**
   * Check if token exists
   */
  hasToken() {
    return this.getToken() !== null;
  },

  /**
   * Get token expiration info
   * @returns {object|null} - Token data or null
   */
  getTokenData() {
    const sessionToken = safeSessionStorage.getItem('auth_token');
    const localToken = safeLocalStorage.getItem('auth_token');
    const tokenString = sessionToken || localToken;

    if (!tokenString) return null;

    try {
      return JSON.parse(tokenString);
    } catch (e) {
      console.error('Failed to parse token data:', e);
      return null;
    }
  }
};

// Default export with both storage objects and auth helper
export default {
  local: safeLocalStorage,
  session: safeSessionStorage,
  setToken: SafeStorageAuthHelper.setToken,
  getToken: SafeStorageAuthHelper.getToken,
  removeToken: SafeStorageAuthHelper.removeToken,
  hasToken: SafeStorageAuthHelper.hasToken,
  getTokenData: SafeStorageAuthHelper.getTokenData
};
