# Work From Home (WFH) - Attendance Implementation ✅

## Summary

**Work From Home (WFH) is treated as a NORMAL working day, NOT as leave.**

Employees with approved WFH requests must punch in/out and work their regular shift hours. The attendance system treats WFH days exactly like office days, with the same rules for Present/Late/Half-day/Absent statuses.

---

## Key Principles

1. **WFH ≠ Leave**: WFH is not counted as a leave type
2. **Normal Work Required**: Employee must punch in/out and complete their shift hours
3. **Same Attendance Rules**: All shift timing, late marking, and hour tracking rules apply
4. **Visual Indicator**: Calendar shows 🏠 icon to distinguish WFH days from office days
5. **Rejection Handling**: If WFH is rejected and employee doesn't work, marked as Absent

---

## Backend Implementation

### File: `server/services/AttendanceService.js`

#### 1. Updated `getLeaveInfo()` - Separate WFH from Leaves

**Lines 286-343**:

```javascript
async getLeaveInfo(userId, date) {
  try {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // Query LeaveRequest with CORRECT field names
    const leaveRequest = await LeaveRequest.findOne({
      'employee._id': userId,
      'period.start': { $lte: normalizedDate },
      'period.end': { $gte: normalizedDate },
      status: 'Approved'  // Only approved requests
    });

    let isOnLeave = false;
    let isWFH = false;
    let leaveType = null;

    if (leaveRequest) {
      if (leaveRequest.type === 'workFromHome') {
        // ⭐ WFH is NOT a leave - employee should work normal hours
        isWFH = true;
        leaveType = 'workFromHome';
        isOnLeave = false;  // CRITICAL: WFH NOT counted as leave
      } else {
        // Regular leave types (sick, paid, unpaid, maternity, halfDay)
        isOnLeave = true;
        leaveType = leaveRequest.type;
      }
    }

    // Check for holidays
    const holiday = await Holiday.findOne({
      date: normalizedDate,
      isActive: true
    });

    const isHoliday = !!holiday;
    const holidayName = holiday?.name || null;

    return {
      isOnLeave,    // false for WFH
      isWFH,        // true for WFH
      leaveType,    // 'workFromHome'
      isHoliday,
      holidayName
    };
  } catch (error) {
    console.error('Error getting leave info:', error);
    return {
      isOnLeave: false,
      isWFH: false,
      leaveType: null,
      isHoliday: false,
      holidayName: null
    };
  }
}
```

#### 2. Added `isWFH` to Calculated Data

**Lines 520-557**:

```javascript
// Extract isWFH from leaveInfo
const isWFH = employee.leaveInfo?.isWFH || false;

employee.calculated = {
  arrivalTime,
  workDurationSeconds: workSeconds,
  breakDurationSeconds: breakSeconds,

  // Status flags
  isPresent: workSeconds > 0,
  isAbsent: workSeconds === 0,
  isLate: isFlexibleShift ? false : this.calculateIsLate(arrivalTime, employee.assignedShift, attendanceDate),
  isEarly: this.calculateIsEarly(arrivalTime, employee.assignedShift),
  isHalfDay: workHours >= this.CONSTANTS.MIN_HALF_DAY_HOURS &&
             workHours < this.CONSTANTS.HALF_DAY_THRESHOLD_HOURS,
  isFullDay: workHours >= this.CONSTANTS.MIN_FULL_DAY_HOURS,

  // ⭐ WFH flag
  isWFH,  // Work From Home indicator

  // ... other fields
};
```

#### 3. Updated Default Calculated Data

**Line 1081**:

```javascript
getDefaultCalculatedData() {
  return {
    arrivalTime: null,
    workDurationSeconds: 0,
    breakDurationSeconds: 0,
    isPresent: false,
    isAbsent: true,
    isLate: false,
    isEarly: false,
    isHalfDay: false,
    isFullDay: false,
    isWFH: false,  // ⭐ NEW: Work From Home flag
    overtimeSeconds: 0,
    punctualityScore: 0,
    expectedStartTime: null,
    expectedEndTime: null
  };
}
```

---

## Frontend Implementation

### File: `client/src/pages/SuperAdminAttendancePortal.jsx`

#### 1. Updated Status Priority Logic

**Lines 769-812**:

