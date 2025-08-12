const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");

exports.getMessages = async (req, res) => {
  try {
    const { room, receiverId } = req.query;
    let messages;

    if (room) {
      messages = await ChatMessage.find({ room })
        .sort({ createdAt: 1 })
        .populate("sender", "name email");
    } else if (receiverId) {
      messages = await ChatMessage.find({
        $or: [
          { sender: req.user._id, receiver: receiverId },
          { sender: receiverId, receiver: req.user._id },
        ],
      })
        .sort({ createdAt: 1 })
        .populate("sender", "name email");
    } else {
      return res.status(400).json({ message: "room or receiverId is required" });
    }

    res.json(messages);
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { message, receiverId, room } = req.body;
    if (!message || (!receiverId && !room)) {
      return res.status(400).json({ message: "Message and receiverId/room are required" });
    }

    const newMessage = new ChatMessage({
      sender: req.user._id,
      receiver: receiverId || null,
      message,
      room: room || null,
    });

    const saved = await newMessage.save();
    res.json(await saved.populate("sender", "name email"));
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select("name email _id");
    res.json(users);
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ message: err.message });
  }
};
