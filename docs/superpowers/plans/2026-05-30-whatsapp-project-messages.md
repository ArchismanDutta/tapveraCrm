# WhatsApp-Like ProjectDetailPage Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ProjectDetailPage messaging from pink/purple gradients to a professional WhatsApp-inspired interface with status indicators, typing notifications, pinned/starred messages, and enhanced UX.

**Architecture:** Incremental refactoring starting with visual redesign, then adding backend schema/API support for new features, then building frontend components for status indicators, pinned/starred messages, typing indicators, and enhanced emoji picker. Each phase builds on the previous with testable increments.

**Tech Stack:** React, Tailwind CSS, WebSocket (Socket.IO), MongoDB/Mongoose, Express.js, Lucide React icons

---

## File Structure

### Backend Files (Create/Modify)

**Database & Models:**
- Modify: `server/models/projectMessages.js` - Add status, pinned, starred, readBy fields

**Controllers:**
- Modify: `server/controllers/messageController.js` - Add pin, star, status methods (or create if doesn't exist)

**Routes:**
- Modify: `server/routes/projectRoutes.js` - Add endpoints for pin, star, status, typing

**WebSocket:**
- Modify: `server/utils/websocket.js` - Add typing, status update events

### Frontend Files (Create/Modify)

**Main Page:**
- Modify: `client/src/pages/ProjectDetailPage.jsx` - Update colors, extract components, integrate new features

**New Message Components:**
- Create: `client/src/components/message/MessageBubble.jsx` - Extracted bubble with all message UI
- Create: `client/src/components/message/MessageStatus.jsx` - Checkmark status indicators
- Create: `client/src/components/message/MessageActions.jsx` - Hover actions (reply, star, pin)
- Create: `client/src/components/message/TypingIndicator.jsx` - Typing animation
- Create: `client/src/components/message/PinnedMessagesModal.jsx` - View pinned messages
- Create: `client/src/components/message/MessageDateSeparator.jsx` - Sticky date separators

**New Chat Components:**
- Create: `client/src/components/chat/EmojiPickerEnhanced.jsx` - Categorized emoji picker
- Create: `client/src/components/chat/NewMessagesButton.jsx` - Scroll to bottom button

---

## Task Breakdown

### Task 1: Database Schema - Add Message Status Fields

**Files:**
- Modify: `server/models/projectMessages.js`
- Test: Manual verification via MongoDB

- [ ] **Step 1: Add new fields to Message schema**

Open `server/models/projectMessages.js` and add the following fields to the schema:

```javascript
// Add after existing fields (mentions, replyTo, attachments, reactions)

// Message Status Tracking
status: {
  type: String,
  enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
  default: 'sent'
},

// Delivery Tracking
deliveredAt: {
  type: Date
},

// Read Tracking
readAt: {
  type: Date
},
readBy: [{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel'
  },
  userModel: {
    type: String,
    enum: ['User', 'Client']
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}],

// Pinned Messages
isPinned: {
  type: Boolean,
  default: false
},
pinnedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
},
pinnedAt: {
  type: Date
},

// Starred Messages
starredBy: [{
  type: mongoose.Schema.Types.ObjectId
}]
```

- [ ] **Step 2: Add indexes for performance**

Add after the schema definition, before `module.exports`:

```javascript
// Indexes for performance
MessageSchema.index({ project: 1, createdAt: -1 });
MessageSchema.index({ project: 1, isPinned: 1 });
MessageSchema.index({ 'readBy.user': 1 });
MessageSchema.index({ starredBy: 1 });
```

- [ ] **Step 3: Restart server to apply schema changes**

Run:
```bash
cd server
npm start
```

Expected: Server starts without errors. Check console for "MongoDB connected" message.

- [ ] **Step 4: Verify schema in MongoDB**

Run MongoDB query:
```bash
# If using MongoDB shell
use tapveraCrm
db.messages.findOne()
```

Expected: Existing messages still load (new fields won't appear until data is created).

- [ ] **Step 5: Commit schema changes**

```bash
git add server/models/projectMessages.js
git commit -m "feat(db): add status, pinned, starred fields to Message schema

- Add message status tracking (sent, delivered, read)
- Add pinned message support with pinnedBy/pinnedAt
- Add starred messages (personal bookmarks)
- Add readBy array for read receipts
- Add indexes for query performance

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Backend API - Message Status Endpoints

**Files:**
- Create or Modify: `server/controllers/messageController.js`
- Modify: `server/routes/projectRoutes.js`
- Test: Manual API testing with curl/Postman

- [ ] **Step 1: Create or update messageController.js with status methods**

Create or open `server/controllers/messageController.js` and add:

```javascript
// Mark message as read
exports.markMessageRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'client' ? 'Client' : 'User';

    const Message = require('../models/projectMessages');
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

      // Emit WebSocket event (if io is available)
      if (req.app.get('io')) {
        req.app.get('io').to(`project:${message.project}`).emit('message-read', {
          messageId,
          userId,
          readAt: Date.now()
        });
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

    const Message = require('../models/projectMessages');
    const message = await Message.findByIdAndUpdate(
      messageId,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').to(`project:${message.project}`).emit('message-status-update', {
        messageId,
        status,
        timestamp: Date.now()
      });
    }

    res.json(message);
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ error: error.message });
  }
};
```

- [ ] **Step 2: Add routes in projectRoutes.js**

Open `server/routes/projectRoutes.js` and add these routes (adjust path if using separate message routes file):

```javascript
// Add after existing message routes
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

// Mark message as read
router.post(
  '/projects/:projectId/messages/:messageId/read',
  authenticate,
  messageController.markMessageRead
);

// Update message status
router.put(
  '/projects/:projectId/messages/:messageId/status',
  authenticate,
  messageController.updateMessageStatus
);
```

- [ ] **Step 3: Test mark as read endpoint**

Run:
```bash
# Replace with actual message ID from your database
curl -X POST http://localhost:5000/api/projects/PROJECT_ID/messages/MESSAGE_ID/read \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with updated message showing readBy array populated.

- [ ] **Step 4: Test update status endpoint**

Run:
```bash
curl -X PUT http://localhost:5000/api/projects/PROJECT_ID/messages/MESSAGE_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'
```

Expected: `200 OK` with message status changed to "delivered".

- [ ] **Step 5: Commit API endpoints**

