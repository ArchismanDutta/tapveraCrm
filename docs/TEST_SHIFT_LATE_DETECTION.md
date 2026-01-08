# Test: Shift-Based Late Detection

## Problem Report
Night shift members are showing as "late" even when punching in before their shift start time.

## Test Scenarios

### Scenario 1: Day Shift (09:00 - 18:00)
**Employee**: Day shift worker
**Shift**: 09:00 - 18:00

| Punch In Time | Expected | Current Result | Status |
|--------------|----------|----------------|--------|
| 08:55 | NOT Late | ? | ❓ |
| 09:00 | NOT Late | ? | ❓ |
| 09:15 | Late | ? | ❓ |

### Scenario 2: Night Shift (20:00 - 05:00)
**Employee**: Night shift worker
**Shift**: 20:00 - 05:00

| Punch In Time | Expected | Current Result | Status |
|--------------|----------|----------------|--------|
| 19:55 | NOT Late | **Late** ❌ | **WRONG** |
| 20:00 | NOT Late | ? | ❓ |
| 20:30 | Late | ? | ❓ |

### Scenario 3: Evening Shift (13:00 - 22:00)
**Employee**: Evening shift worker
**Shift**: 13:00 - 22:00

| Punch In Time | Expected | Current Result | Status |
|--------------|----------|----------------|--------|
| 12:55 | NOT Late | ? | ❓ |
| 13:00 | NOT Late | ? | ❓ |
| 13:10 | Late | ? | ❓ |

## Possible Causes

### 1. Shift Not Assigned ❌
**Check**: Are night shift employees actually assigned a night shift?

**How to verify**:
```javascript
// In MongoDB or via API
db.users.findOne({ _id: nightShiftUserId }, { assignedShift: 1, shift: 1, shiftType: 1 })
```

**Expected**:
- `assignedShift`: Should reference a Shift document with start="20:00"
- OR `shift.start`: "20:00"
- OR User.getEffectiveShift() returns night shift

**If NULL/Missing**: System falls back to MORNING shift (09:00-18:00) → Everyone shows late!

---

### 2. Shift Data Structure Mismatch ❌
**Check**: Does the shift model use different field names?

**AttendanceService expects**:
```javascript
{
  startTime: "20:00",  // ← Looking for this
  endTime: "05:00"
}
```

**Shift model might have**:
```javascript
{
  start: "20:00",  // ← Different name!
  end: "05:00"
}
```

**Fix needed**: Mapping in getUserShift() line 147:
```javascript
startTime: effectiveShift.start,  // ✅ Already mapping!
```

---

### 3. User.getEffectiveShift() Returning Wrong Data ❌
**Check**: Does getEffectiveShift() return the correct shift?

**Test**:
```javascript
const user = await User.findById(nightShiftUserId);
const shift = await user.getEffectiveShift(new Date());
console.log(shift);
// Should be: { start: "20:00", end: "05:00", name: "Night Shift" }
```

**Possible Issues**:
- Shift not populated
- assignedShift reference broken
- Fallback to default shift happening

---

### 4. Fallback to MORNING Shift ❌
**Code Review**:

```javascript
// Line 137: If user not found
if (!user) return this.STANDARD_SHIFTS.MORNING;  // ❌ FALLBACK!

// Line 204: If no shift configured
return this.STANDARD_SHIFTS.MORNING;  // ❌ FALLBACK!

// Line 208: If error
return this.STANDARD_SHIFTS.MORNING;  // ❌ FALLBACK!
```

**Problem**: ANY error → everyone gets morning shift → night workers show late

---

## Debugging Steps

### Step 1: Check Shift Assignment
```bash
# In MongoDB shell or Compass
db.users.find({
  $or: [
    { "shift.start": "20:00" },
    { assignedShift: { $exists: true } }
  ]
}).pretty()
```

### Step 2: Check AttendanceRecord Data
```bash
db.attendancerecords.findOne({
  date: ISODate("2025-10-06T00:00:00Z"),
  "employees.userId": ObjectId("nightShiftUserId")
}, {
  "employees.$": 1
})
```

Look for:
```javascript
{
  employees: [{
    assignedShift: {
      name: "Night Shift",
      startTime: "20:00",  // ← Should be here!
      endTime: "05:00"
    },
    calculated: {
      isLate: false  // ← Should be false if punched at 19:55
    }
  }]
}
```

### Step 3: Enable Debug Logging
The AttendanceService already has console.log statements:

```javascript
console.log('🔍 getUserShift - effectiveShift:', effectiveShift);
console.log('🔍 getUserShift - returning:', shiftData);
console.log('🔍 calculateIsLate called with:', { arrivalTime, shift });
console.log('🕐 calculateIsLate RESULT:', { isLate, minutesLate });
```

**Action**: Check server logs when night shift employee punches in.

---

## Recommended Fixes

### Fix 1: Better Fallback Logic
Instead of always returning MORNING shift, check user's department or role:

```javascript
// Better fallback
if (!effectiveShift) {
  console.warn(`No shift found for user ${userId}, using default`);
  // Could base on department, role, or explicitly set default per user
  return this.STANDARD_SHIFTS.MORNING;
}
```

### Fix 2: Add Shift Validation
Before calculating isLate, verify shift data:

```javascript
calculateIsLate(arrivalTime, shift) {
  if (!arrivalTime) {
    console.warn('No arrival time provided');
    return false;
  }

  if (!shift || !shift.startTime) {
    console.error('Invalid shift data:', shift);
    // Don't assume late if shift data is missing
    return false;
  }

  // ... rest of logic
}
```

### Fix 3: Ensure Shift Assignment on User Creation
When creating users, ensure shift is assigned:

```javascript
// In user creation/update
if (user.shiftType === 'standard' && !user.assignedShift) {
  console.error('User has standard shift type but no assigned shift!');
  // Assign default or throw error
}
```

---

## Action Items

1. ✅ Check server logs for night shift punch-ins
2. ❓ Query database to see what shift is assigned to night shift users
3. ❓ Add temporary extra logging to see exact shift data
4. ❓ Verify User.getEffectiveShift() is working correctly
5. ❓ Test with known night shift employee

---

## Expected Solution

**Most Likely Cause**: Night shift employees don't have `assignedShift` properly set, so system falls back to MORNING shift (09:00).

**Solution**:
1. Assign correct shift to night shift employees
2. Verify shift assignment is saved correctly
3. Test punch-in to confirm late detection works

**Quick Test**:
```javascript
// In Node.js or MongoDB shell
const user = await User.findById('nightShiftUserId').populate('assignedShift');
console.log('Assigned Shift:', user.assignedShift);
console.log('Legacy Shift:', user.shift);
const effectiveShift = await user.getEffectiveShift(new Date());
console.log('Effective Shift:', effectiveShift);
```

If `effectiveShift.start` is "09:00" instead of "20:00", that's the problem!
