# Attendance and Work From Home (WFH) Integration

## Overview

This document explains how the attendance system integrates with Work From Home (WFH) leave requests to ensure employees are marked as WFH-present only when they actually punch in.

## Core Principle

**WFH approval does NOT automatically mark attendance as present.**

- When a WFH request is approved, the dates are marked as WFH-eligible
- Employee must still punch in to be counted as present
- When employee punches in on a WFH-approved date, the system marks attendance as WFH

## Architecture Components

### 1. Leave Request Approval (leaveController.js)

**Location**: `server/controllers/leaveController.js:151-158`

When a WFH request is approved:

```javascript
// WFH Integration: Mark the dates as WFH-approved, but don't mark attendance
// Employee still needs to punch in to be counted as present
if (status === "Approved" && updatedLeave.type === "workFromHome") {
  // Store WFH approval info - this will be checked when employee punches in
  // The attendance system will reference approved WFH requests when validating punch-ins
  console.log(`WFH request approved for user ${updatedLeave.employee._id} from ${updatedLeave.period.start} to ${updatedLeave.period.end}`);
  console.log(`Employee must still punch in to be marked present - WFH status will be applied on punch-in`);
}
```

**What happens:**
- Leave request status is updated to "Approved"
- No attendance records are created
- The approved WFH request is stored in the `LeaveRequest` collection
- System logs the approval for audit purposes

### 2. WFH Detection (AttendanceService.js)

**Location**: `server/services/AttendanceService.js:297-346`

The `getLeaveInfo()` function checks for approved WFH requests:

```javascript
async getLeaveInfo(userId, date) {
  const normalizedDate = this.normalizeDate(date);

  const leaveRequest = await LeaveRequest.findOne({
    'employee._id': userId,
    'period.start': { $lte: normalizedDate },
    'period.end': { $gte: normalizedDate },
    status: 'Approved'
  });

  if (leaveRequest) {
    if (leaveRequest.type === 'workFromHome') {
      // WFH is NOT a leave - employee should work normal hours
      isWFH = true;
      leaveType = 'workFromHome';
      isOnLeave = false; // ⭐ WFH is NOT counted as leave
      isPaidLeave = false;
    } else {
      // Other leave types (paid, unpaid, sick, maternity)
      isOnLeave = true;
      isPaidLeave = ['paid', 'sick', 'maternity'].includes(leaveRequest.type);
      leaveType = leaveRequest.type;
    }
  }

  return {
    isOnLeave,
    isWFH,
    isPaidLeave,
    isHalfDayLeave,
    leaveType,
    isHoliday
  };
}
```

**What this does:**
- Queries for approved leave requests that cover the given date
- Distinguishes between WFH and actual leave types
- Returns `isWFH = true` if WFH request is approved for that date
- **Important**: `isWFH = true` does NOT mean the employee is present, just that they have WFH approval

### 3. Attendance Record Creation (AttendanceService.js)

**Location**: `server/services/AttendanceService.js` (createEmployeeRecord and punch event handling)

When an employee punches in:

```javascript
// 1. Get leave info for the date
const leaveInfo = await this.getLeaveInfo(userId, normalizedDate);

// 2. Create or get the employee record
const employeeRecord = {
  userId: userId,
  date: normalizedDate,
  status: 'present', // Initially marked as present
  isWFH: leaveInfo.isWFH, // ⭐ Set based on approved WFH request
  isOnLeave: leaveInfo.isOnLeave,
  isPaidLeave: leaveInfo.isPaidLeave,
  isHalfDayLeave: leaveInfo.isHalfDayLeave,
  leaveType: leaveInfo.leaveType,
  // ... other fields
};

// 3. Add the punch event
employeeRecord.punchEvents.push({
  type: 'PUNCH_IN',
  time: punchTime,
  location: location,
  // ... other event details
});
```

**What happens:**
1. System calls `getLeaveInfo()` to check if there's an approved WFH request
2. If WFH is approved, `isWFH` is set to `true` in the attendance record
3. Employee is marked as `present` with `isWFH = true`
4. The punch event is recorded with location and timestamp

## Workflow Examples

### Scenario 1: Employee Requests WFH and Punches In

**Timeline:**

1. **Monday 9:00 AM**: Employee submits WFH request for Wednesday
   - Request status: "Pending"
   - No attendance record created

2. **Monday 2:00 PM**: Manager approves WFH request
   - Request status: "Approved"
   - No attendance record created
   - System logs: "WFH request approved, employee must still punch in"

3. **Wednesday 9:30 AM**: Employee punches in from home
   - System calls `getLeaveInfo()` → finds approved WFH request
   - Creates attendance record with:
     - `status: 'present'`
     - `isWFH: true`
     - `punchEvents: [{ type: 'PUNCH_IN', time: '2026-07-30T04:00:00.000Z' }]`
   - Employee is marked as **WFH-Present**

