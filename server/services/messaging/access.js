// services/messaging/access.js
//
// THE authorization module for messaging. Every read/write to a chat
// conversation or a project message thread — whether it arrives over REST or
// over Socket.IO — asks this module first.
//
// Why one module: before this existed, `GET /api/chat/messages/:id` and the
// `chat:subscribe` socket event both had *no* membership check at all, while
// `GET /api/projects/:id/messages` had one that covered the `employee` role
// but silently let `client` through. Three transports, three different answers
// to the same question. Access rules that live in route handlers drift; this
// file is the single answer.
//
// Design notes:
//   - Throws AccessError rather than returning a boolean, so a caller that
//     forgets to check the result fails closed instead of open.
//   - Returns the loaded Conversation/Project on success, so callers don't
//     re-fetch the document they just authorized against.
//   - Role strings are inconsistent across this codebase ("super-admin" vs
//     "superadmin" — see the defensive room targeting in utils/websocket.js).
//     Both are accepted everywhere here.
'use strict';

const Conversation = require('../../models/Conversation');
const Project = require('../../models/Project');
const User = require('../../models/User');
const { can } = require('../../utils/accessControl');
const hierarchyUtils = require('../../utils/hierarchyUtils');

class AccessError extends Error {
  constructor(message, status = 403, code = 'FORBIDDEN') {
    super(message);
    this.name = 'AccessError';
    this.status = status;
    this.code = code;
  }
}

const ADMIN_ROLES = ['admin', 'super-admin', 'superadmin'];

const isAdmin = (user) => ADMIN_ROLES.includes(user?.role);
const sameId = (a, b) => String(a) === String(b);

/**
 * The two transports carry different user shapes and this bit them before:
 *   - REST:   `req.user` is built by middlewares/authMiddleware.js  -> `_id`
 *   - Socket: `socket.user` is the raw JWT payload (socket/index.js) -> `id`
 * Every check below goes through this, so neither transport can silently
 * evaluate `undefined === undefined` and fail open.
 */
const userIdOf = (user) => user?._id ?? user?.id ?? null;

/**
 * `can()` and `hierarchyUtils` resolve authority from the user's Position
 * (`positionRef`, falling back to the legacy `position` string). Those fields
 * are on the REST `req.user`, but NOT on the socket JWT payload — which
 * carries only { id, role, userType, regions, region }.
 *
 * Passing a raw socket user straight into `can()` would silently return false
 * for, say, a Project Manager whose projects:view authority comes from their
 * Position — denying access they legitimately have. So: if the object we were
 * handed is missing those fields, load the real User document once.
 *
 * Admins and super-admins short-circuit inside `can()` on `role` alone, so
 * they never need the round trip. Clients are never Users and are handled
 * separately by the caller.
 */
async function hydrateForAuthority(user) {
  if (!user) return user;
  if (isAdmin(user)) return user;
  if (user.userType === 'Client' || user.role === 'client') return user;
  // Already a full document / fully-built req.user.
  if ('positionRef' in user || 'position' in user) return user;

  const uid = userIdOf(user);
  if (!uid) return user;
  const full = await User.findById(uid).select('-password').lean().catch(() => null);
  return full || user;
}

/* ── Chat conversations (ChatMessage / Conversation) ──────────────────── */

/**
 * Can this user act on this chat conversation?
 *
 * @param {object} user            req.user / socket.user
 * @param {string} conversationId
 * @param {'read'|'write'|'moderate'|'delete'} action
 * @returns {Promise<{ conversation, isMember, isCreator }>}
 * @throws  {AccessError}
 *
 * Rules:
 *   read / write  — must be in `Conversation.members`. Admins are NOT given a
 *                   blanket bypass: no admin surface in this app reads a
 *                   thread it isn't part of (verified by grepping every
 *                   caller of /api/chat/*), and a silent admin backdoor into
 *                   private DMs is not something to add without it being an
 *                   explicit, audited product decision.
 *   moderate      — group creator, or an admin. (Membership management was
 *                   already creator-only in chatController; admins are added
 *                   here so a group whose creator has left is not orphaned.)
 *   delete        — private: either participant. group: creator or admin.
 *                   Deletion drops every message for everyone, so a plain
 *                   member cannot do it to a group.
 */
