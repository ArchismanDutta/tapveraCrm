# Payroll Calculation System Update

## Summary of Changes

This document outlines the updates made to the automatic payroll calculation system based on new business requirements.

---

## Key Changes

### 1. Working Days Calculation
**Previous Behavior:**
- Working days = Only weekdays (Monday to Friday)
- Excluded Saturdays and Sundays

**New Behavior:**
- Working days = Total number of days in the month
- Includes all calendar days (weekends, holidays, etc.)

**Files Modified:**
- `server/services/AutoPayrollService.js` (lines 112-122)

---

### 2. Leave Payment Logic

#### Paid Leave
- **Payment:** Full day salary (100%)
- **Deduction:** None
- **Types:** Paid leave, Sick leave, Maternity leave

#### Unpaid Leave
- **Payment:** No salary
- **Deduction:** One full day salary

#### Work From Home (WFH)
- **Payment:** Full day salary (100%)
- **Deduction:** None
- **Note:** WFH is not counted as leave; employees are expected to work normal hours

#### Half Day
- **Payment:** 50% of daily salary
- **Deduction:** 50% of daily salary
- **Note:** Half-day leave means employee works reduced hours

---

## Implementation Details

### Paid Days Calculation

```javascript
paidDays = presentDays + paidLeaveDays + wfhDays
```

**Where:**
- `presentDays` = Days employee was physically present or punched in
- `paidLeaveDays` = Approved paid leaves (paid, sick, maternity)
- `wfhDays` = Approved work from home days

### Priority Logic

The system processes attendance in the following priority order:
1. **WFH** → Full payment
2. **Paid Leave** → Full payment
3. **Unpaid Leave** → No payment
4. **Present** → Payment based on attendance (with deductions)

This priority ensures no double-counting when an employee has multiple statuses on the same day.

---

## Files Modified

1. **`server/services/AutoPayrollService.js`**
   - Updated `getWorkingDaysInMonth()` to return total days in month
   - Updated attendance processing logic to avoid double-counting
   - Improved paid days calculation with clearer priority logic
   - Enhanced logging for better debugging

2. **`server/controllers/autoPayrollController.js`**
   - Updated calculation rules documentation
   - Added working days calculation details
   - Clarified leave payment rules

3. **`server/services/AttendanceService.js`**
   - Updated leave type handling to mark sick and maternity as paid leaves
   - Maintained existing WFH and half-day logic

---

## Salary Calculation Formula

```
Monthly Salary = ₹X
Working Days = Total days in month (e.g., 30 or 31)
Per Day Salary = Monthly Salary / Working Days

Paid Days = Present Days + Paid Leave Days + WFH Days

Gross Salary = (Monthly Salary / Working Days) × Paid Days

Deductions:
- Half Day Deduction = Number of Half Days × (Per Day Salary × 50%)
- Late Deduction = (Based on late policy)
- PF, ESI, PT, TDS, etc.

Net Salary = Gross Salary - Total Deductions
```

---

## Examples

### Example 1: Employee with WFH and Paid Leave

**Scenario:**
- Month: January (31 days)
- Monthly Salary: ₹30,000
- Present Days: 20
- WFH Days: 5
- Paid Leave Days: 3
- Unpaid Leave Days: 2
- Absent: 1

**Calculation:**
```
Working Days = 31
Per Day Salary = 30,000 / 31 = ₹967.74

Paid Days = 20 + 5 + 3 = 28 days

Gross Salary = (30,000 / 31) × 28 = ₹27,096.77
```

### Example 2: Employee with Half Days

**Scenario:**
- Month: February (28 days)
- Monthly Salary: ₹40,000
- Present Days: 22 (includes 2 half days)
- Half Days: 2

**Calculation:**
```
Working Days = 28
Per Day Salary = 40,000 / 28 = ₹1,428.57

Paid Days = 22

Gross Salary = (40,000 / 28) × 22 = ₹31,428.57

Half Day Deduction = 2 × (1,428.57 × 50%) = ₹1,428.57

Adjusted Gross = 31,428.57 - 1,428.57 = ₹30,000
```

---

## Testing Recommendations

1. **Test with different months** (28, 29, 30, 31 days)
2. **Test with various leave combinations**
3. **Verify no double-counting** when WFH + Present on same day
4. **Check edge cases** (all WFH, all paid leave, all unpaid)
5. **Validate half-day deductions** are exactly 50%

---

## Benefits

1. ✅ **Simpler calculation** - Uses total calendar days
2. ✅ **Fair payment** - All leave types properly compensated
3. ✅ **No double-counting** - Priority-based logic prevents errors
4. ✅ **Transparent** - Clear documentation of rules
5. ✅ **Flexible** - Handles all leave type combinations

---

## Date: December 5, 2025
## Updated By: Claude Code