4. **Wednesday 6:00 PM**: Employee punches out
   - Punch event added to same attendance record
   - Working hours calculated based on punch times
   - Employee remains **WFH-Present**

### Scenario 2: Employee Requests WFH but Doesn't Punch In

**Timeline:**

1. **Monday 9:00 AM**: Employee submits WFH request for Wednesday
   - Request status: "Pending"

2. **Monday 2:00 PM**: Manager approves WFH request
   - Request status: "Approved"
   - No attendance record created

3. **Wednesday (all day)**: Employee does NOT punch in
   - No attendance record created
   - System queries for this employee on Wednesday → returns no record
   - Employee is marked as **Absent** (no attendance record = absent)

4. **End of Day**: Attendance report shows
   - Employee: Absent (despite having approved WFH request)
   - This is correct behavior: WFH approval ≠ automatic attendance

### Scenario 3: Regular Leave (Paid/Sick)

**Timeline:**

1. **Monday**: Employee submits sick leave request for Wednesday
2. **Monday**: Manager approves sick leave
   - Request status: "Approved"
   - No attendance record created (leave = no attendance needed)

3. **Wednesday**: Employee should NOT punch in
   - If employee does punch in, system will detect `isOnLeave = true`
   - Attendance record would be created with:
     - `status: 'present'` (they punched in)
     - `isOnLeave: true`
     - `leaveType: 'sick'`
   - This scenario indicates potential misuse (employee on leave but punching in)

## Database Schema

### LeaveRequest Model

```javascript
{
  employee: {
    _id: ObjectId,
    name: String,
    email: String,
    department: String
  },
  period: {
    start: Date, // Start date of leave
    end: Date    // End date of leave
  },
  type: String, // 'workFromHome', 'paid', 'unpaid', 'sick', 'maternity', 'halfDay'
  status: String, // 'Pending', 'Approved', 'Rejected'
  reason: String,
  document: Object, // Optional supporting document
  approvedBy: Object, // Admin who approved
  createdAt: Date,
  updatedAt: Date
}
```

### AttendanceRecord Model (Employee Record)

