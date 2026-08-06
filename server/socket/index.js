// socket/index.js
//
// Socket.IO server — replaces the raw `ws` server that used to live inline in
// app.js. Modeled on kha-crm-hrms's socket layer:
//   - JWT auth happens in the Socket.IO handshake (io.use middleware), not as
//     a post-connect message. There's no window where an unauthenticated
//     socket can send data (the old raw-ws code sent "auth_required"/
//     "auth_failed" AFTER accepting the connection).
//   - Every socket joins two rooms on connect: `user:<id>` (targeted
//     notifications/messages) and `role:<role>` (broadcast to everyone with a
//     given role, e.g. "notify all admins").
//   - The Redis adapter means this works the same whether the app is running
//     as one process or scaled to several behind a load balancer.
'use strict';

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const { getRedis, attachQuietErrorHandler } = require('../config/redis');

let io = null;

function initSocket(httpServer) {
  const frontendOrigins = [
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_URL,
    'https://client.tapvera.io',
  ]
    .filter(Boolean)
    .flatMap((origin) => origin.split(',').map((o) => o.trim()))
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: frontendOrigins.length ? frontendOrigins : '*',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for horizontal scaling — see config/redis.js for rationale.
  // Attached unconditionally, even if Redis isn't reachable right now: the
  // adapter's local (same-process) delivery doesn't depend on the Redis
  // connection succeeding, so a missing/down Redis never breaks chat or
  // notifications for a single instance — it only pauses fan-out to *other*
  // instances until Redis reconnects. attachQuietErrorHandler keeps that
  // reconnect attempt from flooding the console, and gives the subClient
  // (from .duplicate(), which doesn't inherit the pub client's listeners)
  // its own error handler so ioredis doesn't warn about a missing one.
  try {
    const pubClient = getRedis();
    const subClient = pubClient.duplicate();
    attachQuietErrorHandler(subClient, 'sub');
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis adapter attached (multi-instance ready once Redis connects)');
  } catch (err) {
    console.error('⚠️  Socket.IO Redis adapter failed to attach (falling back to in-memory adapter):', err.message);
  }

  // Auth middleware — runs once per connection, before "connection" fires.
  // Mirrors the payload shape server/controllers/authController.js signs:
  // { id, role, userType, regions, region }.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.id) return next(new Error('Invalid token payload'));

      socket.user = decoded; // { id, role, userType, regions, region, iat, exp }

      // ─── WHY THIS IS MIRRORED ONTO socket.data ───
      // `socket.data` is the only thing that survives the Redis adapter.
      // `io.in(room).fetchSockets()` returns a RemoteSocket for every socket
      // living on another instance, and a RemoteSocket carries just
      // { id, handshake, rooms, data } — a custom `.user` property assigned
      // here is NOT serialized and reads back as undefined. So any check that
      // has to be correct cluster-wide must read from `data`.
      socket.data.userId = String(decoded.id);

      // Is this tab in the foreground? The client reports it (see
      // WebSocketContext) and pushPolicy reads it to tell "the tab is open"
      // apart from "the user is actually looking at it".
      //
      // Defaults to true so a client that never reports — an older cached
      // bundle — behaves exactly as it did before rather than suddenly
      // notifying someone who is staring at the conversation.
      socket.data.active = true;

      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    console.log(`[Socket.IO] Connected: ${socket.id} (user ${id}${role ? `, role ${role}` : ''})`);

    socket.join(`user:${id}`);
    if (role) socket.join(`role:${role}`);

    require('./handlers/chat.handler')(io, socket);
    require('./handlers/notification.handler')(io, socket);
    require('./handlers/clientRequest.handler')(io, socket);
    // Online / last-seen (S3). Registers its own `disconnect` listener, which
    // Socket.IO fires alongside the one below rather than replacing it.
    require('./handlers/presence.handler')(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket(server) first.');
  return io;
}

module.exports = { initSocket, getIO };
