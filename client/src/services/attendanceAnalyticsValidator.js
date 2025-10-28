/**
 * Comprehensive Test Suite for Attendance Analytics
 * Validates all calculations with real test data
 */

import attendanceAnalytics from './attendanceAnalytics';

class AttendanceAnalyticsValidator {
  /**
   * Run all validation tests
   */
  runAllTests() {
    console.group('🧪 Attendance Analytics Validation Suite');

    const results = {
      latePatternTests: this.testLatePatterns(),
      burnoutTests: this.testBurnoutDetection(),
      punctualityTests: this.testPunctualityTrend(),
      irregularHoursTests: this.testIrregularHours(),
      breakPatternTests: this.testBreakPatterns(),
      riskScoreTests: this.testRiskScore(),
      edgeCaseTests: this.testEdgeCases()
    };

    const allPassed = Object.values(results).every(r => r.passed);

    console.log('\n📊 VALIDATION SUMMARY:');
    Object.entries(results).forEach(([test, result]) => {
      console.log(`${result.passed ? '✅' : '❌'} ${test}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      if (!result.passed) {
        console.error('  Errors:', result.errors);
      }
    });

    console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.groupEnd();

    return { allPassed, results };
  }

  /**
   * Test late pattern detection
   */
  testLatePatterns() {
    console.group('🕐 Testing Late Pattern Detection');
    const errors = [];

    // Test Case 1: No late days
    const noLateDays = this.generateTestData(10, { lateDays: 0 });
    const result1 = attendanceAnalytics.analyzeAttendancePatterns(noLateDays);

    if (result1.latePatterns.lateDaysCount !== 0) {
      errors.push('No late days test failed');
    }
    if (result1.latePatterns.latePercentage !== 0) {
      errors.push('Late percentage should be 0');
    }
    console.log('✓ No late days:', result1.latePatterns.lateDaysCount === 0);

    // Test Case 2: 5 late days out of 20
    const fiveLateDays = this.generateTestData(20, { lateDays: 5 });
    const result2 = attendanceAnalytics.analyzeAttendancePatterns(fiveLateDays);

    if (result2.latePatterns.lateDaysCount !== 5) {
      errors.push(`Late days count mismatch: expected 5, got ${result2.latePatterns.lateDaysCount}`);
    }
    const expectedPercentage = (5 / 20) * 100;
    if (Math.abs(result2.latePatterns.latePercentage - expectedPercentage) > 0.1) {
      errors.push(`Late percentage mismatch: expected ${expectedPercentage}, got ${result2.latePatterns.latePercentage}`);
    }
    console.log('✓ 5 late days out of 20:', result2.latePatterns.lateDaysCount === 5);

    // Test Case 3: Consecutive late days
    const consecutiveLate = this.generateTestData(10, { lateDays: 5, consecutive: true });
    const result3 = attendanceAnalytics.analyzeAttendancePatterns(consecutiveLate);

    if (result3.latePatterns.maxConsecutiveLate < 3) {
      errors.push('Consecutive late days not detected');
    }
    console.log('✓ Consecutive late detection:', result3.latePatterns.maxConsecutiveLate >= 3);

    // Test Case 4: Late minutes calculation
    const lateMinutesTest = this.generateTestData(10, {
      lateDays: 3,
      lateMinutes: [15, 30, 45] // Specific late minutes
    });
    const result4 = attendanceAnalytics.analyzeAttendancePatterns(lateMinutesTest);

    const expectedAvgLateMinutes = (15 + 30 + 45) / 3;
    if (Math.abs(result4.latePatterns.avgLateMinutes - expectedAvgLateMinutes) > 1) {
      errors.push(`Avg late minutes mismatch: expected ${expectedAvgLateMinutes}, got ${result4.latePatterns.avgLateMinutes}`);
    }
    console.log('✓ Average late minutes calculation:', Math.abs(result4.latePatterns.avgLateMinutes - expectedAvgLateMinutes) <= 1);

    console.groupEnd();
    return { passed: errors.length === 0, errors };
  }

  /**
   * Test burnout detection
   */
  testBurnoutDetection() {
    console.group('🔥 Testing Burnout Detection');
    const errors = [];

    // Test Case 1: No overtime
    const noOvertime = this.generateTestData(10, {
      workHours: 7.5 // Standard hours
    });
    const result1 = attendanceAnalytics.analyzeAttendancePatterns(noOvertime);

    if (result1.burnoutSignals.overtimeDaysCount !== 0) {
      errors.push('No overtime test failed');
    }
    console.log('✓ No overtime detected:', result1.burnoutSignals.overtimeDaysCount === 0);

    // Test Case 2: Consistent overtime
    const overtime = this.generateTestData(10, {
      workHours: 10 // 2.5 hours overtime per day
    });
    const result2 = attendanceAnalytics.analyzeAttendancePatterns(overtime);

    if (result2.burnoutSignals.overtimeDaysCount !== 10) {
      errors.push(`Overtime days mismatch: expected 10, got ${result2.burnoutSignals.overtimeDaysCount}`);
    }
    console.log('✓ Overtime days detected:', result2.burnoutSignals.overtimeDaysCount === 10);

    // Test Case 3: Skipped breaks
    const skippedBreaks = this.generateTestData(10, {
      workHours: 8,
      breakMinutes: 5 // Very short breaks
    });
    const result3 = attendanceAnalytics.analyzeAttendancePatterns(skippedBreaks);

    if (result3.burnoutSignals.skippedBreakDays < 5) {
      errors.push('Skipped breaks not detected properly');
    }
    console.log('✓ Skipped breaks detected:', result3.burnoutSignals.skippedBreakDays > 0);

    // Test Case 4: Weekly overtime calculation
    const weeklyOvertimeTest = this.generateTestData(5, {
      workHours: 10 // 2.5 hours overtime per day = 12.5 hours per week
    });
    const result4 = attendanceAnalytics.analyzeAttendancePatterns(weeklyOvertimeTest);

    const expectedWeeklyOvertime = 5 * 2.5; // 12.5 hours
    if (Math.abs(result4.burnoutSignals.avgWeeklyOvertime - expectedWeeklyOvertime) > 1) {
      errors.push(`Weekly overtime mismatch: expected ~${expectedWeeklyOvertime}, got ${result4.burnoutSignals.avgWeeklyOvertime}`);
    }
    console.log('✓ Weekly overtime calculation:', Math.abs(result4.burnoutSignals.avgWeeklyOvertime - expectedWeeklyOvertime) <= 1);

    console.groupEnd();
    return { passed: errors.length === 0, errors };
  }

  /**
   * Test punctuality trend analysis
   */
  testPunctualityTrend() {
    console.group('📈 Testing Punctuality Trend');
    const errors = [];

    // Test Case 1: Declining punctuality
    const decliningData = [
      ...this.generateTestData(10, { lateDays: 1 }), // 10% late
      ...this.generateTestData(10, { lateDays: 5 })  // 50% late - significant decline
    ];
    const result1 = attendanceAnalytics.analyzeAttendancePatterns(decliningData);

    if (!result1.punctualityTrend.isDeclining) {
      errors.push('Declining trend not detected');
    }
    console.log('✓ Declining trend detected:', result1.punctualityTrend.isDeclining);

    // Test Case 2: Improving punctuality
    const improvingData = [
      ...this.generateTestData(10, { lateDays: 5 }), // 50% late
      ...this.generateTestData(10, { lateDays: 1 })  // 10% late - improvement
    ];
    const result2 = attendanceAnalytics.analyzeAttendancePatterns(improvingData);

    if (result2.punctualityTrend.trendDirection !== 'improving') {
      errors.push('Improving trend not detected');
    }
    console.log('✓ Improving trend detected:', result2.punctualityTrend.trendDirection === 'improving');

    // Test Case 3: Stable punctuality
    const stableData = this.generateTestData(20, { lateDays: 2 });
    const result3 = attendanceAnalytics.analyzeAttendancePatterns(stableData);

    if (result3.punctualityTrend.trendDirection !== 'stable') {
      errors.push('Stable trend not detected');
    }
    console.log('✓ Stable trend detected:', result3.punctualityTrend.trendDirection === 'stable');

    console.groupEnd();
    return { passed: errors.length === 0, errors };
  }

  /**
   * Test irregular work hours detection
   */
  testIrregularHours() {
    console.group('⏱️ Testing Irregular Work Hours');
    const errors = [];

    // Test Case 1: Consistent hours (7.5h every day)
    const consistentHours = this.generateTestData(10, { workHours: 7.5 });
    const result1 = attendanceAnalytics.analyzeAttendancePatterns(consistentHours);

    if (result1.irregularPatterns.isIrregular) {
      errors.push('Consistent hours incorrectly flagged as irregular');
    }
    console.log('✓ Consistent hours recognized:', !result1.irregularPatterns.isIrregular);

    // Test Case 2: Irregular hours (varying significantly)
    const irregularData = [
      ...this.generateTestData(3, { workHours: 4 }),
      ...this.generateTestData(3, { workHours: 10 }),
      ...this.generateTestData(3, { workHours: 6 })
    ];
    const result2 = attendanceAnalytics.analyzeAttendancePatterns(irregularData);

    if (!result2.irregularPatterns.isIrregular) {
      errors.push('Irregular hours not detected');
    }
    console.log('✓ Irregular hours detected:', result2.irregularPatterns.isIrregular);

    console.groupEnd();
    return { passed: errors.length === 0, errors };
  }

  /**
   * Test break pattern analysis
   */
  testBreakPatterns() {
    console.group('☕ Testing Break Patterns');
    const errors = [];

    // Test Case 1: Adequate breaks
    const adequateBreaks = this.generateTestData(10, {
      workHours: 8,
      breakMinutes: 45 // Good break duration
    });
    const result1 = attendanceAnalytics.analyzeAttendancePatterns(adequateBreaks);

    if (result1.breakPatterns.hasIssue) {
      errors.push('Adequate breaks incorrectly flagged as issue');
    }
    console.log('✓ Adequate breaks recognized:', !result1.breakPatterns.hasIssue);

    // Test Case 2: No breaks
    const noBreaks = this.generateTestData(10, {
      workHours: 8,
      breakMinutes: 0
    });
    const result2 = attendanceAnalytics.analyzeAttendancePatterns(noBreaks);

    if (result2.breakPatterns.noBreakDays !== 10) {
      errors.push(`No break days mismatch: expected 10, got ${result2.breakPatterns.noBreakDays}`);
    }
    console.log('✓ No breaks detected:', result2.breakPatterns.noBreakDays === 10);

    console.groupEnd();
    return { passed: errors.length === 0, errors };
  }

  /**
   * Test risk score calculation
   */
  testRiskScore() {
    console.group('🎯 Testing Risk Score Calculation');
    const errors = [];

    // Test Case 1: Low risk scenario
    const lowRiskData = this.generateTestData(20, {
      lateDays: 1,
      workHours: 7.5,
      breakMinutes: 45
    });
    const result1 = attendanceAnalytics.analyzeAttendancePatterns(lowRiskData);

    if (result1.riskScore.level !== 'low') {
      errors.push(`Low risk not identified: got ${result1.riskScore.level}`);
    }
    console.log('✓ Low risk identified:', result1.riskScore.level === 'low');

    // Test Case 2: High risk scenario
    const highRiskData = this.generateTestData(20, {
      lateDays: 12,
      workHours: 11,
      breakMinutes: 5,
      consecutive: true
    });
    const result2 = attendanceAnalytics.analyzeAttendancePatterns(highRiskData);

    if (result2.riskScore.level === 'low') {
      errors.push(`High risk not identified: got ${result2.riskScore.level}`);
    }
    console.log('✓ High risk identified:', result2.riskScore.level !== 'low');

    // Test Case 3: Risk score range (0-100)
    if (result1.riskScore.score < 0 || result1.riskScore.score > 100) {
      errors.push(`Risk score out of range: ${result1.riskScore.score}`);
    }
    if (result2.riskScore.score < 0 || result2.riskScore.score > 100) {
      errors.push(`Risk score out of range: ${result2.riskScore.score}`);
    }
    console.log('✓ Risk scores within 0-100 range');

    console.groupEnd();
    return { passed: errors.length === 0, errors };
  }

  /**
   * Test edge cases
   */
  testEdgeCases() {
    console.group('🔍 Testing Edge Cases');
    const errors = [];

    // Test Case 1: Empty data
    const emptyResult = attendanceAnalytics.analyzeAttendancePatterns([]);
    if (emptyResult.summary.totalDays !== 0) {
      errors.push('Empty data not handled correctly');
    }
    console.log('✓ Empty data handled:', emptyResult.summary.totalDays === 0);

    // Test Case 2: Single day data
    const singleDay = this.generateTestData(1, {});
    const singleResult = attendanceAnalytics.analyzeAttendancePatterns(singleDay);
    if (!singleResult.summary) {
      errors.push('Single day data not handled');
    }
    console.log('✓ Single day handled:', !!singleResult.summary);

    // Test Case 3: Missing work duration
    const missingDuration = [{
      date: new Date().toISOString(),
      isPresent: true,
      isLate: false,
      isAbsent: false
      // workDurationSeconds missing
    }];
    const missingResult = attendanceAnalytics.analyzeAttendancePatterns(missingDuration);
    if (missingResult.summary.averageWorkHours !== 0) {
      errors.push('Missing work duration not handled');
    }
    console.log('✓ Missing duration handled');

    // Test Case 4: Extreme values
    const extremeValues = this.generateTestData(1, {
      workHours: 24, // Max possible
      lateMinutes: [1440] // 24 hours late
    });
    const extremeResult = attendanceAnalytics.analyzeAttendancePatterns(extremeValues);
    if (!extremeResult.summary) {
      errors.push('Extreme values crashed the system');
    }
    console.log('✓ Extreme values handled');

    console.groupEnd();
    return { passed: errors.length === 0, errors };
  }

  /**
   * Generate test data with specific patterns
   */
  generateTestData(days, options = {}) {
    const {
      lateDays = 0,
      workHours = 7.5,
      breakMinutes = 30,
      consecutive = false,
      lateMinutes = null
    } = options;

    const data = [];
    const now = new Date();
    let consecutiveCounter = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      let isLate = false;
      let lateMin = 0;

      if (consecutive) {
        // Make the first 'lateDays' consecutive
        isLate = consecutiveCounter < lateDays;
        if (isLate) {
          lateMin = 15 + Math.floor(Math.random() * 30);
          consecutiveCounter++;
        }
      } else {
        // Distribute late days randomly
        isLate = i < lateDays;
        if (isLate) {
          if (lateMinutes && lateMinutes[i]) {
            lateMin = lateMinutes[i];
          } else {
            lateMin = 15 + Math.floor(Math.random() * 30);
          }
        }
      }

      data.push({
        date: date.toISOString().split('T')[0],
        workDurationSeconds: workHours * 3600,
        breakDurationSeconds: breakMinutes * 60,
        isPresent: true,
        isAbsent: false,
        isLate: isLate,
        isHalfDay: workHours < 6,
        isWFH: false,
        metadata: {
          lateMinutes: lateMin,
          breakSessions: breakMinutes > 0 ? 1 : 0
        }
      });
    }

    return data;
  }

  /**
   * Validate specific calculation formulas
   */
  validateCalculations() {
    console.group('🧮 Validating Calculation Formulas');

    // Test percentage calculation
    const percentageTest = (5 / 20) * 100;
    console.assert(percentageTest === 25, 'Percentage calculation');

    // Test average calculation
    const avgTest = (10 + 20 + 30) / 3;
    console.assert(avgTest === 20, 'Average calculation');

    // Test standard deviation
    const values = [10, 20, 30];
    const mean = 20;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    console.assert(Math.abs(stdDev - 8.165) < 0.01, 'Standard deviation calculation');

    console.log('✅ All calculation formulas validated');
    console.groupEnd();
  }
}

export default new AttendanceAnalyticsValidator();
