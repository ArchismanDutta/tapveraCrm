# Salary and Attendance Alignment Documentation

## Overview

This document explains how the automatic payroll system integrates with the attendance system to calculate employee salaries based on actual attendance, leave, and work-from-home (WFH) status.

## Core Architecture

### System Components

1. **AttendanceRecord Model**: Stores daily attendance with punch events
2. **LeaveRequest Model**: Stores approved/pending leave requests
3. **AttendanceService**: Handles punch in/out and attendance calculations
4. **AutoPayrollService**: Fetches attendance and calculates salary
5. **Payslip Model**: Stores generated salary slips

## Critical Principle: WFH Requires Punch-In

**WFH approval does NOT automatically count as attendance for salary.**

- Employee must punch in on WFH-approved dates
- Only when punched in is the day counted in `wfhDays`
- Only then does it contribute to `paidDays` for salary calculation

This ensures accountability and accurate tracking of actual working days.

## Attendance Data Flow for Salary Calculation

### Step 1: Fetch Attendance Records

**Location**: `AutoPayrollService.js:131-148`

```javascript
async fetchAttendanceForMonth(userId, payPeriod) {
  const [year, month] = payPeriod.split("-").map(Number);

  // Get start and end dates for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Fetch all attendance records for the month
  const attendanceRecords = await AttendanceRecord.find({
    date: { $gte: startDate, $lte: endDate },
  }).lean();
}
```

**What happens:**
- Queries AttendanceRecord collection for entire month
- Returns all date-level attendance records
- Each record contains `employees` array with individual employee data

### Step 2: Process Each Employee's Attendance

**Location**: `AutoPayrollService.js:166-255`

```javascript
for (const record of attendanceRecords) {
  const employeeData = record.employees?.find(
    (emp) => emp.userId && emp.userId.toString() === userId.toString()
  );

  if (employeeData) {
    // ⭐ IMPORTANT: Recalculate to ensure consistency
    const attendanceService = new AttendanceService();
    attendanceService.recalculateEmployeeData(employeeData, record.date);

    const calc = employeeData.calculated || {};
    const leaveInfo = employeeData.leaveInfo || {};

    // Categorize the day based on priority order
  }
}
```

**What happens:**
1. Finds employee's data within the date's attendance record
2. **Recalculates** employee data to ensure fresh calculations
3. Extracts `calculated` (isPresent, isLate, isHalfDay, workHours)
4. Extracts `leaveInfo` (isWFH, isPaidLeave, isOnLeave, leaveType)

### Step 3: Categorize Days (Priority Order)

**Location**: `AutoPayrollService.js:209-253`

#### Priority 1: WFH Days (lines 216-219)

```javascript
if (isWFH) {
  wfhDays++;
  console.log(`   🏠 ${record.date}: WFH Day`);
}
```

**Conditions:**
- `leaveInfo.isWFH === true` (set by AttendanceService when employee punches in on WFH-approved date)
- Employee has punched in on the date
- Approved WFH request exists for the date

**Salary Impact:**
- ✅ Counted in `paidDays` (full payment)
- ✅ No deductions
- ✅ Counts as full working day

#### Priority 2: Paid Leave Days (lines 221-224)

```javascript
else if (isPaidLeave) {
  paidLeaveDays++;
  console.log(`   🌴 ${record.date}: Paid Leave (${leaveInfo.leaveType})`);
}
```

**Leave Types:**
- `paid`
- `sick`
- `maternity`

**Salary Impact:**
- ✅ Counted in `paidDays` (full payment)
- ✅ No punch-in required
- ✅ Counts as full working day

#### Priority 3: Unpaid Leave Days (lines 226-229)

```javascript
else if (isUnpaidLeave) {
  unpaidLeaveDays++;
  console.log(`   ❌ ${record.date}: Unpaid Leave`);
}
```

**Leave Types:**
- `unpaid`

**Salary Impact:**
- ❌ NOT counted in `paidDays`
- ❌ No payment for the day
- ❌ Reduces salary

#### Priority 4: Present Days (lines 231-251)

```javascript
else if (calc.isPresent) {
  presentDays++;

  if (calc.isLate) {
    lateDays++;
  }

  if (calc.isHalfDay) {
    halfDays++;
  } else if (calc.isFullDay) {
    fullDays++;
  }

  totalWorkHours += calc.workDurationSeconds / 3600;
}
```