async function assertChatAccess(user, conversationId, action = 'read') {
  const uid = userIdOf(user);
  if (!uid) throw new AccessError('Not authenticated', 401, 'UNAUTHENTICATED');
  if (!conversationId) throw new AccessError('Conversation id required', 400, 'BAD_REQUEST');

  const conversation = await Conversation.findById(conversationId).catch(() => null);
  if (!conversation) throw new AccessError('Conversation not found', 404, 'NOT_FOUND');

  // Conversation.members is String[] of user ids — compare as strings.
  const isMember = (conversation.members || []).some((m) => sameId(m, uid));
  const isCreator = sameId(conversation.createdBy, uid);
  const admin = isAdmin(user);

  let allowed;
  switch (action) {
    case 'read':
    case 'write':
      allowed = isMember;
      break;
    case 'moderate':
      allowed = isCreator || admin;
      break;
    case 'delete':
      allowed = conversation.type === 'private' ? isMember : isCreator || admin;
      break;
    default:
      throw new AccessError(`Unknown action "${action}"`, 400, 'BAD_REQUEST');
  }

  if (!allowed) {
    throw new AccessError('You do not have access to this conversation', 403, 'CONVERSATION_FORBIDDEN');
  }

  return { conversation, isMember, isCreator };
}

/* ── Project message threads (Message / Project) ──────────────────────── */

/**
 * Can this user act on this project's message thread?
 *
 * @param {object} user
 * @param {string} projectId
 * @param {'read'|'write'|'moderate'} action
 * @returns {Promise<{ project, membership }>}
 * @throws  {AccessError}
 *
 * Rules:
 *   read / write — assigned employee, owning client, or project-view
 *                  authority (admin / super-admin / projects:manage /
 *                  projects:view scoped to accessible people).
 *   moderate     — project-manage authority only (pin, unpin).
 *
 * Note on clients: Project carries BOTH `clients` (current, array) and
 * `client` (legacy, single) — see the schema comments in models/Project.js.
 * Both are checked. The dead server/models/projectMessages.js router only
 * ever checked `clients`, so it would have wrongly locked clients out of
 * their own older projects.
 */
async function assertProjectChatAccess(user, projectId, action = 'read') {
  const uid = userIdOf(user);
  if (!uid) throw new AccessError('Not authenticated', 401, 'UNAUTHENTICATED');
  if (!projectId) throw new AccessError('Project id required', 400, 'BAD_REQUEST');

  const project = await Project.findById(projectId).catch(() => null);
  if (!project) throw new AccessError('Project not found', 404, 'NOT_FOUND');

  // Position-derived authority needs the full User doc — see hydrateForAuthority.
  const actor = await hydrateForAuthority(user);

  const manageAuthority =
    isAdmin(actor) || (await can(actor, 'projects:manage'));

  if (action === 'moderate') {
    if (!manageAuthority) {
      throw new AccessError('Not authorized to moderate this thread', 403, 'PROJECT_MODERATE_FORBIDDEN');
    }
    return { project, membership: 'manager' };
  }

  if (manageAuthority) return { project, membership: 'manager' };

  if (actor.role === 'client' || actor.userType === 'Client') {
    const inClients = (project.clients || []).some((c) => sameId(c?._id || c, uid));
    const isLegacyClient = project.client && sameId(project.client, uid);
    if (inClients || isLegacyClient) return { project, membership: 'client' };
    throw new AccessError('You do not have access to this project', 403, 'PROJECT_FORBIDDEN');
  }

  const isAssigned = (project.assignedTo || []).some((u) => sameId(u?._id || u, uid));
  if (isAssigned) return { project, membership: 'assignee' };

  // projects:view authority, scoped to projects staffed by people this user
  // can see in the hierarchy. Mirrors hasProjectViewAuthority in
  // routes/projectRoutes.js — kept in step deliberately.
  if (await can(actor, 'projects:view')) {
    const accessibleIds = await hierarchyUtils.getAccessibleUserIds(actor);
    const accessible = new Set(accessibleIds.map(String));
    const overlaps = (project.assignedTo || []).some((id) =>
      accessible.has(String(id?._id || id))
    );
    if (overlaps) return { project, membership: 'supervisor' };
  }

  throw new AccessError('You do not have access to this project', 403, 'PROJECT_FORBIDDEN');
}

/* ── Express glue ─────────────────────────────────────────────────────── */

/**
 * Turn an AccessError into a response. Anything that isn't an AccessError is
 * re-thrown so genuine bugs keep surfacing as 500s instead of being
 * misreported as permission problems.
 */
function sendAccessError(res, err) {
  if (err instanceof AccessError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  throw err;
}

module.exports = {
  AccessError,
  assertChatAccess,
  assertProjectChatAccess,
  sendAccessError,
  isAdmin,
};
