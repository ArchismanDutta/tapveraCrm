# Automatic Payroll System - Documentation

## Overview

The Automatic Payroll System integrates with the attendance system to automatically calculate salaries, deductions, and generate payslips without manual data entry. It uses the same calculation rules as the manual payroll system but fetches attendance data automatically.

---

## Features

### ✅ Automatic Data Fetching
- **Attendance Data**: Automatically fetches attendance records from the date-centric attendance system
- **Leave Data**: Retrieves approved leave requests (paid, unpaid, half-day, WFH)
- **Employee Salary**: Uses salary configured in employee profile

### ✅ Comprehensive Calculations
- **Working Days**: Automatically calculates working days (Mon-Fri) for the month
- **Paid Days**: Present days + Paid leave days + WFH days
- **Late Days**: Counts late arrivals from attendance
- **Half-Days**: Tracks half-day attendance (4-4.5 hours)

### ✅ Salary Components (Same as Manual System)
- **Basic**: 50% of monthly salary
- **HRA**: 35% of monthly salary
- **Conveyance**: 5% of monthly salary
- **Medical**: 5% of monthly salary
- **Special Allowance**: 5% of monthly salary

### ✅ Automatic Deductions
1. **Employee PF**: 12% of basic (capped at ₹1,800) if basic ≤ ₹15,000
2. **ESI**: 0.75% of gross total if salary ≤ ₹21,000
3. **Professional Tax**: Based on salary slabs:
   - < ₹10,000: ₹0
   - ₹10,000-15,000: ₹110
   - ₹15,001-25,000: ₹130
   - ₹25,001-40,000: ₹150
   - > ₹40,000: ₹200
4. **Late Deduction**:
   - First 2 lates: Free
   - Every 3 lates: 1 day salary deduction
   - Extra lates: ₹200 per late
5. **Half-Day Deduction**: 50% of per-day salary
6. **Manual Deductions**: TDS, Other, Advance (optional)

### ✅ Employer Contributions
- **Employer PF**: 12% of basic (capped at ₹1,800) if basic ≤ ₹15,000
- **Employer ESI**: 3.25% of gross total if salary ≤ ₹21,000

---

## Architecture

### Backend Components

#### 1. **AutoPayrollService.js** (`server/services/AutoPayrollService.js`)
Core service that handles all automatic payroll logic:

```javascript
// Main Functions:
- fetchAttendanceForMonth(userId, payPeriod)
  → Fetches attendance data for a specific month

- calculateSalaryBreakdown(monthlySalary, workingDays, paidDays, lateDays, halfDays)
  → Calculates complete salary with all deductions

- generateAutoPayslip(userId, payPeriod, manualDeductions, createdBy)
  → Generates and saves payslip automatically

- generateBulkPayslips(payPeriod, createdBy, options)
  → Generates payslips for all employees

- previewSalaryCalculation(userId, payPeriod)
  → Preview calculations without saving
```

#### 2. **autoPayrollController.js** (`server/controllers/autoPayrollController.js`)
Handles HTTP requests:

- `previewSalaryCalculation` - Preview salary before generating
- `generateSinglePayslip` - Generate payslip for one employee
- `generateBulkPayslips` - Batch generation for all employees
- `getAttendanceSummary` - View attendance data
- `recalculatePayslip` - Regenerate existing payslip
- `getCalculationRules` - Get all calculation rules
- `compareCalculations` - Compare auto vs manual calculations

#### 3. **autoPayrollRoutes.js** (`server/routes/autoPayrollRoutes.js`)
API endpoints:

```
GET  /api/auto-payroll/preview/:userId/:payPeriod
GET  /api/auto-payroll/attendance-summary/:userId/:payPeriod
GET  /api/auto-payroll/calculation-rules
GET  /api/auto-payroll/compare/:userId/:payPeriod
POST /api/auto-payroll/generate
POST /api/auto-payroll/generate-bulk
PUT  /api/auto-payroll/recalculate/:payslipId
```

### Frontend Components

#### 1. **AutoPayrollManagement.jsx** (`client/src/pages/admin/AutoPayrollManagement.jsx`)
Main UI for automatic payroll:

**Features**:
- Month selection for payroll generation
- Employee list with salary information
- Preview salary calculations
- Single payslip generation
- Bulk payslip generation
- Calculation rules viewer
- Real-time generation status
- Bulk generation results summary

**Actions per Employee**:
- **Preview**: See calculations before generating
- **Generate**: Create official payslip

**Bulk Actions**:
- Generate payslips for all filtered employees
- Skip existing payslips automatically
- View detailed results (generated, skipped, failed)

---

## How It Works

### 1. **Data Collection Flow**

```
User selects month (e.g., "2024-12")
        ↓
System fetches attendance records for the month
        ↓
For each employee:
  - Get attendance data (present, late, half-day)
  - Get leave requests (paid, unpaid, WFH)
  - Get employee salary from profile
        ↓
Calculate working days (Mon-Fri only)
        ↓
Calculate paid days (present + paid leaves + WFH)
```

