# Real-time & Notification Architecture (2026-07-16)

**Status:** ✅ Current architecture. Supersedes the real-time parts of
`NOTIFICATION_CENTER_BUILD_SUMMARY.md` and `NOTIFICATION_SYSTEM_FIXES.md`
(kept for history — the notification *data model* and *UI* they describe are
still accurate, only the transport underneath changed).

## Why this changed

An audit of the previous system found it was "centralized" in name only:

- `notificationService.js` (persist + push) existed, but only 2 features
  (tasks, chat) actually went through it. Payslips, auto-payroll, task
  status changes, and wishes all pushed raw WebSocket pings directly via
  `server/utils/websocket.js`, bypassing the database — those notifications
  never appeared in the Notification Center, never counted toward the
  unread badge, and were lost if the recipient wasn't connected at the
  moment they fired.
- The transport itself was a hand-rolled `ws` server with an in-memory
  `userId -> ws[]` map — no rooms, connection tracking done by hand, and no
  way to scale beyond a single server instance.
- The client had a shared `WebSocketContext`, but `ProjectDetailPage.jsx`
  and `ProjectMessagePanel.jsx` each additionally opened their **own** raw
  `new WebSocket(...)` connection — the "2-3 sockets per user" issue
  `NOTIFICATION_SYSTEM_FIXES.md` had already flagged as a known, unfixed
  bug.
- `wishController.js` sent notifications through `global.users[...]`, a map
  that was never actually populated anywhere — wishes never had working
  real-time delivery.

This was ported from **kha-crm-hrms**, whose notification layer doesn't
have these problems: one service is the only allowed producer, transport is
Socket.IO with a Redis adapter (so it's ready for multiple server
instances), and the client holds exactly one socket connection.

## What's the same as before

- **`server/models/Notification.js`** — unchanged schema (this project's
  version is actually richer than kha's: priority, typed `relatedData`,
  TTL expiry). Added `"wish"` to the `type` enum.
- **The notification UI** — `NotificationBell`, `NotificationDropdown`,
  `NotificationCenterPage` (search/filter/pagination/bulk actions) are all
  unchanged in behavior. kha's own notification UI (a scrolling ticker bar)
  is simpler than what this project already had, so it wasn't worth
  copying over — only the backend discipline and transport were.
- **REST API** (`/api/notifications/...`) — unchanged.

## What changed

### Server

- **`server/config/redis.js`** (new) — shared `ioredis` client.
- **`server/socket/index.js`** (new) — Socket.IO server. JWT auth happens
  in the handshake (`io.use(...)`), not as a post-connect message like the
  old `ws` code did. Every socket joins a `user:<id>` room and a
  `role:<role>` room on connect. Uses `@socket.io/redis-adapter` so this
  works the same on one instance or several behind a load balancer.
- **`server/socket/handlers/chat.handler.js`** (new) — group chat messages
  and project-room events (join/leave/message/typing/stop_typing). Project
  messages are now scoped to a `project:<id>` room (only members who
  called `project:join`), whereas the old code broadcast every project
  message to *every* connected socket regardless of project membership.
  Typing indicators are now actually wired up — the old server had no
  handler for the `typing`/`stop_typing` events the client already sent, so
  they silently did nothing.
- **`server/utils/websocket.js`** — same exported function names
  (`sendNotificationToUser`, `broadcastMessageRead`, etc.), reimplemented
  on Socket.IO rooms instead of the manual connection map. No controller
  call sites needed to change for these.
- **`server/services/notificationService.js`** — `createAndSend` still
  works (existing call sites in `taskController`/`chatController`
  untouched). Added `notifyUsers()` (bulk persist + fan-out to several
  users in one call) and `notifyRoles()` (persist + fan-out to everyone
  with a given role, e.g. all admins) for parity with kha's service.
- **Controllers rewired to persist instead of ping-and-forget:**
  `taskController` (status/update/reject notifications), `payslipController`
  (publish), `autoPayrollController` (generate/bulk-generate/recalculate),
  `wishController` (fixed the dead `global.users` reference).

### Client

- **`client/src/contexts/WebSocketContext.jsx`** — same public API
  (`sendMessage`, `isConnected`, `chatMessages`, `registerNotificationHandler`,
  etc.), internals now use `socket.io-client` instead of `new WebSocket()`.
  Added `joinProject` / `leaveProject` / `sendProjectMessage` /
  `sendProjectTyping` / `sendProjectStopTyping` so project pages don't need
  their own connection.
- **`client/src/pages/ProjectDetailPage.jsx`** and
  **`client/src/components/message/ProjectMessagePanel.jsx`** — no longer
  open their own WebSocket; they join/leave the shared context's project
  room and listen for `project-message` / `project-typing` /
  `project-stop-typing` / `project-message-read` window events instead.
- **`client/src/store/slices/notificationSlice.js`** (new) — Redux slice
  for the unread badge + latest-notifications cache. REST is still the
  source of truth (`fetchUnreadCount`, `fetchLatestNotifications`); the
  `notification:new` socket event just triggers `receiveRealtime` to bump
  the badge instantly, deduped by notification id.
- **`NotificationBell.jsx`** now reads its unread count from that Redux
  store instead of its own 30s polling loop. Ring/sound-on-arrival is
  unchanged (still driven by the `ws-notification` window event).
- Deleted `useWebSocket.deprecated.js`, `useChatWebSocket.deprecated.js`,
  `useGlobalChatNotifications.deprecated.js` — confirmed-dead leftovers
  from an earlier attempt at this same cleanup.

## Event contract

| Direction | Event | Payload |
|---|---|---|
| client → server | `chat:subscribe` | `{ conversationIds: string[] }` |
| client → server | `chat:message` | `{ conversationId, message, attachments?, replyTo? }` |
| client → server | `project:join` / `project:leave` | `{ projectId }` |
| client → server | `project:message` | `{ projectId, messageData }` |
| client → server | `project:typing` / `project:stop_typing` | `{ projectId, userName? }` |
| server → client | `notification:new` | `{ type:"notification", channel, title, body, message, notificationId, priority, ...relatedData }` |
| server → client | `chat:message` | `{ _id, conversationId, senderId, message, timestamp, attachments, replyTo }` |
| server → client | `project:message` | `{ projectId, messageData, timestamp }` |
| server → client | `project:typing` / `project:stop_typing` | `{ projectId, userId, userName? }` |
| server → client | `project:message_read` / `project:message_status` / `project:message_pinned` / `project:message_delivered` | `{ projectId, ...data }` |

## Running it locally

1. Redis needs to be reachable at `REDIS_URL` (defaults to
   `redis://127.0.0.1:6379`, matching a default local install — see
   `server/.env.example` for options including Docker).
2. `cd server && npm install && npm run dev`
3. `cd client && npm install && npm run dev`

## Production note

`REDIS_URL` needs to point at a real Redis instance in AWS (e.g. an
ElastiCache for Redis cluster) — there was no Redis in this project's
infrastructure before this change. Everything else (Socket.IO, the
notification service) works the same in a single-instance deployment; the
Redis adapter only becomes load-bearing once there's more than one server
instance behind the load balancer.
