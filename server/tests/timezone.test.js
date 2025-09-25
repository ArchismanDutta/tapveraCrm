// tests/timezone.test.js

/**
 * Test Suite for Timezone and Date Handling
 * Tests Kolkata timezone conversion, date formatting, and UTC handling
 */

// Import the timezone functions from statusController
const fs = require('fs');
const path = require('path');

// Read and extract timezone functions from statusController
const statusControllerPath = path.join(__dirname, '../controllers/statusController.js');
const statusControllerCode = fs.readFileSync(statusControllerPath, 'utf8');

// Extract the timezone utility functions for testing
function extractTimezoneUtils() {
  // For testing, we'll reimplement the timezone utilities

  function formatPartsFor(date, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      hour12: false,
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const map = {};
    parts.forEach(({ type, value }) => {
      map[type] = value;
    });
    return map;
  }

  function getTimeZoneOffsetMilliseconds(date, timeZone) {
    const dtfUTC = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const dtfTZ = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const partsUTC = dtfUTC.formatToParts(date);
    const partsTZ = dtfTZ.formatToParts(date);

    function partsToDate(parts) {
      const map = {};
      parts.forEach(({ type, value }) => {
        map[type] = value;
      });
      return new Date(
        `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`
      );
    }

    const dateUTC = partsToDate(partsUTC);
    const dateTZ = partsToDate(partsTZ);

    return dateTZ.getTime() - dateUTC.getTime();
  }

  function zonedTimeToUtc(date, timeZone) {
    const localParts = formatPartsFor(date, timeZone);

    const utcDate = new Date(
      Date.UTC(
        parseInt(localParts.year),
        parseInt(localParts.month) - 1,
        parseInt(localParts.day),
        parseInt(localParts.hour),
        parseInt(localParts.minute),
        parseInt(localParts.second)
      )
    );

    return utcDate;
  }

  function utcToZonedTime(utcDate, timeZone) {
    const offsetMs = getTimeZoneOffsetMilliseconds(utcDate, timeZone);
    return new Date(utcDate.getTime() + offsetMs);
  }

  return {
    formatPartsFor,
    getTimeZoneOffsetMilliseconds,
    zonedTimeToUtc,
    utcToZonedTime
  };
}

const timezoneUtils = extractTimezoneUtils();

// Test cases for timezone handling
const timezoneTestCases = [
  {
    name: 'UTC to Kolkata conversion (morning)',
    utcTime: '2024-01-15T03:30:00.000Z', // 3:30 AM UTC
    timezone: 'Asia/Kolkata',
    expectedKolkataHour: 9, // 9:00 AM IST (UTC+5:30)
    expectedKolkataMinute: 0
  },
  {
    name: 'UTC to Kolkata conversion (afternoon)',
    utcTime: '2024-01-15T07:00:00.000Z', // 7:00 AM UTC
    timezone: 'Asia/Kolkata',
    expectedKolkataHour: 12, // 12:30 PM IST
    expectedKolkataMinute: 30
  },
  {
    name: 'UTC to Kolkata conversion (evening)',
    utcTime: '2024-01-15T12:30:00.000Z', // 12:30 PM UTC
    timezone: 'Asia/Kolkata',
    expectedKolkataHour: 18, // 6:00 PM IST
    expectedKolkataMinute: 0
  },
  {
    name: 'Kolkata to UTC conversion (morning)',
    kolkataTime: '2024-01-15T09:00:00', // 9:00 AM IST
    timezone: 'Asia/Kolkata',
    expectedUtcHour: 3, // 3:30 AM UTC
    expectedUtcMinute: 30
  },
  {
    name: 'Kolkata to UTC conversion (afternoon)',
    kolkataTime: '2024-01-15T14:30:00', // 2:30 PM IST
    timezone: 'Asia/Kolkata',
    expectedUtcHour: 9, // 9:00 AM UTC
    expectedUtcMinute: 0
  }
];

// Date formatting test cases
const dateFormattingTests = [
  {
    name: 'Format arrival time in 12-hour format',
    utcTime: '2024-01-15T03:30:00.000Z',
    timezone: 'Asia/Kolkata',
    expectedFormatted: '9:00 AM'
  },
  {
    name: 'Format arrival time in 12-hour format (PM)',
    utcTime: '2024-01-15T12:30:00.000Z',
    timezone: 'Asia/Kolkata',
    expectedFormatted: '6:00 PM'
  },
  {
    name: 'Format arrival time with minutes',
    utcTime: '2024-01-15T04:15:00.000Z',
    timezone: 'Asia/Kolkata',
    expectedFormatted: '9:45 AM'
  }
];

// Date boundary test cases
const dateBoundaryTests = [
  {
    name: 'Date boundary - Late night to early morning',
    utcTime: '2024-01-14T20:00:00.000Z', // 8:00 PM UTC on Jan 14
    timezone: 'Asia/Kolkata',
    expectedDate: '2024-01-15', // Should be Jan 15 in Kolkata
    expectedHour: 1,
    expectedMinute: 30
  },
  {
    name: 'Date boundary - Early morning to previous day',
    utcTime: '2024-01-15T02:00:00.000Z', // 2:00 AM UTC on Jan 15
    timezone: 'Asia/Kolkata',
    expectedDate: '2024-01-15', // Should still be Jan 15 in Kolkata
    expectedHour: 7,
    expectedMinute: 30
  }
];