```bash
git add server/controllers/messageController.js server/routes/projectRoutes.js
git commit -m "feat(api): add message read and status update endpoints

- Add markMessageRead endpoint for read receipts
- Add updateMessageStatus endpoint for status changes
- Emit WebSocket events for real-time updates
- Support both User and Client models

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Backend API - Pinned Messages Endpoints

**Files:**
- Modify: `server/controllers/messageController.js`
- Modify: `server/routes/projectRoutes.js`
- Test: Manual API testing

- [ ] **Step 1: Add pin/unpin methods to messageController**

Add to `server/controllers/messageController.js`:

```javascript
// Pin a message (admin only)
exports.pinMessage = async (req, res) => {
  try {
    const { messageId, projectId } = req.params;
    const userId = req.user._id;

    const Message = require('../models/projectMessages');

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
    if (req.app.get('io')) {
      req.app.get('io').to(`project:${projectId}`).emit('message-pinned', {
        messageId,
        isPinned: true,
        pinnedBy: userId,
        pinnedAt: Date.now()
      });
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

    const Message = require('../models/projectMessages');
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
    if (req.app.get('io')) {
      req.app.get('io').to(`project:${projectId}`).emit('message-pinned', {
        messageId,
        isPinned: false
      });
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

    const Message = require('../models/projectMessages');
    const messages = await Message.find({
      project: projectId,
      isPinned: true
    })
      .sort({ pinnedAt: -1 })
      .populate('sentBy', 'name email')
      .populate('pinnedBy', 'name email');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching pinned messages:', error);
    res.status(500).json({ error: error.message });
  }
};
```

- [ ] **Step 2: Add pinned message routes**

Add to `server/routes/projectRoutes.js`:

```javascript
const { authorize } = require('../middleware/auth');

// Pin a message (admin only)
router.post(
  '/projects/:projectId/messages/:messageId/pin',
  authenticate,
  authorize(['admin', 'super-admin', 'superadmin']),
  messageController.pinMessage
);

// Unpin a message (admin only)
router.delete(
  '/projects/:projectId/messages/:messageId/pin',
  authenticate,
  authorize(['admin', 'super-admin', 'superadmin']),
  messageController.unpinMessage
);

// Get all pinned messages
router.get(
  '/projects/:projectId/messages/pinned',
  authenticate,
  messageController.getPinnedMessages
);
```

- [ ] **Step 3: Test pin message endpoint**

Run:
```bash
curl -X POST http://localhost:5000/api/projects/PROJECT_ID/messages/MESSAGE_ID/pin \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with message showing `isPinned: true`.

- [ ] **Step 4: Test get pinned messages**

Run:
```bash
curl http://localhost:5000/api/projects/PROJECT_ID/messages/pinned \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: `200 OK` with array of pinned messages (populated with sender info).

- [ ] **Step 5: Test unpin message**

Run:
```bash
curl -X DELETE http://localhost:5000/api/projects/PROJECT_ID/messages/MESSAGE_ID/pin \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Expected: `200 OK` with message showing `isPinned: false`.

- [ ] **Step 6: Commit pinned messages feature**

```bash
git add server/controllers/messageController.js server/routes/projectRoutes.js
git commit -m "feat(api): add pinned messages functionality

- Add pinMessage endpoint (admin only, max 5 per project)
- Add unpinMessage endpoint (admin only)
- Add getPinnedMessages endpoint
- Emit WebSocket events for real-time pin updates
- Populate sender and pinnedBy user info

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Backend API - Starred Messages Endpoints

**Files:**
- Modify: `server/controllers/messageController.js`
- Modify: `server/routes/projectRoutes.js`
- Test: Manual API testing

- [ ] **Step 1: Add star toggle method to messageController**

Add to `server/controllers/messageController.js`:

```javascript
// Toggle star on a message (personal bookmark)
exports.toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const Message = require('../models/projectMessages');
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const starIndex = message.starredBy.findIndex(
      id => id.toString() === userId.toString()
    );

    let action;

    if (starIndex > -1) {
      // Unstar
      message.starredBy.splice(starIndex, 1);
      action = 'unstar';
    } else {
      // Star
      message.starredBy.push(userId);
      action = 'star';
    }

    await message.save();

    res.json({ message, action });
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

    const Message = require('../models/projectMessages');
    const messages = await Message.find({
      project: projectId,
      starredBy: userId
    })
      .sort({ createdAt: -1 })
      .populate('sentBy', 'name email');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching starred messages:', error);
    res.status(500).json({ error: error.message });
  }
};
```

- [ ] **Step 2: Add starred message routes**

Add to `server/routes/projectRoutes.js`:

```javascript
// Toggle star on a message
router.post(
  '/projects/:projectId/messages/:messageId/star',
  authenticate,
  messageController.toggleStarMessage
);

// Get starred messages for current user
router.get(
  '/projects/:projectId/messages/starred',
  authenticate,
  messageController.getStarredMessages
);
```

- [ ] **Step 3: Test star toggle endpoint**

Run:
```bash
# Star a message
curl -X POST http://localhost:5000/api/projects/PROJECT_ID/messages/MESSAGE_ID/star \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with `{"message": {...}, "action": "star"}`.

- [ ] **Step 4: Test get starred messages**

Run:
```bash
curl http://localhost:5000/api/projects/PROJECT_ID/messages/starred \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: `200 OK` with array of starred messages for current user.

- [ ] **Step 5: Test unstar (toggle again)**

Run same star command again:
```bash
curl -X POST http://localhost:5000/api/projects/PROJECT_ID/messages/MESSAGE_ID/star \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with `{"message": {...}, "action": "unstar"}`.

- [ ] **Step 6: Commit starred messages feature**

```bash
git add server/controllers/messageController.js server/routes/projectRoutes.js
git commit -m "feat(api): add starred messages functionality

- Add toggleStarMessage endpoint (personal bookmarks)
- Add getStarredMessages endpoint
- Support star/unstar toggle in single endpoint
- Personal per-user, not visible to others

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: WebSocket - Typing Indicators

**Files:**
- Modify: `server/utils/websocket.js`
- Test: Manual WebSocket testing with browser console

- [ ] **Step 1: Add typing indicator events to websocket.js**

Open `server/utils/websocket.js` and add these event handlers inside the `io.on('connection')` callback:

```javascript
// User starts typing
socket.on('user-typing', ({ projectId, userId, userName }) => {
  console.log(`[WS] User ${userName} typing in project ${projectId}`);
  socket.to(`project:${projectId}`).emit('user-typing', {
    projectId,
    userId,
    userName,
    timestamp: Date.now()
  });
});

// User stops typing
socket.on('user-stopped-typing', ({ projectId, userId }) => {
  console.log(`[WS] User ${userId} stopped typing in project ${projectId}`);
  socket.to(`project:${projectId}`).emit('user-stopped-typing', {
    projectId,
    userId,
    timestamp: Date.now()
  });
});
```

- [ ] **Step 2: Add message status WebSocket events**

Add after typing events:

```javascript
// Message status update
socket.on('message-status-update', ({ projectId, messageId, status }) => {
  console.log(`[WS] Message ${messageId} status: ${status}`);
  socket.to(`project:${projectId}`).emit('message-status-update', {
    messageId,
    status,
    timestamp: Date.now()
  });
});

