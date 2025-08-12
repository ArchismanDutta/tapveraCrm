const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const emailController = require("../controllers/emailController");

router.post("/send", protect, emailController.sendOutlookEmail);

module.exports = router;