### 2. **Salary Calculation Flow**

```
Monthly Salary (from employee profile)
        ↓
Split into components (Basic 50%, HRA 35%, etc.)
        ↓
Prorate by working days → Gross salary
        ↓
Calculate deductions:
  - PF, ESI, PTax
  - Late deductions
  - Half-day deductions
  - Manual deductions (if any)
        ↓
Gross Salary - Total Deductions = Net Payment
        ↓
Net Payment + Employer contributions = CTC
```

### 3. **Leave Impact on Salary**

| Leave Type | Impact on Salary | Impact on Paid Days |
|------------|------------------|---------------------|
| Paid Leave | ✅ Full salary credited | ✅ Counted as paid |
| Unpaid Leave | ❌ No salary | ❌ Not counted |
| Half Day | ✅ Full day counted, but 50% deduction applied | ✅ Counted as paid |
| Work From Home | ✅ Full salary credited | ✅ Counted as paid |
| Sick Leave | ✅ Full salary credited | ✅ Counted as paid |
| Maternity Leave | ✅ Full salary credited | ✅ Counted as paid |

---

## Usage Guide

### For Admins/HR

#### Single Payslip Generation

1. Navigate to **Auto Payroll** in the sidebar
2. Select the month (e.g., December 2024)
3. Find the employee in the list
4. Click **"Preview"** to see calculations
5. Review the preview:
   - Attendance summary (working days, paid days, lates, half-days)
   - Salary breakdown (gross, deductions, net)
   - All deduction details
6. Click **"Generate Payslip"** to create official payslip
7. Payslip is saved and employee is notified

#### Bulk Payslip Generation

1. Navigate to **Auto Payroll**
2. Select the month
3. (Optional) Filter employees by department or search
4. Click **"Generate Bulk Payslips"** button
5. Confirm the action
6. System generates payslips for all employees:
   - **Generated**: New payslips created
   - **Skipped**: Payslips already exist
   - **Failed**: Errors (e.g., salary not configured)
7. View detailed results

#### Preview Before Generating

- Always preview before generating to verify calculations
- Check attendance data is correct
- Verify deductions are calculated properly
- Compare with manual calculations if needed

#### View Calculation Rules

- Click **"Calculation Rules"** button in header
- Review all salary components, deductions, and leave rules
- Use as reference for understanding calculations

---

## API Endpoints

### Preview Salary Calculation
```http
GET /api/auto-payroll/preview/:userId/:payPeriod
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "employee": {
      "name": "John Doe",
      "employeeId": "EMP001",
      "salary": { "total": 30000 }
    },
    "attendanceData": {
      "workingDays": 22,
      "paidDays": 20,
      "lateDays": 4,
      "halfDays": 1
    },
    "calculations": {
      "grossTotal": 27272.73,
      "deductions": {
        "employeePF": 1800,
        "esi": 204,
        "ptax": 130,
        "lateDeduction": 1363.64,
        "halfDayDeduction": 681.82
      },
      "totalDeductions": 4179.46,
      "netPayment": 23093.27
    }
  }
}
```

### Generate Single Payslip
```http
POST /api/auto-payroll/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "employeeId": "675b5f123456789abcdef",
  "payPeriod": "2024-12",
  "manualDeductions": {
    "tds": 500,
    "advance": 1000
  },
  "remarks": "December salary"
}
```

### Generate Bulk Payslips
```http
POST /api/auto-payroll/generate-bulk
Authorization: Bearer {token}
Content-Type: application/json

{
  "payPeriod": "2024-12",
  "employeeIds": null,  // null = all employees
  "skipExisting": true
}
```

**Response**:
```json
{
  "success": true,
  "results": {
    "total": 50,
    "generated": 45,
    "skipped": 3,
    "failed": 2,
    "details": [
      {
        "employeeId": "675b5f123456789abcdef",
        "employeeName": "John Doe",
        "status": "success",
        "netPayment": 23093.27,
        "paidDays": 20,
        "lateDays": 4
      }
    ]
  }
}
```

---

## Examples

### Example 1: Employee with Perfect Attendance

**Employee**: John Doe
**Monthly Salary**: ₹30,000
**Working Days**: 22
**Present Days**: 22
**Late Days**: 0
**Half Days**: 0

**Calculation**:
```
Salary Components:
  Basic: ₹15,000 (50%)
  HRA: ₹10,500 (35%)
  Conveyance: ₹1,500 (5%)
  Medical: ₹1,500 (5%)
  Special: ₹1,500 (5%)

Gross Total: ₹30,000 (all 22 days paid)

Deductions:
  Employee PF: ₹1,800 (12% of ₹15,000)
  ESI: ₹225 (0.75% of ₹30,000)
  PTax: ₹130
  Late: ₹0
  Half-day: ₹0
  Total: ₹2,155

Net Payment: ₹27,845
CTC: ₹31,575 (includes employer PF ₹1,800 + ESI ₹975)
```

### Example 2: Employee with Lates and Half-Days

