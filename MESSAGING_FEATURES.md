# Messaging Features - @Mentions & Unread Counters

This document describes the new messaging features added to the TapVera CRM system.

## Features Overview

### 1. @Mention Tagging (WhatsApp-style)
Tag users in messages by typing `@` followed by their name. Tagged users receive notifications and mentions are highlighted in messages.

### 2. Unread Message Counters
Visual badges showing unread message counts appear throughout the application:
- Client Portal project cards
- Project Detail Page messaging tab
- Chat interface

---

## 1. @Mention Tagging Feature

### How to Use

#### In Project Messages:
1. Open any project's messaging/chat tab
2. Type `@` in the message input
3. Continue typing the user's name (e.g., `@John` or `@John Doe`)
4. The system will automatically detect and tag the user
5. Send your message - the tagged user will receive a notification

#### In Group/Private Chats:
1. Open ChatPage
2. Type `@` followed by a user's name
3. The mention will be automatically detected
4. Tagged users receive high-priority notifications

### Features:
- **Auto-detection**: Just type `@Name` - no dropdown needed
- **Case-insensitive**: Works with any case (e.g., `@john`, `@John`, `@JOHN`)
- **Full name support**: Use first name or full name (e.g., `@John` or `@John Doe`)
- **Notifications**: Tagged users receive high-priority notifications with message preview
- **Visual badges**: Mentions appear as colored badges below messages
- **Self-highlight**: Your mentions appear in yellow, others in blue

### Technical Implementation:

#### Backend:
- **Automatic parsing**: Backend automatically parses `@mentions` from message text
- **Database storage**: Mentions stored in `mentions` array field
- **Notification service**: Sends notifications to mentioned users
- **Supported models**: Works with both User and Client models

#### Frontend:
- **Display**: Mentions shown as colored badges below messages
- **Yellow badges**: When you are mentioned
- **Blue badges**: When others are mentioned
- **Hover info**: Hover over badges to see user email

### Example Usage:

```
Message: "Hey @Alice can you review the design? cc @Bob"

Result:
- Alice receives notification: "John mentioned you in Project Name"
- Bob receives notification: "John mentioned you in Project Name"
- Message displays with badges showing @Alice and @Bob
```

---

## 2. Unread Message Counters

### Where They Appear:

#### Client Portal (`/client-portal`)
- **Desktop view**: Message icon with red badge next to "View Details" button
- **Mobile view**: Message icon with red badge next to "View" button
- **Auto-refresh**: Updates every 60 seconds

#### Project Detail Page (`/project/:id`)
- **Messages tab**: Red badge showing unread count
- **Auto-refresh**: Updates every 30 seconds
- **Real-time**: Updates via WebSocket when new messages arrive

### Features:
- **Auto-refresh**: Counters update automatically
- **WebSocket support**: Real-time updates when messages are sent/read
- **Zero hiding**: Badge hidden when count is 0
- **99+ display**: Shows "99+" for counts over 99
- **Pulse animation**: Badge pulses to draw attention

### Technical Implementation:

#### Backend Endpoint:
```
GET /api/projects/:projectId/messages/unread-count
```

#### Frontend Component:
```jsx
<UnreadMessageBadge
  projectId={projectId}
  refreshInterval={30000} // 30 seconds
/>
```

#### Real-time Events:
- Listens for `project-message-received` events
- Listens for `project-messages-read` events
- Auto-fetches count when events fire

---

## Database Schema Changes

### ChatMessage Model
```javascript
{
  conversationId: String,
  senderId: String,
  message: String,
  mentions: [String], // NEW: Array of mentioned user IDs
  readBy: [String],
  replyTo: ObjectId,
  attachments: Array,
  reactions: Array,
  timestamp: Date
}
```

### Message Model (Project Messages)
```javascript
{
  project: ObjectId,
  message: String,
  sentBy: ObjectId,
  senderModel: String,
  mentions: [              // NEW: Array of mentioned users
    {
      user: ObjectId,
      userModel: String    // "User" or "Client"
    }
  ],
  readBy: Array,
  replyTo: ObjectId,
  attachments: Array,
  reactions: Array,
  timestamps: true
}
```

---

## API Changes

### Chat Messages API

#### POST `/api/chat/messages`
**New Parameter:**
- `mentions` (optional): Array of user IDs or JSON string

**Example:**
```javascript
const formData = new FormData();
formData.append('conversationId', conversationId);
formData.append('message', 'Hey @Alice, can you help?');
formData.append('mentions', JSON.stringify(['userId1', 'userId2']));
// mentions are auto-parsed if not provided
```

#### GET `/api/chat/messages/:conversationId`
**Returns:** Messages with populated `mentionedUsers` array

---

### Project Messages API

#### POST `/api/projects/:id/messages`
**New Parameter:**
- `mentions` (optional): Array of mention objects or JSON string

**Example:**
```javascript
const formData = new FormData();
formData.append('message', 'Hey @Bob, check this out');
formData.append('mentions', JSON.stringify([
  { user: 'userId1', userModel: 'User' }
]));
// mentions are auto-parsed if not provided
```

