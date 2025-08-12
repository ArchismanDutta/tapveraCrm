const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const chatController = require("../controllers/chatController");

router.get("/users", protect, chatController.getUsers);
router.get("/messages", protect, chatController.getMessages);
router.post("/message", protect, chatController.sendMessage);

module.exports = router;
