/**
 * Secure Storage Utility
 *
 * This module provides secure storage for sensitive data like authentication tokens.
 * It addresses the security concerns of storing sensitive data in localStorage.
 *
 * SECURITY FEATURES:
 * 1. Uses sessionStorage for tokens (cleared on browser close)
 * 2. Implements token expiration checking
 * 3. Provides encryption wrapper for localStorage when persistence is needed
 * 4. Validates token format before storage
 * 5. Automatic cleanup on logout
 *
 * USAGE:
 * - Use sessionStorage by default (tokens cleared on browser close)
 * - Use localStorage with 'remember me' option only when explicitly requested
 */

// Token expiration time (8 hours in milliseconds)
const TOKEN_EXPIRATION = 8 * 60 * 60 * 1000;

/**
 * Simple XOR encryption for localStorage
 * NOTE: This is basic obfuscation, NOT cryptographic security
 * The main security comes from using sessionStorage by default
 */
const encryptionKey = 'TapVeraCRM2024SecureKey';

function simpleEncrypt(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length)
    );
  }
  return btoa(result); // Base64 encode
}

function simpleDecrypt(encrypted) {
  try {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length)
      );
    }
    return result;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Validate JWT token format
 */
function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3; // JWT has 3 parts: header.payload.signature
}

/**
 * SecureStorage class
 */
class SecureStorage {
  constructor() {
    this.storageType = 'session'; // Default to sessionStorage
  }

  /**
   * Set authentication token
   * @param {string} token - JWT token
   * @param {boolean} rememberMe - If true, use localStorage (persistent)
   */
  setToken(token, rememberMe = false) {
    if (!isValidTokenFormat(token)) {
      console.error('Invalid token format');
      return false;
    }

    const tokenData = {
      value: token,
      timestamp: Date.now(),
      expiresAt: Date.now() + TOKEN_EXPIRATION
    };

    const storage = rememberMe ? localStorage : sessionStorage;
    this.storageType = rememberMe ? 'local' : 'session';

    try {
      if (rememberMe) {
        // Encrypt token before storing in localStorage
        storage.setItem('auth_token', simpleEncrypt(JSON.stringify(tokenData)));
      } else {
        // SessionStorage - no encryption needed (cleared on close)
        storage.setItem('auth_token', JSON.stringify(tokenData));
      }
      return true;
    } catch (error) {
      console.error('Failed to store token:', error);
      return false;
    }
  }

  /**
   * Get authentication token
   * @returns {string|null} - Token or null if expired/invalid
   */
  getToken() {
    // Try sessionStorage first, then localStorage
    let tokenData = sessionStorage.getItem('auth_token');
    let isEncrypted = false;

    if (!tokenData) {
      tokenData = localStorage.getItem('auth_token');
      isEncrypted = true;
    }

    if (!tokenData) return null;

    try {
      // Decrypt if from localStorage
      const parsed = JSON.parse(
        isEncrypted ? simpleDecrypt(tokenData) : tokenData
      );

      if (!parsed || !parsed.value) return null;

      // Check expiration
      if (Date.now() > parsed.expiresAt) {
        this.clearToken();
        return null;
      }

      // Validate token format
      if (!isValidTokenFormat(parsed.value)) {
        this.clearToken();
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      this.clearToken();
      return null;
    }
  }

  /**
   * Check if token exists and is valid
   */
  hasValidToken() {
    return this.getToken() !== null;
  }

  /**
   * Clear authentication token from all storage
   */
  clearToken() {
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token');
  }

  /**
   * Store user data (non-sensitive)
   * @param {object} userData - User information (without sensitive fields)
   */
  setUserData(userData) {
    // Remove any sensitive fields before storing
    const sanitized = {
      id: userData.id || userData._id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      department: userData.department,
      avatar: userData.avatar
      // DO NOT store: password, tokens, secrets
    };

    sessionStorage.setItem('user_data', JSON.stringify(sanitized));
  }

  /**
   * Get user data
   */
  getUserData() {
    const data = sessionStorage.getItem('user_data');
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear user data
   */
  clearUserData() {
    sessionStorage.removeItem('user_data');
    localStorage.removeItem('user_data'); // Also clear from localStorage if exists
  }

  /**
   * Clear all secure storage
   */
  clearAll() {
    this.clearToken();
    this.clearUserData();
  }

  /**
   * Get token expiration time remaining (in minutes)
   */
  getTokenTimeRemaining() {
    const tokenData = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    if (!tokenData) return 0;

    try {
      const isEncrypted = !sessionStorage.getItem('auth_token');
      const parsed = JSON.parse(
        isEncrypted ? simpleDecrypt(tokenData) : tokenData
      );

      const remaining = parsed.expiresAt - Date.now();
      return Math.max(0, Math.floor(remaining / 60000)); // Convert to minutes
    } catch {
      return 0;
    }
  }

  /**
   * Refresh token timestamp (extend expiration)
   */
  refreshTokenExpiration() {
    const token = this.getToken();
    if (token) {
      const rememberMe = this.storageType === 'local';
      this.setToken(token, rememberMe);
    }
  }
}

// Export singleton instance
const secureStorage = new SecureStorage();

export default secureStorage;

/**
 * MIGRATION GUIDE:
 *
 * Replace old localStorage usage:
 *
 * OLD:
 * localStorage.setItem("token", token);
 * const token = localStorage.getItem("token");
 * localStorage.removeItem("token");
 *
 * NEW:
 * import secureStorage from './utils/secureStorage';
 *
 * secureStorage.setToken(token, rememberMe);
 * const token = secureStorage.getToken();
 * secureStorage.clearToken();
 */
