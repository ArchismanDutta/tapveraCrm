const Shift = require("../models/Shift");
const User = require("../models/User");


// ======================
// Get All Shifts
// GET /api/shifts
// ======================
exports.getAllShifts = async (req, res) => {
  try {
    // Find shifts that are either active or don't have isActive field (for backward compatibility)
    const shifts = await Shift.find({ 
      $or: [
        { isActive: true },
        { isActive: { $exists: false } }
      ]
    }).sort({ start: 1 });
    
    console.log(`Found ${shifts.length} shifts in database`);
    res.json(shifts);
  } catch (err) {
    console.error("Get shifts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Create New Shift
// POST /api/shifts
// ======================
exports.createShift = async (req, res) => {
  try {
    const { name, start, end, durationHours, description } = req.body;

    if (!name || !start || !end) {
      return res.status(400).json({
        message: "Name, start time, and end time are required"
      });
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      return res.status(400).json({
        message: "Start and end times must be in HH:mm format"
      });
    }

    // Calculate duration if not provided
    let calculatedDuration = durationHours;
    if (!calculatedDuration) {
      const [startH, startM] = start.split(":").map(Number);
      const [endH, endM] = end.split(":").map(Number);
      
      let startMinutes = startH * 60 + startM;
      let endMinutes = endH * 60 + endM;
      
      // Handle overnight shifts
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60; // Add 24 hours
      }
      
      calculatedDuration = (endMinutes - startMinutes) / 60;
    }

    const shift = new Shift({
      name,
      start,
      end,
      durationHours: calculatedDuration,
      description: description || "",
      isFlexible: false,
      isActive: true
    });

    await shift.save();
    res.status(201).json({ message: "Shift created successfully", shift });
  } catch (err) {
    console.error("Create shift error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Update Shift
// PUT /api/shifts/:id
// ======================
exports.updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start, end, durationHours, description, isActive } = req.body;

    const shift = await Shift.findById(id);
    if (!shift) {
      return res.status(404).json({ message: "Shift not found" });
    }

    // Validate time format if provided
    if (start || end) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (start && !timeRegex.test(start)) {
        return res.status(400).json({ message: "Invalid start time format. Use HH:mm" });
      }
      if (end && !timeRegex.test(end)) {
        return res.status(400).json({ message: "Invalid end time format. Use HH:mm" });
      }
    }

    if (name !== undefined) shift.name = name;
    if (start !== undefined) shift.start = start;
    if (end !== undefined) shift.end = end;
    if (durationHours !== undefined) shift.durationHours = durationHours;
    if (description !== undefined) shift.description = description;
    if (isActive !== undefined) shift.isActive = isActive;

    await shift.save();

    // Update all users assigned to this shift with the new details
    await User.updateMany(
      { assignedShift: id },
      {
        $set: {
          "shift.name": shift.name,
          "shift.start": shift.start,
          "shift.end": shift.end,
          "shift.durationHours": shift.durationHours,
        }
      }
    );

    res.json({ message: "Shift updated successfully", shift });
  } catch (err) {
    console.error("Update shift error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Delete Shift
// DELETE /api/shifts/:id
// ======================
exports.deleteShift = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any users are assigned to this shift
    const usersWithShift = await User.find({ assignedShift: id });
    if (usersWithShift.length > 0) {
      return res.status(400).json({
        message: `Cannot delete shift. ${usersWithShift.length} employee(s) are assigned to this shift.`,
        employees: usersWithShift.map(user => ({ id: user._id, name: user.name, employeeId: user.employeeId }))
      });
    }

    const shift = await Shift.findByIdAndDelete(id);
    if (!shift) {
      return res.status(404).json({ message: "Shift not found" });
    }

    res.json({ message: "Shift deleted successfully" });
  } catch (err) {
    console.error("Delete shift error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Assign Shift to Employee
// PUT /api/shifts/assign/:userId
// ======================
exports.assignShiftToEmployee = async (req, res) => {
  try {
    const { userId } = req.params;
    const { shiftId, shiftType } = req.body;

    if (!shiftType || !["standard", "flexiblePermanent"].includes(shiftType)) {
      return res.status(400).json({ 
        message: "Valid shiftType is required (standard or flexiblePermanent)" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Check if user has required fields for shift assignment
    if (!user.employeeId || !user.doj) {
      return res.status(400).json({
        message: "Employee profile is incomplete. Please complete the employee profile (Employee ID and Date of Joining are required) before assigning shifts.",
        missingFields: {
          employeeId: !user.employeeId,
          doj: !user.doj
        }
      });
    }

    // Fix salary field if it's a primitive value (migration fix)
    if (user.salary && typeof user.salary === 'number') {
      user.salary = {
        basic: user.salary,
        total: user.salary,
        paymentMode: 'bank'
      };
    } else if (!user.salary || typeof user.salary !== 'object') {
      user.salary = {
        basic: 0,
        total: 0,
        paymentMode: 'bank'
      };
    }

    if (shiftType === "flexiblePermanent") {
      // For flexible permanent employees
      user.shiftType = "flexiblePermanent";
      user.assignedShift = null;
      user.standardShiftType = null;
      user.shift = {
        name: "Flexible 9h/day",
        start: "00:00",
        end: "23:59",
        durationHours: 9,
        isFlexible: true,
        shiftId: null
      };
    } else if (shiftType === "standard") {
      if (!shiftId) {
        return res.status(400).json({ message: "Shift ID is required for standard shifts" });
      }

      const shift = await Shift.findById(shiftId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      user.shiftType = "standard";
      user.assignedShift = shift._id;
      // Don't try to determine standardShiftType from time - let it be set explicitly (optional)
      user.shift = {
        name: shift.name,
        start: shift.start,
        end: shift.end,
        durationHours: shift.durationHours,
        isFlexible: false,
        shiftId: shift._id
      };
    }

    await user.save();
    
    // Populate the assigned shift for response
    await user.populate('assignedShift');
    
    res.json({ 
      message: "Shift assigned successfully", 
      user: {
        id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        shiftType: user.shiftType,
        standardShiftType: user.standardShiftType,
        assignedShift: user.assignedShift,
        shift: user.shift
      }
    });
  } catch (err) {
    console.error("Assign shift error:", err);
    
    // Handle validation errors specifically
    if (err.name === 'ValidationError') {
      const missingFields = Object.keys(err.errors).map(field => ({
        field,
        message: err.errors[field].message
      }));
      
      return res.status(400).json({ 
        message: "Employee profile validation failed. Please complete the employee profile before assigning shifts.",
        missingFields,
        details: err.message
      });
    }
    
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Get Employees by Shift
// GET /api/shifts/:id/employees
// ======================
exports.getEmployeesByShift = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify shift exists
    const shift = await Shift.findById(id);
    if (!shift) {
      return res.status(404).json({ message: "Shift not found" });
    }

    const employees = await User.find({ 
      assignedShift: id,
      shiftType: "standard"
    })
    .select("_id name email employeeId shift shiftType department designation status")
    .populate('assignedShift', 'name start end durationHours')
    .sort({ name: 1 });

    res.json({
      shift: {
        id: shift._id,
        name: shift.name,
        start: shift.start,
        end: shift.end,
        durationHours: shift.durationHours
      },
      employees,
      totalEmployees: employees.length
    });
  } catch (err) {
    console.error("Get employees by shift error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Get All Employees with Shift Information
// GET /api/shifts/employees/all
// ======================
exports.getAllEmployeesWithShifts = async (req, res) => {
  try {
    // Exclude terminated and absconded employees
    const employees = await User.find({
      role: "employee",
      status: { $nin: ['terminated', 'absconded'] }
    })
      .select("_id name email employeeId shiftType standardShiftType department designation status")
      .populate('assignedShift', 'name start end durationHours')
      .sort({ name: 1 });

    const result = {
      standard: employees.filter(emp => emp.shiftType === "standard"),
      flexiblePermanent: employees.filter(emp => emp.shiftType === "flexiblePermanent"),
      total: employees.length
    };

    res.json(result);
  } catch (err) {
    console.error("Get all employees with shifts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Fix Existing Shifts (Add missing isActive field)
// POST /api/shifts/fix
// ======================
exports.fixExistingShifts = async (req, res) => {
  try {
    // Find shifts without isActive field
    const shiftsWithoutIsActive = await Shift.find({ isActive: { $exists: false } });
    console.log(`Found ${shiftsWithoutIsActive.length} shifts without isActive field`);

    if (shiftsWithoutIsActive.length === 0) {
      return res.json({ 
        message: "All shifts already have isActive field", 
        count: 0 
      });
    }

    // Update all shifts to add isActive: true
    const result = await Shift.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );

    console.log(`Updated ${result.modifiedCount} shifts with isActive: true`);

    // Get all shifts after fix
    const allShifts = await Shift.find({}).select('name start end isActive');
    
    res.json({ 
      message: `Fixed ${result.modifiedCount} shifts by adding isActive: true`, 
      count: result.modifiedCount,
      shifts: allShifts
    });
  } catch (err) {
    console.error("Fix shifts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Initialize Default Shifts
// POST /api/shifts/initialize
// ======================
exports.initializeDefaultShifts = async (req, res) => {
  try {
    // Check if shifts already exist
    const existingShifts = await Shift.countDocuments();
    console.log(`Found ${existingShifts} existing shifts in database`);
    
    if (existingShifts > 0) {
      // Get details of existing shifts
      const shifts = await Shift.find({}).select('name start end isActive');
      console.log('Existing shifts:', shifts);
      
      return res.status(400).json({ 
        message: `Shifts already exist (${existingShifts} shifts found). Please delete existing shifts first or create new ones manually.`, 
        count: existingShifts,
        existingShifts: shifts
      });
    }

    const defaultShifts = [
      {
        name: "Morning Shift",
        start: "09:00",
        end: "18:00",
        durationHours: 9,
        description: "Standard morning shift 9 AM to 6 PM",
        isFlexible: false,
        isActive: true
      },
      {
        name: "Evening Shift",
        start: "20:00",
        end: "05:00",
        durationHours: 9,
        description: "Evening shift 8 PM to 5 AM (next day)",
        isFlexible: false,
        isActive: true
      },
      {
        name: "Night Shift",
        start: "05:30",
        end: "14:20",
        durationHours: 8.83,
        description: "Night shift 5:30 AM to 2:20 PM",
        isFlexible: false,
        isActive: true
      }
    ];

    const createdShifts = await Shift.insertMany(defaultShifts);
    res.status(201).json({ 
      message: "Default shifts initialized successfully", 
      shifts: createdShifts,
      count: createdShifts.length
    });
  } catch (err) {
    console.error("Initialize shifts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