**Employee**: Jane Smith
**Monthly Salary**: ₹25,000
**Working Days**: 22
**Present Days**: 22
**Late Days**: 5 (deduction: 1 day + ₹400)
**Half Days**: 2

**Calculation**:
```
Salary Components:
  Basic: ₹12,500 (50%)
  HRA: ₹8,750 (35%)
  Conveyance: ₹1,250 (5%)
  Medical: ₹1,250 (5%)
  Special: ₹1,250 (5%)

Gross Total: ₹25,000

Per Day Salary: ₹25,000 / 22 = ₹1,136.36

Deductions:
  Employee PF: ₹1,500 (12% of ₹12,500)
  ESI: ₹187.50 (0.75% of ₹25,000)
  PTax: ₹130
  Late: ₹1,536.36 (1 day + ₹400)
  Half-day: ₹1,136.36 (2 × 50% of per-day salary)
  Total: ₹4,490.22

Net Payment: ₹20,509.78
```

### Example 3: Employee with Unpaid Leave

**Employee**: Bob Johnson
**Monthly Salary**: ₹40,000
**Working Days**: 22
**Present Days**: 18
**Unpaid Leave**: 4 days
**Late Days**: 0
**Half Days**: 0

**Calculation**:
```
Salary Components (Full Month):
  Basic: ₹20,000 (50%)
  HRA: ₹14,000 (35%)
  Conveyance: ₹2,000 (5%)
  Medical: ₹2,000 (5%)
  Special: ₹2,000 (5%)

Gross Components (Prorated by 18/22 days):
  Basic: ₹16,363.64
  HRA: ₹11,454.55
  Conveyance: ₹1,636.36
  Medical: ₹1,636.36
  Special: ₹1,636.36

Gross Total: ₹32,727.27

Deductions:
  Employee PF: ₹1,800 (on full basic)
  ESI: ₹0 (salary > ₹21,000)
  PTax: ₹200
  Total: ₹2,000

Net Payment: ₹30,727.27
```

---

## Benefits Over Manual System

| Feature | Manual System | Automatic System |
|---------|---------------|------------------|
| **Data Entry** | Admin enters attendance manually | Fetched automatically from attendance |
| **Accuracy** | Prone to human error | Calculated from actual attendance data |
| **Time Required** | ~5-10 minutes per employee | ~5 seconds per employee |
| **Bulk Processing** | Not available | Generate 50+ payslips in seconds |
| **Attendance Sync** | Manual reconciliation needed | Always in sync |
| **Leave Tracking** | Manual counting | Automatic from leave requests |
| **Late Deductions** | Manual calculation | Auto-calculated from attendance |
| **Preview** | Not available | Preview before generating |

---

## Integration with Existing Systems

### ✅ Attendance System
- Reads from `AttendanceRecord` model (date-centric)
- Fetches punch events, work hours, late status
- Tracks half-days (4-4.5 hours)

### ✅ Leave Management
- Reads approved `LeaveRequest` records
- Handles all leave types (paid, unpaid, WFH, half-day)
- Applies sandwich policy automatically

### ✅ Manual Payroll System
- **Kept intact** - No changes to existing manual system
- **Side-by-side** - Both systems coexist
- **Same Payslip Model** - Uses same `Payslip` schema
- **Same Calculations** - Identical calculation rules

---

## Troubleshooting

### Issue: Payslip Already Exists

**Problem**: Trying to generate payslip but one already exists for the month.

**Solution**:
- Use bulk generation with `skipExisting: true` (default)
- Or delete existing payslip first
- Or use "Recalculate" endpoint to regenerate

### Issue: Employee Salary Not Configured

**Problem**: `Employee salary not configured` error.

**Solution**:
- Go to Employee Details/Management
- Set employee's `salary.total` field
- Minimum salary should be > 0

### Issue: No Attendance Data

**Problem**: Payslip shows 0 paid days.

**Solution**:
- Check if attendance records exist for the month
- Verify employee has punched in/out
- Ensure attendance system is running properly

### Issue: Wrong Deductions

**Problem**: Deductions don't match expectations.

**Solution**:
- Use "Preview" to see detailed breakdown
- Verify salary components
- Check calculation rules
- Compare with manual calculation

---

## Future Enhancements

- [ ] Email payslips automatically to employees
- [ ] PDF download of payslips
- [ ] Payroll analytics and reports
- [ ] Multi-currency support
- [ ] Custom deduction rules per employee
- [ ] Payroll approval workflow
- [ ] Integration with accounting software
- [ ] Payslip templates customization

---

## Support

For issues or questions:
1. Check this documentation
2. Review calculation rules in the UI
3. Use preview feature to understand calculations
4. Compare with manual system
5. Check attendance data is correct

---

## Changelog

### Version 1.0.0 (December 2024)
- Initial release of Automatic Payroll System
- Integrated with attendance system
- Automatic salary calculations
- Bulk payslip generation
- Preview functionality
- Calculation rules viewer
- Support for all leave types
- Late and half-day deductions

---

**Created**: December 2024
**Author**: Tapvera CRM Development Team
**License**: Proprietary