#### GET `/api/projects/:id/messages`
**Returns:** Messages with populated `mentions.user` field

#### GET `/api/projects/:id/messages/unread-count`
**Returns:**
```json
{
  "unreadCount": 5
}
```

---

## Components Reference

### 1. UnreadMessageBadge
**Location:** `client/src/components/message/UnreadMessageBadge.jsx`

**Props:**
- `projectId` (string): Project ID to fetch unread count for
- `refreshInterval` (number): Refresh interval in ms (default: 30000)
- `className` (string): Additional CSS classes
- `showZero` (boolean): Show badge when count is 0 (default: false)

**Usage:**
```jsx
<UnreadMessageBadge
  projectId={project._id}
  refreshInterval={60000}
/>
```

---

### 2. MentionInput
**Location:** `client/src/components/message/MentionInput.jsx`

**Props:**
- `availableUsers` (array): Array of users that can be mentioned
- `onSend` (function): Callback with `{message, mentionedUserIds}`
- `placeholder` (string): Input placeholder
- `disabled` (boolean): Disable input

**Features:**
- @mention autocomplete dropdown
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Click outside to close
- Shows user avatars and emails

**Usage:**
```jsx
<MentionInput
  availableUsers={conversationMembers}
  onSend={({message, mentionedUserIds}) => {
    handleSendMessage(message, mentionedUserIds);
  }}
  placeholder="Type a message..."
/>
```

---

### 3. MessageWithMentions
**Location:** `client/src/components/message/MessageWithMentions.jsx`

**Props:**
- `message` (string): Message text with @mentions
- `mentions` (array): Array of mentioned users from DB
- `currentUserId` (string): Current user's ID

**Features:**
- Parses and highlights @mentions
- Highlights user's own mentions in yellow
- Shows user info on hover

**Usage:**
```jsx
<MessageWithMentions
  message={msg.message}
  mentions={msg.mentions}
  currentUserId={currentUser._id}
/>
```

---

## Notifications

### Mention Notifications
When a user is mentioned:
- **Type:** `chat`
- **Channel:** `mention`
- **Priority:** `high`
- **Title:** "{SenderName} mentioned you in {ProjectName/ConversationName}"
- **Body:** First 100 characters of message
- **Related Data:**
  - `conversationId` or `projectId`
  - `messageId`

### Notification Service Integration
```javascript
await notificationService.createNotification({
  userId: mentionedUserId,
  type: 'chat',
  channel: 'mention',
  title: `${senderName} mentioned you`,
  body: message.slice(0, 100),
  relatedData: {
    projectId: projectId,
    messageId: messageId
  },
  priority: 'high'
});
```

---

## Styling

### Mention Badges (Project Messages)
```css
/* Current user mentioned (yellow) */
bg-yellow-500/20 text-yellow-400 border-yellow-500/30

/* Other user mentioned (blue) */
bg-blue-500/20 text-blue-400 border-blue-500/30
```

### Unread Counter Badge
```css
/* Red badge with pulse animation */
bg-red-500 text-white rounded-full
animation: pulse 2s infinite
```

---

## Testing

### Testing @Mentions:
1. Create a test project with multiple users assigned
2. Open project messaging as User A
3. Type: "Hey @UserB can you check this?"
4. Verify:
   - Message sends successfully
   - UserB receives notification
   - Mention badge appears below message
   - Badge is yellow when viewing as UserB
   - Badge is blue when viewing as other users

### Testing Unread Counters:
1. Login as Client
2. Open Client Portal
3. Note unread count on project cards
4. Open project and view messages
5. Verify:
   - Badge updates when viewing messages
   - Badge disappears when all read
   - Badge appears when new message arrives
   - Counter updates in real-time via WebSocket

---

## Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Performance Considerations

### Unread Counters:
- **Caching**: Uses sessionStorage for temporary cache
- **Debouncing**: Updates throttled to refresh interval
- **WebSocket**: Real-time updates without polling
- **Lazy loading**: Only loads for visible projects

### Mentions:
- **Auto-parsing**: Backend parses mentions automatically (no heavy client processing)
- **Regex-based**: Efficient pattern matching
- **Database indexing**: Ensure user name fields are indexed for fast lookups

---

## Future Enhancements

### Potential Improvements:
1. **Autocomplete dropdown**: Show user suggestions as you type `@`
2. **Mention search**: Filter messages by mentions
3. **Mention reports**: Analytics on most mentioned users
4. **Mention permissions**: Control who can mention whom
5. **Group mentions**: Support `@everyone` or `@team`
6. **Rich notifications**: Include sender avatar and project icon

---

## Support

For issues or questions:
- Check console logs for errors
- Verify WebSocket connection is active
- Ensure notification permissions are granted
- Check backend logs for API errors

---

## Changelog

### Version 1.0.0 (Current)
- ✅ @Mention tagging with auto-detection
- ✅ Unread message counters (Client Portal, Project Detail)
- ✅ Mention notifications (high priority)
- ✅ Visual mention badges
- ✅ Real-time WebSocket updates
- ✅ Support for User and Client models
- ✅ Auto-parsing from message text