```javascript
// Priority-based status determination:
// Holiday > Absent > Leave (NOT WFH) > Half-day > Late > Present
// WFH is NOT treated as leave - it's a normal working day with isWFH flag

if (attendanceData.isAbsent && !attendanceData.isPresent) {
  // PRIORITY 2: Absent (no work done)
  status = "absent";
} else if (attendanceData.leaveInfo && attendanceData.leaveInfo.type && attendanceData.leaveInfo.type !== 'workFromHome') {
  // PRIORITY 3: Leave types (on approved leave) - EXCLUDING WFH
  // ⭐ WFH is NOT a leave type, it's a normal working day
  switch (attendanceData.leaveInfo.type) {
    case 'sick':
      status = "sick-leave";
      break;
    case 'vacation':
      status = "vacation";
      break;
    case 'personal':
      status = "personal-leave";
      break;
    case 'halfDay':
      status = "half-day-leave";
      break;
    default:
      status = "approved-leave";
  }
} else if (attendanceData.isHalfDay && attendanceData.isPresent) {
  // PRIORITY 4: Half Day (< 4.5 hours worked)
  // Works for both office and WFH days
  status = "half-day";
} else if (attendanceData.isLate && attendanceData.isPresent && !isFlexibleEmployee) {
  // PRIORITY 5: Late (only for standard shift employees)
  // Works for both office and WFH days
  status = "late";
} else if (attendanceData.isPresent || (attendanceData.workDurationSeconds && attendanceData.workDurationSeconds > 0)) {
  // PRIORITY 6: Present (>= 4.5 hours worked)
  // Works for both office and WFH days
  status = "present";
} else if (attendanceData.isEarly && attendanceData.isPresent) {
  status = "early";
} else {
  status = "absent";
}
```

#### 2. Updated Monthly Stats Calculation

**Lines 1079-1094**:

```javascript
// Calculate enhanced monthly stats
const monthlyStats = {
  // Present includes: on-time, late, and half-day (all non-absent working days)
  // ⭐ WFH is NOT counted separately - it's a normal working day (present/half-day/late/absent)
  totalPresent: days.filter(d => ["present", "late", "half-day"].includes(d.status)).length,
  totalLate: days.filter(d => d.status === "late").length,
  totalHalfDay: days.filter(d => d.status === "half-day").length,
  totalAbsent: days.filter(d => d.status === "absent").length,
  totalWeekend: days.filter(d => d.status === "weekend").length,
  totalLeave: days.filter(d => ["leave", "half-day-leave", "approved-leave", "sick-leave", "vacation", "personal-leave"].includes(d.status)).length,
  totalHolidays: days.filter(d => d.status === "holiday").length,
  // ⭐ WFH count: days with isWFH flag (for informational purposes only, not counted as separate leave)
  totalWFH: days.filter(d => d.metadata?.isWFH === true).length,
  totalWorkingDays: days.filter(d => !["weekend", "default"].includes(d.status)).length,
  totalWorkHours: days.reduce((sum, d) => sum + parseFloat(d.workingHours || 0), 0).toFixed(1)
};
```

### File: `client/src/components/attendance/AttendanceCalendar.jsx`

#### 1. Added WFH Visual Indicator to Calendar Days

**Lines 345-350**:

```javascript
{/* WFH Indicator (Home icon badge) */}
{dayData.metadata?.isWFH && (
  <div className="absolute top-1 left-1" title="Work From Home">
    <div className="text-[10px] opacity-90">🏠</div>
  </div>
)}
```

#### 2. Added WFH Indicator to Hover Tooltip

**Lines 385-389**:

```javascript
<div className="font-semibold text-white">
  {data.month} {hoveredDay.day}, {data.year}
  {hoveredDay.metadata?.isWFH && <span className="ml-1" title="Work From Home">🏠</span>}
</div>
```

#### 3. Added WFH Badge to Selected Day Details

**Lines 474-481**:

```javascript
<h4 className="text-xl font-bold text-white">
  {data.month} {selectedDay.day}, {data.year}
  {selectedDay.metadata?.isWFH && (
    <span className="ml-2 text-sm bg-blue-600/30 text-blue-300 px-2 py-1 rounded" title="Work From Home">
      🏠 WFH
    </span>
  )}
</h4>
```

---

## Attendance Status Flow for WFH Days

### WFH Request Approved + Employee Works

