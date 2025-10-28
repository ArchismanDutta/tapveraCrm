// AttendanceService.js - NIGHT SHIFT FIX
// This shows the changes needed to fix night shift date assignment

// ADD THIS NEW METHOD after normalizeDate()

/**
 * Get the correct attendance date for a punch event
 * For night shifts, punches after midnight belong to the PREVIOUS day's shift
 */
getAttendanceDateForPunch(punchTime, shift) {
  const punch = new Date(punchTime);
  const punchHour = punch.getHours();

  // If no shift or not a night shift, use the punch date
  if (!shift || !shift.startTime || !shift.endTime) {
    return this.normalizeDate(punch);
  }

  const [startHour] = shift.startTime.split(':').map(Number);
  const [endHour] = shift.endTime.split(':').map(Number);

  // Check if this is a night shift (shift that crosses midnight)
  const isNightShift = endHour < startHour;

  if (isNightShift) {
    // For night shifts, if punch is BEFORE shift end time AND after midnight,
    // it belongs to PREVIOUS day's shift
    // Example: Shift 20:00-05:00
    //   - Punch at 18:00 = Sept 10 → Record for Sept 10 ✅
    //   - Punch at 22:00 = Sept 10 → Record for Sept 10 ✅
    //   - Punch at 02:00 = Sept 11 → Record for Sept 10 ✅ (belongs to previous shift)
    //   - Punch at 06:00 = Sept 11 → Record for Sept 11 ✅ (after shift ends)

    if (punchHour < endHour) {
      // Punch is in the early morning hours (00:00 - endHour)
      // This belongs to YESTERDAY's night shift
      const yesterday = new Date(punch);
      yesterday.setDate(yesterday.getDate() - 1);
      console.log(`🌙 Night shift detected: Punch at ${punchHour}:00 before shift end ${endHour}:00`);
      console.log(`   Assigning to previous day: ${yesterday.toISOString().split('T')[0]}`);
      return this.normalizeDate(yesterday);
    } else if (punchHour >= startHour) {
      // Punch is in the evening (after shift start)
      // This belongs to TODAY's night shift
      console.log(`🌙 Night shift detected: Punch at ${punchHour}:00 after shift start ${startHour}:00`);
      console.log(`   Assigning to current day: ${punch.toISOString().split('T')[0]}`);
      return this.normalizeDate(punch);
    } else {
      // Punch is between endHour and startHour (the "off" hours)
      // For example, punching at 10:00 AM for a 20:00-05:00 shift
      // This is unusual - could be early punch for today's shift
      // Assign to today
      console.log(`⚠️  Unusual punch time: ${punchHour}:00 between shift end ${endHour}:00 and start ${startHour}:00`);
      console.log(`   Assigning to current day: ${punch.toISOString().split('T')[0]}`);
      return this.normalizeDate(punch);
    }
  }

  // Not a night shift, use the punch date
  return this.normalizeDate(punch);
}

// MODIFY recordPunchEvent() to use the new method
async recordPunchEvent(userId, eventType, options = {}) {
  const now = new Date();

  // CHANGE THIS:
  // const today = this.normalizeDate(now);

  // TO THIS:
  // First, get user's shift to determine correct date
  const userShift = await this.getUserShift(userId, now);
  const today = this.getAttendanceDateForPunch(now, userShift);

  console.log(`📅 Punch event for user ${userId}:`);
  console.log(`   Punch time: ${now.toISOString()}`);
  console.log(`   Shift: ${userShift?.startTime}-${userShift?.endTime}`);
  console.log(`   Assigned to date: ${today.toISOString().split('T')[0]}`);

  // Get attendance record for the determined date
  const record = await this.getAttendanceRecord(today);

  // Find or create employee record
  let employee = record.getEmployee(userId);

  if (!employee) {
    // Pass the actual date we're recording for
    const employeeData = await this.createEmployeeRecord(userId, today);
    employee = record.upsertEmployee(employeeData);
  }

  // ... rest of the method stays the same
}
