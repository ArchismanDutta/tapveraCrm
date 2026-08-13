import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import CreateGroupModal from "../components/chat/CreateGroupModal";
import ManageGroupModal from "../components/chat/ManageGroupModal";
import GroupMembersModal from "../components/chat/GroupMembersModal";
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
  // Read-only member roster, available to every participant — not just the
  // admins who can reach ManageGroupModal.
  const [showMembers, setShowMembers] = useState(false);

  // Groups | DMs. Two lists that answer different questions — "which of my
  // teams is talking" vs "who do I need to reply to" — and mixing them into
  // one column made both harder to scan.
  const [activeTab, setActiveTab] = useState("groups");
  // The full active roster (see chatController.listDirectory). Held here
  // rather than in the thread slice because these are people, not threads —
  // most of them have no conversation at all yet.
  const [directory, setDirectory] = useState([]);
  // "Not loaded yet" and "loaded, and there is nobody" look identical in an
  // empty array — these separate them so the tab can't claim you have no
  // colleagues while the request is still in flight or after it failed.
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState(null);
  const [openingDm, setOpeningDm] = useState(null);

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

  /**
   * Load the DM roster.
   *
   * ─── WHY THE LOADING/ERROR STATE IS NOT OPTIONAL HERE ───
   * `directory` starts empty, and an empty roster and a roster that hasn't
   * arrived yet render identically — as "No colleagues to message yet". So a
   * slow first fetch flashed that message, and a FAILED one left it on screen
   * permanently: the DM tab looked empty until the user reloaded the page,
   * which is exactly the "it goes invisible, then a refresh brings it back"
   * behaviour.
   *
   * Tracking both states separates "nothing here" from "not here yet" and
   * from "couldn't load", and gives the last one a retry that doesn't require
   * reloading the app.
   */
  const loadDirectory = useCallback(async () => {
    setDirectoryError(null);
    setDirectoryLoading(true);
    try {
      const rows = await messagingApi.listDirectory();
      setDirectory(rows);
    } catch (error) {
      console.error("Failed to load chat directory:", error);
      // The previous roster is deliberately left in place. If this was a
      // transient blip on a refetch, blanking a list the user was reading
      // would be a worse outcome than showing a slightly stale one.
      setDirectoryError("Could not load the people list.");
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const storedToken = localStorage.getItem("token");
    if (storedRole) setUserRole(storedRole);
    if (storedToken) setJwtToken(storedToken);
    if (storedToken) {
      loadConversations();
      loadDirectory();
    }
  }, [loadConversations, loadDirectory]);

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
      // The roster is fetched once on mount, so a first attempt that failed
      // while the network was down would otherwise stay failed for the whole
      // session — the DM tab empty until a manual reload. A reconnect is the
      // clearest signal that retrying is worth it.
      loadDirectory();
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
  }, [isConnected, loadConversations, loadDirectory, dispatch, selectedId]);

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

  /**
   * Open a DM from the directory.
   *
   * The conversation may not exist yet — that's the normal case for a first
   * message. The server's get-or-create is idempotent, so this is safe to call
   * on every tap, including for threads that already exist.
   */
  const openDirectMessage = useCallback(
    async (row) => {
      // Already have the thread: skip the round trip entirely.
      if (row.conversation) {
        openConversation(row.conversation);
        return;
      }

      setOpeningDm(String(row.person._id));
      try {
        const conversation = await messagingApi.openDirectMessage(row.person._id);

        // Refresh so the new thread enters the store (and the socket
        // subscription) rather than existing only as a local object — without
        // this, the first incoming reply would have no thread to land in until
        // the next reload.
        await loadConversations();

        openConversation({
          ...conversation,
          // The list response names a DM after its peer; mirror that here so
          // the header reads correctly in the moment before the refetch lands.
          name: row.person.name,
          peer: row.person,
        });
      } catch (error) {
        alert(
          error?.response?.data?.error ||
            "Could not open that conversation. Please try again."
        );
      } finally {
        setOpeningDm(null);
      }
    },
    [loadConversations, openConversation]
  );

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

  // Close a conversation that disappeared out from under us.
  //
  // `selectedConversation` is local state holding a snapshot of the document, so
  // it survives the thread being pruned from the store — leaving the composer
  // and message pane rendering a conversation the user has just been removed
  // from or that another admin deleted. Every write from that point 403s, with
  // nothing on screen explaining why.
  //
  // Guarded on `conversations.length` so the first render (before the list has
  // loaded) doesn't read as "your conversation is gone" and close it.
  useEffect(() => {
    if (!selectedId || conversations.length === 0) return;
    if (conversations.some((c) => c._id === selectedId)) return;

    setSelectedConversation(null);
    setActiveConversation(null);
    dispatch(setActiveThread(null, null));
  }, [selectedId, conversations, dispatch, setActiveConversation]);

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

  /* ── Derived lists ────────────────────────────────────────────────── */

  // Groups only. DMs come from `directoryRows` below, which is keyed on people
  // rather than on threads — see the comment there.
  const filteredAndSortedConversations = useMemo(() => {
    let filtered = conversations.filter((c) => c.type !== "private");

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
          // `updatedAt` is the newest message's timestamp, supplied by the
          // server. This used to `return 0` — a sort that did nothing, so
          // "Most recent" silently left the list in creation order.
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      }
    });

    return filtered;
  }, [conversations, debouncedSearchTerm, filterType, sortBy, getUnreadCount]);

  /**
   * The DM tab is a list of PEOPLE, not of threads.
   *
   * That inversion is the whole point: you must be able to message a colleague
   * you have never messaged, so the roster is the source and any existing
   * conversation is joined onto it. A person with no thread yet is a perfectly
   * ordinary row — it just has no unread count and no last-activity time until
   * someone speaks.
   */
  const directoryRows = useMemo(() => {
    const dmByPeer = new Map();
    conversations
      .filter((c) => c.type === "private")
      .forEach((c) => {
        const peerId = c.peer?._id
          || (c.members || []).map((m) => String(m._id)).find((id) => id !== String(currentUserId));
        if (peerId) dmByPeer.set(String(peerId), c);
      });

    let rows = directory.map((person) => {
      const conversation = dmByPeer.get(String(person._id)) || null;
      return {
        person,
        conversation,
        conversationId: conversation?._id || person.conversationId || null,
        unread: conversation ? getUnreadCount(conversation._id) : 0,
        lastMessageAt: conversation?.lastMessageAt || null,
      };
    });

    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.person.name || "").toLowerCase().includes(q) ||
          (r.person.email || "").toLowerCase().includes(q)
      );
    }

    if (filterType === "unread") rows = rows.filter((r) => r.unread > 0);
    else if (filterType === "read") rows = rows.filter((r) => r.unread === 0);

    rows.sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return (a.person.name || "").localeCompare(b.person.name || "");
        case "unread":
          return b.unread - a.unread;
        case "recent":
        default: {
          // People you have actually spoken to float above the rest of the
          // roster, most recent first; everyone else stays alphabetical
          // underneath rather than in an arbitrary order.
          const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          if (at || bt) return bt - at;
          return (a.person.name || "").localeCompare(b.person.name || "");
        }
      }
    });

    return rows;
  }, [
    directory,
    conversations,
    currentUserId,
    debouncedSearchTerm,
    filterType,
    sortBy,
    getUnreadCount,
  ]);

  const totalDmUnread = useMemo(
    () => directoryRows.reduce((sum, r) => sum + (r.unread || 0), 0),
    [directoryRows]
  );

  const totalGroupUnread = useMemo(
    () => filteredAndSortedConversations.reduce((sum, c) => sum + getUnreadCount(c._id), 0),
    [filteredAndSortedConversations, getUnreadCount]
  );

  // Drives the header: a DM has no membership to manage and is already titled
  // with the other person's name.
  const isDirectThread = selectedConversation?.type === "private";

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
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
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

            {/* Groups | DMs. Unread totals live on the tabs so a message
                arriving in the list you're NOT looking at is still visible —
                without them, switching tabs would be the only way to find out
                something was waiting. */}
            <div className="mb-3 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
              {[
                { key: "groups", label: "Groups", count: totalGroupUnread },
                { key: "dms", label: "Direct", count: totalDmUnread },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-white text-blue-700 shadow-sm dark:bg-[#10131c] dark:text-blue-300"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {tab.key === "groups" ? (
                    <Users className="h-3.5 w-3.5" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {tab.count > 99 ? "99+" : tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={
                  activeTab === "groups"
                    ? "Search groups or members..."
                    : "Search colleagues..."
                }
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
            {activeTab === "dms" ? (
              /* ── Direct messages ──────────────────────────────────────
                 A list of PEOPLE, not threads: a colleague you have never
                 messaged still gets a row, and the conversation is created on
                 first open. That is what makes "message anyone" work without
                 a separate new-chat flow to discover. */
              /* Three distinct states, because collapsing them is what made
                 the tab look broken: still loading, failed to load, and
                 genuinely empty each need a different message — and only the
                 last one is "you have no colleagues". */
              directoryLoading && directory.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <Users className="mb-3 h-12 w-12 animate-pulse text-gray-600" />
                  <p className="text-sm text-gray-400">Loading people…</p>
                </div>
              ) : directoryError && directory.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <Users className="mb-3 h-12 w-12 text-gray-600" />
                  <p className="mb-1 text-sm text-gray-400">{directoryError}</p>
                  <button
                    onClick={loadDirectory}
                    className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-500 transition hover:bg-blue-50 dark:border-white/10 dark:text-blue-300 dark:hover:bg-white/[0.06]"
                  >
                    Try again
                  </button>
                </div>
              ) : directoryRows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <Users className="mb-3 h-12 w-12 text-gray-600" />
                  <p className="mb-1 text-sm text-gray-400">
                    {searchTerm
                      ? "No colleagues found"
                      : filterType === "unread"
                      ? "No unread messages"
                      : "No colleagues to message yet"}
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <ul className="mt-2 list-none space-y-2 p-0">
                  {directoryRows.map(({ person, conversation, unread, lastMessageAt }) => {
                    const hasUnread = unread > 0;
                    const isSelected =
                      conversation && selectedConversation?._id === conversation._id;
                    const isOpening = openingDm === String(person._id);

                    return (
                      <li
                        key={person._id}
                        className={`relative cursor-pointer rounded-xl border px-3 py-3 transition-colors ${
                          isSelected
                            ? "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-white"
                            : hasUnread
                            ? "border-blue-200 bg-blue-50/70 text-slate-900 hover:bg-blue-100 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-white dark:hover:bg-blue-400/15"
                            : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-white/10 dark:hover:bg-white/[0.05]"
                        } ${isOpening ? "opacity-60" : ""}`}
                        onClick={() =>
                          !isOpening &&
                          openDirectMessage({ person, conversation, lastMessageAt })
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              hasUnread
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300"
                            }`}
                          >
                            {(person.name || "?")
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`truncate ${hasUnread ? "font-semibold" : ""}`}>
                                {person.name}
                              </span>
                              {hasUnread && (
                                <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                                  {unread > 99 ? "99+" : unread}
                                </span>
                              )}
                            </div>
                            {/* Role/department rather than a message preview:
                                listThreads doesn't return one, and in a company
                                directory "who is this person" is the more useful
                                second line anyway. */}
                            <p className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                              {isOpening
                                ? "Opening…"
                                : [person.role, person.department]
                                    .filter(Boolean)
                                    .join(" · ") || "Colleague"}
                            </p>
                          </div>
                        </div>
                        {hasUnread && (
                          <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 transform rounded-r bg-blue-500" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )
            ) : filteredAndSortedConversations.length === 0 ? (
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
                    {/* A row used to be a bare name on a 50px line, so the list
                        read as eight labels floating in empty space with no way
                        to tell one conversation from another at a glance.

                        The avatar and the member count both come from data the
                        list response ALREADY carries — no extra request — and
                        give the row an anchor to scan down and a second line of
                        substance. (A last-message preview would be better still,
                        but `listThreads` doesn't return one; that needs the
                        server change noted in MESSAGING-FIXLIST.md #10, which is
                        also what would make the "Most Recent" sort work.) */}
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          hasUnread
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300"
                        }`}
                      >
                        {(conv.name || "?")
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate ${hasUnread ? "font-semibold" : ""}`}>
                            {conv.name || "Unnamed Group"}
                          </span>
                          {hasUnread && (
                            <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {(() => {
                            const active = (conv.members || []).filter((m) => m?.isActive !== false);
                            return active.length
                              ? `${active.length} member${active.length === 1 ? "" : "s"}`
                              : "No members";
                          })()}
                        </p>
                      </div>
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
          {/* Groups tab only — there is no "new DM" button by design: every
              colleague is already listed, so creating one is just tapping a
              name. */}
          {activeTab === "groups" &&
            (userRole === "admin" || userRole === "super-admin") && (
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
                  {/* The title opens the member list on a group — the same
                      affordance as tapping a group's name in WhatsApp, and
                      the only one that works on mobile, where the members
                      strip below is hidden at this breakpoint. */}
                  {isDirectThread ? (
                    <h4 className="truncate text-lg font-semibold text-slate-950 dark:text-white">
                      {selectedConversation.name || "Direct message"}
                    </h4>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMembers(true)}
                      className="truncate rounded text-left text-lg font-semibold text-slate-950 transition hover:text-blue-700 dark:text-white dark:hover:text-blue-300"
                      title="View group members"
                    >
                      {selectedConversation.name || "Group Chat"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {/* Current members only. The list now includes people who
                      have left the company (so their old messages keep their
                      author — see adapters/chatThread.js); naming them here
                      would read as "still in this group", which they are not.

                      Clickable for EVERYONE, not just admins. This strip
                      truncates after three or four names, and until now the
                      only way to see the rest was ManageGroupModal — which is
                      admin-gated, because it also renames the group and
                      removes people. Seeing who is in a group you belong to
                      is not an administrative privilege.

                      Suppressed for DMs: the header already IS the other
                      person's name, so "Members: Priya" is just it again. */}
                  {!isDirectThread && selectedConversation.members && (
                    <button
                      type="button"
                      onClick={() => setShowMembers(true)}
                      className="hidden max-w-sm truncate rounded text-left text-sm text-slate-500 underline-offset-4 transition hover:text-blue-700 hover:underline dark:text-slate-400 dark:hover:text-blue-300 lg:block"
                      title="View all group members"
                    >
                      Members:{" "}
                      {selectedConversation.members
                        .filter((m) => m?.isActive !== false)
                        .map((m) => m.name || m._id)
                        .join(", ")}
                    </button>
                  )}

                  {/* Group management is meaningless on a DM — there is no
                      membership to edit, and deleting the thread from under
                      the other person is not an admin's call to make here. */}
                  {!isDirectThread &&
                    (userRole === "admin" || userRole === "super-admin") && (
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
                  // Forward destinations. Owned here because ChatPage already
                  // loads and filters the list; ChatWindow just renders it.
                  conversations={conversations}
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

      {/* Read-only member roster — every participant, not just admins.
          Renders from the members already on the conversation, so opening it
          costs no request. */}
      <GroupMembersModal
        isOpen={showMembers}
        onClose={() => setShowMembers(false)}
        conversation={selectedConversation}
        currentUserId={currentUserId}
      />
    </div>
  );
};

export default ChatPage;