```javascript
{
  userId: ObjectId,
  date: Date, // Normalized to midnight IST
  status: String, // 'present', 'absent', 'late', 'half-day'
  isWFH: Boolean, // ⭐ Set when approved WFH request exists AND employee punches in
  isOnLeave: Boolean,
  isPaidLeave: Boolean,
  isHalfDayLeave: Boolean,
  leaveType: String,
  punchEvents: [
    {
      type: String, // 'PUNCH_IN', 'PUNCH_OUT', 'BREAK_START', 'BREAK_END'
      time: Date,
      location: Object,
      ipAddress: String
    }
  ],
  totalWorkingMinutes: Number,
  totalBreakMinutes: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## Key Design Decisions

### Why WFH Approval Doesn't Auto-Create Attendance

**Rationale:**
1. **Accountability**: Ensures employees are actually working, not just approved to work from home
2. **Accurate Tracking**: Distinguishes between "approved to WFH" and "actually working from home"
3. **Data Integrity**: Attendance records should only exist when employee actively participates
4. **Audit Trail**: Punch events provide verifiable timestamps and locations

**Alternative Considered:**
- Auto-create attendance records when WFH is approved
- **Rejected because**: Would allow employees to be marked present without actually working

### WFH vs Regular Leave

| Aspect | WFH | Regular Leave (Paid/Sick) |
|--------|-----|---------------------------|
| Requires Punch In | ✅ Yes | ❌ No |
| Creates Attendance Record | Only when punched in | No |
| Counts as Leave | ❌ No | ✅ Yes |
| Working Hours Expected | ✅ Yes | ❌ No |
| `isOnLeave` Flag | `false` | `true` |
| `isWFH` Flag | `true` | `false` |

## API Endpoints

### 1. Approve/Reject Leave Request

**Endpoint**: `PUT /api/leave/:id/status`

**Request:**
```json
{
  "status": "Approved",
  "adminRemarks": "Approved for remote work"
}
```

**Response:**
```json
{
  "_id": "leave_id",
  "employee": {
    "_id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "period": {
    "start": "2026-07-30T00:00:00.000Z",
    "end": "2026-07-30T00:00:00.000Z"
  },
  "type": "workFromHome",
  "status": "Approved",
  "approvedBy": {
    "_id": "admin_id",
    "name": "Manager",
    "email": "manager@example.com"
  }
}
```

**What happens internally:**
- Leave request status updated to "Approved"
- Approval info stored (who approved, when)
- WebSocket broadcast to notify employee
- **No attendance record created**

### 2. Punch In

**Endpoint**: `POST /api/attendance/punch`

**Request:**
```json
{
  "type": "PUNCH_IN",
  "location": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Punched in successfully",
  "attendance": {
    "userId": "user_id",
    "date": "2026-07-30T00:00:00.000Z",
    "status": "present",
    "isWFH": true, // ⭐ Set because WFH request is approved
    "punchEvents": [
      {
        "type": "PUNCH_IN",
        "time": "2026-07-30T04:00:00.000Z",
        "location": {
          "latitude": 28.6139,
          "longitude": 77.2090
        }
      }
    ]
  }
}
```

**What happens internally:**
1. System calls `getLeaveInfo(userId, today)`
2. Finds approved WFH request for today
3. Creates attendance record with `isWFH: true`
4. Records punch event with location and timestamp
5. Broadcasts WebSocket update to all connected clients

## Frontend Integration

### Leave Request Status Display

When displaying leave requests, show the approval status but make it clear that attendance requires punch-in:

```jsx
{leave.type === 'workFromHome' && leave.status === 'Approved' && (
  <div className="text-sm text-amber-600 dark:text-amber-400">
    ⚠️ WFH Approved - Remember to punch in to be marked present
  </div>
)}
```

### Attendance Dashboard

Show WFH status clearly:

```jsx
{attendance.isWFH && (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
    🏠 Work From Home
  </span>
)}
```

## Testing Scenarios

### Test Case 1: WFH Approval → Punch In

**Steps:**
1. Submit WFH request for tomorrow
2. Have manager approve the request
3. Tomorrow, punch in at 9:00 AM
4. Check attendance record

**Expected Result:**
- Attendance record created with `isWFH: true`
- Status: "present"
- Punch event recorded

### Test Case 2: WFH Approval → No Punch In

**Steps:**
1. Submit WFH request for tomorrow
2. Have manager approve the request
3. Tomorrow, do NOT punch in
4. Check attendance record at end of day

**Expected Result:**
- No attendance record exists
- Employee marked as absent in reports
- WFH request still shows as "Approved" (separate from attendance)

### Test Case 3: Regular Leave (No Punch In Required)

**Steps:**
1. Submit sick leave request for tomorrow
2. Have manager approve the request
3. Tomorrow, do NOT punch in
4. Check attendance and leave status

**Expected Result:**
- No attendance record (correct behavior)
- Leave request shows as "Approved"
- Employee not marked as absent (on approved leave)

## Common Questions

**Q: Why doesn't WFH approval automatically mark attendance?**
A: To ensure accountability. Employees must actively punch in to confirm they're working, even from home.

**Q: What happens if employee has WFH approved but forgets to punch in?**
A: They will be marked as absent. The WFH approval doesn't guarantee attendance.

**Q: Can employee punch in on regular leave (paid/sick)?**
A: Technically yes, but it would be flagged as unusual (present while on leave). This could indicate misuse.

**Q: How does the system know if someone is WFH when they punch in?**
A: The `getLeaveInfo()` function queries for approved WFH requests covering that date. If found, `isWFH` is set to true.

**Q: What's the difference between `isWFH` and `isOnLeave`?**
A: `isWFH` means working remotely (requires punch in). `isOnLeave` means not working (no punch in needed).

## Related Files

- **Leave Controller**: `server/controllers/leaveController.js`
- **Attendance Service**: `server/services/AttendanceService.js`
- **Leave Model**: `server/models/LeaveRequest.js`
- **Attendance Model**: `server/models/AttendanceRecord.js`
- **Access Control**: `server/utils/accessControl.js`

## Migration Notes

If migrating from an old system where WFH approval auto-created attendance:

1. No database migration needed (different behavior going forward)
2. Historical data remains unchanged
3. Communicate policy change to employees: "WFH approval now requires punch-in"
4. Update employee handbook/documentation
5. Consider grace period with reminders

## Maintenance

### Monitoring

Monitor these metrics to ensure system health:

1. **WFH requests approved but no punch-in**: Indicates employees forgetting to punch in
2. **Punch-in on approved leave**: Indicates potential misuse
3. **WFH punch-in without approval**: Should be blocked or flagged

### Audit Logging

The system logs:
- WFH approval events (console logs in leaveController.js)
- Punch events with timestamps and locations
- Leave info queries (getLeaveInfo calls)

### Future Enhancements

Potential improvements:
1. Automated reminder notifications when WFH is approved: "Remember to punch in tomorrow"
2. Grace period for late punch-ins on WFH days
3. Notification if employee has WFH approved but hasn't punched in by certain time
4. Analytics dashboard showing WFH vs office attendance trends
