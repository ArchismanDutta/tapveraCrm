// client/src/__tests__/safeDateParser.test.js
import { describe, test, expect } from 'vitest';
import { parseDate, getTodayString, formatDateString, isValidDate } from '../utils/safeDateParser';

describe('safeDateParser', () => {
  describe('parseDate', () => {
    test('parses YYYY-MM-DD format correctly', () => {
      const date = parseDate('2024-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January is 0
      expect(date.getDate()).toBe(15);
    });

    test('parses YYYY-MM format to first day of month', () => {
      const date = parseDate('2024-03');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(2); // March
      expect(date.getDate()).toBe(1);
    });

    test('parses ISO 8601 format with timezone', () => {
      const date = parseDate('2024-01-15T10:30:00.000Z');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    test('returns null for invalid date strings', () => {
      expect(parseDate('invalid')).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
    });

    test('returns null for malformed dates', () => {
      expect(parseDate('2024-13-01')).toBeNull(); // Invalid month
      expect(parseDate('2024-02-30')).toBeNull(); // Invalid day
    });
  });

  describe('isValidDate', () => {
    test('validates correct date strings', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('2024-12')).toBe(true);
      expect(isValidDate('2024-01-15T00:00:00.000Z')).toBe(true);
    });

    test('rejects invalid date strings', () => {
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(null)).toBe(false);
    });
  });

  describe('getTodayString', () => {
    test('returns date in YYYY-MM-DD format', () => {
      const today = getTodayString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatDateString', () => {
    test('formats Date object to YYYY-MM-DD', () => {
      const date = new Date('2024-01-15T00:00:00.000Z');
      const formatted = formatDateString(date);
      expect(formatted).toBe('2024-01-15');
    });

    test('formats date string to YYYY-MM-DD', () => {
      const formatted = formatDateString('2024-01-15');
      expect(formatted).toBe('2024-01-15');
    });

    test('returns null for invalid input', () => {
      expect(formatDateString(null)).toBeNull();
      expect(formatDateString('invalid')).toBeNull();
    });
  });
});