**Conditions:**
- Employee punched in on the date
- Not on any leave
- Not WFH (WFH is higher priority)

**Salary Impact:**
- ✅ Counted in `paidDays`
- ⚠️ May have half-day deductions if `isHalfDay === true`
- ⚠️ Late days tracked (currently not deducted in new formula, kept for compatibility)

#### Priority 5: Absent Days

```javascript
else {
  console.log(`   ❌ ${record.date}: Absent`);
}
```

**Conditions:**
- No attendance record for the employee
- OR `calc.isPresent === false`

**Salary Impact:**
- ❌ NOT counted in `paidDays`
- ❌ No payment for the day
- ❌ Reduces salary

### Step 4: Calculate Paid Days

**Location**: `AutoPayrollService.js:264-287`

```javascript
// Calculate weekend days (Saturdays and Sundays) in the month
const weekendDays = this.getWeekendDaysInMonth(year, month);

// Calculate paid days
const paidDays = presentDays + paidLeaveDays + wfhDays + weekendDays;

console.log(`✅ Attendance Summary:`);
console.log(`   Present Days: ${presentDays}`);
console.log(`   Paid Leave Days: ${paidLeaveDays}`);
console.log(`   WFH Days (Full Payment): ${wfhDays}`);
console.log(`   Weekend Days (Sat & Sun - Always Paid): ${weekendDays}`);
console.log(`   Unpaid Leave Days: ${unpaidLeaveDays}`);
console.log(`   Total Paid Days: ${paidDays}`);
```

**Formula:**
```
paidDays = presentDays + paidLeaveDays + wfhDays + weekendDays
```

**Components:**
- **presentDays**: Days employee punched in (not on leave, not WFH)
- **paidLeaveDays**: Days on approved paid leave (sick, paid, maternity)
- **wfhDays**: Days on approved WFH AND punched in
- **weekendDays**: Saturdays and Sundays in the month (ALWAYS PAID)

**⚠️ Important:** Weekends are always counted as paid, regardless of attendance. This means:
- Employee gets paid for ~8-9 weekend days per month automatically
- No punch-in required for weekends
- This is standard practice for salaried employees

## Salary Calculation

### Step 1: Calculate Salary Components

**Location**: `AutoPayrollService.js:467-474`

```javascript
const salaryComponents = {
  basic: monthlySalary * 0.5,        // 50%
  hra: monthlySalary * 0.35,         // 35%
  conveyance: monthlySalary * 0.05,  // 5%
  medical: monthlySalary * 0.05,     // 5%
  specialAllowance: monthlySalary * 0.05, // 5%
};
```

**Breakdown:**
- Monthly salary is split into 5 components
- Percentages are fixed
- Total = 100% of monthly salary

### Step 2: Prorate Components by Paid Days

**Location**: `AutoPayrollService.js:483-490`

```javascript
const grossComponents = {
  basic: (salaryComponents.basic / safeWorkingDays) * paidDays,
  hra: (salaryComponents.hra / safeWorkingDays) * paidDays,
  conveyance: (salaryComponents.conveyance / safeWorkingDays) * paidDays,
  medical: (salaryComponents.medical / safeWorkingDays) * paidDays,
  specialAllowance: (salaryComponents.specialAllowance / safeWorkingDays) * paidDays,
};
```

**Formula for each component:**
```
Paid Component = (Component Amount / Working Days) × Paid Days
```

**Example:**
- Monthly Salary: ₹30,000
- Basic Component: ₹30,000 × 50% = ₹15,000
- Working Days in Month: 31
- Paid Days: 28 (includes weekends, WFH, present days)
- **Basic Paid**: (₹15,000 / 31) × 28 = ₹13,548.39

**What this means:**
- If employee has unpaid leaves, `paidDays` is less than `workingDays`
- Each component is reduced proportionally
- WFH days contribute to `paidDays`, so WFH employees get full payment

### Step 3: Calculate Net Total

**Location**: `AutoPayrollService.js:493-496`

```javascript
const netTotal = Object.values(grossComponents).reduce(
  (sum, val) => sum + val,
  0
);
```

