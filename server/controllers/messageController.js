// controllers/messageController.js
//
// ─── AUTHORIZATION (Phase 0 security patch) ───
// Every handler in this file used to take a messageId (and sometimes a
// projectId) and act on it with no membership check whatsoever — the routes
// only applied `protect`. Pin and unpin were the exceptions, guarded by
// hasProjectManageAuthority at the route layer. Everything else — marking
// read, changing status, starring, listing pinned/starred — was reachable for
// any message in the system by any logged-in user.
//
// `guard()` below resolves the project from the message (or the route param),
// authorizes against the shared messaging access module, and additionally
// asserts that the message actually belongs to that project so a caller can't
// pair a project they can see with a message they can't.
const {
  assertProjectChatAccess,
  sendAccessError,
} = require('../services/messaging/access');
const realtime = require('../services/messaging/realtime');

/**
 * Authorize a message-scoped action.
 *
 * @param {object} req
 * @param {object} [opts]
 * @param {string} [opts.messageId]  when present, the message is loaded and
 *                                   verified to belong to the project
 * @param {string} [opts.projectId]  falls back to the message's own project
 * @param {'read'|'write'|'moderate'} [opts.action]
 * @returns {Promise<{ message, project }>}
 * @throws  AccessError | NotFound-shaped AccessError
 */
async function guard(req, { messageId, projectId, action = 'read' } = {}) {
  const Message = require('../models/Message');

  let message = null;
  if (messageId) {
    message = await Message.findById(messageId);
    if (!message) {
      const { AccessError } = require('../services/messaging/access');
      throw new AccessError('Message not found', 404, 'NOT_FOUND');
    }
  }

  const resolvedProjectId = projectId || (message && String(message.project));

  // A messageId paired with someone else's projectId must not authorize.
  if (message && projectId && String(message.project) !== String(projectId)) {
    const { AccessError } = require('../services/messaging/access');
    throw new AccessError('Message not found', 404, 'NOT_FOUND');
  }

  const { project } = await assertProjectChatAccess(req.user, resolvedProjectId, action);
  return { message, project };
}

// Mark message as read
exports.markMessageRead = async (req, res) => {
  try {
    const { messageId, id: projectId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'client' ? 'Client' : 'User';

    const { message } = await guard(req, { messageId, projectId, action: 'read' });

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

      // Through realtime.js so this reaches `thread:receipt`, which the client
      // store applies. It previously called broadcastMessageRead directly,
      // emitting `project:message_read` — an event nothing listens for any more.
      realtime.emitReceipt({
        scope: realtime.SCOPES.PROJECT,
        threadId: message.project.toString(),
        messageId,
        userId: userId.toString(),
        kind: 'read',
      });
    }

    res.json(message);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error('Error marking message as read:', unexpected);
      return res.status(500).json({ error: unexpected.message });
    }
  }
};

// Update message status
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId, id: projectId } = req.params;
    const { status } = req.body;

    await guard(req, { messageId, projectId, action: 'write' });

    const Message = require('../models/Message');
    const message = await Message.findByIdAndUpdate(
      messageId,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    realtime.emitReceipt({
      scope: realtime.SCOPES.PROJECT,
      threadId: message.project.toString(),
      messageId,
      kind: 'status',
      status,
    });

    res.json(message);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error('Error updating message status:', unexpected);
      return res.status(500).json({ error: unexpected.message });
    }
  }
};

// Pin a message (admin only)
exports.pinMessage = async (req, res) => {
  try {
    const { messageId, projectId } = req.params;
    const userId = req.user._id;

    // The route already gates on hasProjectManageAuthority; this additionally
    // ties the message to THIS project, so manage authority over one project
    // can't be used to pin a message belonging to another.
    await guard(req, { messageId, projectId, action: 'moderate' });

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

    realtime.emitUpdated({
      scope: realtime.SCOPES.PROJECT,
      threadId: projectId,
      patch: { messageId, pinned: true, pinnedBy: userId.toString(), pinnedAt: Date.now() },
    });

    res.json(message);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error('Error pinning message:', unexpected);
      return res.status(500).json({ error: unexpected.message });
    }
  }
};

// Unpin a message (admin only)
exports.unpinMessage = async (req, res) => {
  try {
    const { messageId, projectId } = req.params;

    await guard(req, { messageId, projectId, action: 'moderate' });

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

    realtime.emitUpdated({
      scope: realtime.SCOPES.PROJECT,
      threadId: projectId,
      patch: { messageId, pinned: false },
    });

    res.json(message);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error('Error unpinning message:', unexpected);
      return res.status(500).json({ error: unexpected.message });
    }
  }
};

// Get pinned messages for a project
exports.getPinnedMessages = async (req, res) => {
  try {
    const { projectId } = req.params;

    await guard(req, { projectId, action: 'read' });

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
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error('Error fetching pinned messages:', unexpected);
      return res.status(500).json({ error: unexpected.message });
    }
  }
};

// Toggle star on a message (personal bookmark)
exports.toggleStarMessage = async (req, res) => {
  try {
    const { messageId, projectId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'client' ? 'Client' : 'User';

    const { message } = await guard(req, { messageId, projectId, action: 'read' });

    const Message = require('../models/Message');

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
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error('Error toggling star:', unexpected);
      return res.status(500).json({ error: unexpected.message });
    }
  }
};

// Get starred messages for current user
exports.getStarredMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    await guard(req, { projectId, action: 'read' });

    const Message = require('../models/Message');
    const messages = await Message.find({
      project: projectId,
      'starredBy.user': userId
    })
      .sort({ createdAt: -1 })
      .populate('sentBy', 'name email clientName designation');

    res.json(messages);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error('Error fetching starred messages:', unexpected);
      return res.status(500).json({ error: unexpected.message });
    }
  }
};
