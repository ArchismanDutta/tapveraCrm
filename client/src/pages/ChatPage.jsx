import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import CreateGroupModal from "../components/chat/CreateGroupModal";
import ManageGroupModal from "../components/chat/ManageGroupModal";
import ChatWindow from "../components/chat/chatWindow";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import Sidebar from "../components/dashboard/Sidebar";
import { ArrowLeft, Search, Filter, X, SortAsc, Users, Settings, Trash2, MessageSquare } from "lucide-react";
import * as messagingApi from "../api/messagingApi";
import NotificationPermissionPrompt from "../components/notifications/NotificationPermissionPrompt";
import {
  fetchThreads,
  fetchMessages as fetchThreadMessages,
  markThreadRead,
  setActiveThread,
  selectMessages,
  PAGE_SIZE,
} from "../store/slices/threadsSlice";

const SCOPE = messagingApi.SCOPES.CHAT;

// Module-level so the reference is stable across renders — returning a fresh
// [] from a selector makes useSelector re-render on every store change.
const EMPTY_MESSAGES = [];
const selectNoMessages = () => EMPTY_MESSAGES;

/**
 * ChatPage — Phase 3.
 *
 * ─── WHAT CHANGED ───
 * Conversation list, thread history and unread counts now come from
 * `threadsSlice`. This component previously owned all three in local state,
 * kept a `sessionStorage` mirror of the unread map, and reconciled three
 * sources of messages by hand (`initialMessages` + `allChatMessages` +
 * `chatMessages` merged through a Map on every render). All of that is gone —
 * the slice dedupes and orders centrally, so a message can arrive from REST,
 * the legacy `chat:message` event, or the new `thread:message` event and land
 * exactly once.
 *
 * Composer state (draft text, attachments, reply target) stays local to
 * ChatWindow, which is where it belongs — it is per-view UI state, not shared
 * application state.
 *
 * ─── UNREAD OWNERSHIP ───
 * Four modules used to write `chat_unread_total` / `chat_unread_map` to
 * sessionStorage and broadcast `chat-unread-*` events: this page,
 * WebSocketContext, Sidebar and App. Four writers, no owner — which is exactly
 * why the badge drifted. As of Phase 5 the store is the only owner: Sidebar
 * seeds it app-wide from the server, `thread:message` increments it, and
 * opening a thread clears it. The sessionStorage mirror is gone.
 */