```javascript
// Scenario: WFH approved, employee punches in at 9:00 AM, out at 6:00 PM

1. LeaveRequest.findOne() → returns { type: 'workFromHome', status: 'Approved' }
2. getLeaveInfo() → returns { isWFH: true, isOnLeave: false }
3. Employee punches in/out → workDurationSeconds: 32400 (9 hours)
4. calculateIsLate() → checks if arrival time > shift start (same as office days)
5. Status determination:
   - workHours = 9h (>= 4.5h)
   - isWFH = true
   - Status = "Present" ✅
   - Calendar display: Green "Present" with 🏠 icon
```

### WFH Request Approved + Employee Works Half Day

```javascript
// Scenario: WFH approved, employee punches in at 9:00 AM, out at 1:00 PM

1. LeaveRequest → { type: 'workFromHome', status: 'Approved' }
2. getLeaveInfo() → { isWFH: true, isOnLeave: false }
3. Employee punches in/out → workDurationSeconds: 14400 (4 hours)
4. Status determination:
   - workHours = 4h (< 4.5h)
   - isWFH = true
   - isHalfDay = true
   - Status = "Half-day" ⚠️
   - Calendar display: Orange "Half-day" with 🏠 icon
```

### WFH Request Approved + Employee Doesn't Work

```javascript
// Scenario: WFH approved, but employee never punches in

1. LeaveRequest → { type: 'workFromHome', status: 'Approved' }
2. getLeaveInfo() → { isWFH: true, isOnLeave: false }
3. No punch events → workDurationSeconds: 0
4. Status determination:
   - workHours = 0h
   - isWFH = true
   - isAbsent = true
   - Status = "Absent" ❌
   - Calendar display: Red "Absent" with 🏠 icon
```

### WFH Request Approved + Employee Late

```javascript
// Scenario: WFH approved, shift at 9:00 AM, employee punches at 9:01 AM

1. LeaveRequest → { type: 'workFromHome', status: 'Approved' }
2. getLeaveInfo() → { isWFH: true, isOnLeave: false }
3. Employee punches in late → calculateIsLate() returns true
4. Works 8+ hours → workDurationSeconds: 28800+
5. Status determination:
   - isWFH = true
   - isLate = true
   - workHours >= 4.5h
   - Status = "Late" ⏰
   - Calendar display: Yellow "Late" with 🏠 icon
```

### WFH Request Rejected + Employee Works

```javascript
// Scenario: WFH rejected, but employee still works (from office)

1. LeaveRequest → { type: 'workFromHome', status: 'Rejected' }
2. getLeaveInfo() → { isWFH: false, isOnLeave: false } (request ignored)
3. Employee punches in/out → workDurationSeconds: 32400
4. Status determination:
   - No WFH flag
   - Normal office day flow
   - Status = "Present" ✅
   - Calendar display: Green "Present" (no 🏠 icon)
```

### WFH Request Rejected + Employee Doesn't Work

```javascript
// Scenario: WFH rejected, employee doesn't come to office

1. LeaveRequest → { type: 'workFromHome', status: 'Rejected' }
2. getLeaveInfo() → { isWFH: false, isOnLeave: false }
3. No punch events → workDurationSeconds: 0
4. Status determination:
   - No WFH flag
   - isAbsent = true
   - Status = "Absent" ❌
   - Calendar display: Red "Absent" (no 🏠 icon)
```

---

## Example Scenarios

### Scenario 1: Full Day WFH

**Employee**: John Doe
**Shift**: Morning Shift (09:00 - 18:00)
**WFH Request**: Approved for 2025-01-10
**Punch In**: 09:00 AM IST
**Punch Out**: 06:05 PM IST
**Total Work**: 9 hours 5 minutes

**Backend Response**:
```json
{
  "calculated": {
    "isWFH": true,
    "isPresent": true,
    "isLate": false,
    "isHalfDay": false,
    "isFullDay": true,
    "workDurationSeconds": 32700
  }
}
```

**Calendar Display**: ✅ **Present** (Green) with 🏠 icon
**Monthly Stats**: Counts as 1 Present day, 1 WFH day

---

### Scenario 2: Late WFH Day

**Employee**: Jane Smith
**Shift**: Morning Shift (09:00 - 18:00)
**WFH Request**: Approved for 2025-01-11
**Punch In**: 09:05 AM IST (5 minutes late)
**Punch Out**: 06:00 PM IST
**Total Work**: 8 hours 55 minutes

**Backend Response**:
```json
{
  "calculated": {
    "isWFH": true,
    "isPresent": true,
    "isLate": true,
    "lateMinutes": 5,
    "isHalfDay": false,
    "isFullDay": true,
    "workDurationSeconds": 32100
  }
}
```