**Formula:**
```
Net Total = Basic Paid + HRA Paid + Conveyance Paid + Medical Paid + Special Allowance Paid
```

### Step 4: Calculate Deductions

**Location**: `AutoPayrollService.js:499-530`

#### Employee PF (Provident Fund)

```javascript
const pfEligible = salaryComponents.basic <= 15000;
const employeePF = pfEligible
  ? Math.min(1800, grossComponents.basic * 0.12)
  : 0;
```

**Rules:**
- Only applicable if **basic salary ≤ ₹15,000**
- Rate: **12% of basic paid**
- Cap: **₹1,800 maximum**

#### ESI (Employee State Insurance)

```javascript
const esiApplicable = grossTotal <= 21000;
const esi = esiApplicable
  ? netTotal * 0.0075
  : 0;
```

**Rules:**
- Only applicable if **gross total ≤ ₹21,000**
- Rate: **0.75% of net total**
- No cap

#### Professional Tax (PTax)

```javascript
const ptax = this.calculatePTax(monthlySalary);
```

**Slabs:**

| Monthly Salary Range | Professional Tax |
|---------------------|------------------|
| < ₹10,000 | ₹0 |
| ₹10,000 - ₹15,000 | ₹110 |
| ₹15,001 - ₹25,000 | ₹130 |
| ₹25,001 - ₹40,000 | ₹150 |
| > ₹40,000 | ₹200 |

**Note:** PTax is based on **monthly salary**, not net total

#### Manual Deductions

```javascript
tds: manualDeductions.tds || 0,
other: manualDeductions.other || 0,
advance: manualDeductions.advance || 0,
```

**Types:**
- **TDS**: Tax Deducted at Source (manual entry)
- **Other**: Miscellaneous deductions
- **Advance**: Salary advance adjustments

#### Legacy Deductions (Not Used in New Formula)

```javascript
lateDeduction: 0,
halfDayDeduction: 0,
```

**Note:** These are kept for schema/UI compatibility but are set to 0. The new formula handles attendance via `paidDays` proration instead.

### Step 5: Calculate Employer Contributions

**Location**: `AutoPayrollService.js:533-543`

```javascript
const employerContributions = {
  employerPF: pfEligible
    ? Math.min(1800, grossComponents.basic * 0.12)
    : 0,
  employerESI: esiApplicable
    ? netTotal * 0.0325
    : 0,
};
```

**Rules:**
- **Employer PF**: Same as Employee PF (12% of basic paid, cap ₹1,800)
- **Employer ESI**: 3.25% of net total (if applicable)

### Step 6: Calculate Final Amounts

**Location**: `AutoPayrollService.js:546-558`

```javascript
const totalDeductions =
  deductions.employeePF +
  deductions.esi +
  deductions.tds +
  deductions.ptax +
  deductions.other +
  deductions.advance;

const netPayment = netTotal - totalDeductions;

const ctc =
  totalDeductions +
  netPayment +
  employerContributions.employerPF +
  employerContributions.employerESI;
```

**Formulas:**

| Metric | Formula |
|--------|---------|
| **Total Deductions** | PF + ESI + TDS + PTax + Other + Advance |
| **Net Payment** | Net Total - Total Deductions |
| **CTC** | Total Deductions + Net Payment + Employer PF + Employer ESI |

## WFH Salary Calculation Examples

### Example 1: Full Month WFH with Perfect Punch-In

**Scenario:**
- Employee: John Doe
- Monthly Salary: ₹30,000
- Month: July 2026 (31 days)
- WFH Requests: All working days (approved)
- Punch-In: All WFH days (22 working days)
- Weekends: 8 days (Sat & Sun)
- Holidays: 1 day (15th July - Approved holiday)

**Attendance Breakdown:**
```
Working Days (Total): 31
Weekend Days: 8 (auto-paid)
Holiday: 1 (auto-paid, if official holiday)
WFH Days (Punched In): 22
Present Days: 0 (all days were WFH)
Paid Leave Days: 0
Unpaid Leave Days: 0
```

**Paid Days Calculation:**
```
paidDays = presentDays + paidLeaveDays + wfhDays + weekendDays
paidDays = 0 + 0 + 22 + 8 = 30 days
```

