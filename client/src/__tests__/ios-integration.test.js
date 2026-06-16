// client/src/__tests__/ios-integration.test.js
import { describe, test, expect } from 'vitest';
import { parseDate, isValidDate } from '../utils/safeDateParser';
import { isIOS, getIOSVersion } from '../utils/iosCompatibility';
import { audioManager } from '../utils/audioManager';
import { safeLocalStorage } from '../utils/safeStorage';
import ErrorBoundary from '../components/ErrorBoundary';

describe('iOS Integration Tests', () => {
  describe('Critical Path - App Loading', () => {
    test('error boundary component exists', () => {
      expect(ErrorBoundary).toBeDefined();
      expect(typeof ErrorBoundary).toBe('function');
    });

    test('safe date parser handles iOS formats', () => {
      // iOS Safari requires these formats
      expect(parseDate('2024-01-15')).toBeInstanceOf(Date);
      expect(parseDate('2024-01')).toBeInstanceOf(Date);
      expect(parseDate('2024-01-15T00:00:00.000Z')).toBeInstanceOf(Date);
    });

    test('safe storage handles private browsing', () => {
      // Should not throw even if storage fails
      expect(() => {
        safeLocalStorage.setItem('test', 'value');
        safeLocalStorage.getItem('test');
        safeLocalStorage.removeItem('test');
      }).not.toThrow();
    });
  });

  describe('iOS Detection', () => {
    test('iOS detection returns boolean', () => {
      const result = isIOS();
      expect(typeof result).toBe('boolean');
    });

    test('iOS version parsing handles formats', () => {
      // Should not throw regardless of user agent
      expect(() => getIOSVersion()).not.toThrow();
    });
  });

  describe('Audio Manager', () => {
    test('initializes without errors', async () => {
      const result = await audioManager.initialize();
      expect(typeof result).toBe('boolean');
    });

    test('handles missing AudioContext gracefully', () => {
      // Should not crash if AudioContext unavailable
      expect(() => audioManager.playNotificationSound()).not.toThrow();
    });
  });

  describe('Date Parsing Edge Cases', () => {
    test('handles invalid dates safely', () => {
      expect(parseDate('')).toBeNull();
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('invalid-date')).toBeNull();
      expect(parseDate('2024-13-01')).toBeNull(); // Invalid month
    });

    test('validates dates correctly', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('')).toBe(false);
    });
  });
});