**Calendar Display**: ⏰ **Late** (Yellow) with 🏠 icon
**Monthly Stats**: Counts as 1 Present day, 1 Late day, 1 WFH day

---

### Scenario 3: Half Day WFH

**Employee**: Bob Wilson
**Shift**: Morning Shift (09:00 - 18:00)
**WFH Request**: Approved for 2025-01-12
**Punch In**: 09:00 AM IST
**Punch Out**: 01:15 PM IST
**Total Work**: 4 hours 15 minutes

**Backend Response**:
```json
{
  "calculated": {
    "isWFH": true,
    "isPresent": true,
    "isLate": false,
    "isHalfDay": true,
    "isFullDay": false,
    "workDurationSeconds": 15300
  }
}
```

**Calendar Display**: ⚠️ **Half-day** (Orange) with 🏠 icon
**Monthly Stats**: Counts as 1 Present day, 1 Half-day, 1 WFH day

---

### Scenario 4: Absent WFH (Approved but didn't work)

**Employee**: Alice Cooper
**Shift**: Morning Shift (09:00 - 18:00)
**WFH Request**: Approved for 2025-01-13
**Punch In**: None
**Punch Out**: None
**Total Work**: 0 hours

**Backend Response**:
```json
{
  "calculated": {
    "isWFH": true,
    "isPresent": false,
    "isAbsent": true,
    "isLate": false,
    "isHalfDay": false,
    "isFullDay": false,
    "workDurationSeconds": 0
  }
}
```

**Calendar Display**: ❌ **Absent** (Red) with 🏠 icon
**Monthly Stats**: Counts as 1 Absent day, 1 WFH day (requested but not utilized)

---

## Calendar Visual Display

### Day Cell Display

```
┌─────────────┐
│🏠        ✅ │  ← WFH icon (top-left), Status icon (top-right)
│             │
│     15      │  ← Day number (center)
│             │
│          8h │  ← Work hours (bottom-right)
└─────────────┘
```

### Tooltip on Hover

```
┌─────────────────────────────┐
│ January 15, 2025 🏠         │
│                     Present │
├─────────────────────────────┤
│ Work Hours:           8.5h  │
│ Time In:             09:00  │
│ Time Out:            17:30  │
│ Breaks:       1 (0.5h)      │
│ Efficiency:            106% │
├─────────────────────────────┤
│ Click for detailed view     │
└─────────────────────────────┘
```

### Selected Day Details

```
╔══════════════════════════════════════╗
║  January 15, 2025  [🏠 WFH]  Present ║
║  Thursday                             ║
╠══════════════════════════════════════╣
║  Work Duration: 8.5h                 ║
║  Break Time: 0.5h                    ║
║  Efficiency: 106%                    ║
╠══════════════════════════════════════╣
║  Time In: 09:00                      ║
║  Time Out: 17:30                     ║
║  Shift Type: Standard                ║
╚══════════════════════════════════════╝
```

---

## Monthly Stats Display

```javascript
// WFH days are counted in their respective status categories

Example Month:
┌────────────────────────────────────┐
│ Total Present:    18 days          │
│   ├─ Office:      15 days          │
│   └─ WFH:          3 days  🏠      │
│                                    │
│ Total Late:        2 days          │
│   ├─ Office:       2 days          │
│   └─ WFH:          0 days          │
│                                    │
│ Total Half-day:    1 day           │
│   ├─ Office:       0 days          │
│   └─ WFH:          1 day   🏠      │
│                                    │
│ Total Absent:      2 days          │
│   ├─ Office:       2 days          │
│   └─ WFH:          0 days          │
│                                    │
│ Total WFH:         4 days  🏠      │
│ (includes Present + Half-day WFH)  │
└────────────────────────────────────┘
```

---

## Database Schema

### LeaveRequest Model