**Salary Calculation:**
```
Basic Component: ₹30,000 × 50% = ₹15,000
Basic Paid: (₹15,000 / 31) × 30 = ₹14,516.13

HRA Component: ₹30,000 × 35% = ₹10,500
HRA Paid: (₹10,500 / 31) × 30 = ₹10,161.29

... (other components similarly)

Net Total: ₹29,032.26
Deductions (PF, ESI, PTax): ~₹2,673.87
Net Payment: ₹26,358.39
```

**Result:** Employee gets ~96.8% of full salary (30/31 days paid)

### Example 2: WFH Approved but No Punch-In

**Scenario:**
- Employee: Jane Smith
- Monthly Salary: ₹30,000
- Month: July 2026 (31 days)
- WFH Requests: 5 days (Mon-Fri, approved)
- Punch-In: 0 days (forgot to punch in)
- Regular Office Days: 17 days (punched in)
- Weekends: 8 days

**Attendance Breakdown:**
```
Working Days (Total): 31
Weekend Days: 8 (auto-paid)
WFH Days (Punched In): 0 ❌ (approved but didn't punch in)
Present Days: 17 (office days)
Paid Leave Days: 0
Unpaid Leave Days: 5 (WFH without punch-in = absent)
```

**Paid Days Calculation:**
```
paidDays = presentDays + paidLeaveDays + wfhDays + weekendDays
paidDays = 17 + 0 + 0 + 8 = 25 days
```

**Salary Calculation:**
```
Basic Paid: (₹15,000 / 31) × 25 = ₹12,096.77
HRA Paid: (₹10,500 / 31) × 25 = ₹8,467.74
... (other components)

Net Total: ₹24,193.55
Deductions: ~₹2,228.06
Net Payment: ₹21,965.49
```

**Result:** Employee gets only ~78% of salary due to not punching in on WFH days!

### Example 3: Mixed Attendance (Office + WFH + Leaves)

**Scenario:**
- Employee: Alice Johnson
- Monthly Salary: ₹40,000
- Month: July 2026 (31 days)
- Office Days (Present): 12 days
- WFH Days (Approved + Punched In): 5 days
- Paid Leave (Sick): 2 days
- Unpaid Leave: 1 day
- Late Days: 3 days (within present days)
- Half Days: 1 day (within present days)
- Weekends: 8 days

**Attendance Breakdown:**
```
Working Days (Total): 31
Weekend Days: 8
Present Days: 12
WFH Days: 5
Paid Leave Days: 2
Unpaid Leave Days: 1
Late Days: 3
Half Days: 1
```

**Paid Days Calculation:**
```
paidDays = presentDays + paidLeaveDays + wfhDays + weekendDays
paidDays = 12 + 2 + 5 + 8 = 27 days
```

**Salary Calculation:**
```
Basic Component: ₹40,000 × 50% = ₹20,000
Basic Paid: (₹20,000 / 31) × 27 = ₹17,419.35

HRA Component: ₹40,000 × 35% = ₹14,000
HRA Paid: (₹14,000 / 31) × 27 = ₹12,193.55

... (other components)

Net Total: ₹34,838.71
Deductions (No PF as basic > ₹15,000, ESI not applicable, PTax ₹150): ₹150
Net Payment: ₹34,688.71
```

**Result:** Employee gets ~87% of salary (27/31 days paid)

**Note:** Late days and half-day are tracked but **not deducted** in the new formula. They're included in the attendance record for reference only.

## Leave Type Salary Impact Summary

| Leave Type | Punch-In Required? | Counted in Paid Days? | Salary Impact |
|------------|-------------------|----------------------|---------------|
| **Work From Home** | ✅ Yes | ✅ Yes (if punched in) | Full day payment |
| **Paid Leave** | ❌ No | ✅ Yes | Full day payment |
| **Sick Leave** | ❌ No | ✅ Yes | Full day payment |
| **Maternity Leave** | ❌ No | ✅ Yes | Full day payment |
| **Unpaid Leave** | ❌ No | ❌ No | No payment (deduction) |
| **Half Day** | ⚠️ Special | Partial | 50% deduction (legacy) |
| **Weekends** | ❌ No | ✅ Yes (always) | Full day payment |
| **Holidays** | ❌ No | ✅ Yes (if official) | Full day payment |

