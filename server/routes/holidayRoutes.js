const express = require("express");
const router = express.Router();
const holidayController = require("../controllers/holidayController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Public
router.get("/", holidayController.getHolidays);
router.get("/check", holidayController.checkIfHoliday);

// Admin / HR only
router.post(
  "/",
  protect,
  authorize("admin", "super-admin", "hr"),
  holidayController.createHoliday
);
router.delete(
  "/:id",
  protect,
  authorize("admin", "super-admin", "hr"),
  holidayController.removeHoliday
);

// Apply sandwich policy (used in payroll)
router.post(
  "/sandwich",
  protect,
  authorize("admin", "super-admin", "hr"),
  holidayController.applySandwich
);

module.exports = router;