```javascript
{
  employee: {
    _id: ObjectId,
    name: String,
    email: String
  },
  type: {
    type: String,
    enum: ["maternity", "paid", "unpaid", "sick", "workFromHome", "halfDay"]
  },
  period: {
    start: Date,  // Normalized to 00:00:00
    end: Date     // Normalized to 00:00:00
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },
  reason: String,
  approvedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## API Response Format

### WFH Day - Present

```json
{
  "success": true,
  "data": {
    "calculated": {
      "arrivalTime": "2025-01-10T03:30:00.000Z",
      "workDurationSeconds": 32400,
      "breakDurationSeconds": 1800,
      "isPresent": true,
      "isAbsent": false,
      "isLate": false,
      "isEarly": false,
      "isHalfDay": false,
      "isFullDay": true,
      "isWFH": true,
      "overtimeSeconds": 0,
      "punctualityScore": 100
    },
    "leaveInfo": {
      "isOnLeave": false,
      "isWFH": true,
      "leaveType": "workFromHome",
      "isHoliday": false,
      "holidayName": null
    }
  }
}
```

### WFH Day - Late

```json
{
  "success": true,
  "data": {
    "calculated": {
      "arrivalTime": "2025-01-10T03:35:00.000Z",
      "workDurationSeconds": 32100,
      "isPresent": true,
      "isLate": true,
      "isWFH": true,
      "lateMinutes": 5
    }
  }
}
```

### WFH Day - Absent

```json
{
  "success": true,
  "data": {
    "calculated": {
      "arrivalTime": null,
      "workDurationSeconds": 0,
      "isPresent": false,
      "isAbsent": true,
      "isWFH": true
    }
  }
}
```

---

## Testing Checklist

### Backend Tests

- [x] WFH request query uses correct field names (`employee._id`, `period.start`, `period.end`)
- [x] WFH approved → `isWFH: true`, `isOnLeave: false`
- [x] WFH rejected → `isWFH: false`, `isOnLeave: false`
- [x] Regular leave → `isWFH: false`, `isOnLeave: true`
- [x] No leave/WFH → `isWFH: false`, `isOnLeave: false`
- [x] WFH + full work hours → `isPresent: true`
- [x] WFH + late punch → `isLate: true`
- [x] WFH + < 4.5 hours → `isHalfDay: true`
- [x] WFH + 0 hours → `isAbsent: true`

### Frontend Tests

- [ ] WFH day shows 🏠 icon on calendar cell
- [ ] WFH day shows correct status (Present/Late/Half-day/Absent)
- [ ] Hover tooltip displays 🏠 icon
- [ ] Selected day details show "🏠 WFH" badge
- [ ] Monthly stats count WFH days correctly
- [ ] WFH NOT counted as separate leave type
- [ ] WFH absent days counted in absent total
- [ ] WFH present days counted in present total

---

## Key Differences: WFH vs Regular Leave

| Feature | Regular Leave | Work From Home |
|---------|--------------|----------------|
| **isOnLeave flag** | ✅ true | ❌ false |
| **isWFH flag** | ❌ false | ✅ true |
| **Punch in/out required** | ❌ No | ✅ Yes |
| **Work hours tracked** | ❌ No | ✅ Yes |
| **Can be marked Late** | ❌ No | ✅ Yes |
| **Can be marked Absent** | ❌ No (shows as "Leave") | ✅ Yes (if no work) |
| **Calendar status** | "Leave" (Purple) | Present/Late/Half-day/Absent |
| **Calendar icon** | ❌ Leave icon | 🏠 WFH icon |
| **Counted in attendance** | ❌ No | ✅ Yes |
| **Counted in total present** | ❌ No | ✅ Yes (if worked) |
| **Counted in total leave** | ✅ Yes | ❌ No |

---

## Summary

### What This Solves

1. **Proper WFH Tracking**: WFH is tracked as a working day, not leave
2. **Accountability**: Employees must work their shift hours even on WFH days
3. **Fair Marking**: Late/Half-day/Absent rules apply equally to WFH and office days
4. **Visual Clarity**: 🏠 icon distinguishes WFH days from office days
5. **Accurate Stats**: Monthly stats reflect actual work done, not just location

### Key Rules

- **WFH Approved + Work ≥ 4.5h** → Present ✅
- **WFH Approved + Work < 4.5h** → Half-day ⚠️
- **WFH Approved + Late** → Late ⏰
- **WFH Approved + No Work** → Absent ❌
- **WFH Rejected** → Treated as normal office day (no WFH flag)

---

**Date**: 2025-01-08
**Status**: ✅ Implementation Complete
**Files Changed**:
- `server/services/AttendanceService.js` (Lines 286-343, 520-557, 1081)
- `client/src/pages/SuperAdminAttendancePortal.jsx` (Lines 769-812, 1079-1094)
- `client/src/components/attendance/AttendanceCalendar.jsx` (Lines 345-350, 385-389, 474-481)