// Custom hook for debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const ChatPage = ({ onLogout }) => {
  const location = useLocation();
  const dispatch = useDispatch();

  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [jwtToken, setJwtToken] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showManageGroup, setShowManageGroup] = useState(false);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, unread, read
  const [sortBy, setSortBy] = useState("recent"); // recent, alphabetical, unread
  const [showFilters, setShowFilters] = useState(false);

  // Drives the contextual push-permission prompt. Set once the user has
  // actually sent something — see NotificationPermissionPrompt for why the
  // browser dialog must never be reached on page load.
  const [hasSentMessage, setHasSentMessage] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Socket context is still needed for reconnect detection and for telling the
  // server which conversation rooms this socket should be subscribed to.
  // Sending no longer goes through it — ChatWindow queues to the outbox (S2),
  // which survives an offline period and drains on reconnect.
  const {
    isConnected,
    setActiveConversation,
    setConversations: updateWebSocketConversations,
  } = useWebSocketContext();

  const currentUserId = JSON.parse(localStorage.getItem("user") || "{}")?._id;

  /* ── Store-derived state ──────────────────────────────────────────── */

  const threadsById = useSelector((s) => s.threads.threads);
  const unreadByKey = useSelector((s) => s.threads.unreadByKey);

  // The slice keys everything "chat:<id>"; the list UI wants plain documents.
  const conversations = useMemo(
    () =>
      Object.entries(threadsById)
        .filter(([key]) => key.startsWith(`${SCOPE}:`))
        .map(([, thread]) => thread),
    [threadsById]
  );

  const selectedId = selectedConversation?._id;
  const combinedMessages = useSelector(
    selectedId ? selectMessages(SCOPE, selectedId) : selectNoMessages
  );

  const getUnreadCount = useCallback(
    (conversationId) => unreadByKey[`${SCOPE}:${conversationId}`] || 0,
    [unreadByKey]
  );

  /* ── Loading ──────────────────────────────────────────────────────── */

  const loadConversations = useCallback(
    () => dispatch(fetchThreads(SCOPE)),
    [dispatch]
  );

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const storedToken = localStorage.getItem("token");
    if (storedRole) setUserRole(storedRole);
    if (storedToken) setJwtToken(storedToken);
    if (storedToken) loadConversations();
  }, [loadConversations]);

  // Keep the socket subscribed to whatever conversations we know about.
  // Without this a conversation loaded after connect never joins its room.
  useEffect(() => {
    if (conversations.length) updateWebSocketConversations(conversations);
  }, [conversations, updateWebSocketConversations]);

  // Reconcile after a reconnect.
  //
  // Sockets drop — laptop lid, wifi handoff, proxy timeout. Anything that
  // arrived while this client was disconnected was never counted, because the
  // only thing that increments unread live is a socket event. On every
  // reconnect (not the first connect — that is covered by the mount fetch) we
  // reseed from the server, which is authoritative. Without this, unread
  // silently under-counts for the rest of the session.
  const wasConnected = React.useRef(false);
  useEffect(() => {
    if (isConnected && wasConnected.current) {
      loadConversations();
      if (selectedId) {
        dispatch(
          fetchThreadMessages({
            scope: SCOPE,
            threadId: selectedId,
            params: { page: 1, limit: PAGE_SIZE },
          })
        );
      }
    }
    wasConnected.current = isConnected;
  }, [isConnected, loadConversations, dispatch, selectedId]);

  // Refetch when a group is created, renamed, or its membership changes.
  // The server broadcasts `conversation:updated` to every member; this is the
  // one legacy listener worth keeping until group management moves behind the
  // service layer.
  useEffect(() => {
    const onConversationUpdated = () => loadConversations();
    window.addEventListener("conversation-updated", onConversationUpdated);
    return () =>
      window.removeEventListener("conversation-updated", onConversationUpdated);
  }, [loadConversations]);

  // Thread history. REST is authoritative; the slice merges socket arrivals on
  // top rather than being clobbered by this.
  useEffect(() => {
    if (!selectedId) return;
    // Newest page only. Loading the entire thread meant a long-running group
    // shipped every message it had ever held on each open — megabytes of JSON
    // and a correspondingly long render, for history almost nobody scrolls to.
    // ChatWindow pulls older pages as the user scrolls up.
    dispatch(
      fetchThreadMessages({
        scope: SCOPE,
        threadId: selectedId,
        params: { page: 1, limit: PAGE_SIZE },
      })
    );
  }, [dispatch, selectedId]);

  /* ── Actions ──────────────────────────────────────────────────────── */

  const openConversation = useCallback(
    (conv) => {
      setSelectedConversation(conv);
      setActiveConversation(conv._id);
      // Zeroes the badge locally and advances the server-side read cursor.
      dispatch(setActiveThread(SCOPE, conv._id));
      dispatch(markThreadRead({ scope: SCOPE, threadId: conv._id }));
    },
    [dispatch, setActiveConversation]
  );

  const handleSelectConversation = openConversation;

  // Auto-open a conversation when arriving from a notification.
  useEffect(() => {
    if (!location.state?.openConversationId || conversations.length === 0) return;
    const target = conversations.find((c) => c._id === location.state.openConversationId);
    if (!target) return;
    openConversation(target);
    window.history.replaceState({}, document.title);
  }, [location.state, conversations, openConversation]);

  // Clear the active thread on unmount so a background message badges correctly.
  useEffect(() => () => { dispatch(setActiveThread(null, null)); }, [dispatch]);

  const handleCreateGroup = async (name, memberIds) => {
    try {
      await messagingApi.createGroup(name, memberIds);
      await loadConversations();
      setShowCreateGroup(false);
    } catch (error) {
      alert(error?.response?.data?.error || error.message);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!window.confirm("Are you sure you want to delete this conversation?")) return;

    try {
      await messagingApi.deleteConversation(conversationId);

      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
        setActiveConversation(null);
        dispatch(setActiveThread(null, null));
      }

      await loadConversations();
      alert("Conversation deleted successfully");
    } catch (error) {
      alert(error?.response?.data?.error || error.message);
    }
  };

  /* ── Derived list ─────────────────────────────────────────────────── */

  const filteredAndSortedConversations = useMemo(() => {
    let filtered = [...conversations];

    if (debouncedSearchTerm) {
      filtered = filtered.filter((conv) => {
        const searchLower = debouncedSearchTerm.toLowerCase();
        const nameMatch = (conv.name || "").toLowerCase().includes(searchLower);
        const memberMatch = conv.members?.some((member) =>
          (member.name || "").toLowerCase().includes(searchLower)
        );
        return nameMatch || memberMatch;
      });
    }

    if (filterType === "unread") {
      filtered = filtered.filter((conv) => getUnreadCount(conv._id) > 0);
    } else if (filterType === "read") {
      filtered = filtered.filter((conv) => getUnreadCount(conv._id) === 0);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return (a.name || "").localeCompare(b.name || "");
        case "unread":
          return getUnreadCount(b._id) - getUnreadCount(a._id);
        case "recent":
        default:
          return 0;
      }
    });

    return filtered;
  }, [conversations, debouncedSearchTerm, filterType, sortBy, getUnreadCount]);

  return (
    <div className="app-shell messages-theme h-[100dvh] overflow-hidden">
      {/* Shared Sidebar (same as AttendancePage) */}
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole || "employee"}
      />

      {/* Main Chat Area */}
      <main
        className={`app-main flex h-[100dvh] transition-all duration-300 ${
          collapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        {/* Conversations Panel */}
        <section className={`h-full w-[340px] min-w-[280px] max-w-[34vw] flex-col border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#10131c] ${selectedConversation ? "flex max-sm:hidden" : "flex max-sm:w-full max-sm:max-w-none"}`}>
          {/* Header with title and filter button */}
          <div className="border-b border-slate-200 p-4 pb-3 dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="app-eyebrow">Messages</p>
                  <h1 className="text-lg font-semibold text-slate-950 dark:text-white">Conversations</h1>
                </div>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters
                    ? "bg-blue-600 text-white"
                    : "app-icon-button"
                }`}
                title="Toggle filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations or members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="app-control w-full py-2 pl-10 pr-10 text-sm placeholder-gray-500 focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter and Sort Options */}
            {showFilters && (
              <div className="app-panel mt-3 space-y-2 p-3">
                {/* Filter Tabs */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Filter</label>
                  <div className="flex gap-2">
                    {["all", "unread", "read"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          filterType === type
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                        }`}
                      >
                        {type === "all"
                          ? `All (${conversations.length})`
                          : type === "unread"
                          ? `Unread (${
                              conversations.filter(
                                (c) => getUnreadCount(c._id) > 0
                              ).length
                            })`
                          : `Read (${
                              conversations.filter(
                                (c) => getUnreadCount(c._id) === 0
                              ).length
                            })`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Options */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                    <SortAsc className="w-3 h-3" />
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="app-control w-full px-3 py-1.5 text-xs"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="alphabetical">Alphabetical</option>
                    <option value="unread">Most Unread</option>
                  </select>
                </div>

                {/* Active Filters Info */}
                {(searchTerm || filterType !== "all" || sortBy !== "recent") && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Showing {filteredAndSortedConversations.length} of{" "}
                        {conversations.length}
                      </span>
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setFilterType("all");
                          setSortBy("recent");
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {filteredAndSortedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Users className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-sm text-gray-400 mb-1">
                  {searchTerm
                    ? "No conversations found"
                    : filterType === "unread"
                    ? "No unread conversations"
                    : "No conversations yet"}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <ul className="list-none p-0 space-y-2 mt-2">
                {filteredAndSortedConversations.map((conv) => {
                const unreadCount = getUnreadCount(conv._id);
                const hasUnread = unreadCount > 0;

                return (
                  <li
                    key={conv._id}
                  className={`relative cursor-pointer rounded-xl border px-3 py-3 transition-colors ${
                      selectedConversation?._id === conv._id
                        ? "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-white"
                        : hasUnread
                        ? "border-blue-200 bg-blue-50/70 text-slate-900 hover:bg-blue-100 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-white dark:hover:bg-blue-400/15"
                        : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-white/10 dark:hover:bg-white/[0.05]"
                    }`}
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`${hasUnread ? "font-semibold" : ""}`}>
                        {conv.name || "Unnamed Group"}
                      </span>
                      {hasUnread && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    {hasUnread && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r"></div>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          {(userRole === "admin" || userRole === "super-admin") && (
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowCreateGroup(true)}
                className="app-primary-button w-full px-3 py-2 text-sm font-semibold"
              >
                + New Group
              </button>
            </div>
          )}
        </section>

        {/* Chat Panel */}
        <section className={`h-full min-w-0 flex-1 flex-col bg-slate-50 dark:bg-[#0b0d12] ${selectedConversation ? "flex" : "flex max-sm:hidden"}`}>
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedConversation(null)}
                    className="app-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center sm:hidden"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h4 className="truncate text-lg font-semibold text-slate-950 dark:text-white">
                    {selectedConversation.name || "Group Chat"}
                  </h4>
                </div>
                <div className="flex items-center gap-4">
                  {selectedConversation.members && (
                    <div className="hidden max-w-sm truncate text-sm text-slate-500 dark:text-slate-400 lg:block">
                      Members:{" "}
                      {selectedConversation.members
                        .map((m) => m.name || m._id)
                        .join(", ")}
                    </div>
                  )}

                  {(userRole === "admin" || userRole === "super-admin") && (
                    <>
                      <button
                        title="Manage Group Members"
                        onClick={() => setShowManageGroup(true)}
                        className="app-secondary-button flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
                      >
                        <Settings className="w-4 h-4" />
                        Manage
                      </button>
                      <button
                        title="Delete Conversation"
                        onClick={() =>
                          handleDeleteConversation(selectedConversation._id)
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-[0px] text-rose-600 transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300 dark:hover:bg-rose-400/15"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-4 w-4" />
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Messages - scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                <NotificationPermissionPrompt trigger={hasSentMessage} />
                <ChatWindow
                  // Remount on conversation change.
                  //
                  // Without a key React reuses the same instance across
                  // conversations, and ChatWindow holds a lot of internal state
                  // that is only meaningful for one thread: the draft, staged
                  // files, message search and date filters, the open lightbox,
                  // typing users, reply target, suggestions. None of it resets
                  // on its own, so switching threads carried the previous
                  // conversation's UI state into the new one — and anything
                  // derived from it rendered stale until a refresh rebuilt the
                  // component from scratch.
                  //
                  // Remounting is the right call here rather than resetting
                  // each piece by hand: a conversation switch genuinely is a
                  // fresh view, and hand-reset lists rot as state is added.
                  key={selectedConversation._id}
                  messages={combinedMessages}
                  onSent={() => setHasSentMessage(true)}
                  conversationId={selectedConversation._id}
                  currentUserId={currentUserId}
                  conversationMembers={selectedConversation.members || []}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600 shadow-sm dark:border-white/10 dark:bg-[#10131c] dark:text-blue-300">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Choose a conversation</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select a team or group from the left to start chatting.</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreate={handleCreateGroup}
        jwtToken={jwtToken}
      />

      {/* Manage Group Modal */}
      <ManageGroupModal
        isOpen={showManageGroup}
        onClose={() => setShowManageGroup(false)}
        conversation={selectedConversation}
        jwtToken={jwtToken}
        onGroupUpdated={() => loadConversations()}
      />
    </div>
  );
};

export default ChatPage;
