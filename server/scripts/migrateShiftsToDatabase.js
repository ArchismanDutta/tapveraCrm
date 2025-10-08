/**
 * Migration Script: Migrate Hardcoded Shifts to Database
 *
 * This script:
 * 1. Creates default shifts in the Shift collection if they don't exist
 * 2. Updates all existing users with legacy shift data to reference the new Shift documents
 * 3. Ensures data consistency between user.shift and user.assignedShift
 *
 * Run with: node server/scripts/migrateShiftsToDatabase.js
 */

const mongoose = require('mongoose');
const Shift = require('../models/Shift');
const User = require('../models/User');

// Database connection (adjust as needed)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database-name';

// Default shifts to create
const DEFAULT_SHIFTS = [
  {
    name: "Morning Shift",
    start: "09:00",
    end: "18:00",
    durationHours: 9,
    description: "Standard morning shift 9 AM to 6 PM",
    isFlexible: false,
    isActive: true
  },
  {
    name: "Evening Shift",
    start: "20:00",
    end: "05:00",
    durationHours: 9,
    description: "Evening shift 8 PM to 5 AM (next day)",
    isFlexible: false,
    isActive: true
  },
  {
    name: "Night Shift",
    start: "05:30",
    end: "14:20",
    durationHours: 8.83,
    description: "Night shift 5:30 AM to 2:20 PM",
    isFlexible: false,
    isActive: true
  },
  {
    name: "Early Shift",
    start: "05:30",
    end: "14:20",
    durationHours: 8.83,
    description: "Early shift 5:30 AM to 2:20 PM (same as Night Shift)",
    isFlexible: false,
    isActive: true
  }
];

async function migrateShifts() {
  try {
    console.log('🔄 Starting shift migration...\n');

    // Connect to database
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to database\n');

    // Step 1: Create default shifts if they don't exist
    console.log('📋 Step 1: Creating default shifts...');
    const shiftMap = new Map(); // Maps shift name to shift ID

    for (const shiftData of DEFAULT_SHIFTS) {
      let shift = await Shift.findOne({ name: shiftData.name });

      if (!shift) {
        shift = new Shift(shiftData);
        await shift.save();
        console.log(`   ✅ Created shift: ${shift.name} (${shift.start} - ${shift.end})`);
      } else {
        console.log(`   ℹ️  Shift already exists: ${shift.name}`);
      }

      shiftMap.set(shift.name, shift._id);

      // Also map by start time for matching
      shiftMap.set(`${shift.start}-${shift.end}`, shift._id);
    }

    console.log(`\n✅ Total shifts in database: ${shiftMap.size / 2}\n`);

    // Step 2: Migrate existing users
    console.log('👥 Step 2: Migrating existing users...');

    const users = await User.find({});
    console.log(`   Found ${users.length} users to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let flexibleCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Skip if already has assignedShift reference
        if (user.assignedShift) {
          console.log(`   ⏭️  Skipping ${user.name} (${user.employeeId}) - already has assignedShift`);
          skippedCount++;
          continue;
        }

        // Handle flexible permanent employees
        if (user.shiftType === 'flexiblePermanent' || user.shift?.isFlexible) {
          user.shiftType = 'flexiblePermanent';
          user.assignedShift = null;
          user.shift = {
            name: "Flexible 9h/day",
            start: "00:00",
            end: "23:59",
            durationHours: 9,
            isFlexible: true,
            shiftId: null
          };
          await user.save();
          console.log(`   ✅ Migrated ${user.name} (${user.employeeId}) - Flexible Permanent`);
          flexibleCount++;
          continue;
        }

        // Handle standard shift employees
        if (user.shift?.start && user.shift?.end) {
          // Try to find matching shift by time
          const timeKey = `${user.shift.start}-${user.shift.end}`;
          let shiftId = shiftMap.get(timeKey);

          // If not found by time, try by name
          if (!shiftId && user.shift.name) {
            shiftId = shiftMap.get(user.shift.name);
          }

          if (shiftId) {
            const shift = await Shift.findById(shiftId);
            user.shiftType = 'standard';
            user.assignedShift = shiftId;
            user.shift = {
              name: shift.name,
              start: shift.start,
              end: shift.end,
              durationHours: shift.durationHours,
              isFlexible: false,
              shiftId: shiftId
            };
            await user.save();
            console.log(`   ✅ Migrated ${user.name} (${user.employeeId}) - ${shift.name}`);
            migratedCount++;
          } else {
            console.log(`   ⚠️  No matching shift found for ${user.name} (${user.employeeId}) - ${user.shift.name || 'unnamed'} (${user.shift.start}-${user.shift.end})`);
            console.log(`       You may need to create a custom shift or manually assign this user`);
            skippedCount++;
          }
        } else {
          console.log(`   ⚠️  ${user.name} (${user.employeeId}) has no shift data - skipping`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error migrating ${user.name} (${user.employeeId}):`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total users processed:     ${users.length}`);
    console.log(`✅ Migrated (standard):    ${migratedCount}`);
    console.log(`✅ Migrated (flexible):    ${flexibleCount}`);
    console.log(`⏭️  Skipped:                ${skippedCount}`);
    console.log(`❌ Errors:                 ${errorCount}`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration completed successfully!\n');

    // Verification
    console.log('🔍 Verification:');
    const usersWithAssignedShift = await User.countDocuments({ assignedShift: { $ne: null } });
    const usersWithFlexible = await User.countDocuments({ shiftType: 'flexiblePermanent' });
    const usersWithoutShift = await User.countDocuments({
      assignedShift: null,
      shiftType: { $ne: 'flexiblePermanent' }
    });

    console.log(`   Users with assigned shifts: ${usersWithAssignedShift}`);
    console.log(`   Users with flexible shifts: ${usersWithFlexible}`);
    console.log(`   Users without shifts: ${usersWithoutShift}`);

    if (usersWithoutShift > 0) {
      console.log('\n⚠️  Warning: Some users still don\'t have shifts assigned.');
      console.log('   You may need to assign shifts manually through the shift management page.\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
}

// Run migration
if (require.main === module) {
  migrateShifts()
    .then(() => {
      console.log('✅ All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = migrateShifts;
