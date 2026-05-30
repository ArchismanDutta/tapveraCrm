# WhatsApp-Like ProjectDetailPage Messages Design Specification

**Date:** 2026-05-30
**Scope:** ProjectDetailPage chat/messaging interface redesign
**Goal:** Transform the current pink-gradient message UI into a professional WhatsApp-inspired chat experience with clear client vs team distinction

---

## Table of Contents

1. [Overview](#overview)
2. [Design Approach](#design-approach)
3. [Color Scheme & Visual Design](#color-scheme--visual-design)
4. [Message Layout & Structure](#message-layout--structure)
5. [Input Area & Interaction](#input-area--interaction)
6. [WhatsApp-Like Features](#whatsapp-like-features)
7. [Animations & Micro-interactions](#animations--micro-interactions)
8. [Technical Implementation](#technical-implementation)
9. [Success Criteria](#success-criteria)

---

## Overview

### Current State

The ProjectDetailPage messaging system currently uses:
- Pink/purple gradient for sent messages (`bg-gradient-to-r from-purple-600 to-pink-600`)
- Dark gray for received messages
- Cartoonish appearance that doesn't fit a professional B2B CRM
- Basic features but lacks WhatsApp-like polish and clarity

### Desired State

A professional, WhatsApp-inspired messaging interface with:
- Clear visual distinction between client and team messages
- Professional color palette (teal-green for team, deep blue for client)
- WhatsApp-like features: status indicators, typing notifications, pinned messages, starred messages
- Enhanced UX: better emoji picker, file previews, smooth animations
- Dark theme aesthetic matching WhatsApp Dark mode

### Target Users

- **Super Admin/Admin**: Full access to all features including pinning, analytics
- **Employees**: Standard messaging features, can star messages
- **Clients**: Standard messaging features from client perspective

---

## Design Approach

**Selected Approach:** WhatsApp-Inspired with Professional Colors

### Why This Approach

1. **Clear Visual Distinction**: Color-coded messages (green = team, blue = client) enable instant recognition
2. **Professional Yet Familiar**: Leverages WhatsApp UX patterns users already know while maintaining CRM professionalism
3. **Best of Both Worlds**: Familiar interaction patterns with branded, business-appropriate colors
4. **Practical for CRM Use**: Quick visual scanning is critical in busy CRM workflows

### Alternative Approaches Considered

- **Pure WhatsApp Dark Clone**: Rejected due to consumer-focused appearance
- **WhatsApp with Accent Borders**: Rejected due to insufficient visual distinction

---

## Color Scheme & Visual Design

### Message Bubble Colors

#### Team Messages (Admin/Employee/Super-Admin)
```css
background: #0D7C66 /* Professional teal-green */
color: #FFFFFF
border-radius: 8px
alignment: right
tail: none (omit for cleaner, more professional look)
```

#### Client Messages
```css
background: #1F4788 /* Deep professional blue */
color: #FFFFFF
border-radius: 8px
alignment: left
tail: none (omit for cleaner, more professional look)
```

### Supporting Colors

| Element | Color | Usage |
|---------|-------|-------|
| Chat Background | `#111827` | Main chat container background (solid, no pattern) |
| Timestamps | `#9CA3AF` | Time display in messages |
| Date Separators | `#374151` bg + `#9CA3AF` text | "Today", "Yesterday", dates |
| Links | `#60A5FA` | Clickable links in messages |
| Mentions | `#F59E0B` bg + dark text | @mentioned user highlights |
| Hover State | +5-10% lightness | Message bubble hover |
| Selection/Active | Subtle glow or border | Selected/active states |

### Status Indicators

| Status | Icon | Color |
|--------|------|-------|
| Sending | 🕐 Clock (spinning) | `#9CA3AF` (gray) |
| Sent | ✓ Single checkmark | `#9CA3AF` (gray) |
| Delivered | ✓✓ Double checkmark | `#9CA3AF` (gray) |
| Read | ✓✓ Double checkmark | `#3B82F6` (blue) |
| Failed | ⚠️ Exclamation | `#EF4444` (red) |

---

## Message Layout & Structure

### Message Bubble Anatomy

```
For Client Messages (left-aligned):
┌─────────────────────────────────────────────┐
│ [Avatar: 32px circle] [Sender Name]         │
│ ┌─────────────────────────────────┐         │
│ │ [Reply Preview]                 │         │
│ │ Message text with markdown      │         │
│ │ [Attachments]                   │         │
│ │ [Mentions badges]               │         │
│ │ [Reactions row]                 │         │
│ │ [10:30 AM] [✓✓] [Actions]      │         │
│ └─────────────────────────────────┘         │
└─────────────────────────────────────────────┘

For Team Messages (right-aligned):
┌─────────────────────────────────────────────┐
│         ┌─────────────────────────────────┐ │
│         │ [Reply Preview]                 │ │
│         │ Message text with markdown      │ │
│         │ [Attachments]                   │ │
│         │ [Mentions badges]               │ │
│         │ [Reactions row]                 │ │
│         │ [10:30 AM] [✓✓] [Actions]      │ │
│         └─────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Spacing & Sizing

- **Bubble padding**: 12px horizontal, 10px vertical
- **Max bubble width**: 65% of chat container width
- **Gap between messages**:
  - Same sender: 8px
  - Different sender: 16px
- **Avatar size**: 32px circle (client messages only)
- **Sender name**: Small text, `#9CA3AF`, shown above client messages only

### Message Grouping Rules

- **Consecutive messages** from same sender within 5 minutes: Group with minimal spacing (8px)
- **Time gap > 5 minutes**: Add larger spacing (16px) and show timestamp
- **Date change**: Insert date separator

### Date Separators

- **Style**: Centered pill/badge floating above messages
- **Background**: `#374151` semi-transparent
- **Text**: `#D1D5DB` (gray-300)
- **Content**:
  - "Today" for current day
  - "Yesterday" for previous day
  - "Jan 15, 2024" for older dates
- **Behavior**: Sticky at top while scrolling through that day's messages

### Reply Preview Design

When a message is a reply:
- **Position**: Inside bubble at top
- **Border-left**: 3px solid (lighter shade of bubble color)
- **Background**: Slightly darker than bubble (rgba overlay)
- **Content**:
  - Sender name (small, semi-transparent)
  - Original message preview (truncated to 2 lines)
- **Interaction**: Clickable, scrolls to original message with highlight animation

### Typing Indicator

When someone is typing:
- **Position**: Fixed at bottom of chat, above input area
- **Format**: "{Name} is typing..."
- **Animation**: Three dots bouncing sequentially
- **Color**:
  - Teal dots for team members typing
  - Blue dots for client typing
- **Timing**:
  - Appears 2 seconds after user starts typing
  - Disappears immediately when stopped or message sent
  - Animation cycle: 0.6s continuous loop

---

## Input Area & Interaction

### Input Area Layout

```
┌──────────────────────────────────────────────────────┐
│ [File Preview Bar] (when files selected)            │
├──────────────────────────────────────────────────────┤
│ [Reply Preview Bar] (when replying)                 │
├──────────────────────────────────────────────────────┤
│ [+] [😊] [Textarea...........] [📎] [Send ➤]        │
└──────────────────────────────────────────────────────┘
```

### Button Specifications

| Button | Icon | Function | Hover Color |
|--------|------|----------|-------------|
| Plus (+) | Plus icon | Quick actions menu | Teal |
| Emoji | Smile icon | Open emoji picker | Yellow |
| Attach | Paperclip | File/image picker | Blue |
| Send | Arrow/Send | Send message | Teal (solid when active) |

### Input Area Styling

```css
background: #1F2937 /* Slightly lighter than chat */
border-top: 1px solid #374151
padding: 12px 16px

textarea {
  background: #374151
  color: #FFFFFF
  placeholder: #9CA3AF
  border-radius: 20px
  padding: 10px 16px
  max-height: 120px /* ~4 lines */
  resize: none
  auto-expand: true
}

buttons {
  color: #9CA3AF
  hover: #0D7C66 (teal)
  transition: 200ms ease
}

send-button-active {
  background: #0D7C66
  color: #FFFFFF
  border-radius: 50%
  width: 44px
  height: 44px
}
```

### Enhanced Emoji Picker

**Dimensions**: 320px × 400px popup

**Layout**:
```
┌─────────────────────────────────────┐
│ [Search emojis...]                  │
├─────────────────────────────────────┤
│ [😊] [👤] [🐶] [🍔] [⚽] [🎨] [🔣]   │ ← Category tabs
├─────────────────────────────────────┤
│ Recently Used:                      │
│ [👍] [❤️] [😂] [🔥] [✅] [💡] [🎉] │
├─────────────────────────────────────┤
│ Smileys & People:                   │
│ [😀] [😃] [😄] [😁] [😆] [😅] ...  │
│ ... (scrollable grid)               │
│                                     │
│ [Skin tone selector: 👋🏻👋🏼👋🏽...]  │
└─────────────────────────────────────┘
```

**Categories**:
1. Recent (last 12 used)
2. Smileys & People
3. Animals & Nature
4. Food & Drink
5. Activities
6. Travel & Places
7. Objects
8. Symbols & Flags

**Features**:
- Search bar filters emojis in real-time
- Skin tone selector for applicable emojis
- Click emoji to insert at cursor position
- Keyboard navigation (arrow keys)
- ESC to close

### File Preview Before Sending

When files are selected:
```
┌────────────────────────────────────────────┐
│ Selected files (3/5):                      │
│ ┌──────┐ ┌──────┐ ┌──────┐                │
│ │[img] │ │[pdf] │ │[doc] │                │
│ │photo │ │report│ │notes │                │
│ │ [×]  │ │ [×]  │ │ [×]  │                │
│ └──────┘ └──────┘ └──────┘                │
└────────────────────────────────────────────┘
```

**Each file preview shows**:
- Thumbnail (48×48px) for images
- File icon for documents
- File name (truncated)
- File size
- Remove button (×)

**Limits**:
- Max 5 files per message
- Supported: Images, videos, PDFs, docs, spreadsheets

### Reply Preview in Input

When replying to a message:
```
┌────────────────────────────────────────────┐
│ ↩️ Replying to John Doe               [×] │
│ "Can you send me the project timeline?"   │
└────────────────────────────────────────────┘
```

**Design**:
- Border-left accent: Teal (team) or Blue (client)
- Background: `#374151`
- Text: Original message preview (1 line, truncated)
- Close button: × to cancel reply

---

## WhatsApp-Like Features

### 1. Message Status Indicators

**Implementation Logic**:

```javascript
// Only show status on messages sent by current user (team messages)
if (message.sentBy === currentUserId) {
  renderStatusIcon(message.status);
}

// Status progression:
// sending → sent → delivered → read
```

**Visual Display**:
- Position: Bottom-right of bubble, next to timestamp
- Size: 16px icons
- Spacing: 4px from timestamp

**Status Definitions**:

| Status | When | Icon | Color |
|--------|------|------|-------|
| sending | Message being sent to server | 🕐 Spinning clock | Gray |
| sent | Server received message | ✓ Single check | Gray |
| delivered | Delivered to recipient(s) | ✓✓ Double check | Gray |
| read | Recipient(s) opened/read | ✓✓ Double check | Blue |
| failed | Send failed | ⚠️ Triangle | Red |

**Failed State**:
- Show retry button
- Display error tooltip on hover
- Allow deletion or retry

### 2. Pinned Messages

**Pin Feature** (Admin/Super-Admin only):

**UI Elements**:
- Pin button appears on message hover (right-click menu or button)
- Pinned indicator: 📌 icon on message top-right corner
- Pinned banner at top of chat: "📌 3 pinned messages - Click to view"

**Pin Management**:
- Click banner to open pinned messages modal
- Modal shows all pinned messages with:
  - Full message content
  - Timestamp
  - Sender
  - "Jump to message" button
  - "Unpin" button (admin only)

**Limits**:
- Maximum 5 pinned messages per project
- Only admins/super-admins can pin/unpin
- All users can view pinned messages

**Use Cases**:
- Important client requirements
- Project deadlines
- Key decisions or approvals
- Critical instructions

### 3. Starred/Favorite Messages

**Star Feature** (All users):

**UI Elements**:
- Star button appears on message hover
- Starred indicator: ⭐ gold star icon on message
- Filter toggle: "Show starred only" at top of chat

**Personal Stars**:
- Each user has their own starred messages
- Stars are not visible to other users
- No limit on starred messages

**Use Cases**:
- Save important information for reference
- Bookmark tasks or action items
- Mark messages to follow up on

### 4. Message Search & Filters

**Search Panel** (Collapsible at top):

```
┌────────────────────────────────────────────────┐
│ 🔍 Search & Filters                       [▼] │
├────────────────────────────────────────────────┤
│ [Search messages...]                           │
│ Filter by: [All Senders ▼] [All Types ▼]      │
│ Date range: [Start ──] [End ──]               │
│ ☐ Starred only                                 │
│ [Clear Filters]                                │
└────────────────────────────────────────────────┘
```

**Filter Options**:

1. **By Sender**:
   - All
   - Clients only
   - Team only
   - Specific person (dropdown)

2. **By Type**:
   - All messages
   - Text only
   - With attachments
   - With mentions
   - With reactions

3. **By Date**:
   - Date range picker
   - Quick filters: Today, This week, This month

4. **Starred Only**:
   - Toggle to show only starred messages

**Search Behavior**:
- Real-time search as you type
- Highlights matching text in messages
- Scrolls to first match
- Shows match count: "12 results"
- Next/Previous navigation buttons

---

## Animations & Micro-interactions

### Message Animations

#### New Message Arrival
```css
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

.message-team {
  animation: slideInFromRight 200ms ease-out;
}

.message-client {
  animation: slideInFromLeft 200ms ease-out;
}
```

#### Sending Message (Optimistic UI)
- Message appears immediately with "sending" status
- Smooth transition from sending → sent (200ms)
- If failed, shake animation + show retry button

#### Message Hover Effects
```css
.message-bubble:hover {
  filter: brightness(1.05);
  transition: filter 150ms ease;
}

.message-actions {
  opacity: 0;
  transform: translateX(10px);
  transition: all 200ms ease;
}

.message-bubble:hover .message-actions {
  opacity: 1;
  transform: translateX(0);
}
```

### Typing Indicator Animation

```css
@keyframes bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

.typing-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0D7C66; /* or #1F4788 for client */
  animation: bounce 1.4s infinite;
}

.typing-dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}
```

**Display**: "{Name} is typing" with three bouncing dots

### Scroll Behavior

#### Auto-scroll to Bottom
```javascript
// Only auto-scroll if user is near bottom
if (isNearBottom(200px)) {
  smoothScrollToBottom(300ms);
} else {
  showNewMessageButton();
}
```

#### Scroll to Replied Message
```javascript
// When clicking reply preview
scrollToMessage(messageId, {
  behavior: 'smooth',
  duration: 400ms,
  block: 'center'
});

// Highlight animation
message.classList.add('highlight-flash');
setTimeout(() => {
  message.classList.remove('highlight-flash');
}, 1500);
```

```css
@keyframes highlightFlash {
  0%, 100% {
    background: transparent;
  }
  50% {
    background: rgba(251, 191, 36, 0.3); /* Yellow flash */
  }
}

.highlight-flash {
  animation: highlightFlash 1.5s ease-out;
}
```

#### New Messages Button
When user scrolls up and new messages arrive:
```
┌─────────────────────────┐
│ ↓ New messages (3)      │
└─────────────────────────┘
```

**Design**:
- Fixed at bottom of chat area
- Background: `#0D7C66`
- Text: White
- Click: Smooth scroll to bottom

### Emoji Reaction Animations

#### Adding Reaction
```css
@keyframes reactionPop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.reaction-added {
  animation: reactionPop 300ms ease-out;
}
```

#### Reaction Counter Increment
```css
@keyframes counterBump {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
}

.reaction-count-increment {
  animation: counterBump 200ms ease;
}
```

### Loading States

#### Skeleton Screens (Initial Load)
```
┌──────────────────────────────────────┐
│     ┌──────────────────────┐         │
│     │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │         │
│     │ ▓▓▓▓▓▓▓▓▓            │         │
│     └──────────────────────┘         │
│ ┌──────────────────────┐             │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │             │
│ │ ▓▓▓▓▓▓▓▓▓            │             │
│ └──────────────────────┘             │
└──────────────────────────────────────┘
```

**Shimmer Effect**:
```css
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #1F2937 0%,
    #374151 50%,
    #1F2937 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
```

#### Load More Spinner
When scrolling up to load older messages:
```
         ┌───────┐
         │   ⟳   │ ← Spinner at top
         └───────┘
```

**Behavior**:
- Maintains scroll position when new messages load
- Spinner disappears when loaded
- Shows "No more messages" when reached beginning

---

## Technical Implementation

### Database Schema Updates

#### Message Model Extensions

```javascript
// server/models/Message.js (or projectMessages.js)

const MessageSchema = new mongoose.Schema({
  // === EXISTING FIELDS ===
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    required: true,
    enum: ['User', 'Client']
  },
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'mentions.userModel'
    },
    userModel: {
      type: String,
      enum: ['User', 'Client']
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  attachments: [{
    filename: String,
    url: String,
    fileType: String,
    size: Number
  }],
  reactions: [{
    emoji: String,
    users: [mongoose.Schema.Types.ObjectId]
  }],

  // === NEW FIELDS FOR WHATSAPP-LIKE FEATURES ===

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
  deliveredTo: [{
    user: mongoose.Schema.Types.ObjectId,
    deliveredAt: Date
  }],

  // Read Tracking
  readAt: {
    type: Date
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'readBy.userModel'
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

  // Starred Messages (personal bookmarks)
  starredBy: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel' // Can be User or Client
  }],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
MessageSchema.index({ project: 1, createdAt: -1 });
MessageSchema.index({ project: 1, isPinned: 1 });
MessageSchema.index({ 'readBy.user': 1 });
MessageSchema.index({ starredBy: 1 });

module.exports = mongoose.model('Message', MessageSchema);
```

### WebSocket Events

#### New Events to Implement

```javascript
// server/utils/websocket.js

// Typing indicators
io.on('connection', (socket) => {

  // User starts typing
  socket.on('user-typing', ({ projectId, userId, userName }) => {
    socket.to(`project:${projectId}`).emit('user-typing', {
      projectId,
      userId,
      userName,
      timestamp: Date.now()
    });
  });

  // User stops typing
  socket.on('user-stopped-typing', ({ projectId, userId }) => {
    socket.to(`project:${projectId}`).emit('user-stopped-typing', {
      projectId,
      userId,
      timestamp: Date.now()
    });
  });

  // Message status updates
  socket.on('message-status-update', ({ messageId, status }) => {
    socket.to(`project:${projectId}`).emit('message-status-update', {
      messageId,
      status,
      timestamp: Date.now()
    });
  });

  // Message delivered
  socket.on('message-delivered', ({ messageId, userId }) => {
    socket.to(`project:${projectId}`).emit('message-delivered', {
      messageId,
      userId,
      deliveredAt: Date.now()
    });
  });

  // Message read
  socket.on('message-read', ({ messageId, userId }) => {
    socket.to(`project:${projectId}`).emit('message-read', {
      messageId,
      userId,
      readAt: Date.now()
    });
  });

  // Message pinned/unpinned
  socket.on('message-pinned', ({ messageId, isPinned, pinnedBy }) => {
    socket.to(`project:${projectId}`).emit('message-pinned', {
      messageId,
      isPinned,
      pinnedBy,
      pinnedAt: Date.now()
    });
  });

  // Message starred (personal, only notify user)
  socket.on('message-starred', ({ messageId, userId, action }) => {
    socket.emit('message-starred', {
      messageId,
      userId,
      action, // 'star' or 'unstar'
      timestamp: Date.now()
    });
  });

});
```

### API Endpoints

#### New/Updated Routes

```javascript
// server/routes/projectRoutes.js

const router = require('express').Router();
const messageController = require('../controllers/messageController');
const { authenticate, authorize } = require('../middleware/auth');

// === MESSAGE STATUS ===

// Update message status (sent, delivered, read)
router.put(
  '/projects/:projectId/messages/:messageId/status',
  authenticate,
  messageController.updateMessageStatus
);

// Mark message as read (updates readBy array)
router.post(
  '/projects/:projectId/messages/:messageId/read',
  authenticate,
  messageController.markMessageRead
);

// Mark all messages as read
router.post(
  '/projects/:projectId/messages/read-all',
  authenticate,
  messageController.markAllMessagesRead
);

// === PINNED MESSAGES ===

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

// Get all pinned messages for a project
router.get(
  '/projects/:projectId/messages/pinned',
  authenticate,
  messageController.getPinnedMessages
);

// === STARRED MESSAGES ===

// Star/unstar a message (toggle)
router.post(
  '/projects/:projectId/messages/:messageId/star',
  authenticate,
  messageController.toggleStarMessage
);

// Get all starred messages for current user
router.get(
  '/projects/:projectId/messages/starred',
  authenticate,
  messageController.getStarredMessages
);

// === TYPING INDICATORS ===

// Notify typing (handled via WebSocket, but can have REST fallback)
router.post(
  '/projects/:projectId/typing',
  authenticate,
  messageController.notifyTyping
);

module.exports = router;
```

#### Controller Methods

```javascript
// server/controllers/messageController.js

// Update message status
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    const message = await Message.findByIdAndUpdate(
      messageId,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    // Emit WebSocket event
    req.io.to(`project:${message.project}`).emit('message-status-update', {
      messageId,
      status,
      timestamp: Date.now()
    });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark message as read
exports.markMessageRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'client' ? 'Client' : 'User';

    const message = await Message.findById(messageId);

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

      // Update status to 'read' if all recipients have read
      if (shouldMarkAsRead(message)) {
        message.status = 'read';
        message.readAt = Date.now();
      }

      await message.save();

      // Emit WebSocket event
      req.io.to(`project:${message.project}`).emit('message-read', {
        messageId,
        userId,
        readAt: Date.now()
      });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Pin message
exports.pinMessage = async (req, res) => {
  try {
    const { messageId, projectId } = req.params;
    const userId = req.user._id;

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

    // Emit WebSocket event
    req.io.to(`project:${projectId}`).emit('message-pinned', {
      messageId,
      isPinned: true,
      pinnedBy: userId,
      pinnedAt: Date.now()
    });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle star message
exports.toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    const starIndex = message.starredBy.indexOf(userId);
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

    // Only emit to user who starred (personal action)
    req.io.to(req.user.socketId).emit('message-starred', {
      messageId,
      userId,
      action,
      timestamp: Date.now()
    });

    res.json({ message, action });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get pinned messages
exports.getPinnedMessages = async (req, res) => {
  try {
    const { projectId } = req.params;

    const messages = await Message.find({
      project: projectId,
      isPinned: true
    })
      .sort({ pinnedAt: -1 })
      .populate('sentBy', 'name email')
      .populate('pinnedBy', 'name email');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get starred messages
exports.getStarredMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    const messages = await Message.find({
      project: projectId,
      starredBy: userId
    })
      .sort({ createdAt: -1 })
      .populate('sentBy', 'name email');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Component Structure

#### New Components to Create

```
client/src/components/
├── message/
│   ├── MessageBubble.jsx          (NEW - extracted from ProjectDetailPage)
│   ├── MessageStatus.jsx          (NEW - checkmark indicators)
│   ├── MessageActions.jsx         (NEW - reply, star, pin buttons)
│   ├── TypingIndicator.jsx        (NEW - "John is typing...")
│   ├── PinnedMessagesModal.jsx    (NEW - view all pinned messages)
│   ├── MessageDateSeparator.jsx   (NEW - "Today", "Yesterday", dates)
│   └── StarredMessagesView.jsx    (NEW - filter view for starred)
├── chat/
│   ├── ChatInputArea.jsx          (NEW - extracted input section)
│   ├── EmojiPickerEnhanced.jsx    (NEW - categorized emoji picker)
│   ├── FilePreviewBar.jsx         (UPDATE - style improvements)
│   ├── ReplyPreviewBar.jsx        (UPDATE - WhatsApp styling)
│   └── NewMessagesButton.jsx      (NEW - "New messages" scroll button)
```

#### Component Hierarchy

```
ProjectDetailPage.jsx
└── Tab: "chat"
    ├── SearchFiltersPanel.jsx
    ├── PinnedMessagesBanner.jsx
    │   └── onClick → PinnedMessagesModal.jsx
    ├── MessagesContainer.jsx
    │   ├── MessageDateSeparator.jsx (conditional)
    │   ├── MessageBubble.jsx (repeated)
    │   │   ├── Avatar (client only)
    │   │   ├── SenderName (client only)
    │   │   ├── ReplyPreview.jsx (conditional)
    │   │   ├── MessageContent (markdown)
    │   │   ├── AttachmentsList.jsx
    │   │   ├── MentionsBadges.jsx
    │   │   ├── ReactionsRow.jsx
    │   │   └── MessageFooter
    │   │       ├── Timestamp
    │   │       ├── MessageStatus.jsx (team only)
    │   │       └── MessageActions.jsx (hover)
    │   │           ├── ReplyButton
    │   │           ├── StarButton
    │   │           ├── PinButton (admin only)
    │   │           ├── ReactButton
    │   │           └── CopyButton
    │   ├── TypingIndicator.jsx (conditional)
    │   └── NewMessagesButton.jsx (conditional)
    └── ChatInputArea.jsx
        ├── ReplyPreviewBar.jsx (conditional)
        ├── FilePreviewBar.jsx (conditional)
        └── InputToolbar
            ├── PlusButton
            ├── EmojiButton → EmojiPickerEnhanced.jsx
            ├── Textarea (auto-expand)
            ├── AttachButton
            └── SendButton
```

### State Management

#### New State Variables

```javascript
// In ProjectDetailPage.jsx

const [messages, setMessages] = useState([]);
const [typingUsers, setTypingUsers] = useState([]); // NEW
const [pinnedMessages, setPinnedMessages] = useState([]); // NEW
const [starredMessageIds, setStarredMessageIds] = useState([]); // NEW
const [showPinnedModal, setShowPinnedModal] = useState(false); // NEW
const [showStarredOnly, setShowStarredOnly] = useState(false); // NEW
const [messageStatuses, setMessageStatuses] = useState({}); // NEW: { messageId: 'sent'|'delivered'|'read' }
const [lastReadTimestamp, setLastReadTimestamp] = useState(null); // NEW
```

#### WebSocket Event Handlers

```javascript
// In ProjectDetailPage.jsx useEffect

useEffect(() => {
  const ws = wsRef.current;

  // Existing handlers...

  // NEW: Typing indicator
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

  // NEW: Message status updates
  ws.on('message-status-update', ({ messageId, status }) => {
    setMessageStatuses(prev => ({
      ...prev,
      [messageId]: status
    }));

    // Update message in messages array
    setMessages(prev => prev.map(msg =>
      msg._id === messageId ? { ...msg, status } : msg
    ));
  });

  ws.on('message-read', ({ messageId, userId, readAt }) => {
    setMessages(prev => prev.map(msg => {
      if (msg._id === messageId) {
        const readByUpdated = [
          ...msg.readBy,
          { user: userId, readAt }
        ];
        return {
          ...msg,
          readBy: readByUpdated,
          status: 'read'
        };
      }
      return msg;
    }));
  });

  // NEW: Pinned message updates
  ws.on('message-pinned', ({ messageId, isPinned }) => {
    setMessages(prev => prev.map(msg =>
      msg._id === messageId ? { ...msg, isPinned } : msg
    ));

    // Refresh pinned messages list
    fetchPinnedMessages();
  });

  // NEW: Starred message (personal)
  ws.on('message-starred', ({ messageId, action }) => {
    if (action === 'star') {
      setStarredMessageIds(prev => [...prev, messageId]);
    } else {
      setStarredMessageIds(prev => prev.filter(id => id !== messageId));
    }
  });

  return () => {
    ws.off('user-typing');
    ws.off('user-stopped-typing');
    ws.off('message-status-update');
    ws.off('message-read');
    ws.off('message-pinned');
    ws.off('message-starred');
  };
}, []);
```

#### Typing Indicator Logic

```javascript
// In ChatInputArea.jsx

const [typingTimeout, setTypingTimeout] = useState(null);

const handleInputChange = (e) => {
  setInput(e.target.value);

  // Notify typing
  if (!typingTimeout) {
    // First keystroke - notify typing
    wsRef.current.emit('user-typing', {
      projectId,
      userId,
      userName: currentUser.name
    });
  }

  // Clear previous timeout
  if (typingTimeout) clearTimeout(typingTimeout);

  // Set new timeout to stop typing after 2 seconds
  const timeout = setTimeout(() => {
    wsRef.current.emit('user-stopped-typing', {
      projectId,
      userId
    });
    setTypingTimeout(null);
  }, 2000);

  setTypingTimeout(timeout);
};

const handleSendMessage = () => {
  // Send message...

  // Stop typing immediately
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    setTypingTimeout(null);
  }
  wsRef.current.emit('user-stopped-typing', {
    projectId,
    userId
  });
};
```

### Performance Optimizations

#### Message Virtualization

For projects with thousands of messages, implement virtual scrolling:

```javascript
import { VariableSizeList } from 'react-window';

const VirtualizedMessageList = ({ messages }) => {
  const listRef = useRef();

  const getItemSize = (index) => {
    const message = messages[index];
    // Calculate approximate height based on message content
    // Base height + content length + attachments, etc.
    return estimateMessageHeight(message);
  };

  const Row = ({ index, style }) => (
    <div style={style}>
      <MessageBubble message={messages[index]} />
    </div>
  );

  return (
    <VariableSizeList
      ref={listRef}
      height={600}
      itemCount={messages.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </VariableSizeList>
  );
};
```

#### Lazy Loading

Load messages in batches as user scrolls up:

```javascript
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

const loadMoreMessages = async () => {
  if (!hasMore || loadingMore) return;

  setLoadingMore(true);
  const response = await API.get(
    `/api/projects/${projectId}/messages?page=${page + 1}&limit=50`
  );

  setMessages(prev => [...response.data.messages, ...prev]);
  setPage(prev => prev + 1);
  setHasMore(response.data.hasMore);
  setLoadingMore(false);
};

// Intersection Observer for infinite scroll
const observerTarget = useRef(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting) {
        loadMoreMessages();
      }
    },
    { threshold: 1 }
  );

  if (observerTarget.current) {
    observer.observe(observerTarget.current);
  }

  return () => observer.disconnect();
}, [hasMore, loadingMore]);
```

---

## Success Criteria

### Visual Quality
- ✅ Message bubbles use professional teal-green (#0D7C66) for team, deep blue (#1F4788) for client
- ✅ Chat background is dark (#111827) with optional subtle pattern
- ✅ Clear visual distinction between client and team messages at a glance
- ✅ No pink/purple gradients in message bubbles
- ✅ Professional, non-cartoonish appearance suitable for B2B CRM

### Functional Requirements
- ✅ Message status indicators (sent, delivered, read) working correctly
- ✅ Typing indicators appear when users are typing
- ✅ Pinned messages (max 5 per project) with admin-only pin/unpin
- ✅ Starred messages (personal bookmarks) for all users
- ✅ Enhanced emoji picker with categories and search
- ✅ File preview before sending (max 5 files)
- ✅ Date separators that are sticky while scrolling
- ✅ Search and filter messages by sender, date, type, starred

### User Experience
- ✅ Smooth animations for new messages (200ms slide-in)
- ✅ Auto-scroll to bottom only when user is near bottom
- ✅ "New messages" button when scrolled up
- ✅ Scroll to replied message with highlight animation
- ✅ Message actions (reply, star, pin) appear on hover
- ✅ Optimistic UI: messages appear immediately with "sending" status
- ✅ Graceful error handling with retry options

### Performance
- ✅ Messages load in batches (50 per page)
- ✅ Smooth scrolling with no lag
- ✅ WebSocket events handled efficiently
- ✅ No memory leaks from event listeners
- ✅ Typing indicator debounced (2 seconds)

### Accessibility
- ✅ Keyboard navigation for all interactive elements
- ✅ Proper ARIA labels for screen readers
- ✅ Focus visible indicators
- ✅ Color contrast meets WCAG AA standards
- ✅ Alternative text for icons and emojis

### Cross-Browser Compatibility
- ✅ Works in Chrome, Firefox, Safari, Edge (latest versions)
- ✅ Responsive design for mobile and tablet
- ✅ Touch-friendly controls for mobile users
- ✅ Graceful degradation for older browsers

---

## Implementation Phases

### Phase 1: Core Visual Redesign
1. Update message bubble colors (teal for team, blue for client)
2. Update chat background to dark theme
3. Improve spacing and layout
4. Add/update date separators
5. Style message actions on hover

### Phase 2: Message Status Indicators
1. Add database fields for status tracking
2. Implement WebSocket events for status updates
3. Create MessageStatus component with checkmarks
4. Add delivery and read tracking logic
5. Update UI to show status icons

### Phase 3: Enhanced Input Area
1. Create ChatInputArea component
2. Implement enhanced emoji picker with categories
3. Add file preview before sending
4. Improve reply preview bar styling
5. Add formatting toolbar

### Phase 4: Advanced Features
1. Implement pinned messages (modal + banner)
2. Add starred messages (personal bookmarks)
3. Create typing indicator component
4. Add search and filter functionality
5. Implement "scroll to bottom" button

### Phase 5: Animations & Polish
1. Add message slide-in animations
2. Implement typing indicator animation
3. Add scroll-to-replied-message with highlight
4. Polish hover effects and transitions
5. Add loading states and skeletons

### Phase 6: Testing & Optimization
1. Cross-browser testing
2. Mobile responsiveness testing
3. Performance optimization (virtualization if needed)
4. Accessibility audit
5. User acceptance testing

---

## Notes & Considerations

### Design Decisions

**Why teal-green for team?**
- Conveys internal, trustworthy, professional
- Distinct from WhatsApp's consumer green but similar enough to feel familiar
- Good contrast against dark background

**Why deep blue for client?**
- Represents external, external communication
- Professional and calming
- Clear contrast with teal-green for instant recognition

**Why max 5 pinned messages?**
- Prevents clutter
- Forces prioritization of truly important messages
- Keeps pinned messages banner manageable

### Future Enhancements (Out of Scope)

- Voice messages (recording and playback)
- Video messages
- GIF/sticker library integration
- Message editing (after sent)
- Message deletion (with tombstone)
- Thread/conversation branching
- @everyone or @team group mentions
- Rich link previews
- Read receipts settings (privacy controls)
- Message encryption (end-to-end)

### Known Limitations

- File size limits depend on server configuration
- Emoji picker doesn't include custom emoji (company-specific)
- Typing indicator shows max 3 users (UI constraint)
- Message search is client-side (may need server-side for large datasets)

---

## Appendix

### Color Reference Table

| Color Name | Hex | Usage |
|------------|-----|-------|
| Team Message Bg | `#0D7C66` | Background for admin/employee messages |
| Client Message Bg | `#1F4788` | Background for client messages |
| Chat Background | `#111827` | Main chat container |
| Input Area Bg | `#1F2937` | Message input section |
| Textarea Bg | `#374151` | Text input field |
| Border Color | `#374151` | Borders and dividers |
| Timestamp Gray | `#9CA3AF` | Timestamps and secondary text |
| Date Separator | `#374151` bg + `#9CA3AF` text | Date pills |
| Link Blue | `#60A5FA` | Clickable links |
| Mention Amber | `#F59E0B` | @mention highlights |
| Status Read Blue | `#3B82F6` | Read checkmarks |
| Error Red | `#EF4444` | Failed status |
| Success Green | `#10B981` | Success states |

### Typography

- **Body text**: 14px, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Timestamps**: 11px, same font
- **Sender names**: 12px, semibold
- **Date separators**: 13px, medium
- **Input placeholder**: 14px, gray-400

### Spacing System

- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px

---

**End of Specification**
