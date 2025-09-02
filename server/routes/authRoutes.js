// File: routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const authController = require("../controllers/authController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// ======================
// Middleware to handle validation results
// ======================
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return all validation errors in an array
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ======================
// Validation rules for signup
// ======================
const signupValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("contact").trim().notEmpty().withMessage("Contact is required"),
  body("dob").isISO8601().withMessage("Valid date of birth is required (YYYY-MM-DD)"),
  body("gender")
    .isIn(["male", "female", "other"])
    .withMessage("Gender must be male, female, or other"),

  // Optional fields
  body("department")
    .optional()
    .isIn(["executives", "development", "marketingAndSales", "humanResource"])
    .withMessage(
      "Department must be one of executives, development, marketingAndSales, humanResource"
    ),

  body("designation")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Designation should be at most 100 characters"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("employeeId").trim().notEmpty().withMessage("Employee ID is required"),
  body("doj").isISO8601().withMessage("Valid Date of Joining is required (YYYY-MM-DD)"),

  // ✅ Allow arrays for skills
  body("skills").optional().isArray().withMessage("Skills must be an array"),
  body("skills.*").optional().isString().trim(),

  // ✅ Allow array of qualification objects
  body("qualifications").optional().isArray().withMessage("Qualifications must be an array"),
  body("qualifications.*.school").optional().isString().trim(),
  body("qualifications.*.degree").optional().isString().trim(),
  body("qualifications.*.year").optional().isInt().toInt(),
  body("qualifications.*.marks").optional().isString().trim(),

  // ✅ Ensure salary and totalPl are numbers if provided
  body("salary").optional().isNumeric().toFloat(),
  body("totalPl").optional().isInt().toInt(),
];

// ======================
// Validation rules for login
// ======================
const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// ======================
// Routes
// ======================

// Signup route (protected: HR/Admin/Super Admin only)
router.post(
  "/signup",
  protect,
  authorize("hr", "admin", "super-admin"),
  signupValidation,
  validateRequest,
  authController.signup
);

// Login route (public)
router.post("/login", loginValidation, validateRequest, authController.login);

// Export router
module.exports = router;