## API Endpoints

### 1. Preview Salary Calculation

**Endpoint:** `GET /api/auto-payroll/preview/:userId/:payPeriod`

**Example:** `GET /api/auto-payroll/preview/64abc123/2026-07`

**Response:**
```json
{
  "success": true,
  "data": {
    "employee": {
      "name": "John Doe",
      "employeeId": "EMP001",
      "email": "john@example.com",
      "department": "Engineering",
      "salary": 30000
    },
    "payPeriod": "2026-07",
    "monthlySalary": 30000,
    "attendanceData": {
      "workingDays": 31,
      "presentDays": 17,
      "lateDays": 2,
      "halfDays": 1,
      "wfhDays": 5,
      "paidLeaveDays": 1,
      "unpaidLeaveDays": 0,
      "paidDays": 31,
      "totalWorkHours": 176.5
    },
    "calculations": {
      "grossTotal": 30000,
      "netTotal": 30000,
      "totalDeductions": 2673.87,
      "netPayment": 27326.13
    }
  }
}
```

### 2. Generate Single Payslip

**Endpoint:** `POST /api/auto-payroll/generate`

**Request:**
```json
{
  "employeeId": "64abc123",
  "payPeriod": "2026-07",
  "manualDeductions": {
    "tds": 500,
    "advance": 1000
  },
  "remarks": "July 2026 salary"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payslip generated successfully",
  "payslip": {
    "_id": "payslip_id",
    "employee": {...},
    "payPeriod": "2026-07",
    "workingDays": 31,
    "paidDays": 31,
    "netPayment": 25826.13
  },
  "attendanceData": {...},
  "calculations": {...}
}
```

### 3. Generate Bulk Payslips

**Endpoint:** `POST /api/auto-payroll/generate-bulk`

**Request:**
```json
{
  "payPeriod": "2026-07",
  "skipExisting": true,
  "employeeIds": ["64abc123", "64def456"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk payslip generation completed",
  "results": {
    "total": 50,
    "generated": 45,
    "skipped": 3,
    "failed": 2,
    "details": [...]
  }
}
```

### 4. Get Attendance Summary

**Endpoint:** `GET /api/auto-payroll/attendance-summary/:userId/:payPeriod`

**Example:** `GET /api/auto-payroll/attendance-summary/64abc123/2026-07`

**Response:**
```json
{
  "success": true,
  "data": {
    "workingDays": 31,
    "presentDays": 17,
    "wfhDays": 5,
    "paidLeaveDays": 1,
    "unpaidLeaveDays": 0,
    "paidDays": 31,
    "attendanceDetails": [
      {
        "date": "2026-07-01T00:00:00.000Z",
        "status": "present",
        "isLate": false,
        "isWFH": false,
        "workHours": 8.5
      }
    ]
  }
}
```

## System Guarantees

### ✅ What the System Ensures

1. **WFH Accountability**: WFH approval alone doesn't count as attendance
2. **Accurate Proration**: Salary is proportional to `paidDays / workingDays`
3. **Leave Integration**: All leave types properly affect salary
4. **Weekend Payment**: Weekends always count as paid days
5. **Fresh Calculations**: Attendance data is recalculated before salary generation
6. **Audit Trail**: Detailed logging of all attendance categorizations

### ⚠️ Important Behaviors

1. **Weekend Auto-Payment**: Employees get paid for weekends even with zero attendance
2. **WFH Punch-In Required**: Forgetting to punch in on WFH days = absent = salary deduction
3. **Working Days = Calendar Days**: Working days includes all days (weekends, holidays)
4. **Late/Half-Day Tracking**: Currently tracked but not deducted (legacy compatibility)
5. **Component-Based Proration**: Each salary component is reduced proportionally

## Database Schema

### Payslip Model

