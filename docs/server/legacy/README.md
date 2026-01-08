# Legacy Attendance System Files

**⚠️ DEPRECATED - DO NOT USE**

These files are from the old UserStatus-based attendance system and have been replaced by the new AttendanceRecord-based system.

## Migration Date
- **Date**: 2025-10-06
- **Reason**: Migrated to new date-centric attendance system

## Old System Architecture

### Routes (DEPRECATED)
- `routes/statusRoutes.js` → Replaced by `/api/attendance-new` endpoints
- `routes/summaryRoutes.js` → Replaced by `/api/attendance-new/my-weekly`
- `routes/attendanceRoutes.js` → Was never registered, used statusControllerNew

### Controllers (DEPRECATED)
- `controllers/statusController.js` → Replaced by `AttendanceController.js`
- `controllers/summaryController.js` → Replaced by `AttendanceController.getMyWeeklySummary`
- `controllers/statusControllerNew.js` → Never used
- `controllers/summaryControllerNew.js` → Never used

### Services (DEPRECATED)
- `services/attendanceCalculationService.js` → Replaced by `AttendanceService.js`
- `services/unifiedAttendanceService.js` → Replaced by `AttendanceService.js`

## New System Location

**Active System Files:**
- **Routes**: `server/routes/newAttendanceRoutes.js` → `/api/attendance-new/*`
- **Controller**: `server/controllers/AttendanceController.js`
- **Service**: `server/services/AttendanceService.js`
- **Model**: `server/models/AttendanceRecord.js`

## Key Differences

### Old System (UserStatus-based)
- One document per user per day
- Separate queries for each user
- Data stored in `UserStatus` collection
- Endpoints: `/api/status/today`, `/api/summary/week`

### New System (AttendanceRecord-based)
- One document per date (contains all employees)
- Single query for daily reports
- Data stored in `AttendanceRecord` collection
- Endpoints: `/api/attendance-new/*`
- Event-driven calculations
- Better performance for admin queries

## Frontend Migration

All frontend components have been migrated to use `newAttendanceService`:
- ✅ `EmployeeDashboard.jsx`
- ✅ `MyProfile.jsx`
- ✅ `TodayStatusPage.jsx`
- ✅ `AttendancePage.jsx`
- ✅ `SuperAdminAttendancePortal.jsx`

## Data Migration

If you need to migrate old UserStatus data to the new system, use:
```bash
node server/scripts/migrateToNewAttendanceSystem.js
```

## Cleanup

These files can be safely deleted after confirming the new system is working correctly for at least 30 days.

**Recommended Retention**: Keep until 2025-11-06, then delete if no issues found.
