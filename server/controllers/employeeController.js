const User = require("../models/User");

// GET /api/employees/:id
exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await User.findById(id).select(
      "-password -outlookAppPassword -__v -createdAt -updatedAt"
    );

    if (!employee) return res.status(404).json({ message: "Employee not found" });

    res.json(employee);
  } catch (err) {
    console.error("Get Employee Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: "employee" }).select(
      "_id name"
    );
    res.json(employees);
  } catch (err) {
    console.error("Get Employees Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