```javascript
{
  employee: ObjectId,
  payPeriod: String, // "YYYY-MM"
  monthlySalary: Number,
  workingDays: Number, // Total days in month
  paidDays: Number, // presentDays + paidLeaveDays + wfhDays + weekendDays
  lateDays: Number,
  halfDays: Number,

  salaryComponents: {
    basic: Number,
    hra: Number,
    conveyance: Number,
    medical: Number,
    specialAllowance: Number
  },

  grossComponents: {
    basic: Number, // Prorated by paidDays
    hra: Number,
    conveyance: Number,
    medical: Number,
    specialAllowance: Number
  },

  grossTotal: Number, // Sum of salaryComponents
  netTotal: Number, // Sum of grossComponents

  eligibility: {
    pf: Boolean,
    esi: Boolean
  },

  deductions: {
    employeePF: Number,
    esi: Number,
    ptax: Number,
    lateDeduction: Number, // Legacy (0)
    halfDayDeduction: Number, // Legacy (0)
    tds: Number,
    other: Number,
    advance: Number
  },

  totalDeductions: Number,

  employerContributions: {
    employerPF: Number,
    employerESI: Number
  },

  netPayment: Number,
  ctc: Number,

  remarks: String,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## Common Questions

**Q: Does WFH approval automatically add to paid days?**
A: No. Employee must punch in on WFH-approved dates for it to count as a paid day.

**Q: What happens if employee forgets to punch in on WFH day?**
A: The day is treated as absent and NOT counted in `paidDays`, resulting in salary deduction.

**Q: Are weekends paid even if employee doesn't work?**
A: Yes. Weekends (Saturday & Sunday) are always counted as paid days for salaried employees.

**Q: How are late days handled in salary?**
A: Late days are tracked but NOT deducted in the current formula. The old `lateDeduction` field is set to 0.

**Q: How are half-days calculated?**
A: Half-days are tracked but NOT deducted separately. They're already reflected in `paidDays` calculation.

**Q: What's the difference between `grossTotal` and `netTotal`?**
A:
- `grossTotal` = Sum of full salary components (before attendance proration)
- `netTotal` = Sum of prorated components based on paidDays

**Q: Why is CTC calculated the way it is?**
A: CTC (Cost to Company) includes all costs: employee take-home + deductions + employer contributions.

## Troubleshooting

### Issue: Employee shows 0 paid days despite working

**Check:**
1. Are attendance records created in AttendanceRecord collection?
2. Does the attendance record have the employee in the `employees` array?
3. Is `calculated.isPresent` set to true?
4. Is the pay period correct (YYYY-MM format)?

### Issue: WFH days not counted in salary

**Check:**
1. Is there an approved WFH leave request for the date?
2. Did the employee punch in on the WFH date?
3. Is `leaveInfo.isWFH` set to true in the attendance record?
4. Check console logs for WFH day tracking

### Issue: Salary seems too low

**Check:**
1. How many unpaid leave days does the employee have?
2. How many weekend days are in the month?
3. What's the `paidDays / workingDays` ratio?
4. Are there manual deductions (TDS, advance)?

### Issue: Weekends not included in paid days

**Check:**
1. Is `getWeekendDaysInMonth()` being called correctly?
2. Are Saturdays (6) and Sundays (0) being detected?
3. Check the returned `weekendDays` count in the attendance summary

## Related Documentation

- [Attendance and WFH Integration](./ATTENDANCE_WFH_INTEGRATION.md)
- [Auto Payroll System](../AUTO_PAYROLL_SYSTEM.md)
- [Perfect Attendance Bonus Feature](../PERFECT_ATTENDANCE_BONUS_FEATURE.md)

## Migration Notes

If migrating from manual payslip generation:

1. **Attendance Data Required**: Ensure all attendance records are populated before generating payslips
2. **WFH Policy Change**: Communicate to employees that WFH requires punch-in
3. **Weekend Payment**: Confirm if weekend auto-payment aligns with company policy
4. **Late/Half-Day**: Old deductions are no longer applied; proration handles everything
5. **Testing**: Run preview calculations before generating actual payslips

## Future Enhancements

Potential improvements:

1. **Configurable Weekend Policy**: Allow companies to choose whether weekends are auto-paid
2. **Holiday Auto-Detection**: Automatically include official holidays in paid days
3. **Grace Period for WFH**: Allow late punch-ins on WFH days with warnings
4. **Automated Reminders**: Notify employees to punch in on WFH days
5. **Shift-Based Calculations**: Support different shift timings for salary calculation
6. **Performance Bonuses**: Integrate with performance metrics for bonus calculation
