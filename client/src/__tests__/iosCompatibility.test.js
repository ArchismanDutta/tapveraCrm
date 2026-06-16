import { describe, test, expect, vi } from 'vitest';
import {
  isIOS,
  isSafari,
  getIOSVersion,
  isIOSVersionAtLeast,
  isPrivateBrowsing
} from '../utils/iosCompatibility';

describe('iosCompatibility', () => {
  describe('isIOS', () => {
    test('returns boolean', () => {
      expect(typeof isIOS()).toBe('boolean');
    });
  });

  describe('isSafari', () => {
    test('returns boolean', () => {
      expect(typeof isSafari()).toBe('boolean');
    });
  });

  describe('getIOSVersion', () => {
    test('returns null or version object', () => {
      const version = getIOSVersion();
      if (version !== null) {
        expect(version).toHaveProperty('major');
        expect(version).toHaveProperty('minor');
        expect(version).toHaveProperty('patch');
      }
    });
  });

  describe('isIOSVersionAtLeast', () => {
    test('returns boolean for version check', () => {
      expect(typeof isIOSVersionAtLeast(13, 0)).toBe('boolean');
      expect(typeof isIOSVersionAtLeast(15, 0)).toBe('boolean');
    });
  });

  describe('isPrivateBrowsing', () => {
    test('returns promise with boolean', async () => {
      const result = await isPrivateBrowsing();
      expect(typeof result).toBe('boolean');
    });
  });
});
