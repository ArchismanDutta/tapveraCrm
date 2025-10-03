// scripts/migrateToNewAttendanceSystem.js
// DEPRECATED: DailyWork model has been removed
// Migration script to convert from old UserStatus system to new date-centric AttendanceRecord system

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const UserStatus = require('../models/UserStatus');
// const DailyWork = require('../models/DailyWork'); // REMOVED
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');

class AttendanceMigration {
  constructor() {
    this.stats = {
      totalOldRecords: 0,
      totalNewRecords: 0,
      migratedEmployees: 0,
      errors: [],
      duplicates: 0,
      warnings: []
    };
  }

  async connectToDatabase() {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✓ Connected to MongoDB');
    } catch (error) {
      console.error('✗ Failed to connect to MongoDB:', error);
      process.exit(1);
    }
  }

  async runMigration() {
    console.log('\n🚀 Starting migration to new date-centric attendance system...\n');

    try {
      // Step 1: Analyze existing data
      await this.analyzeExistingData();

      // Step 2: Create migration plan
      await this.createMigrationPlan();

      // Step 3: Execute migration
      await this.executeMigration();

      // Step 4: Verify migration
      await this.verifyMigration();

      // Step 5: Generate report
      await this.generateReport();

    } catch (error) {
      console.error('✗ Migration failed:', error);
      this.stats.errors.push(`Fatal error: ${error.message}`);
    } finally {
      await this.cleanup();
    }
  }

  async analyzeExistingData() {
    console.log('📊 Analyzing existing attendance data...');

    // Count UserStatus records
    const userStatusCount = await UserStatus.countDocuments();
    console.log(`   Found ${userStatusCount} UserStatus records`);

    // Count DailyWork records
    const dailyWorkCount = await DailyWork.countDocuments();
    console.log(`   Found ${dailyWorkCount} DailyWork records`);

    this.stats.totalOldRecords = userStatusCount + dailyWorkCount;

    // Get date range
    const oldestUserStatus = await UserStatus.findOne().sort({ today: 1 });
    const newestUserStatus = await UserStatus.findOne().sort({ today: -1 });

    if (oldestUserStatus && newestUserStatus) {
      console.log(`   UserStatus date range: ${oldestUserStatus.today.toDateString()} to ${newestUserStatus.today.toDateString()}`);
    }

    const oldestDailyWork = await DailyWork.findOne().sort({ date: 1 });
    const newestDailyWork = await DailyWork.findOne().sort({ date: -1 });

    if (oldestDailyWork && newestDailyWork) {
      console.log(`   DailyWork date range: ${oldestDailyWork.date.toDateString()} to ${newestDailyWork.date.toDateString()}`);
    }

    // Check for existing AttendanceRecord data
    const existingAttendanceCount = await AttendanceRecord.countDocuments();
    if (existingAttendanceCount > 0) {
      console.log(`   ⚠️  Found ${existingAttendanceCount} existing AttendanceRecord documents`);
      this.stats.warnings.push(`${existingAttendanceCount} existing AttendanceRecord documents found`);
    }

    console.log('✓ Analysis complete\n');
  }

  async createMigrationPlan() {
    console.log('📋 Creating migration plan...');

    // Get all unique dates from both collections
    const userStatusDates = await UserStatus.distinct('today');
    const dailyWorkDates = await DailyWork.distinct('date');

    // Combine and deduplicate dates
    const allDates = [...new Set([
      ...userStatusDates.map(d => d.toDateString()),
      ...dailyWorkDates.map(d => d.toDateString())
    ])].map(dateStr => new Date(dateStr));

    console.log(`   Planning to migrate ${allDates.length} unique dates`);
    console.log(`   Date range: ${Math.min(...allDates).toDateString()} to ${Math.max(...allDates).toDateString()}`);

    this.migrationDates = allDates.sort((a, b) => a - b);
    console.log('✓ Migration plan created\n');
  }

  async executeMigration() {
    console.log('⚙️  Executing migration...');

    let processedDates = 0;
    const batchSize = 10; // Process dates in batches

    for (let i = 0; i < this.migrationDates.length; i += batchSize) {
      const batch = this.migrationDates.slice(i, i + batchSize);

      console.log(`   Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.migrationDates.length/batchSize)} (${batch.length} dates)`);

      for (const date of batch) {
        try {
          await this.migrateDateData(date);
          processedDates++;

          if (processedDates % 20 === 0) {
            console.log(`   Processed ${processedDates}/${this.migrationDates.length} dates...`);
          }
        } catch (error) {
          this.stats.errors.push(`Error migrating date ${date.toDateString()}: ${error.message}`);
          console.log(`   ✗ Error migrating ${date.toDateString()}: ${error.message}`);
        }
      }

      // Small delay between batches to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✓ Migration execution complete (${processedDates} dates processed)\n`);
  }

  async migrateDateData(date) {
    const normalizedDate = this.normalizeDate(date);

    // Check if AttendanceRecord already exists for this date
    const existingRecord = await AttendanceRecord.findOne({ date: normalizedDate });
    if (existingRecord) {
      this.stats.duplicates++;
      return; // Skip if already exists
    }

    // Get all UserStatus records for this date
    const userStatuses = await UserStatus.find({
      today: {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }).populate('userId', 'name email department');

    // Get all DailyWork records for this date
    const dailyWorks = await DailyWork.find({
      date: {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }).populate('userId', 'name email department');

    // Combine data by userId
    const employeeMap = new Map();

    // Process UserStatus records
    for (const status of userStatuses) {
      if (!status.userId) continue;

      const userId = status.userId._id;
      const employeeData = this.convertUserStatusToNewFormat(status);
      employeeMap.set(userId.toString(), employeeData);
    }

    // Process DailyWork records (merge with existing or create new)
    for (const work of dailyWorks) {
      if (!work.userId) continue;

      const userId = work.userId._id;
      const userIdStr = userId.toString();

      if (employeeMap.has(userIdStr)) {
        // Merge with existing UserStatus data
        const existing = employeeMap.get(userIdStr);
        const merged = this.mergeDailyWorkData(existing, work);
        employeeMap.set(userIdStr, merged);
      } else {
        // Create new from DailyWork only
        const employeeData = this.convertDailyWorkToNewFormat(work);
        employeeMap.set(userIdStr, employeeData);
      }
    }

    // Create new AttendanceRecord if we have any employee data
    if (employeeMap.size > 0) {
      const employees = Array.from(employeeMap.values());

      const attendanceRecord = new AttendanceRecord({
        date: normalizedDate,
        employees: employees,
        dailyStats: this.calculateDailyStats(employees),
        departmentStats: this.calculateDepartmentStats(employees),
        specialDay: await this.getSpecialDayInfo(normalizedDate)
      });

      await attendanceRecord.save();
      this.stats.totalNewRecords++;
      this.stats.migratedEmployees += employees.length;
    }
  }

  convertUserStatusToNewFormat(status) {
    // Convert timeline events to new format
    const events = [];

    if (status.timeline && Array.isArray(status.timeline)) {
      for (const event of status.timeline) {
        const eventType = this.convertEventType(event.type);
        if (eventType) {
          events.push({
            type: eventType,
            timestamp: new Date(event.time),
            manual: false
          });
        }
      }
    }

    return {
      userId: status.userId._id,
      events: events,
      calculated: {
        arrivalTime: status.arrivalTime,
        departureTime: null, // Will be calculated from events
        workDurationSeconds: status.workDurationSeconds || 0,
        breakDurationSeconds: status.breakDurationSeconds || 0,
        totalDurationSeconds: (status.workDurationSeconds || 0) + (status.breakDurationSeconds || 0),
        workDuration: status.workDuration || '0h 0m',
        breakDuration: status.breakDuration || '0h 0m',
        totalDuration: this.formatDuration((status.workDurationSeconds || 0) + (status.breakDurationSeconds || 0)),
        isPresent: !status.isAbsent,
        isAbsent: status.isAbsent || false,
        isLate: status.isLate || false,
        isHalfDay: status.isHalfDay || false,
        isFullDay: (status.workDurationSeconds || 0) >= 8 * 3600,
        isOvertime: (status.workDurationSeconds || 0) > 12 * 3600,
        currentlyWorking: status.currentlyWorking || false,
        onBreak: status.onBreak || false,
        currentStatus: this.determineCurrentStatus(status),
        totalWorkSessions: status.workedSessions ? status.workedSessions.length : 0,
        totalBreakSessions: status.breakSessions ? status.breakSessions.length : 0,
        longestWorkSession: this.calculateLongestSession(status.workedSessions),
        longestBreakSession: this.calculateLongestSession(status.breakSessions)
      },
      assignedShift: this.extractShiftInfo(status),
      leaveInfo: {
        isOnLeave: false, // Will be updated if leave data is found
        leaveType: null,
        isHoliday: false,
        holidayName: null
      },
      performance: {
        punctualityScore: status.isLate ? 70 : 100,
        attendanceScore: status.isAbsent ? 0 : (status.isHalfDay ? 50 : 100),
        productivityHours: (status.workDurationSeconds || 0) / 3600,
        efficiencyRating: this.calculateEfficiencyFromOldData(status)
      },
      metadata: {
        lastUpdated: new Date(),
        version: 1,
        syncStatus: 'SYNCED',
        migratedFrom: 'UserStatus'
      }
    };
  }

  convertDailyWorkToNewFormat(work) {
    // Convert timeline events to new format
    const events = [];

    if (work.timeline && Array.isArray(work.timeline)) {
      for (const event of work.timeline) {
        const eventType = this.convertEventType(event.type);
        if (eventType) {
          events.push({
            type: eventType,
            timestamp: new Date(event.time),
            manual: false
          });
        }
      }
    }

    return {
      userId: work.userId._id,
      events: events,
      calculated: {
        arrivalTime: work.arrivalTime,
        departureTime: work.departureTime,
        workDurationSeconds: work.workDurationSeconds || 0,
        breakDurationSeconds: work.breakDurationSeconds || 0,
        totalDurationSeconds: (work.workDurationSeconds || 0) + (work.breakDurationSeconds || 0),
        workDuration: this.formatDuration(work.workDurationSeconds || 0),
        breakDuration: this.formatDuration(work.breakDurationSeconds || 0),
        totalDuration: this.formatDuration((work.workDurationSeconds || 0) + (work.breakDurationSeconds || 0)),
        isPresent: !work.isAbsent,
        isAbsent: work.isAbsent || false,
        isLate: work.isLate || false,
        isHalfDay: work.isHalfDay || false,
        isFullDay: (work.workDurationSeconds || 0) >= 8 * 3600,
        isOvertime: (work.workDurationSeconds || 0) > 12 * 3600,
        currentlyWorking: false, // DailyWork represents completed days
        onBreak: false,
        currentStatus: 'FINISHED',
        totalWorkSessions: work.workedSessions ? work.workedSessions.length : 0,
        totalBreakSessions: work.breakSessions ? work.breakSessions.length : 0,
        longestWorkSession: this.calculateLongestSession(work.workedSessions),
        longestBreakSession: this.calculateLongestSession(work.breakSessions)
      },
      assignedShift: work.shift || {
        name: 'Day Shift',
        startTime: '09:00',
        endTime: '18:00',
        durationHours: 9,
        isFlexible: false,
        type: 'STANDARD'
      },
      leaveInfo: {
        isOnLeave: work.isOnLeave || false,
        leaveType: null,
        isHoliday: work.isHoliday || false,
        holidayName: null
      },
      performance: {
        punctualityScore: work.isLate ? 70 : 100,
        attendanceScore: work.isAbsent ? 0 : (work.isHalfDay ? 50 : 100),
        productivityHours: (work.workDurationSeconds || 0) / 3600,
        efficiencyRating: work.productivity ? work.productivity.efficiency / 20 : 3 // Convert 0-100 to 0-5
      },
      metadata: {
        lastUpdated: new Date(),
        version: 1,
        syncStatus: 'SYNCED',
        migratedFrom: 'DailyWork'
      }
    };
  }

  mergeDailyWorkData(userStatusData, dailyWork) {
    // Merge DailyWork data into UserStatus data (DailyWork takes precedence for calculated fields)
    return {
      ...userStatusData,
      calculated: {
        ...userStatusData.calculated,
        departureTime: dailyWork.departureTime || userStatusData.calculated.departureTime,
        // Use DailyWork values if they seem more complete
        workDurationSeconds: dailyWork.workDurationSeconds || userStatusData.calculated.workDurationSeconds,
        breakDurationSeconds: dailyWork.breakDurationSeconds || userStatusData.calculated.breakDurationSeconds,
        isAbsent: dailyWork.isAbsent !== undefined ? dailyWork.isAbsent : userStatusData.calculated.isAbsent,
        isLate: dailyWork.isLate !== undefined ? dailyWork.isLate : userStatusData.calculated.isLate,
        isHalfDay: dailyWork.isHalfDay !== undefined ? dailyWork.isHalfDay : userStatusData.calculated.isHalfDay,
        currentStatus: 'FINISHED' // If we have DailyWork, the day is completed
      },
      leaveInfo: {
        ...userStatusData.leaveInfo,
        isOnLeave: dailyWork.isOnLeave || userStatusData.leaveInfo.isOnLeave,
        isHoliday: dailyWork.isHoliday || userStatusData.leaveInfo.isHoliday
      },
      assignedShift: dailyWork.shift || userStatusData.assignedShift,
      metadata: {
        ...userStatusData.metadata,
        migratedFrom: 'UserStatus+DailyWork'
      }
    };
  }

  convertEventType(oldType) {
    if (!oldType) return null;

    const type = oldType.toLowerCase();
    if (type.includes('punch in') || type === 'punchin') return 'PUNCH_IN';
    if (type.includes('punch out') || type === 'punchout') return 'PUNCH_OUT';
    if (type.includes('break start') || type.includes('breakstart')) return 'BREAK_START';
    if (type.includes('resume work') || type.includes('break end')) return 'BREAK_END';

    return null; // Unknown event type
  }

  determineCurrentStatus(status) {
    if (status.currentlyWorking) return 'WORKING';
    if (status.onBreak) return 'ON_BREAK';
    if (status.arrivalTime) return 'FINISHED';
    return 'NOT_STARTED';
  }

  calculateLongestSession(sessions) {
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) return 0;

    let longest = 0;
    for (const session of sessions) {
      if (session.start && session.end) {
        const duration = (new Date(session.end) - new Date(session.start)) / 1000;
        longest = Math.max(longest, duration);
      }
    }
    return Math.round(longest);
  }

  extractShiftInfo(status) {
    // Try to extract shift information from UserStatus
    return {
      name: 'Day Shift',
      startTime: '09:00',
      endTime: '18:00',
      durationHours: 9,
      isFlexible: status.flexibleRequest || false,
      type: status.flexibleRequest ? 'FLEXIBLE' : 'STANDARD'
    };
  }

  calculateEfficiencyFromOldData(status) {
    const workHours = (status.workDurationSeconds || 0) / 3600;
    const breakHours = (status.breakDurationSeconds || 0) / 3600;

    if (workHours === 0) return 1;

    const breakRatio = breakHours / workHours;
    let rating = 5;

    if (breakRatio > 0.15) rating -= 0.5;
    if (breakRatio > 0.25) rating -= 0.5;
    if (workHours < 6) rating -= 0.5;
    if (workHours < 4) rating -= 1;

    return Math.max(1, Math.min(5, rating));
  }

  calculateDailyStats(employees) {
    return {
      totalEmployees: employees.length,
      present: employees.filter(e => e.calculated.isPresent).length,
      absent: employees.filter(e => e.calculated.isAbsent).length,
      late: employees.filter(e => e.calculated.isLate).length,
      halfDay: employees.filter(e => e.calculated.isHalfDay).length,
      fullDay: employees.filter(e => e.calculated.isFullDay).length,
      onLeave: employees.filter(e => e.leaveInfo.isOnLeave).length,
      onHoliday: employees.filter(e => e.leaveInfo.isHoliday).length,
      currentlyWorking: employees.filter(e => e.calculated.currentlyWorking).length,
      onBreak: employees.filter(e => e.calculated.onBreak).length,
      finished: employees.filter(e => e.calculated.currentStatus === 'FINISHED').length,
      totalWorkHours: employees.reduce((sum, e) => sum + (e.calculated.workDurationSeconds / 3600), 0),
      totalBreakHours: employees.reduce((sum, e) => sum + (e.calculated.breakDurationSeconds / 3600), 0),
      averageWorkHours: employees.length > 0 ?
        employees.reduce((sum, e) => sum + (e.calculated.workDurationSeconds / 3600), 0) / employees.length : 0,
      averagePunctualityScore: employees.length > 0 ?
        employees.reduce((sum, e) => sum + e.performance.punctualityScore, 0) / employees.length : 0,
      averageAttendanceScore: employees.length > 0 ?
        employees.reduce((sum, e) => sum + e.performance.attendanceScore, 0) / employees.length : 0,
      totalOvertimeHours: employees.reduce((sum, e) => e.calculated.isOvertime ? sum + Math.max(0, (e.calculated.workDurationSeconds / 3600) - 12) : sum, 0)
    };
  }

  calculateDepartmentStats(employees) {
    const deptMap = new Map();

    for (const employee of employees) {
      // Note: Department info might not be available in migrated data
      const dept = 'Unknown'; // Would need to populate from User model

      if (!deptMap.has(dept)) {
        deptMap.set(dept, { total: 0, present: 0, totalHours: 0 });
      }

      const stats = deptMap.get(dept);
      stats.total++;
      if (employee.calculated.isPresent) stats.present++;
      stats.totalHours += employee.calculated.workDurationSeconds / 3600;
    }

    return Array.from(deptMap.entries()).map(([deptName, stats]) => ({
      departmentName: deptName,
      totalEmployees: stats.total,
      present: stats.present,
      absent: stats.total - stats.present,
      averageHours: stats.total > 0 ? stats.totalHours / stats.total : 0
    }));
  }

  async getSpecialDayInfo(date) {
    const dayOfWeek = date.getDay();
    return {
      isHoliday: false, // Would need to check Holiday model
      holidayName: null,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isWorkingDay: dayOfWeek !== 0 && dayOfWeek !== 6
    };
  }

  async verifyMigration() {
    console.log('🔍 Verifying migration...');

    const newRecordCount = await AttendanceRecord.countDocuments();
    console.log(`   Created ${newRecordCount} AttendanceRecord documents`);

    // Sample verification
    const sampleRecords = await AttendanceRecord.find({}).limit(5);
    for (const record of sampleRecords) {
      console.log(`   Sample: ${record.date.toDateString()} - ${record.employees.length} employees`);
    }

    // Check for data integrity
    const recordsWithoutEmployees = await AttendanceRecord.countDocuments({ 'employees.0': { $exists: false } });
    if (recordsWithoutEmployees > 0) {
      this.stats.warnings.push(`${recordsWithoutEmployees} AttendanceRecord documents have no employees`);
    }

    console.log('✓ Verification complete\n');
  }

  async generateReport() {
    console.log('📝 Migration Report');
    console.log('==================');
    console.log(`Total old records processed: ${this.stats.totalOldRecords}`);
    console.log(`New AttendanceRecord documents created: ${this.stats.totalNewRecords}`);
    console.log(`Total employees migrated: ${this.stats.migratedEmployees}`);
    console.log(`Duplicate dates skipped: ${this.stats.duplicates}`);
    console.log(`Warnings: ${this.stats.warnings.length}`);
    console.log(`Errors: ${this.stats.errors.length}`);

    if (this.stats.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.stats.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    if (this.stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.stats.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test the new attendance system thoroughly');
    console.log('2. Update your application to use /api/attendance-new routes');
    console.log('3. Once satisfied, you can archive/remove old UserStatus and DailyWork collections');
    console.log('4. Update your frontend to use the new API endpoints');
  }

  async cleanup() {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n✓ Database connection closed');
    }
  }

  // Helper methods
  normalizeDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  formatDuration(seconds) {
    if (!seconds || seconds < 0) return "0h 0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

// Main execution
async function runMigration() {
  const migration = new AttendanceMigration();
  await migration.connectToDatabase();
  await migration.runMigration();
}

// Run if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = AttendanceMigration;