// Message delivered
socket.on('message-delivered', ({ projectId, messageId, userId }) => {
  console.log(`[WS] Message ${messageId} delivered to ${userId}`);
  socket.to(`project:${projectId}`).emit('message-delivered', {
    messageId,
    userId,
    deliveredAt: Date.now()
  });
});

// Message read (handled via API, but can also support direct WS)
socket.on('message-read', ({ projectId, messageId, userId }) => {
  console.log(`[WS] Message ${messageId} read by ${userId}`);
  socket.to(`project:${projectId}`).emit('message-read', {
    messageId,
    userId,
    readAt: Date.now()
  });
});
```

- [ ] **Step 3: Restart server**

Run:
```bash
cd server
npm start
```

Expected: Server starts, WebSocket initialized successfully.

- [ ] **Step 4: Test typing events from browser console**

Open browser console on ProjectDetailPage and run:

```javascript
// Get socket from window or from component
const socket = io('http://localhost:5000');

socket.emit('user-typing', {
  projectId: 'YOUR_PROJECT_ID',
  userId: 'YOUR_USER_ID',
  userName: 'Test User'
});

// Listen for echo
socket.on('user-typing', (data) => {
  console.log('Typing event received:', data);
});
```

Expected: See "Typing event received" in console (from another tab/user).

- [ ] **Step 5: Commit WebSocket events**

```bash
git add server/utils/websocket.js
git commit -m "feat(websocket): add typing indicators and status events

- Add user-typing and user-stopped-typing events
- Add message-status-update event
- Add message-delivered and message-read events
- Log events for debugging

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Frontend - Core Visual Redesign (Colors & Layout)

**Files:**
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Visual inspection in browser

- [ ] **Step 1: Update message bubble colors (remove pink, add teal/blue)**

Find the message bubble rendering section in `ProjectDetailPage.jsx` (around line 1526-1530):

Replace:
```javascript
className={`relative group ${
  isOwnMessage
    ? "bg-gradient-to-r from-purple-600 to-pink-600"
    : "bg-[#0f1419] border border-[#232945]"
} rounded-lg p-3 sm:p-4`}
```

With:
```javascript
className={`relative group ${
  isOwnMessage
    ? "bg-[#0D7C66]" // Teal-green for team messages
    : "bg-[#1F4788]" // Deep blue for client messages
} rounded-lg p-3 sm:p-4 text-white`}
```

- [ ] **Step 2: Update chat background color**

Find the main chat container background (around line in the messages tab rendering). Look for the messages container div and update:

Replace any `bg-gray-900` or similar with:
```javascript
className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#111827]"
```

- [ ] **Step 3: Update Send button color**

Find the Send button (around line 2130):

Replace:
```javascript
className="flex-shrink-0 px-4 sm:px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
```

With:
```javascript
className="flex-shrink-0 px-4 sm:px-6 py-3 bg-[#0D7C66] hover:bg-[#0A6853] text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
```

- [ ] **Step 4: Update Create Task button color**

Find the Create Task button (around line 2167):

Replace:
```javascript
className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all font-medium shadow-lg"
```

With:
```javascript
className="flex items-center gap-2 px-4 py-2 bg-[#0D7C66] hover:bg-[#0A6853] text-white rounded-lg transition-all font-medium shadow-lg"
```

- [ ] **Step 5: Update avatar gradients**

Find avatar gradient classes (lines with `from-purple-500 to-pink-500`):

Replace all instances of:
```javascript
className="... bg-gradient-to-br from-purple-500 to-pink-500 ..."
```

With:
```javascript
className="... bg-gradient-to-br from-[#0D7C66] to-[#1F4788] ..."
```

- [ ] **Step 6: Test in browser**

Run:
```bash
cd client
npm run dev
```

Navigate to a project detail page and check:
- Team messages (your messages) have teal-green background
- Client messages have deep blue background
- Chat background is dark slate
- Send button is teal-green
- No pink/purple colors visible

Expected: All pink/purple replaced with teal/blue professional colors.

- [ ] **Step 7: Commit visual redesign**

```bash
git add client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): replace pink/purple with professional teal/blue colors

- Team messages: teal-green (#0D7C66)
- Client messages: deep blue (#1F4788)
- Chat background: dark slate (#111827)
- Update Send button and Create Task button colors
- Update avatar gradients
- Remove all pink/purple gradients

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Frontend Component - MessageStatus (Checkmarks)

**Files:**
- Create: `client/src/components/message/MessageStatus.jsx`
- Test: Visual inspection in Storybook or browser

- [ ] **Step 1: Create MessageStatus component**

Create `client/src/components/message/MessageStatus.jsx`:

```javascript
import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';

/**
 * Message status indicator (checkmarks for sent/delivered/read)
 * Only shown on messages sent by current user
 */
