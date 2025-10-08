# Correct Timezone Handling Approach

## Current Problem
The "Option C" approach stores local time as UTC, which breaks when:
- Server and client are in different timezones
- Users are in different timezones
- Server timezone changes (moving AWS regions)

## The Correct Solution

### 1. Backend Storage (Server)
**Store everything in actual UTC timestamps**

```javascript
// ✅ CORRECT: Use actual UTC timestamps
const now = new Date(); // This is already UTC internally
const timestamp = now.toISOString(); // "2025-10-08T03:59:30.528Z" (actual UTC)

// Save to database - MongoDB stores as UTC by default
event.timestamp = new Date(); // Stores actual UTC time
```

**Remove all Option C conversions:**
- Remove the fake UTC timestamp creation in `recordPunchEvent`
- Remove the fake UTC timestamp in `recalculateEmployeeData`
- Let JavaScript Date objects work naturally (they're always UTC internally)

### 2. User Timezone Storage
**Add timezone field to User model:**

```javascript
// Add to User schema
timezone: {
  type: String,
  default: 'Asia/Kolkata' // IANA timezone identifier
}
```

**Detect timezone on frontend:**
```javascript
// Get user's timezone
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Returns: "Asia/Kolkata", "America/New_York", etc.
```

### 3. Shift Times Storage
**Store shifts with timezone context:**

```javascript
// Current problem: "09:00" - what timezone?
// Solution: Store with timezone or store as time-only

shift: {
  startTime: "09:00", // Time only, interpreted in user's timezone
  endTime: "18:00",
  timezone: "Asia/Kolkata" // The timezone this shift applies to
}
```

### 4. Frontend Display
**Use Intl.DateTimeFormat with user's timezone:**

```javascript
// ✅ CORRECT: Display in user's local time
const formatTime = (utcTimestamp, userTimezone) => {
  const date = new Date(utcTimestamp); // Parse UTC timestamp

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: userTimezone || 'Asia/Kolkata'
  }).format(date);
};

// Example:
// UTC: "2025-10-08T03:59:30Z"
// Display in IST: "09:29 AM" (user in India)
// Display in EST: "11:59 PM" (user in New York, previous day)
```

### 5. Duration Calculations
**Always calculate in UTC, display in local:**

```javascript
// ✅ CORRECT: Duration calculation (timezone-independent)
const startUTC = new Date("2025-10-08T03:59:30Z");
const endUTC = new Date("2025-10-08T09:32:24Z");
const durationSeconds = (endUTC - startUTC) / 1000; // Always correct

// Display times in user's timezone
const displayStart = formatTime(startUTC, userTimezone); // "09:29 AM" IST
const displayEnd = formatTime(endUTC, userTimezone);     // "03:02 PM" IST
```

## Implementation Steps

### Phase 1: Backend Changes (Critical)
1. **Remove Option C conversions** - Let Date objects be UTC naturally
2. **Update `recordPunchEvent`** - Use `new Date()` directly
3. **Update `recalculateEmployeeData`** - Use `new Date()` for current time
4. **Test timestamps** - Verify they're actual UTC in database

### Phase 2: User Timezone Support
1. **Add timezone field to User model**
2. **Auto-detect timezone on signup/login**
3. **Allow users to change timezone in settings**
4. **Store user's timezone preference**

### Phase 3: Frontend Display
1. **Update timeUtils.js** - Use Intl.DateTimeFormat with user's timezone
2. **Update all time displays** - Timeline, StatusCard, etc.
3. **Update shift time comparisons** - Consider user's timezone

### Phase 4: Shift Management
1. **Add timezone to shift definitions**
2. **Update shift comparison logic** - Convert shift times to UTC for comparison
3. **Update late arrival calculation** - Use timezone-aware comparison

## Migration Strategy

### For Existing Data
```javascript
// Existing data in DB has "fake UTC" timestamps
// Need to convert back to actual UTC

const migrateTimestamps = async () => {
  const records = await AttendanceRecord.find({});

  for (const record of records) {
    for (const employee of record.employees) {
      for (const event of employee.events) {
        // If timestamp is "Option C" (local as UTC)
        // Convert: "2025-10-08T09:29:30Z" -> "2025-10-08T03:59:30Z"
        // Subtract IST offset (5 hours 30 minutes)

        const optionCDate = new Date(event.timestamp);
        const actualUTC = new Date(
          optionCDate.getTime() - (5.5 * 60 * 60 * 1000)
        );
        event.timestamp = actualUTC;
      }
    }
    await record.save();
  }
};
```

## Benefits of This Approach

✅ **Server location independent** - Works regardless of where server is deployed
✅ **Multi-timezone support** - Users in different timezones see correct times
✅ **Standard approach** - Uses industry best practices
✅ **No timezone hacks** - Clean, maintainable code
✅ **Accurate calculations** - Durations always correct
✅ **Database portability** - Standard UTC storage

## Testing Checklist

- [ ] Punch in shows correct time in IST
- [ ] Same data shows correct time in different timezone (e.g., EST)
- [ ] Durations calculate correctly across timezones
- [ ] Shift times compare correctly
- [ ] Late arrival detection works in all timezones
- [ ] Timeline shows correct times
- [ ] AWS deployment shows correct times
- [ ] Server timezone change doesn't affect data

## Quick Fix for Current Issue

If you need a quick fix for AWS right now:

1. **Set server timezone to IST:**
```bash
# On AWS server
sudo timedatectl set-timezone Asia/Kolkata
```

2. **Or use environment variable:**
```bash
# In .env or startup script
TZ=Asia/Kolkata node app.js
```

But this is a **temporary workaround**. The proper solution is to implement the UTC storage + timezone display approach above.
