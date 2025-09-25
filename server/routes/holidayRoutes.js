const express = require("express");
const router = express.Router();
const holidayController = require("../controllers/holidayController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Public holiday routes
router.get("/", holidayController.getHolidays);
router.get("/check", holidayController.checkIfHoliday);

// Protected routes for Admin / HR only
router.post(
  "/",
  protect,
  authorize("admin", "super-admin", "hr"),
  holidayController.createHoliday
);
router.put(
  "/:id",
  protect,
  authorize("admin", "super-admin", "hr"),
  holidayController.updateHoliday
);
router.delete(
  "/:id",
  protect,
  authorize("admin", "super-admin", "hr"),
  holidayController.removeHoliday
);

// Sandwich policy applied in payroll logic
router.post(
  "/sandwich",
  protect,
  authorize("admin", "super-admin", "hr"),
  holidayController.applySandwich
);

module.exports = router;