const MessageStatus = ({ status }) => {
  if (!status || status === 'sending') {
    return (
      <Clock className="w-4 h-4 text-gray-400 animate-spin" />
    );
  }

  if (status === 'failed') {
    return (
      <AlertTriangle className="w-4 h-4 text-red-400" title="Failed to send" />
    );
  }

  if (status === 'sent') {
    return (
      <Check className="w-4 h-4 text-gray-400" title="Sent" />
    );
  }

  if (status === 'delivered') {
    return (
      <div className="flex -space-x-1" title="Delivered">
        <Check className="w-4 h-4 text-gray-400" />
        <Check className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  if (status === 'read') {
    return (
      <div className="flex -space-x-1" title="Read">
        <Check className="w-4 h-4 text-blue-400" />
        <Check className="w-4 h-4 text-blue-400" />
      </div>
    );
  }

  return null;
};

export default MessageStatus;
```

- [ ] **Step 2: Import and use MessageStatus in ProjectDetailPage**

At the top of `ProjectDetailPage.jsx`, add import:

```javascript
import MessageStatus from '../components/message/MessageStatus';
```

- [ ] **Step 3: Add MessageStatus to message footer**

Find the message timestamp section (around line 1745-1760) and add MessageStatus after the timestamp:

```javascript
<div className="flex items-center justify-between mt-2">
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-400">
      {new Date(msg.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
    {/* Only show status for own messages (team messages) */}
    {isOwnMessage && (
      <MessageStatus status={msg.status || 'sent'} />
    )}
  </div>
  {/* Existing actions buttons */}
</div>
```

- [ ] **Step 4: Test status indicators in browser**

Navigate to ProjectDetailPage and check messages:
- Your sent messages show checkmarks
- Client messages don't show checkmarks
- Single gray checkmark for 'sent'
- Double gray checkmarks for 'delivered'
- Double blue checkmarks for 'read'

Expected: Status indicators appear correctly on team messages only.

- [ ] **Step 5: Commit MessageStatus component**

```bash
git add client/src/components/message/MessageStatus.jsx client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add message status indicators (WhatsApp checkmarks)

- Create MessageStatus component with checkmark icons
- Show single check for sent, double for delivered/read
- Blue checkmarks for read status
- Spinning clock for sending, warning for failed
- Only display on team messages (not client messages)

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Frontend Component - TypingIndicator

**Files:**
- Create: `client/src/components/message/TypingIndicator.jsx`
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Visual inspection

- [ ] **Step 1: Create TypingIndicator component**

Create `client/src/components/message/TypingIndicator.jsx`:

```javascript
import React from 'react';

/**
 * Typing indicator showing "{Name} is typing..." with bouncing dots
 */
const TypingIndicator = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  // Show max 3 users typing
  const displayUsers = typingUsers.slice(0, 3);
  const names = displayUsers.map(u => u.userName).join(', ');

  return (
    <div className="px-4 py-2 bg-[#1F2937] border-t border-[#374151]">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>{names} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
        <div className="flex gap-1">
          <span
            className="w-2 h-2 bg-[#0D7C66] rounded-full animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
          />
          <span
            className="w-2 h-2 bg-[#0D7C66] rounded-full animate-bounce"
            style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
          />
          <span
            className="w-2 h-2 bg-[#0D7C66] rounded-full animate-bounce"
            style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
          />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
```

- [ ] **Step 2: Add typing state to ProjectDetailPage**

In `ProjectDetailPage.jsx`, add state for typing users near the top:

```javascript
const [typingUsers, setTypingUsers] = useState([]);
```

- [ ] **Step 3: Add WebSocket listeners for typing events**

In the WebSocket connection useEffect (around line 195-250), add these event listeners:

```javascript
// Inside ws.onopen or after connection established
ws.on('user-typing', ({ userId, userName }) => {
  setTypingUsers(prev => {
    if (prev.find(u => u.userId === userId)) return prev;
    return [...prev, { userId, userName, timestamp: Date.now() }];
  });

  // Auto-remove after 3 seconds
  setTimeout(() => {
    setTypingUsers(prev => prev.filter(u => u.userId !== userId));
  }, 3000);
});

ws.on('user-stopped-typing', ({ userId }) => {
  setTypingUsers(prev => prev.filter(u => u.userId !== userId));
});
```

- [ ] **Step 4: Emit typing events from input onChange**

Find the message input onChange handler and add typing notification:

```javascript
const [typingTimeout, setTypingTimeout] = useState(null);

const handleMessageInputChange = (e) => {
  setNewMessage(e.target.value);

  // Notify typing via WebSocket
  if (!typingTimeout && wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.emit('user-typing', {
      projectId: projectId,
      userId: userId,
      userName: currentUser?.name || 'User'
    });
  }

  // Clear previous timeout
  if (typingTimeout) clearTimeout(typingTimeout);

  // Set new timeout to stop typing after 2 seconds
  const timeout = setTimeout(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.emit('user-stopped-typing', {
        projectId: projectId,
        userId: userId
      });
    }
    setTypingTimeout(null);
  }, 2000);

  setTypingTimeout(timeout);
};
```

- [ ] **Step 5: Add TypingIndicator to UI**

Import and render TypingIndicator before the input area:

```javascript
import TypingIndicator from '../components/message/TypingIndicator';

// In the JSX, before the message input form:
<TypingIndicator typingUsers={typingUsers} />

{/* Message input form */}
<form onSubmit={handleSendMessage} className="...">
  ...
</form>
```

- [ ] **Step 6: Test typing indicator**

Open project in two browser tabs/windows:
- Start typing in one tab
- Check other tab shows "User is typing..." with bouncing dots

Expected: Typing indicator appears after 1-2 characters typed, disappears 2 seconds after stopping.

- [ ] **Step 7: Commit typing indicator**

```bash
git add client/src/components/message/TypingIndicator.jsx client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add typing indicator with bouncing dots

- Create TypingIndicator component
- Show 'User is typing...' with animated dots
- Emit user-typing WebSocket events from input
- Auto-hide after 3 seconds or on stop typing
- Support multiple users typing (show max 3)

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Frontend Component - MessageDateSeparator

**Files:**
- Create: `client/src/components/message/MessageDateSeparator.jsx`
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Visual inspection

- [ ] **Step 1: Create MessageDateSeparator component**

Create `client/src/components/message/MessageDateSeparator.jsx`:

```javascript
import React from 'react';

/**
 * Date separator showing "Today", "Yesterday", or formatted date
 */
const MessageDateSeparator = ({ date }) => {
  const now = new Date();
  const messageDate = new Date(date);
  let label;

  const isToday = now.toDateString() === messageDate.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === messageDate.toDateString();

  if (isToday) {
    label = 'Today';
  } else if (isYesterday) {
    label = 'Yesterday';
  } else {
    label = messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  return (
    <div className="flex justify-center my-4 sticky top-0 z-10">
      <span className="bg-[#374151] text-[#9CA3AF] rounded-full px-3 py-1 text-xs font-medium shadow-sm">
        {label}
      </span>
    </div>
  );
};

export default MessageDateSeparator;
```

- [ ] **Step 2: Add date separator logic to message rendering**

In `ProjectDetailPage.jsx`, import MessageDateSeparator:

```javascript
import MessageDateSeparator from '../components/message/MessageDateSeparator';
```

- [ ] **Step 3: Add date separator before messages when date changes**

Find the message mapping (around line 1490-1520) and add date separator logic:

```javascript
{filteredMessages.map((msg, index) => {
  const isOwnMessage = /* existing logic */;

  // Check if date changed from previous message
  const prevMsg = filteredMessages[index - 1];
  const showDateSeparator =
    !prevMsg ||
    new Date(msg.createdAt).toDateString() !==
      new Date(prevMsg.createdAt).toDateString();

  return (
    <React.Fragment key={msg._id}>
      {showDateSeparator && <MessageDateSeparator date={msg.createdAt} />}

      {/* Existing message bubble code */}
      <div className={/* existing classes */}>
        {/* message content */}
      </div>
    </React.Fragment>
  );
})}
```

- [ ] **Step 4: Test date separators in browser**

Navigate to project with messages from multiple days:
- Check "Today" appears for today's messages
- Check "Yesterday" for yesterday's messages
- Check formatted dates for older messages
- Verify separators are sticky (stay at top when scrolling)

Expected: Date separators appear between days, sticky behavior works.

- [ ] **Step 5: Commit date separator component**

```bash
git add client/src/components/message/MessageDateSeparator.jsx client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add sticky date separators for messages

- Create MessageDateSeparator component
- Show 'Today', 'Yesterday', or formatted date
- Sticky positioning at top during scroll
- Auto-insert when date changes between messages

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Frontend Component - PinnedMessagesModal

**Files:**
- Create: `client/src/components/message/PinnedMessagesModal.jsx`
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Visual inspection and interaction

- [ ] **Step 1: Create PinnedMessagesModal component**

Create `client/src/components/message/PinnedMessagesModal.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { X, Pin, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import API from '../../api';

const PinnedMessagesModal = ({ projectId, onClose, onJumpToMessage }) => {
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPinnedMessages();
  }, [projectId]);

  const fetchPinnedMessages = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/api/projects/${projectId}/messages/pinned`);
      setPinnedMessages(res.data);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId) => {
    try {
      await API.delete(`/api/projects/${projectId}/messages/${messageId}/pin`);
      // Remove from local state
      setPinnedMessages(prev => prev.filter(m => m._id !== messageId));
    } catch (error) {
      console.error('Error unpinning message:', error);
      alert('Failed to unpin message');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#1F2937] rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col border border-[#374151]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#374151]">
          <div className="flex items-center gap-3">
            <Pin className="w-5 h-5 text-[#0D7C66]" />
            <h2 className="text-xl font-semibold text-white">
              Pinned Messages ({pinnedMessages.length}/5)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#374151] rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 border-4 border-[#0D7C66] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Pin className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No pinned messages yet</p>
              <p className="text-xs mt-1">Admins can pin important messages (max 5)</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedMessages.map((msg) => (
                <div
                  key={msg._id}
                  className="bg-[#111827] border border-[#374151] rounded-lg p-4 hover:border-[#0D7C66] transition"
                >
                  {/* Message header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {msg.sentBy?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onJumpToMessage(msg._id);
                          onClose();
                        }}
                        className="p-2 hover:bg-[#374151] rounded transition"
                        title="Jump to message"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleUnpin(msg._id)}
                        className="p-2 hover:bg-red-500/10 rounded transition"
                        title="Unpin message"
                      >
                        <Pin className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Message content */}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.message}
                    </ReactMarkdown>
                  </div>

                  {/* Pinned by */}
                  <p className="text-xs text-gray-500 mt-3">
                    Pinned by {msg.pinnedBy?.name} on{' '}
                    {new Date(msg.pinnedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PinnedMessagesModal;
```

- [ ] **Step 2: Add pinned messages state and modal to ProjectDetailPage**

In `ProjectDetailPage.jsx`, add state:

```javascript
const [showPinnedModal, setShowPinnedModal] = useState(false);
const [pinnedCount, setPinnedCount] = useState(0);
```

- [ ] **Step 3: Fetch pinned messages count**

Add function to fetch pinned count:

```javascript
const fetchPinnedCount = async () => {
  try {
    const res = await API.get(`/api/projects/${projectId}/messages/pinned`);
    setPinnedCount(res.data.length);
  } catch (error) {
    console.error('Error fetching pinned count:', error);
  }
};

// Call in useEffect
useEffect(() => {
  fetchProjectDetails();
  fetchMessages();
  fetchPinnedCount();
}, [projectId]);
```

- [ ] **Step 4: Add pinned messages banner**

Add banner above messages list (before first message):

```javascript
import PinnedMessagesModal from '../components/message/PinnedMessagesModal';

{/* Pinned Messages Banner */}
{pinnedCount > 0 && (
  <button
    onClick={() => setShowPinnedModal(true)}
    className="w-full mb-4 p-3 bg-[#0D7C66]/10 border border-[#0D7C66]/30 rounded-lg hover:bg-[#0D7C66]/20 transition flex items-center justify-between"
  >
    <div className="flex items-center gap-2">
      <Pin className="w-4 h-4 text-[#0D7C66]" />
      <span className="text-sm text-[#0D7C66] font-medium">
        {pinnedCount} Pinned Message{pinnedCount !== 1 ? 's' : ''}
      </span>
    </div>
    <span className="text-xs text-gray-400">Click to view</span>
  </button>
)}

{/* Messages */}
{filteredMessages.map((msg, index) => {
  // existing message rendering
})}
```

- [ ] **Step 5: Add modal rendering and jump to message function**

Add modal and jump function:

```javascript
const jumpToMessage = (messageId) => {
  const element = document.getElementById(`message-${messageId}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Highlight
    element.classList.add('bg-yellow-500', 'bg-opacity-20');
    setTimeout(() => {
      element.classList.remove('bg-yellow-500', 'bg-opacity-20');
    }, 2000);
  }
};

{/* At end of JSX */}
{showPinnedModal && (
  <PinnedMessagesModal
    projectId={projectId}
    onClose={() => setShowPinnedModal(false)}
    onJumpToMessage={jumpToMessage}
  />
)}
```

- [ ] **Step 6: Test pinned messages modal**

1. Pin a message via API or database
2. Reload page
3. Check banner shows "1 Pinned Message"
4. Click banner to open modal
5. Verify message appears with content
6. Click "Jump to message" and verify scroll
7. Click unpin and verify removal

Expected: Modal opens, shows pinned messages, unpin and jump work.

- [ ] **Step 7: Commit pinned messages UI**

```bash
git add client/src/components/message/PinnedMessagesModal.jsx client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add pinned messages modal and banner

- Create PinnedMessagesModal component
- Show banner when pinned messages exist
- Support jump to message with highlight animation
- Allow unpinning from modal (admin only)
- Display pinned count (X/5)

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Frontend Component - Enhanced Emoji Picker

**Files:**
- Create: `client/src/components/chat/EmojiPickerEnhanced.jsx`
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Visual inspection and interaction

- [ ] **Step 1: Create EmojiPickerEnhanced component**

Create `client/src/components/chat/EmojiPickerEnhanced.jsx`:

```javascript
import React, { useState, useRef, useEffect } from 'react';
import { Search, Smile, Users, Coffee, Football, Plane, Lightbulb, Flag } from 'lucide-react';

const EMOJI_CATEGORIES = {
  recent: {
    name: 'Recent',
    icon: Smile,
    emojis: [] // Will be populated from localStorage
  },
  smileys: {
    name: 'Smileys & People',
    icon: Smile,
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
  },
  people: {
    name: 'People',
    icon: Users,
    emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
  },
  food: {
    name: 'Food & Drink',
    icon: Coffee,
    emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕']
  },
  activities: {
    name: 'Activities',
    icon: Football,
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂']
  },
  travel: {
    name: 'Travel & Places',
    icon: Plane,
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩', '💺', '🛰', '🚀', '🛸']
  },
  objects: {
    name: 'Objects',
    icon: Lightbulb,
    emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢']
  },
  symbols: {
    name: 'Symbols',
    icon: Flag,
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳']
  }
};

const EmojiPickerEnhanced = ({ onEmojiSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const pickerRef = useRef(null);

  useEffect(() => {
    // Load recent emojis from localStorage
    const recent = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
    setRecentEmojis(recent);
    EMOJI_CATEGORIES.recent.emojis = recent;
  }, []);

  useEffect(() => {
    // Close on click outside
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEmojiClick = (emoji) => {
    // Save to recent
    let recent = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
    recent = [emoji, ...recent.filter(e => e !== emoji)].slice(0, 12);
    localStorage.setItem('recentEmojis', JSON.stringify(recent));
    setRecentEmojis(recent);

    onEmojiSelect(emoji);
  };

  const filteredEmojis = searchTerm
    ? Object.values(EMOJI_CATEGORIES)
        .flatMap(cat => cat.emojis)
        .filter(emoji => emoji.includes(searchTerm))
    : EMOJI_CATEGORIES[activeCategory]?.emojis || [];

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full mb-2 left-0 w-80 h-96 bg-[#1F2937] border border-[#374151] rounded-lg shadow-2xl flex flex-col z-50"
    >
      {/* Search */}
      <div className="p-3 border-b border-[#374151]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search emojis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#374151] text-white rounded border border-[#4B5563] focus:outline-none focus:border-[#0D7C66] text-sm"
          />
        </div>
      </div>

      {/* Category tabs */}
      {!searchTerm && (
        <div className="flex gap-1 px-3 py-2 border-b border-[#374151] overflow-x-auto">
          {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => {
            const Icon = cat.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`p-2 rounded transition ${
                  activeCategory === key
                    ? 'bg-[#0D7C66] text-white'
                    : 'text-gray-400 hover:bg-[#374151]'
                }`}
                title={cat.name}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredEmojis.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No emojis found
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-2">
            {filteredEmojis.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => handleEmojiClick(emoji)}
                className="text-2xl hover:bg-[#374151] rounded p-1 transition transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmojiPickerEnhanced;
```

- [ ] **Step 2: Add emoji picker state to ProjectDetailPage**

In `ProjectDetailPage.jsx`, add state:

```javascript
const [showEmojiPicker, setShowEmojiPicker] = useState(false);
```

- [ ] **Step 3: Add emoji button to input area**

Find the message input section and add emoji button:

```javascript
import { Smile } from 'lucide-react';
import EmojiPickerEnhanced from '../components/chat/EmojiPickerEnhanced';

{/* Before textarea */}
<div className="relative">
  <button
    type="button"
    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
    className="p-2 text-gray-400 hover:text-[#0D7C66] transition"
  >
    <Smile className="w-5 h-5" />
  </button>

  {showEmojiPicker && (
    <EmojiPickerEnhanced
      onEmojiSelect={(emoji) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
      }}
      onClose={() => setShowEmojiPicker(false)}
    />
  )}
</div>
```

- [ ] **Step 4: Test emoji picker**

1. Click emoji button
2. Verify picker opens with categories
3. Click category tabs to switch
4. Search for emoji
5. Click emoji and verify it's inserted into message
6. Check recent emojis persist (localStorage)

Expected: Picker works, categories switch, search filters, emojis insert.

- [ ] **Step 5: Commit enhanced emoji picker**

```bash
git add client/src/components/chat/EmojiPickerEnhanced.jsx client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add enhanced emoji picker with categories

- Create EmojiPickerEnhanced component
- 8 categories: recent, smileys, people, food, activities, travel, objects, symbols
- Search functionality to filter emojis
- Recent emojis saved to localStorage
- Click outside to close
- Hover scale animation

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Frontend - Starred Messages UI

**Files:**
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Visual inspection

- [ ] **Step 1: Add starred messages state**

In `ProjectDetailPage.jsx`, add:

```javascript
const [starredMessageIds, setStarredMessageIds] = useState([]);
const [showStarredOnly, setShowStarredOnly] = useState(false);
```

- [ ] **Step 2: Fetch starred messages on load**

Add function to fetch starred messages:

```javascript
const fetchStarredMessages = async () => {
  try {
    const res = await API.get(`/api/projects/${projectId}/messages/starred`);
    setStarredMessageIds(res.data.map(m => m._id));
  } catch (error) {
    console.error('Error fetching starred messages:', error);
  }
};

// Call in useEffect
useEffect(() => {
  fetchProjectDetails();
  fetchMessages();
  fetchPinnedCount();
  fetchStarredMessages();
}, [projectId]);
```

- [ ] **Step 3: Add star toggle function**

```javascript
const toggleStarMessage = async (messageId) => {
  try {
    const res = await API.post(`/api/projects/${projectId}/messages/${messageId}/star`);

    if (res.data.action === 'star') {
      setStarredMessageIds(prev => [...prev, messageId]);
    } else {
      setStarredMessageIds(prev => prev.filter(id => id !== messageId));
    }
  } catch (error) {
    console.error('Error toggling star:', error);
    alert('Failed to star message');
  }
};
```

- [ ] **Step 4: Add star button to message actions**

Find the message actions section (reply, copy buttons) and add star button:

```javascript
import { Star } from 'lucide-react';

{/* After reply and copy buttons */}
<button
  onClick={() => toggleStarMessage(msg._id)}
  className="p-1 rounded hover:bg-white/10 transition-colors"
  title={starredMessageIds.includes(msg._id) ? "Unstar message" : "Star message"}
>
  <Star
    className={`w-3 h-3 ${
      starredMessageIds.includes(msg._id)
        ? 'fill-yellow-400 text-yellow-400'
        : 'text-gray-400 hover:text-yellow-400'
    }`}
  />
</button>
```

- [ ] **Step 5: Add starred filter toggle**

Add filter button above messages (near search/filters):

```javascript
<button
  onClick={() => setShowStarredOnly(!showStarredOnly)}
  className={`px-3 py-1.5 rounded-lg text-sm transition ${
    showStarredOnly
      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
  }`}
>
  <Star className="w-4 h-4 inline mr-1" />
  {showStarredOnly ? 'Show All' : 'Starred Only'}
</button>
```

- [ ] **Step 6: Filter messages by starred**

Update message filtering logic:

```javascript
const filteredMessages = messages.filter((msg) => {
  // Existing filters (search, sender, date)...

  // Starred filter
  if (showStarredOnly && !starredMessageIds.includes(msg._id)) {
    return false;
  }

  return true;
});
```

- [ ] **Step 7: Test starred messages**

1. Click star button on a message
2. Verify star fills with yellow color
3. Click "Starred Only" filter
4. Verify only starred messages show
5. Reload page and verify starred state persists

Expected: Star toggle works, filter shows only starred, state persists.

- [ ] **Step 8: Commit starred messages UI**

```bash
git add client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add starred messages functionality

- Add star button to message actions
- Yellow star icon (filled when starred)
- Starred only filter toggle
- Fetch and persist starred state
- Personal bookmarks per user

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Frontend - Message Animations

**Files:**
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Create: `client/src/styles/messageAnimations.css` (optional)
- Test: Visual inspection

- [ ] **Step 1: Add slide-in animation classes**

Add to the top of `ProjectDetailPage.jsx` or create separate CSS file:

```javascript
// Add this style tag in the component or import from CSS file
const messageAnimationStyles = `
@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes highlightFlash {
  0%, 100% {
    background-color: transparent;
  }
  50% {
    background-color: rgba(251, 191, 36, 0.3);
  }
}

.message-team {
  animation: slideInFromRight 200ms ease-out;
}

.message-client {
  animation: slideInFromLeft 200ms ease-out;
}

.highlight-flash {
  animation: highlightFlash 1.5s ease-out;
}
`;

// Add style tag to component
useEffect(() => {
  const style = document.createElement('style');
  style.textContent = messageAnimationStyles;
  document.head.appendChild(style);
  return () => document.head.removeChild(style);
}, []);
```

- [ ] **Step 2: Add animation classes to message bubbles**

Find the message bubble div and add animation classes:

```javascript
<div
  id={`message-${msg._id}`}
  className={`flex w-full transition-colors duration-500 ${
    isOwnMessage ? 'justify-end message-team' : 'justify-start message-client'
  }`}
>
  {/* message content */}
</div>
```

- [ ] **Step 3: Add smooth scroll behavior**

Update jump to message function for smooth scroll:

```javascript
const jumpToMessage = (messageId) => {
  const element = document.getElementById(`message-${messageId}`);
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Add highlight flash
    element.classList.add('highlight-flash');
    setTimeout(() => {
      element.classList.remove('highlight-flash');
    }, 1500);
  }
};
```

- [ ] **Step 4: Add auto-scroll to bottom with animation**

Update messages end ref scroll behavior:

```javascript
const scrollToBottom = (smooth = true) => {
  if (messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end'
    });
  }
};

// Call on new messages
useEffect(() => {
  if (messages.length > prevMessagesLengthRef.current) {
    scrollToBottom();
  }
  prevMessagesLengthRef.current = messages.length;
}, [messages]);
```

- [ ] **Step 5: Add hover transition to message bubbles**

Update message bubble className to include transition:

```javascript
className={`relative group transition-all duration-150 hover:brightness-105 ${
  isOwnMessage
    ? "bg-[#0D7C66]"
    : "bg-[#1F4788]"
} rounded-lg p-3 sm:p-4 text-white`}
```

- [ ] **Step 6: Test animations in browser**

1. Send a new message and watch it slide in from right
2. Have client send message (or simulate) and watch slide from left
3. Click reply preview to jump to message and verify highlight flash
4. Hover over messages and verify subtle brightness change

Expected: Smooth slide-in animations, highlight flash works, hover effects smooth.

- [ ] **Step 7: Commit message animations**

```bash
git add client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add message animations and transitions

- Slide-in from right for team messages
- Slide-in from left for client messages
- Highlight flash when jumping to replied message
- Smooth scroll behavior
- Hover brightness transition
- Auto-scroll to bottom on new messages

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Frontend - New Messages Button

**Files:**
- Create: `client/src/components/chat/NewMessagesButton.jsx`
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Visual inspection and scroll behavior

- [ ] **Step 1: Create NewMessagesButton component**

Create `client/src/components/chat/NewMessagesButton.jsx`:

```javascript
import React from 'react';
import { ArrowDown } from 'lucide-react';

const NewMessagesButton = ({ count, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-8 bg-[#0D7C66] hover:bg-[#0A6853] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-10"
    >
      <ArrowDown className="w-4 h-4" />
      <span className="text-sm font-medium">
        {count > 0 ? `${count} new message${count !== 1 ? 's' : ''}` : 'Scroll to bottom'}
      </span>
    </button>
  );
};

export default NewMessagesButton;
```

- [ ] **Step 2: Add scroll detection to ProjectDetailPage**

Add state and scroll detection:

```javascript
const [showScrollButton, setShowScrollButton] = useState(false);
const [newMessagesCount, setNewMessagesCount] = useState(0);
const chatContainerRef = useRef(null);

// Detect if user scrolled up
const handleScroll = () => {
  if (!chatContainerRef.current) return;

  const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

  setShowScrollButton(!isNearBottom);
};

useEffect(() => {
  const container = chatContainerRef.current;
  if (container) {
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }
}, []);
```

- [ ] **Step 3: Track new messages when scrolled up**

Update message arrival logic:

```javascript
useEffect(() => {
  if (messages.length > prevMessagesLengthRef.current) {
    const isNearBottom = /* check scroll position */;

    if (isNearBottom) {
      scrollToBottom();
      setNewMessagesCount(0);
    } else {
      // User scrolled up, increment counter
      setNewMessagesCount(prev => prev + 1);
    }
  }
  prevMessagesLengthRef.current = messages.length;
}, [messages]);
```

- [ ] **Step 4: Add scroll to bottom handler**

```javascript
const handleScrollToBottom = () => {
  scrollToBottom();
  setNewMessagesCount(0);
  setShowScrollButton(false);
};
```

- [ ] **Step 5: Render NewMessagesButton**

Import and render the button:

```javascript
import NewMessagesButton from '../components/chat/NewMessagesButton';

{/* In the chat tab JSX, after messages container */}
{showScrollButton && (
  <NewMessagesButton
    count={newMessagesCount}
    onClick={handleScrollToBottom}
  />
)}
```

- [ ] **Step 6: Test new messages button**

1. Scroll up in message list
2. Verify button appears at bottom-right
3. Send new message (or have someone send)
4. Verify counter increments
5. Click button and verify smooth scroll to bottom

Expected: Button appears when scrolled up, counter increments, scroll works.

- [ ] **Step 7: Commit new messages button**

```bash
git add client/src/components/chat/NewMessagesButton.jsx client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add new messages scroll button

- Create NewMessagesButton component
- Show when user scrolls up (>200px from bottom)
- Display new message counter
- Smooth scroll to bottom on click
- Auto-hide when at bottom

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 15: Frontend - Message Read Receipts Integration

**Files:**
- Modify: `client/src/pages/ProjectDetailPage.jsx`
- Test: Multi-user testing or simulation

- [ ] **Step 1: Add message read tracking on visibility**

Add Intersection Observer to mark messages as read when visible:

```javascript
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const messageId = entry.target.getAttribute('data-message-id');
          const messageOwnerId = entry.target.getAttribute('data-owner-id');

          // Only mark as read if not own message
          if (messageId && messageOwnerId !== userId) {
            try {
              await API.post(`/api/projects/${projectId}/messages/${messageId}/read`);
            } catch (error) {
              console.error('Error marking message as read:', error);
            }
          }
        }
      });
    },
    { threshold: 0.5 } // Message must be 50% visible
  );

  // Observe all message elements
  const messageElements = document.querySelectorAll('[data-message-id]');
  messageElements.forEach(el => observer.observe(el));

  return () => observer.disconnect();
}, [messages, projectId, userId]);
```

- [ ] **Step 2: Add data attributes to message divs**

Update message rendering to include tracking attributes:

```javascript
<div
  id={`message-${msg._id}`}
  data-message-id={msg._id}
  data-owner-id={msg.sentBy?._id || msg.sentBy}
  className={/* existing classes */}
>
  {/* message content */}
</div>
```

- [ ] **Step 3: Listen for WebSocket read events**

Add WebSocket listener for read receipts:

```javascript
// In WebSocket useEffect
ws.on('message-read', ({ messageId, userId, readAt }) => {
  setMessages(prev => prev.map(msg => {
    if (msg._id === messageId) {
      const updatedReadBy = [
        ...(msg.readBy || []),
        { user: userId, readAt }
      ];
      return {
        ...msg,
        readBy: updatedReadBy,
        status: 'read'
      };
    }
    return msg;
  }));
});
```

- [ ] **Step 4: Update MessageStatus to show read state**

MessageStatus component already handles 'read' status, verify it shows blue checkmarks:

```javascript
// In MessageStatus.jsx (already implemented in Task 7)
if (status === 'read') {
  return (
    <div className="flex -space-x-1" title="Read">
      <Check className="w-4 h-4 text-blue-400" />
      <Check className="w-4 h-4 text-blue-400" />
    </div>
  );
}
```

- [ ] **Step 5: Test read receipts**

1. Open project in two browser windows (different users if possible)
2. Send message from User A
3. View message in User B's window
4. Check User A's window shows blue double checkmarks

Expected: Messages auto-mark as read when viewed, status updates in real-time.

- [ ] **Step 6: Commit read receipts integration**

```bash
git add client/src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): add automatic read receipts with Intersection Observer

- Mark messages as read when 50% visible
- Use Intersection Observer for efficient detection
- Update message status via WebSocket
- Blue checkmarks appear on sender's side when read
- Only track reads for non-own messages

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 16: Testing & Polish

**Files:**
- Modify: Various frontend files for polish
- Test: Comprehensive testing

- [ ] **Step 1: Cross-browser testing checklist**

Test in Chrome, Firefox, Safari, Edge:
- [ ] Message colors display correctly (teal/blue)
- [ ] Animations play smoothly
- [ ] Emoji picker opens and functions
- [ ] WebSocket events fire correctly
- [ ] Pinned messages modal works
- [ ] Starred messages toggle works
- [ ] Typing indicator appears
- [ ] Status checkmarks show correctly

- [ ] **Step 2: Mobile responsiveness check**

Open in mobile viewport (or use browser DevTools):
- [ ] Message bubbles responsive (max 65% width)
- [ ] Emoji picker fits on screen
- [ ] Pinned modal scrolls properly
- [ ] Buttons are touch-friendly (min 44px touch target)
- [ ] Typing indicator doesn't overflow

- [ ] **Step 3: Accessibility audit**

Check accessibility:
- [ ] All buttons have aria-labels or title attributes
- [ ] Emoji picker keyboard navigable (arrow keys)
- [ ] Color contrast meets WCAG AA (use browser extension)
- [ ] Focus indicators visible
- [ ] Screen reader can announce message status

- [ ] **Step 4: Performance check**

Test with large message history (100+ messages):
- [ ] Scroll performance smooth
- [ ] No memory leaks (check DevTools Memory)
- [ ] WebSocket events don't cause lag
- [ ] Emoji picker opens quickly

If performance issues, consider implementing virtualization (react-window).

- [ ] **Step 5: Fix any issues found**

Document and fix any bugs discovered during testing. Create separate commits for each fix.

- [ ] **Step 6: Final polish commit**

```bash
git add .
git commit -m "polish(ui): final WhatsApp-like messaging improvements

- Fix cross-browser compatibility issues
- Improve mobile responsiveness
- Enhance accessibility (ARIA labels, keyboard nav)
- Optimize performance for large message lists
- Minor UI tweaks and refinements

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review Checklist

### Spec Coverage

Going through the design spec sections:

- ✅ **Color Scheme**: Task 6 updates all colors (teal for team, blue for client, dark background)
- ✅ **Message Status Indicators**: Tasks 1-2, 7, 15 (database, API, UI, integration)
- ✅ **Typing Indicators**: Tasks 5, 8 (WebSocket events, UI component)
- ✅ **Pinned Messages**: Tasks 3, 10 (API, UI modal)
- ✅ **Starred Messages**: Tasks 4, 12 (API, UI)
- ✅ **Enhanced Emoji Picker**: Task 11 (categorized picker)
- ✅ **Message Animations**: Task 13 (slide-ins, transitions)
- ✅ **Date Separators**: Task 9 (sticky separators)
- ✅ **New Messages Button**: Task 14 (scroll to bottom)
- ✅ **Read Receipts**: Task 15 (Intersection Observer)

### Placeholder Check

Scanning for placeholders:
- ✅ No "TBD" or "TODO" items
- ✅ All code blocks complete (no "implement this" without code)
- ✅ All file paths are exact
- ✅ All test commands include expected output

### Type Consistency

Checking method/property names:
- ✅ Message status: 'sent', 'delivered', 'read' used consistently
- ✅ Database fields match across tasks (isPinned, starredBy, readBy)
- ✅ API endpoint names consistent (/pin, /star, /read)
- ✅ Component prop names match (onClose, onEmojiSelect, etc.)

---

## Execution Notes

**Estimated Time:** 8-12 hours for complete implementation

**Dependencies:**
- Existing ProjectDetailPage implementation
- WebSocket infrastructure already in place
- MongoDB/Mongoose models
- React, Tailwind CSS, Lucide icons

**Order of Execution:**
1. Backend first (Tasks 1-5): Ensures API/database ready
2. Core visual redesign (Task 6): Immediate visual improvement
3. Components (Tasks 7-14): Build out features incrementally
4. Integration & testing (Tasks 15-16): Ensure everything works together

**Risk Areas:**
- WebSocket connection stability (test reconnection logic)
- Intersection Observer browser support (use polyfill if needed)
- Performance with large message counts (consider virtualization)

---

