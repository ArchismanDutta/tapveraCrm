// Recalculate ALL existing attendance records with the new fixed logic
const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceService = require('../services/AttendanceService');
const User = require('../models/User');
const Shift = require('../models/Shift');
require('dotenv').config();

async function recalculateAllAttendance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const attendanceService = new AttendanceService();

    // Get all attendance records
    const records = await AttendanceRecord.find({}).sort({ date: -1 });

    console.log('='  .repeat(100));
    console.log(`📊 RECALCULATING ALL ATTENDANCE RECORDS: ${records.length} found`);
    console.log('='  .repeat(100));

    let totalRecords = 0;
    let totalEmployees = 0;
    let totalRecalculated = 0;

    for (const record of records) {
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      totalRecords++;

      console.log(`\n📅 Processing date: ${dateStr} (${record.employees.length} employees)`);

      for (const employee of record.employees) {
        totalEmployees++;

        try {
          // Get user to check if they exist
          const user = await User.findById(employee.userId);
          if (!user) {
            console.log(`   ⚠️  Skipping - User not found: ${employee.userId}`);
            continue;
          }

          console.log(`   👤 ${user.name}`);

          // Store old values for comparison
          const oldIsLate = employee.calculated?.isLate;
          const oldShift = employee.assignedShift;

          // Get fresh shift data for this date
          const freshShift = await attendanceService.getUserShift(employee.userId, record.date);
          employee.assignedShift = freshShift;

          console.log(`      Old shift: ${oldShift?.startTime || 'N/A'} - ${oldShift?.endTime || 'N/A'}`);
          console.log(`      New shift: ${freshShift?.startTime || 'N/A'} - ${freshShift?.endTime || 'N/A'}`);

          // Recalculate with the attendance date (THIS IS THE FIX!)
          attendanceService.recalculateEmployeeData(employee, record.date);

          const newIsLate = employee.calculated?.isLate;

          if (oldIsLate !== newIsLate) {
            console.log(`      ⚡ CHANGED: Late status ${oldIsLate ? 'YES' : 'NO'} → ${newIsLate ? 'YES' : 'NO'}`);
            totalRecalculated++;
          } else {
            console.log(`      ✅ Unchanged: Late = ${newIsLate ? 'YES' : 'NO'}`);
          }

        } catch (error) {
          console.error(`   ❌ Error processing employee ${employee.userId}:`, error.message);
        }
      }

      // Update daily stats
      attendanceService.updateDailyStats(record);

      // Save the record
      await record.save();
      console.log(`   💾 Saved record for ${dateStr}`);
    }

    console.log('\n\n' + '='.repeat(100));
    console.log('📊 RECALCULATION COMPLETE');
    console.log('='.repeat(100));
    console.log(`   Total Records Processed: ${totalRecords}`);
    console.log(`   Total Employees Processed: ${totalEmployees}`);
    console.log(`   Total Changed: ${totalRecalculated}`);
    console.log('='  .repeat(100));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

recalculateAllAttendance();
