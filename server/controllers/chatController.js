// controllers/chatController.js
//
// Conversation/group MANAGEMENT only.
//
// ─── WHAT MOVED, AND WHY ───
// Message CRUD used to live here too: saveMessage, getMessagesByConversation,
// markConversationAsRead, getUnreadCountsForUser and
// getGroupConversationsForUser. All five now live in
// services/messaging/adapters/chatThread.js, reached through
// services/messaging/messaging.service.js.
//
// They were deleted rather than left in place deliberately. Those functions
// carried the pre-Phase-0 code paths, which did no authorization of their own —
// they relied on the caller having checked. Leaving them exported next to the
// new service would be a loaded gun: a future route wired to
// chatController.saveMessage instead of messagingService.sendMessage would
// silently reintroduce the exact IDOR Phase 0 closed, and it would look
// perfectly reasonable in review.
//
// The @mention resolver that used to live here moved to
// services/messaging/mentions.js, where the project thread now shares it.

const ChatMessage = require("../models/ChatMessage");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

exports.getConversationById = async (conversationId) => {
  return await Conversation.findById(conversationId);
};

/**
 * The people you can start a direct message with: every active colleague
 * except yourself.
 *
 * ─── WHY THE WHOLE DIRECTORY, NOT JUST EXISTING CHATS ───
 * A DM list built only from conversations that already exist has a
 * chicken-and-egg problem — you cannot message someone you have never
 * messaged. Returning the full roster and creating the conversation lazily on
 * first send means there is no separate "new chat" step to find.
 *
 * `conversationId` is included where a thread already exists so the client can
 * open it directly. A null there is not an error: it means the pair have not
 * spoken yet, and the row is still perfectly clickable.
 *
 * Clients are deliberately absent — they live in the separate `Client`
 * collection and are reached through project threads, which keep the
 * internal/client boundary that this directory would otherwise cross.
 */
exports.listDirectory = async (currentUserId) => {
  const me = String(currentUserId);

  // Only "active". inactive/terminated/absconded staff are excluded from
  // STARTING a chat — but note listThreads still returns existing threads with
  // them, and still attributes their old messages correctly. Not being able to
  // start a new conversation is different from erasing the ones you had.
  const users = await User.find(
    { _id: { $ne: me }, status: "active" },
    "name email role department"
  )
    .sort({ name: 1 })
    .lean();

  // Existing DMs in one query rather than one per user — this list is the
  // whole company, so a per-row lookup is the difference between one round
  // trip and a hundred.
  const existing = await Conversation.find({ type: "private", members: me })
    .select("members")
    .lean();

  const threadByPeer = new Map();
  existing.forEach((conversation) => {
    const peer = (conversation.members || []).find((m) => String(m) !== me);
    if (peer) threadByPeer.set(String(peer), String(conversation._id));
  });

  return users.map((u) => ({
    _id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department || null,
    conversationId: threadByPeer.get(String(u._id)) || null,
  }));
};

/**
 * Get or create a private conversation between two users.
 *
 * `$size: 2` is what keeps this a genuine one-to-one: without it, `$all`
 * would also match a group that happens to contain both people, and a DM
 * would silently resolve to that group's thread.
 */
exports.getOrCreatePrivateConversation = async (userIdA, userIdB) => {
  const a = String(userIdA);
  const b = String(userIdB);

  // Guard rather than create: a self-conversation has no second party, so
  // every receipt and unread rule downstream (which all read "everyone except
  // the sender") would be computing against an empty set.
  if (a === b) {
    const err = new Error("You cannot start a conversation with yourself");
    err.statusCode = 400;
    throw err;
  }

  const other = await User.findById(b).select("_id status").lean();
  if (!other) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  if (other.status !== "active") {
    const err = new Error("That person is no longer active");
    err.statusCode = 400;
    throw err;
  }

  let conversation = await Conversation.findOne({
    type: "private",
    members: { $all: [a, b], $size: 2 },
  });
  if (!conversation) {
    conversation = new Conversation({
      type: "private",
      members: [a, b],
    });
    await conversation.save();
  }
  return conversation;
};

// List all group conversations a user belongs to
// Create a new group conversation (admin or super-admin only)
exports.createGroupConversation = async (name, memberIds, createdBy) => {
  // Normalize to string IDs and ensure creator is a member
  const members = Array.from(
    new Set([...(memberIds || []).map(String), String(createdBy)])
  );

  const conversation = new Conversation({
    type: "group",
    name,
    members,
    createdBy: String(createdBy),
  });
  return await conversation.save();
};


// Delete conversation along with its messages
exports.deleteConversation = async (conversationId) => {
  // Delete all messages related to the conversation
  await ChatMessage.deleteMany({ conversationId });

  // Delete the conversation document by ID from the Conversation model
  const deletedConversation = await Conversation.findByIdAndDelete(conversationId);

  return deletedConversation;
};

// Add members to a group conversation
exports.addMembersToGroup = async (conversationId, memberIds, requestingUserId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Check if requesting user is the creator or an admin
  // For now, only creator can manage the group
  if (conversation.createdBy !== requestingUserId.toString()) {
    throw new Error("Only the group creator can add members");
  }

  // Add new members (avoid duplicates)
  const existingMembers = new Set(conversation.members);
  const newMembers = memberIds.filter(id => !existingMembers.has(id));

  conversation.members.push(...newMembers);
  await conversation.save();

  return conversation;
};

// Remove a member from a group conversation
exports.removeMemberFromGroup = async (conversationId, memberIdToRemove, requestingUserId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Check if requesting user is the creator
  if (conversation.createdBy !== requestingUserId.toString()) {
    throw new Error("Only the group creator can remove members");
  }

  // Don't allow removing the creator
  if (memberIdToRemove === conversation.createdBy) {
    throw new Error("Cannot remove the group creator");
  }

  // Remove the member
  conversation.members = conversation.members.filter(
    id => id !== memberIdToRemove
  );

  await conversation.save();

  return conversation;
};

// Update group details (name, etc.)
exports.updateGroupDetails = async (conversationId, updates, requestingUserId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Check if requesting user is the creator
  if (conversation.createdBy !== requestingUserId.toString()) {
    throw new Error("Only the group creator can update group details");
  }

  // Update allowed fields
  if (updates.name) {
    conversation.name = updates.name;
  }

  await conversation.save();

  return conversation;
};

// Get group details with populated member information
exports.getGroupDetails = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Get member details
  const members = await User.find({
    _id: { $in: conversation.members }
  }).select('_id name email employeeId role');

  // Get creator details
  const creator = await User.findById(conversation.createdBy)
    .select('_id name email employeeId');

  return {
    ...conversation.toObject(),
    memberDetails: members,
    creatorDetails: creator
  };
};


