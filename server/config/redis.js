// config/redis.js
//
// Single ioredis factory used by the Socket.IO adapter (server/socket/index.js).
// Ported from kha-crm-hrms's notification architecture: Socket.IO's default
// in-memory adapter only knows about sockets connected to THIS process, so a
// notification emitted from a request handled by instance A would never reach
// a user connected to instance B. The redis adapter fixes that by publishing
// every emit to Redis, so all instances behind the load balancer stay in sync.
//
// Local dev: point REDIS_URL at any local Redis (see server/.env.example).
// Production (AWS): point it at an ElastiCache Redis endpoint.
'use strict';

const Redis = require('ioredis');

let client = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Attaches error/ready handlers that log on state CHANGES only (down -> up,
 * up -> down), not on every single retry attempt. ioredis's default
 * retryStrategy below retries forever with capped backoff, which is what we
 * want in production (an ElastiCache blip should self-heal without a
 * restart) — but without this, every retry logs its own error line, so a
 * Redis outage floods the console forever. Also required so that duplicated
 * clients (e.g. the Socket.IO adapter's sub client) don't trigger ioredis's
 * "missing 'error' handler" warning, since `.duplicate()` does not carry
 * over the parent's listeners.
 *
 * Redis itself is optional for a single local/dev instance: Socket.IO's
 * default in-memory adapter already handles same-process delivery, and the
 * redis-adapter's broadcast() calls that local path unconditionally,
 * independent of whether the Redis publish succeeds (see
 * @socket.io/redis-adapter/dist/index.js). So a missing local Redis never
 * breaks notifications or chat — it just means this one process can't fan
 * out to *other* instances until Redis is reachable.
 */
function attachQuietErrorHandler(redisClient, label) {
  let everConnected = false;
  let down = false;
  redisClient.on('error', (err) => {
    if (!down) {
      console.error(
        `❌ Redis (${label}) unreachable — real-time features keep working locally; multi-instance fan-out is paused until it reconnects. (${err.message})`
      );
      down = true;
    }
  });
  redisClient.on('ready', () => {
    if (!everConnected || down) {
      console.log(`✅ Redis (${label}) connected:`, REDIS_URL.replace(/\/\/.*@/, '//***@'));
    }
    everConnected = true;
    down = false;
  });
  return redisClient;
}

/**
 * Returns a shared ioredis client (lazy singleton). Callers that need a
 * second connection (e.g. the Socket.IO adapter's sub client) should call
 * `getRedis().duplicate()` rather than requesting a new one from here, and
 * should pass the duplicate through `attachQuietErrorHandler` themselves.
 */
function getRedis() {
  if (!client) {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // required by @socket.io/redis-adapter
      retryStrategy: (times) => Math.min(times * 500, 10000),
    });

    attachQuietErrorHandler(client, 'pub');
  }

  return client;
}

module.exports = { getRedis, REDIS_URL, attachQuietErrorHandler };
