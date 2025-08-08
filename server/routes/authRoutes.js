const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const authController = require("../controllers/authController");

// Middleware to handle validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return all validation errors
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules for signup
const signupValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("contact").trim().notEmpty().withMessage("Contact is required"),
  body("dob")
    .isISO8601()
    .withMessage("Valid date of birth is required (YYYY-MM-DD)"),
  body("gender")
    .isIn(["male", "female", "other"])
    .withMessage("Gender must be male, female, or other"),

  // Optional department validation: if present, must be from enum list (case sensitive)
  body("department")
    .optional()
    .isIn(["executives", "development", "marketingAndSales", "humanResource"])
    .withMessage(
      "Department must be one of executives, development, marketingAndSales, humanResource"
    ),

  // Optional designation validation: if present, must be string & max length
  body("designation")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Designation should be at most 100 characters"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];


// Validation rules for login
const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Signup route with validation middleware
router.post(
  "/signup",
  signupValidation,
  validateRequest,
  authController.signup
);

// Login route with validation middleware
router.post("/login", loginValidation, validateRequest, authController.login);

module.exports = router;