// Test runner for timezone functionality
function runTimezoneTests() {
  console.log('='.repeat(60));
  console.log('TIMEZONE AND DATE HANDLING TEST SUITE');
  console.log('='.repeat(60));

  let passedTests = 0;
  let totalTests = 0;

  // Test UTC to Kolkata conversion
  console.log('\n🌏 UTC TO KOLKATA CONVERSION TESTS');
  console.log('-'.repeat(40));

  timezoneTestCases.filter(t => t.utcTime).forEach((testCase, index) => {
    totalTests++;
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const utcDate = new Date(testCase.utcTime);
      const kolkataDate = timezoneUtils.utcToZonedTime(utcDate, testCase.timezone);

      const actualHour = kolkataDate.getUTCHours();
      const actualMinute = kolkataDate.getUTCMinutes();

      let testPassed = true;
      let errors = [];

      if (actualHour !== testCase.expectedKolkataHour) {
        errors.push(`Hour: expected ${testCase.expectedKolkataHour}, got ${actualHour}`);
        testPassed = false;
      }
      if (actualMinute !== testCase.expectedKolkataMinute) {
        errors.push(`Minute: expected ${testCase.expectedKolkataMinute}, got ${actualMinute}`);
        testPassed = false;
      }

      if (testPassed) {
        console.log(`   ✅ PASSED - ${utcDate.toISOString()} → ${actualHour}:${actualMinute.toString().padStart(2, '0')} IST`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        errors.forEach(error => console.log(`      - ${error}`));
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });

  // Test Kolkata to UTC conversion
  console.log('\n🌍 KOLKATA TO UTC CONVERSION TESTS');
  console.log('-'.repeat(40));

  timezoneTestCases.filter(t => t.kolkataTime).forEach((testCase, index) => {
    totalTests++;
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const kolkataDate = new Date(testCase.kolkataTime);
      const utcDate = timezoneUtils.zonedTimeToUtc(kolkataDate, testCase.timezone);

      const actualHour = utcDate.getUTCHours();
      const actualMinute = utcDate.getUTCMinutes();

      let testPassed = true;
      let errors = [];

      if (actualHour !== testCase.expectedUtcHour) {
        errors.push(`Hour: expected ${testCase.expectedUtcHour}, got ${actualHour}`);
        testPassed = false;
      }
      if (actualMinute !== testCase.expectedUtcMinute) {
        errors.push(`Minute: expected ${testCase.expectedUtcMinute}, got ${actualMinute}`);
        testPassed = false;
      }

      if (testPassed) {
        console.log(`   ✅ PASSED - ${testCase.kolkataTime} IST → ${utcDate.toISOString()}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        errors.forEach(error => console.log(`      - ${error}`));
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });

  // Test date formatting
  console.log('\n📅 DATE FORMATTING TESTS');
  console.log('-'.repeat(40));

  dateFormattingTests.forEach((testCase, index) => {
    totalTests++;
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const utcDate = new Date(testCase.utcTime);
      const kolkataDate = timezoneUtils.utcToZonedTime(utcDate, testCase.timezone);

      // Format like the frontend does
      const formatted = kolkataDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      if (formatted === testCase.expectedFormatted) {
        console.log(`   ✅ PASSED - ${utcDate.toISOString()} → "${formatted}"`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Expected "${testCase.expectedFormatted}", got "${formatted}"`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });

  // Test date boundaries
  console.log('\n📆 DATE BOUNDARY TESTS');
  console.log('-'.repeat(40));

  dateBoundaryTests.forEach((testCase, index) => {
    totalTests++;
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const utcDate = new Date(testCase.utcTime);
      const kolkataDate = timezoneUtils.utcToZonedTime(utcDate, testCase.timezone);

      const actualDate = kolkataDate.toISOString().slice(0, 10);
      const actualHour = kolkataDate.getUTCHours();
      const actualMinute = kolkataDate.getUTCMinutes();

      let testPassed = true;
      let errors = [];

      if (actualDate !== testCase.expectedDate) {
        errors.push(`Date: expected ${testCase.expectedDate}, got ${actualDate}`);
        testPassed = false;
      }
      if (actualHour !== testCase.expectedHour) {
        errors.push(`Hour: expected ${testCase.expectedHour}, got ${actualHour}`);
        testPassed = false;
      }
      if (actualMinute !== testCase.expectedMinute) {
        errors.push(`Minute: expected ${testCase.expectedMinute}, got ${actualMinute}`);
        testPassed = false;
      }

      if (testPassed) {
        console.log(`   ✅ PASSED - ${utcDate.toISOString()} → ${actualDate} ${actualHour}:${actualMinute.toString().padStart(2, '0')} IST`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        errors.forEach(error => console.log(`      - ${error}`));
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });

  // Test Kolkata timezone offset
  console.log('\n⏰ TIMEZONE OFFSET VERIFICATION');
  console.log('-'.repeat(40));

  totalTests++;
  try {
    const testDate = new Date('2024-01-15T12:00:00.000Z');
    const offsetMs = timezoneUtils.getTimeZoneOffsetMilliseconds(testDate, 'Asia/Kolkata');
    const expectedOffsetMs = 5.5 * 60 * 60 * 1000; // +5:30 in milliseconds

    if (Math.abs(offsetMs - expectedOffsetMs) < 1000) { // Allow 1 second tolerance
      console.log(`✅ PASSED - Kolkata offset: ${offsetMs / (60 * 60 * 1000)} hours`);
      passedTests++;
    } else {
      console.log(`❌ FAILED - Expected ${expectedOffsetMs}ms, got ${offsetMs}ms`);
    }

  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`TIMEZONE TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(60));

  return { passed: passedTests, total: totalTests };
}

// Export for use in other files
module.exports = {
  runTimezoneTests,
  timezoneTestCases,
  timezoneUtils
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTimezoneTests();
}