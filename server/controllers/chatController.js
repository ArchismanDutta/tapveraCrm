const User = require("../models/User");
const Conversation = require("../models/Conversation");
const ChatMessage = require("../models/ChatMessage");

// Get all users except logged-in user
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("_id name email role")
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// Get existing conversation or create new
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.body; // backend expects userId

    if (!userId) return res.status(400).json({ message: "userId required" });

    let conversation = await Conversation.findOne({
      members: { $all: [req.user._id, userId] },
    }).populate("members", "_id name email role"); // ✅ populate members

    if (!conversation) {
      conversation = new Conversation({ members: [req.user._id, userId] });
      await conversation.save();
      conversation = await conversation.populate("members", "_id name email role");
    }

    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create conversation" });
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);

    if (!conversation || !conversation.members.includes(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await ChatMessage.find({ conversation: conversationId })
      .populate("sender", "_id name email role") // ✅ populate sender
      .sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

// Post a new message
exports.postMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim())
      return res.status(400).json({ message: "Message required" });

    const conversation = await Conversation.findById(conversationId);

    if (!conversation || !conversation.members.includes(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const message = new ChatMessage({
      conversation: conversationId,
      sender: req.user._id,
      content: content.trim(),
    });

    await message.save();

    // Update lastMessage
    conversation.lastMessage = {
      content: message.content,
      timestamp: message.timestamp,
      sender: req.user._id,
    };
    await conversation.save();

    // ✅ populate sender before returning
    const populatedMessage = await message.populate("sender", "_id name email role");
    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
};
