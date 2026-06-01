// controllers/messageController.js

// Mark message as read
exports.markMessageRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'client' ? 'Client' : 'User';

    const Message = require('../models/Message');
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if already read by this user
    const alreadyRead = message.readBy.some(
      r => r.user.toString() === userId.toString()
    );

    if (!alreadyRead) {
      message.readBy.push({
        user: userId,
        userModel,
        readAt: Date.now()
      });

      // Update status to 'read' if this is the first read
      if (message.status !== 'read') {
        message.status = 'read';
        message.readAt = Date.now();
      }

      await message.save();

      // Emit WebSocket event (if available)
      const { broadcastMessageRead } = require('../utils/websocket');
      try {
        broadcastMessageRead(message.project.toString(), {
          messageId,
          userId: userId.toString(),
          readAt: Date.now()
        });
      } catch (wsError) {
        console.warn('WebSocket broadcast failed:', wsError.message);
        // Don't fail the request if WebSocket fails
      }
    }

    res.json(message);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update message status
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    const Message = require('../models/Message');
    const message = await Message.findByIdAndUpdate(
      messageId,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Emit WebSocket event
    const { broadcastMessageStatusUpdate } = require('../utils/websocket');
    try {
      broadcastMessageStatusUpdate(message.project.toString(), {
        messageId,
        status,
        timestamp: Date.now()
      });
    } catch (wsError) {
      console.warn('WebSocket broadcast failed:', wsError.message);
      // Don't fail the request if WebSocket fails
    }

    res.json(message);
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Pin a message (admin only)
exports.pinMessage = async (req, res) => {
  try {
    const { messageId, projectId } = req.params;
    const userId = req.user._id;

    const Message = require('../models/Message');

    // Check pin limit (max 5 per project)
    const pinnedCount = await Message.countDocuments({
      project: projectId,
      isPinned: true
    });

    if (pinnedCount >= 5) {
      return res.status(400).json({
        error: 'Maximum 5 messages can be pinned per project'
      });
    }

    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        isPinned: true,
        pinnedBy: userId,
        pinnedAt: Date.now()
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Emit WebSocket event
    const { broadcastMessagePinned } = require('../utils/websocket');
    try {
      broadcastMessagePinned(projectId, {
        messageId,
        isPinned: true,
        pinnedBy: userId.toString(),
        pinnedAt: Date.now()
      });
    } catch (wsError) {
      console.warn('WebSocket broadcast failed:', wsError.message);
      // Don't fail the request if WebSocket fails
    }

    res.json(message);
  } catch (error) {
    console.error('Error pinning message:', error);
    res.status(500).json({ error: error.message });
  }
};

// Unpin a message (admin only)
exports.unpinMessage = async (req, res) => {
  try {
    const { messageId, projectId } = req.params;

    const Message = require('../models/Message');
    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        isPinned: false,
        pinnedBy: null,
        pinnedAt: null
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Emit WebSocket event
    const { broadcastMessagePinned } = require('../utils/websocket');
    try {
      broadcastMessagePinned(projectId, {
        messageId,
        isPinned: false
      });
    } catch (wsError) {
      console.warn('WebSocket broadcast failed:', wsError.message);
      // Don't fail the request if WebSocket fails
    }

    res.json(message);
  } catch (error) {
    console.error('Error unpinning message:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get pinned messages for a project
exports.getPinnedMessages = async (req, res) => {
  try {
    const { projectId } = req.params;

    const Message = require('../models/Message');
    const messages = await Message.find({
      project: projectId,
      isPinned: true
    })
      .sort({ pinnedAt: -1 })
      .populate('sentBy', 'name email clientName')
      .populate('pinnedBy', 'name email');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching pinned messages:', error);
    res.status(500).json({ error: error.message });
  }
};

// Toggle star on a message (personal bookmark)
exports.toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'client' ? 'Client' : 'User';

    const Message = require('../models/Message');
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Find if user already starred this message
    const starIndex = message.starredBy.findIndex(
      s => s.user.toString() === userId.toString()
    );

    let action;

    if (starIndex > -1) {
      // Unstar
      message.starredBy.splice(starIndex, 1);
      action = 'unstar';
    } else {
      // Star
      message.starredBy.push({
        user: userId,
        userModel: userModel
      });
      action = 'star';
    }

    await message.save();

    // Populate before returning
    const populatedMessage = await Message.findById(message._id)
      .populate('sentBy', 'name email clientName designation');

    res.json({ message: populatedMessage, action });
  } catch (error) {
    console.error('Error toggling star:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get starred messages for current user
exports.getStarredMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    const Message = require('../models/Message');
    const messages = await Message.find({
      project: projectId,
      'starredBy.user': userId
    })
      .sort({ createdAt: -1 })
      .populate('sentBy', 'name email clientName designation');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching starred messages:', error);
    res.status(500).json({ error: error.message });
  }
};
