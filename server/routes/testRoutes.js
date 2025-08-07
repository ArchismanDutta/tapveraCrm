const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

router.get(
  "/admin-only",
  protect,
  authorize("admin", "super-admin"),
  (req, res) => {
    res.json({ message: "Welcome, Admin or Super Admin only!" });
  }
);

router.get("/employee-only", protect, authorize("employee"), (req, res) => {
  res.json({ message: "Welcome, Employee only!" });
});

router.get("/any-authenticated", protect, (req, res) => {
  res.json({ message: `Welcome, ${req.user.role}!` });
});

module.exports = router;
