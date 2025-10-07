// scripts/verifyShiftAssignments.js
// Script to verify all users have correct shift assignments

const mongoose = require('mongoose');
const User = require('../models/User');
const Shift = require('../models/Shift');
require('dotenv').config();

async function verifyShiftAssignments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all active users
    const users = await User.find({ isActive: { $ne: false } })
      .populate('assignedShift')
      .select('name email department role shiftType assignedShift shift');

    console.log(`Found ${users.length} active users\n`);
    console.log('='  .repeat(100));

    const issues = [];
    const byShiftType = {
      noShift: [],
      morningShift: [],
      nightShift: [],
      eveningShift: [],
      earlyShift: [],
      flexibleShift: [],
      undefined: []
    };

    for (const user of users) {
      const effectiveShift = await user.getEffectiveShift(new Date());

      console.log(`\n👤 ${user.name} (${user.email})`);
      console.log(`   Department: ${user.department || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Shift Type: ${user.shiftType || 'N/A'}`);

      // Check assigned shift
      if (user.assignedShift) {
        console.log(`   ✅ Assigned Shift: ${user.assignedShift.name} (${user.assignedShift.start} - ${user.assignedShift.end})`);
      } else {
        console.log(`   ⚠️  No Assigned Shift (using assignedShift field)`);
      }

      // Check legacy shift
      if (user.shift && user.shift.start) {
        console.log(`   📜 Legacy Shift: ${user.shift.name || 'Unnamed'} (${user.shift.start} - ${user.shift.end})`);
      }

      // Check effective shift
      if (effectiveShift) {
        console.log(`   🎯 Effective Shift: ${effectiveShift.name} (${effectiveShift.start} - ${effectiveShift.end})`);
        console.log(`      Source: ${effectiveShift.source || 'unknown'}`);
        console.log(`      Is Flexible: ${effectiveShift.isFlexible || false}`);

        // Categorize by shift time
        const startTime = effectiveShift.start;
        if (startTime === '09:00' || startTime === '9:00') {
          byShiftType.morningShift.push(user.name);
        } else if (startTime === '20:00') {
          byShiftType.nightShift.push(user.name);
        } else if (startTime === '13:00') {
          byShiftType.eveningShift.push(user.name);
        } else if (startTime === '05:30') {
          byShiftType.earlyShift.push(user.name);
        } else if (effectiveShift.isFlexible) {
          byShiftType.flexibleShift.push(user.name);
        } else {
          byShiftType.undefined.push(user.name);
        }
      } else {
        console.log(`   ❌ NO EFFECTIVE SHIFT FOUND!`);
        byShiftType.noShift.push(user.name);
        issues.push({
          user: user.name,
          email: user.email,
          issue: 'No effective shift found',
          willFallbackTo: 'Morning Shift (09:00-18:00)'
        });
      }

      // Check for potential issues
      if (!user.assignedShift && (!user.shift || !user.shift.start)) {
        issues.push({
          user: user.name,
          email: user.email,
          issue: 'No shift configured (neither assignedShift nor legacy shift)',
          willFallbackTo: 'Morning Shift (09:00-18:00)'
        });
      }

      if (user.shiftType === 'standard' && !user.assignedShift) {
        issues.push({
          user: user.name,
          email: user.email,
          issue: 'ShiftType is "standard" but no assignedShift reference',
          willFallbackTo: 'Legacy shift or Morning Shift'
        });
      }

      console.log('-'.repeat(100));
    }

    // Summary
    console.log('\n\n');
    console.log('='  .repeat(100));
    console.log('📊 SUMMARY');
    console.log('='  .repeat(100));

    console.log(`\n🕐 Shift Distribution:`);
    console.log(`   Morning Shift (09:00): ${byShiftType.morningShift.length} users`);
    console.log(`   Night Shift (20:00): ${byShiftType.nightShift.length} users`);
    console.log(`   Evening Shift (13:00): ${byShiftType.eveningShift.length} users`);
    console.log(`   Early Shift (05:30): ${byShiftType.earlyShift.length} users`);
    console.log(`   Flexible Shift: ${byShiftType.flexibleShift.length} users`);
    console.log(`   Undefined/Other: ${byShiftType.undefined.length} users`);
    console.log(`   ❌ No Shift: ${byShiftType.noShift.length} users`);

    if (byShiftType.nightShift.length > 0) {
      console.log(`\n🌙 Night Shift Users:`);
      byShiftType.nightShift.forEach(name => console.log(`   - ${name}`));
    }

    if (byShiftType.noShift.length > 0) {
      console.log(`\n⚠️  Users with NO shift (will default to Morning 09:00):`);
      byShiftType.noShift.forEach(name => console.log(`   - ${name}`));
    }

    if (issues.length > 0) {
      console.log(`\n\n❌ ISSUES FOUND (${issues.length}):`);
      console.log('='  .repeat(100));
      issues.forEach((issue, idx) => {
        console.log(`\n${idx + 1}. ${issue.user} (${issue.email})`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Impact: ${issue.willFallbackTo}`);
        console.log(`   ⚠️  This user may show as "late" even if punching in on time!`);
      });
    } else {
      console.log('\n\n✅ No issues found! All users have proper shift assignments.');
    }

    // Check for night shift late detection issue
    if (byShiftType.nightShift.length > 0) {
      console.log('\n\n🔍 NIGHT SHIFT LATE DETECTION CHECK:');
      console.log('='  .repeat(100));
      console.log('For each night shift user, checking if they will be marked late correctly:\n');

      for (const name of byShiftType.nightShift) {
        const user = users.find(u => u.name === name);
        const effectiveShift = await user.getEffectiveShift(new Date());

        console.log(`👤 ${name}:`);
        console.log(`   Shift Start: ${effectiveShift.start}`);
        console.log(`   Expected Behavior:`);
        console.log(`     - Punch in at 19:55 → NOT late ✅`);
        console.log(`     - Punch in at 20:00 → NOT late ✅`);
        console.log(`     - Punch in at 20:05 → Late ⚠️`);

        if (effectiveShift.start !== '20:00') {
          console.log(`   ❌ WARNING: Shift start is "${effectiveShift.start}" but expected "20:00" for night shift!`);
        }
      }
    }

    console.log('\n\n');
    console.log('='  .repeat(100));
    console.log('✅ Verification Complete');
    console.log('='  .repeat(100));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
verifyShiftAssignments();
