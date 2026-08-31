import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Filter,
  X as XCircle,
  Copy,
  Check,
  Reply as ReplyIcon,
  Image as ImageIcon,
  File as FileIcon,
  Video,
  Download,
  Search,
  Smile,
  Paperclip,
  Type,
  Send,
  Sparkles,
  Clock,
  Zap,
  Plus,
  Forward,
  Trash2,
  Pencil,
} from "lucide-react";
import MediaLightbox from "../common/MediaLightbox";
import MessageDateSeparator from "../message/MessageDateSeparator";
import TypingIndicator from "../message/TypingIndicator";
import useMessageSuggestions from "../../hooks/useMessageSuggestions";
import MentionInput from "../common/MentionInput";
import MentionText from "../common/MentionText";
import { messageMentionsUser, resolveMentionedUserIds } from "../../utils/mentions";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import ThreadSummaryModal from "../message/ThreadSummaryModal";
import ThreadFilterBar from "../message/ThreadFilterBar";
import PresenceIndicator from "../message/PresenceIndicator";
import MessageStatus from "../message/MessageStatus";
import useReceipts from "../../hooks/useReceipts";
import { queueAndSend } from "../../utils/sendMessage";
import FailedMessageBar from "../message/FailedMessageBar";
import UnreadDivider from "../message/UnreadDivider";
import NewMessagesButton from "./NewMessagesButton";
import ForwardMessagesModal from "./ForwardMessagesModal";
import MessageSelectionBar from "./MessageSelectionBar";
// Real search — the filter fields above only reach the newest loaded page.
import MessageSearchPanel from "../message/MessageSearchPanel";
import DeleteMessageModal from "../message/DeleteMessageModal";
import DeletedMessageBubble from "../message/DeletedMessageBubble";
import useMessageSelection from "../../hooks/useMessageSelection";
import useMessageListMechanics, { startsGroup } from "../../hooks/useMessageListMechanics";
import useFileAttach from "../../hooks/useFileAttach";
import DropOverlay from "../message/DropOverlay";
import {
  fetchOlderMessages,
  selectOlderStatus,
  selectPagination,
} from "../../store/slices/threadsSlice";
import useDraft from "../../hooks/useDraft";
import { selectUnread } from "../../store/slices/threadsSlice";
import { deriveStatus } from "../../store/slices/threadsSlice";
// Phase 3: network calls go through the shared axios-backed API module instead
// of hand-rolled fetch + `Authorization: Bearer ${localStorage.getItem(...)}`,
// and typing indicators read from the store rather than window CustomEvents.
// Composer state (draft, attachments, reply target) stays local — that is
// per-view UI state, not shared application state.
import * as messagingApi from "../../api/messagingApi";
import { selectTyping } from "../../store/slices/threadsSlice";
import { useSelector, useDispatch } from "react-redux";

// Must match the server's `uploadToS3.array("files", 5)` cap — attaching more
// than the route accepts fails the whole send rather than the extra file.
const MAX_ATTACHMENTS = 5;

// ─── Main component ──────────────────────────────────────────────────────────
// Styling here is kept in lockstep with ChatPage.jsx (its parent shell) —
// same light/dark theme tokens, same blue accent — so this looks like it
// belongs inside the "Messages" page it lives in, the same way
// ProjectMessagePanel was brought in line with ProjectDetailPage's teal theme.
const ChatWindow = ({
  messages,
  onSent,
  conversationId,
  currentUserId,
  conversationMembers,
  // Destinations for forwarding. Passed down rather than selected here so the
  // list stays owned by ChatPage, which already loads and filters it.
  conversations = [],
}) => {
  // Selection mode — entered from a message's Forward action, exited by
  // cancelling or sending. Holds message ids, not messages: the underlying list
  // can change under us (a page of older history loading, a live arrival), and
  // ids survive that where object references wouldn't.
  //
  // Shared with ProjectMessagePanel and the ProjectDetailPage chat tab, which
  // offer the same action against project threads — see the hook for the one
  // rule that is easy to get wrong (a message with no server id yet).
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const {
    selecting,
    selectedIds,
    isSelected,
    toggle: toggleSelected,
    start: startForward,
    exit: exitSelection,
    forwardOpen,
    openForward,
    closeForward,
  } = useMessageSelection();
  // Composer text is a per-thread DRAFT, not plain component state: switching
  // conversations mid-sentence and returning to an empty box feels careless.
  const { draft: input, setDraft: setInput, clearDraft } = useDraft({
    scope: messagingApi.SCOPES.CHAT,
    threadId: conversationId,
    userId: currentUserId,
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  // Transient strip above the composer for attach feedback ("only 2 of 7
  // attached", "zip the folder first"). An alert() here would interrupt
  // someone mid-compose for something advisory, and this is the same
  // information without stealing focus.
  const [attachNotice, setAttachNotice] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  // Inline message editing (7-minute window — see messagingApi.canEditMessage).
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // The edit window closes with the passage of time, not with any state
  // change, so nothing would otherwise re-render to retire the button — it
  // would sit there looking available until something unrelated happened to
  // repaint, and then fail on click. This ticks often enough that the
  // affordance disappears close to when it actually expires.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  // Only the setter is used: the mention picker records its selections here,
  // but resolveMentionedUserIds re-derives them from the message text at send
  // time, which also catches mentions typed without the picker.
  const [, setMentionedUsers] = useState([]);
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [searchSender, setSearchSender] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [copiedText, setCopiedText] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxAllMedia, setLightboxAllMedia] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDays, setSummaryDays] = useState(7);
  const [typingUsers, setTypingUsers] = useState([]);
  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Drag-and-drop onto the thread + paste from the clipboard. Same hook, same
  // rules, as the project panel — see hooks/useFileAttach.js.
  const { isDragging, addFiles, dropHandlers, onPaste } = useFileAttach({
    selectedFiles,
    setSelectedFiles,
    maxFiles: MAX_ATTACHMENTS,
    onError: setAttachNotice,
  });

  // Auto-dismiss the notice; it's advisory, not something to acknowledge.
  useEffect(() => {
    if (!attachNotice) return undefined;
    const t = setTimeout(() => setAttachNotice(null), 5000);
    return () => clearTimeout(t);
  }, [attachNotice]);

  // ── shared real-time connection (see WebSocketContext) ──
  const {
    isConnected: wsConnected,
    sendChatTyping,
    sendChatStopTyping,
  } = useWebSocketContext();

  // { [userId]: userName } for this thread, kept current by the socket layer.
  const typingMap = useSelector(selectTyping(messagingApi.SCOPES.CHAT, conversationId));

  // Unread on open — fixes where the divider sits.
  const unreadOnOpen = useSelector(selectUnread(messagingApi.SCOPES.CHAT, conversationId));

  const dispatch = useDispatch();

  // Older-history paging. The thread loads its newest page on open; this pulls
  // the next page back when the user scrolls near the top.
  const pagination = useSelector(selectPagination(messagingApi.SCOPES.CHAT, conversationId));
  const olderStatus = useSelector(selectOlderStatus(messagingApi.SCOPES.CHAT, conversationId));
  const hasOlder = Boolean(pagination?.hasMore);
  const loadingOlder = olderStatus === "loading";

  const loadOlder = React.useCallback(() => {
    if (!hasOlder || loadingOlder) return;
    dispatch(
      fetchOlderMessages({ scope: messagingApi.SCOPES.CHAT, threadId: conversationId })
    );
  }, [dispatch, conversationId, hasOlder, loadingOlder]);

  // Scroll anchoring, stick-to-bottom, jump-to-latest and the unread divider
  // position all live in one hook (S5). `atBottom` also gates the READ receipt:
  // scrolled up through history is not reading the latest message.
  const {
    containerRef,
    bottomRef,
    onScroll,
    atBottom,
    newSinceScroll,
    scrollToBottom,
    unreadDividerId,
  } = useMessageListMechanics({
    messages,
    threadId: conversationId,
    unreadCount: unreadOnOpen,
    currentUserId,
    hasOlder,
    onLoadOlder: loadOlder,
  });

  // Delivery acks + the read cursor (S1). Read additionally requires
  // document.hasFocus() — see the hook.
  useReceipts({
    scope: messagingApi.SCOPES.CHAT,
    threadId: conversationId,
    messages,
    currentUserId,
    atBottom,
  });

  // Members who are still with the company.
  //
  // The server now returns FORMER colleagues too (flagged `isActive: false`) so
  // that history keeps its authors — see the note in adapters/chatThread.js.
  // That means anything asking "who is in this conversation right now" has to
  // narrow the list itself, while anything asking "who wrote this" must not.
  const activeMembers = useMemo(
    () => (conversationMembers || []).filter((m) => m?.isActive !== false),
    [conversationMembers]
  );

  // Ids of everyone else in the thread — what the tick aggregate is computed
  // against.
  //
  // Active members only. A terminated account will never open the app again, so
  // counting it as a recipient means ✓✓ can never be reached: one departure and
  // every message in that group is permanently stuck on a single tick.
  const recipientIds = useMemo(
    () =>
      activeMembers
        .map((m) => String(m?._id ?? m))
        .filter((id) => id && id !== String(currentUserId)),
    [activeMembers, currentUserId]
  );

  // Message suggestions
  // Only `getSuggestions` (the composer typeahead) is consumed now — the
  // quick-replies strip that sat above the composer has been removed. The
  // hook's canned-phrase list is still used internally to seed typeahead
  // matches, so it stays.
  const { getSuggestions } = useMessageSuggestions(conversationId, messages);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  // ── typing indicator ──
  const resolveMyName = () => {
    // Resolve the current user's own display name. localStorage's "user"
    // record is set at login for every role and always reflects who's
    // actually typing; conversationMembers is kept only as a fallback (e.g.
    // if that record is ever missing).
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.name) return storedUser.name;
    } catch {
      // fall through to the members-list lookup below
    }
    const member = Array.isArray(conversationMembers)
      ? conversationMembers.find((m) => m._id === currentUserId)
      : null;
    return member?.name || "User";
  };

  const sendTypingIndicator = () => {
    if (!wsConnected || !conversationId) return;
    sendChatTyping(conversationId, resolveMyName());
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingIndicator();
    }, 3000);
  };

  const stopTypingIndicator = () => {
    if (!wsConnected || !conversationId) return;
    sendChatStopTyping(conversationId);
  };

  const handleSendMessage = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;

    stopTypingIndicator();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      // Files, a reply target, or mentions need the REST path (multipart /
      // structured body). A plain text message still goes over the socket,
      // which is the lower-latency route — both converge on the same server
      // service since Phase 1, so they behave identically.
      // Resolve rather than mapping _id directly: @everyone is a sentinel
      // option, not a person, so its placeholder id must never reach the
      // server — it would be stored as a mention of a user that doesn't
      // exist and would notify nobody. resolveMentionedUserIds expands it to
      // the real members (minus you) and passes named mentions through.
      // Active members only: `@everyone` expands against this, and notifying an
      // account that no longer exists produces a notification row and a push
      // attempt nobody will ever receive.
      const mentionIds = resolveMentionedUserIds(
        input.trim(),
        activeMembers,
        currentUserId
      );

      // One path for every send now. queueAndSend persists to the outbox,
      // renders the bubble immediately as `sending`, and attempts delivery —
      // so a message composed offline survives a reload and goes out on
      // reconnect instead of vanishing.
      await queueAndSend({
        scope: messagingApi.SCOPES.CHAT,
        threadId: conversationId,
        body: input.trim() || (selectedFiles.length ? "(File attachment)" : ""),
        files: selectedFiles,
        replyTo: replyingTo ? replyingTo._id || replyingTo.messageId : null,
        mentions: mentionIds,
        sender: { id: currentUserId, name: resolveMyName() },
      });

      // Cleared as soon as the bubble is on screen, not when the network agrees.
      clearDraft();
      setSelectedFiles([]);
      setReplyingTo(null);
      setMentionedUsers([]);
      onSent?.();
    } catch (error) {
      console.error("[ChatWindow] Error sending message:", error);
      alert(`Failed to send message: ${error?.response?.data?.error || error.message}`);
    }
  };

  const handleFileSelect = (e) => {
    addFiles(e.target.files);
    // Reset so picking the SAME file again still fires a change event —
    // without this, removing an attachment and re-selecting it silently does
    // nothing.
    e.target.value = "";
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReply = (msg) => {
    setReplyingTo(msg);
  };

  /* ── Editing ──────────────────────────────────────────────────────── */

  const startEdit = (msg) => {
    setEditingId(String(msg.messageId || msg._id || msg.id));
    setEditDraft(msg.message || msg.text || msg.body || "");
    // Replying and editing both commandeer a text box; being in one while the
    // other is open reads as two composers fighting over the same message.
    setReplyingTo(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (messageId) => {
    const text = editDraft.trim();

    // An empty edit is a delete, which is a separate feature with its own
    // rules. The server refuses it too; catching it here avoids a round trip
    // to be told so.
    if (!text) {
      alert("An edited message cannot be empty. Use cancel to leave it unchanged.");
      return;
    }

    setEditSaving(true);
    try {
      await messagingApi.editMessage(messagingApi.SCOPES.CHAT, messageId, text);
      // No local mutation: the server broadcasts `thread:updated`, which
      // patches the message in the store for every participant including this
      // one — the same path a reaction already takes.
      cancelEdit();
    } catch (error) {
      alert(
        error?.response?.data?.error ||
          "Could not edit the message. It may no longer be editable."
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      await messagingApi.react(messagingApi.SCOPES.CHAT, conversationId, messageId, emoji);
      // The server broadcasts `thread:updated`, which patches the message in
      // the store — no local mutation needed here.
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
      alert("Failed to add reaction. Please try again.");
    }
  };

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight the message briefly
      element.classList.add("bg-blue-100", "dark:bg-blue-500/20");
      setTimeout(() => {
        element.classList.remove("bg-blue-100", "dark:bg-blue-500/20");
      }, 2000);
    }
  };

  const clearFilters = () => {
    setMessageSearchTerm("");
    setSearchSender("");
    setDateFilter({ start: "", end: "" });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSummarize = async () => {
    if (!conversationId) return;

    setSummaryLoading(true);
    setShowSummaryModal(true);
    setSummary("");

    try {
      const text = await messagingApi.summarize(
        messagingApi.SCOPES.CHAT,
        conversationId,
        summaryDays
      );
      setSummary(text || "No summary available.");
    } catch (error) {
      console.error("Error generating summary:", error);
      setSummary("Failed to generate summary. Please try again.");
    } finally {
      setSummaryLoading(false);
    }
  };

  // Format text helpers
  const insertFormatting = (before, after = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);
    const beforeText = input.substring(0, start);
    const afterText = input.substring(end);

    const newText = beforeText + before + selectedText + after + afterText;
    setInput(newText);

    // Set cursor position after formatting
    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const formatBold = () => insertFormatting("**");
  const formatItalic = () => insertFormatting("*");
  const formatCode = () => insertFormatting("`");
  const formatStrikethrough = () => insertFormatting("~~");
  const formatHeading = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = input.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = input.substring(0, lineStart);
    const afterLine = input.substring(lineStart);
    setInput(beforeLine + "## " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 3, lineStart + 3);
    }, 0);
  };
  const formatBullet = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = input.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = input.substring(0, lineStart);
    const afterLine = input.substring(lineStart);
    setInput(beforeLine + "- " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 2, lineStart + 2);
    }, 0);
  };
  const formatNumbered = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = input.lastIndexOf("\n", start - 1) + 1;
    const beforeLine = input.substring(0, lineStart);
    const afterLine = input.substring(lineStart);
    setInput(beforeLine + "1. " + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 3, lineStart + 3);
    }, 0);
  };

  // Resolved against the FULL member list, including people who have since left
  // — that is the whole point of the server returning them. Compared as strings
  // because the normalized socket shape carries `sender.id` as a string while
  // REST history carries an ObjectId-backed `_id`.
  const getSenderName = (senderId) => {
    const member = Array.isArray(conversationMembers)
      ? conversationMembers.find((m) => String(m?._id) === String(senderId))
      : null;
    return member?.name || "Unknown";
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      default:
        return <FileIcon className="w-4 h-4" />;
    }
  };

  // att.url is the storage-relative signed path the message carries (e.g.
  // "/uploads/messages/...?e=...&s="), not an absolute URL — it needs the API
  // origin prepended, same as the image/video thumbnails below already do.
  const resolveAttachmentUrl = (url) =>
    url?.startsWith("http") ? url : `${import.meta.env.VITE_API_BASE || "http://localhost:5000"}${url || ""}`;

  // A plain `<a download>` to a cross-origin URL is unreliable — browsers
  // largely ignore the `download` attribute off-origin and just navigate to
  // the file instead, which is why this used to just "open" the attachment
  // rather than save it. Fetching the bytes first and downloading a
  // same-origin blob: URL makes the save happen every time — the file itself
  // was never the problem, only how the browser was asked to save it.
  const handleDownloadAttachment = async (att) => {
    const absoluteUrl = resolveAttachmentUrl(att?.url);
    try {
      const response = await fetch(absoluteUrl);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = att?.filename || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error("Attachment download failed:", error);
      alert("Failed to download attachment. Please try again.");
    }
  };

  // Normalize messages for consistent fields while preserving all original properties
  //
  // Messages arrive in two shapes: the RAW ChatMessage document (REST
  // history — `senderId` as a plain string, `message` as the text) and the
  // NORMALIZED socket/optimistic shape from services/messaging (`sender:
  // {id, name, kind}`, `body`) — see enqueueOptimistic in sendMessage.js and
  // the `thread:message` handler in WebSocketContext. `sender?._id` below
  // was looking for a key the normalized shape doesn't have (it's
  // `sender.id`, not `sender._id`), which stringified the whole sender
  // object into the literal text "[object Object]" and made every
  // live-arriving message resolve to no matching conversation member — i.e.
  // "Unknown". The "---" fallback was worse: handed to ReactMarkdown, three
  // dashes alone on a line render as a horizontal rule, so the bubble showed
  // no visible text at all. Both self-corrected on refresh because a refetch
  // only ever returns the raw shape. This mirrors the same
  // sender?.id-before-senderId-before-sentBy chain already used correctly in
  // threadsSlice.js / useMessageListMechanics.js / useReceipts.js.
  //
  // ─── `messageId` IS NULL UNTIL THE SERVER HAS SEEN THE MESSAGE ───
  // This used to fall back to `Math.random().toString(36).substring(2, 9)`.
  // An optimistic row has `id: null` (see enqueueOptimistic) and a failed send
  // never gets one, so both landed on a random 7-character string — and this
  // map runs on every render, so it was a DIFFERENT string each time. Two
  // things broke. React saw a new key each render and remounted the bubble,
  // silently dropping any selection on it. Worse, forwarding sent that string
  // to the server as a message id, where `find({ _id: { $in: [...] } })` threw
  // a CastError and came back as a 500.
  //
  // `null` is the honest value: this message does not have a server id yet.
  // `rowKey` below gives React something stable to key on, and `hasServerId`
  // is what gates the actions that need a real id.
  const normalizedMessages = messages.map((msg) => ({
    ...msg, // Preserve all original properties
    messageId: msg.messageId || msg._id || msg.id || null,
    rowKey: String(
      msg.messageId ||
        msg._id ||
        msg.id ||
        msg.clientMsgId ||
        msg.createdAt ||
        msg.timestamp ||
        ""
    ),
    hasServerId: Boolean(msg.messageId || msg._id || msg.id),
    senderId: String(
      msg.sender?.id ?? msg.senderId ?? msg.sentBy?._id ?? msg.sentBy ?? "unknown"
    ),
    message: msg.message ?? msg.text ?? msg.body ?? "",
    // Both spellings: the raw document says `deletedForEveryone`, the
    // normalized/socket shape says `deleted`, and REST history returns raw.
    // See the longer note in ProjectDetailPage.
    deleted: Boolean(msg.deleted ?? msg.deletedForEveryone),
    timestamp: msg.timestamp || msg.createdAt || Date.now(),
    attachments: msg.attachments || [],
    replyTo: msg.replyTo || null,
    reactions: msg.reactions || [], // Explicitly preserve reactions
  }));

  // Apply filters
  const filteredMessages = normalizedMessages.filter((msg) => {
    // Search by message content
    if (
      messageSearchTerm &&
      !msg.message.toLowerCase().includes(messageSearchTerm.toLowerCase())
    ) {
      return false;
    }

    // Filter by sender name
    if (searchSender) {
      const senderName = getSenderName(msg.senderId);
      if (!senderName.toLowerCase().includes(searchSender.toLowerCase())) {
        return false;
      }
    }

    // Filter by date range
    if (dateFilter.start || dateFilter.end) {
      const msgDate = new Date(msg.timestamp).toISOString().split("T")[0];
      if (dateFilter.start && msgDate < dateFilter.start) return false;
      if (dateFilter.end && msgDate > dateFilter.end) return false;
    }

    return true;
  });

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(null);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    if (showEmojiPicker !== null || showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, showSuggestions]);

  // Update suggestions when input changes
  useEffect(() => {
    if (input.trim().length >= 2) {
      const newSuggestions = getSuggestions(input, 8);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [input, getSuggestions]);

  // Typing indicator — listen for other members typing in this conversation.
  // Typing now comes from the store (fed by the `thread:typing` socket event)
  // rather than two window listeners. The previous version also leaked a
  // `setTimeout` per keystroke received — each one fired 3s later regardless of
  // whether the conversation had been switched or the component unmounted.
  // Expiry is handled once here instead.
  useEffect(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [conversationId]);

  useEffect(() => {
    const others = Object.entries(typingMap || {})
      .filter(([userId]) => String(userId) !== String(currentUserId))
      .map(([userId, userName]) => ({ userId, userName }));

    setTypingUsers(others);
    if (others.length === 0) return undefined;

    // A `thread:stop_typing` normally clears this; the timer is the backstop
    // for a sender who disconnects mid-keystroke.
    const t = setTimeout(() => setTypingUsers([]), 4000);
    return () => clearTimeout(t);
  }, [typingMap, currentUserId]);

  // Handle suggestion selection
  const acceptSuggestion = (suggestion) => {
    setInput(suggestion.text);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  return (
    // Drop and paste are bound at the panel root, not just the composer, so
    // dropping a file anywhere over the conversation works — aiming for the
    // small textarea is a needless precision task. `relative` anchors the
    // overlay. onPaste is safe this broad because the handler ignores any
    // clipboard payload that carries no files, so pasting text into the
    // search or composer behaves exactly as before.
    <div
      {...dropHandlers}
      onPaste={onPaste}
      className="relative flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100"
    >
      <DropOverlay active={isDragging} accent="blue" maxFiles={MAX_ATTACHMENTS} />
      {/* Presence. Self-hiding — renders null when the other party has
          presence turned off, or before the snapshot arrives, rather than
          claiming they are offline. */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-1 empty:hidden dark:border-white/10 dark:bg-[#10131c]">
        {/* Active members only — a terminated account is not "offline", it is
            not a participant, and listing it as either is misleading. */}
        <PresenceIndicator
          members={activeMembers}
          currentUserId={currentUserId}
          isGroup={activeMembers.length > 2}
        />
      </div>

      <ThreadFilterBar
        open={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        connected={wsConnected}
        onSummarize={handleSummarize}
        search={messageSearchTerm}
        onSearchChange={setMessageSearchTerm}
        sender={searchSender}
        onSenderChange={setSearchSender}
        dateRange={dateFilter}
        onDateRangeChange={setDateFilter}
        onClear={clearFilters}
        onSearchHistory={() => setSearchHistoryOpen(true)}
      />

      <DeleteMessageModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        scope={messagingApi.SCOPES.CHAT}
        message={deleteTarget}
        currentUserId={currentUserId}
        accent="blue"
      />

      <MessageSearchPanel
        open={searchHistoryOpen}
        onClose={() => setSearchHistoryOpen(false)}
        scope={messagingApi.SCOPES.CHAT}
        threadId={conversationId}
        // Only offered for hits in THIS thread — see the panel's note.
        onJump={(id) => {
          setSearchHistoryOpen(false);
          scrollToMessage(id);
        }}
        accent="blue"
      />

      {selecting && (
        <MessageSelectionBar
          count={selectedIds.length}
          onCancel={exitSelection}
          onForward={openForward}
          accent="blue"
        />
      )}

      <div
        ref={containerRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto p-3 sm:px-5 sm:py-4"
      >
        {/* Older-history affordance. Rendered INSIDE the scroll container and
            above the list, so the anchor in useMessageListMechanics measures it
            as part of the prepended content. Placing it outside would shift the
            view by its own height every time a page loads. */}
        {loadingOlder && (
          <p className="mb-2 text-center text-xs text-slate-400 dark:text-slate-500">
            Loading earlier messages…
          </p>
        )}
        {!loadingOlder && hasOlder && (
          <button
            type="button"
            onClick={loadOlder}
            className="mx-auto mb-2 block rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.04]"
          >
            Load earlier messages
          </button>
        )}
        {!hasOlder && pagination && filteredMessages.length > 0 && (
          <p className="mb-2 text-center text-[11px] text-slate-300 dark:text-slate-600">
            Beginning of this conversation
          </p>
        )}

        {filteredMessages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No messages found...
          </p>
        ) : (
          filteredMessages.map((msg, index) => {
            // Ensure currentUserId and senderId are compared as strings
            const isSelf = String(msg.senderId) === String(currentUserId);

            // Where the user left off. Position is frozen on open by
            // useMessageListMechanics, so it stays put while they read.
            const msgId = String(msg.id ?? msg._id ?? "");
            const showUnreadDivider = unreadDividerId && msgId === unreadDividerId;

            // Consecutive messages from one sender within 5 minutes collapse
            // into a single block — the difference between reading as a
            // conversation and reading as a log file.
            const isContinuation = !startsGroup(msg, filteredMessages[index - 1]);

            // Someone addressed you here (by name or via @everyone). Worth
            // marking the whole bubble, not just the name: the point is to be
            // findable when scrolling back through a busy group, which a chip
            // buried mid-paragraph isn't. Never applies to your own messages —
            // you can't summon yourself.
            const mentionsMe =
              !isSelf &&
              messageMentionsUser(
                msg.message || msg.text || "",
                conversationMembers,
                currentUserId
              );

            const prevMsg = filteredMessages[index - 1];
            const showDateDivider =
              !prevMsg ||
              new Date(msg.timestamp).toDateString() !==
                new Date(prevMsg.timestamp).toDateString();

            return (
              <React.Fragment key={msg.rowKey}>
                {showDateDivider && <MessageDateSeparator date={msg.timestamp} />}
                {showUnreadDivider && <UnreadDivider count={unreadOnOpen} />}
                <div
                  id={`message-${msg.messageId || msg.rowKey}`}
                  // A message the server has never seen cannot be forwarded —
                  // there is no id to forward BY — so it is not selectable
                  // either, rather than being tickable and then failing.
                  onClick={
                    selecting && msg.hasServerId
                      ? () => toggleSelected(msg.messageId)
                      : undefined
                  }
                  className={`flex w-full transition-colors duration-500 ${
                    isSelf ? "justify-end" : "justify-start"
                  } ${isContinuation ? "mb-0.5" : "mb-3"} ${
                    selecting
                      ? msg.hasServerId
                        ? "cursor-pointer rounded-lg px-1"
                        : "cursor-not-allowed rounded-lg px-1 opacity-50"
                      : ""
                  } ${
                    selecting && isSelected(msg.messageId)
                      ? "bg-blue-50 dark:bg-blue-400/10"
                      : ""
                  }`}
                >
                  <div className="flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]">
                    {/* Sender name only on the first message of a block. */}
                    {!isSelf && !isContinuation && (
                      <p className="mb-1 px-1 text-xs text-slate-500 dark:text-gray-400">
                        {getSenderName(msg.senderId)}
                      </p>
                    )}
                    <div
                      // `group` is what makes the per-message actions appear. The
                        // action row below is `sm:opacity-0
                        // sm:group-hover:opacity-100`, but nothing above it
                        // carried the `group` class — the only one in this file
                        // sat on an image-attachment wrapper, a sibling branch.
                        // So on desktop the hover rule never fired and Reply,
                        // Copy and Forward were all permanently invisible. They
                        // appeared on mobile only because the base state there
                        // is opacity-100.
                        className={`group w-fit max-w-full rounded-xl border p-3 shadow-sm transition-colors duration-200 ${isSelf ? "self-end" : "self-start"} ${
                        isSelf
                          ? "border-blue-600/20 bg-blue-600 text-white dark:border-blue-400/15"
                          : mentionsMe
                          ? "border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/70 text-slate-900 dark:border-amber-400/25 dark:border-l-amber-400 dark:bg-amber-400/[0.07] dark:text-white"
                          : "border-slate-200 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-[#1a2433] dark:text-white"
                      }`}
                    >
                      {/* Reply Preview */}
                      {msg.replyTo && (
                        <div
                          onClick={() => scrollToMessage(msg.replyTo?._id || msg.replyTo?.messageId)}
                          className="mb-2 cursor-pointer overflow-hidden rounded border-l-2 border-blue-400 bg-black/10 px-2 py-1 text-xs transition hover:bg-black/15 dark:bg-black/20 dark:hover:bg-black/30"
                          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                        >
                          <p className={`truncate font-semibold ${isSelf ? "text-blue-50" : "text-slate-700 dark:text-blue-300"}`}>
                            {msg.replyTo?.senderId?.name ||
                             getSenderName(msg.replyTo?.senderId) ||
                             "Unknown"}
                          </p>
                          <p className={`overflow-hidden italic ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-400"}`} style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere'
                          }}>
                            {msg.replyTo?.message || "..."}
                          </p>
                        </div>
                      )}

                      {/* Relayed from elsewhere. Deliberately does not name the
                        source conversation — the recipient may have no access
                        to it, so naming it would leak that group's existence. */}
                    {msg.forwarded && (
                      <p className={`mb-1 inline-flex items-center gap-1 text-[11px] italic ${isSelf ? "text-blue-50/70" : "text-slate-400 dark:text-slate-500"}`}>
                        <Forward className="h-3 w-3" />
                        Forwarded
                      </p>
                    )}

                    {/* Inline editor — replaces the rendered body in place, so
                        the message stays where it is in the thread and keeps
                        its surrounding context while being corrected. */}
                    {editingId === String(msg.messageId) ? (
                      <div className="space-y-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          autoFocus
                          rows={Math.min(6, (editDraft.match(/\n/g) || []).length + 1)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                            // Enter saves, Shift+Enter adds a line — matching
                            // the composer, so the muscle memory carries over.
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit(msg.messageId);
                            }
                          }}
                          /* No colour classes: index.css forces
                             background, border and text colour on every
                             input/textarea inside .messages-theme with
                             !important, so anything set here is dead code.
                             The forced pair is legible in both themes (white
                             box + dark text in light, dark box + light text
                             in dark), it just won't be translucent over the
                             bubble. */
                          className="w-full resize-none rounded-lg border px-2 py-1.5 text-sm outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={editSaving}
                            onClick={() => saveEdit(msg.messageId)}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                              isSelf
                                ? "bg-white text-blue-700 hover:bg-blue-50"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            {editSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={editSaving}
                            onClick={cancelEdit}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                              isSelf
                                ? "text-blue-50/80 hover:bg-white/10 hover:text-white"
                                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                            }`}
                          >
                            Cancel
                          </button>
                          <span className={`text-[10px] ${isSelf ? "text-blue-50/60" : "text-slate-400 dark:text-slate-500"}`}>
                            Enter to save · Esc to cancel
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Message with Markdown rendering.

                        NOTE: no text colour on the wrapper below — it INHERITS
                        from the bubble. Restating `text-white` there is what
                        made own-messages render near-black in light mode:
                        index.css has a blanket `html.light [class~="text-white"]`
                        remap that turns stray white text dark, exempting only
                        elements that carry their own `bg-*` class. The bubble
                        carries `bg-blue-600` so it is exempt; this inner div
                        was not, and got remapped while sitting on blue.
                        Inheriting keeps one source of truth for the bubble's
                        foreground colour and removes the trigger entirely. */}
                      {msg.deleted ? (
                      <DeletedMessageBubble own={isSelf} />
                    ) : editingId !== String(msg.messageId) && (msg.message || msg.text) ? (
                        <div className="prose prose-sm max-w-none break-words text-sm leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}

                            components={{
                              // Custom styling for markdown elements
                              p: ({ children }) => (
                                <p className="mb-1 last:mb-0 whitespace-pre-wrap">
                                  <MentionText
                                    members={conversationMembers}
                                    currentUserId={currentUserId}
                                    isSelf={isSelf}
                                  >
                                    {children}
                                  </MentionText>
                                </p>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-lg font-bold mb-1">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-base font-bold mb-1">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-bold mb-1">
                                  {children}
                                </h3>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside mb-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside mb-1">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="ml-2">
                                  <MentionText
                                    members={conversationMembers}
                                    currentUserId={currentUserId}
                                    isSelf={isSelf}
                                  >
                                    {children}
                                  </MentionText>
                                </li>
                              ),
                              code: ({ inline, children }) =>
                                inline ? (
                                  <code className="rounded bg-black/10 px-1 text-xs dark:bg-black/30">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block overflow-x-auto rounded bg-black/10 p-2 text-xs dark:bg-black/30">
                                    {children}
                                  </code>
                                ),
                              strong: ({ children }) => (
                                <strong className="font-bold">{children}</strong>
                              ),
                              em: ({ children }) => (
                                <em className="italic">{children}</em>
                              ),
                              a: ({ href, children }) => (
                                // See the note above the component: own-message
                                // links use text-white, never text-blue-*.
                                <a
                                  href={href || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`underline decoration-1 underline-offset-2 ${
                                    isSelf
                                      ? "text-white decoration-white/60 hover:decoration-white"
                                      : "text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                                  }`}
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {msg.message || msg.text || ''}
                          </ReactMarkdown>
                        </div>
                      ) : null}

                      {/* Attachments */}
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.attachments.map((att, attIdx) => {
                            if (!att) return null;
                            const isMedia = att?.fileType === "image" || att?.fileType === "video";
                            const mediaAttachments = Array.isArray(msg.attachments) ? msg.attachments.filter(a => a?.fileType === "image" || a?.fileType === "video") : [];

                            return (
                              <div key={att?._id || attIdx}>
                                {!isMedia && att?.url && (
                                  <div className="flex items-center gap-2 rounded border border-[#1e2a35]/0 bg-black/10 p-2 dark:bg-black/20">
                                    {getFileIcon(att?.fileType)}
                                    <div className="min-w-0 flex-1">
                                      {/* Inherits the bubble's colour — see the
                                          note on the markdown wrapper above for
                                          why an explicit `text-white` here goes
                                          dark in light mode. */}
                                      <div className="truncate text-xs">
                                        {att?.filename || 'Unknown file'}
                                      </div>
                                      <div className={`text-xs ${isSelf ? "text-blue-50/75" : "text-slate-500 dark:text-gray-400"}`}>
                                        {att?.size ? `${(att.size / 1024).toFixed(1)} KB` : 'N/A'}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadAttachment(att)}
                                      className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                                      title="Download"
                                    >
                                      <Download className={`h-4 w-4 ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-300"}`} />
                                    </button>
                                  </div>
                                )}

                                {att?.fileType === "image" && att?.url && (
                                  <div className="relative group">
                                    <img
                                      src={att.url?.startsWith('http') ? att.url : `${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}${att.url || ''}`}
                                      alt={att?.filename || 'Image'}
                                      className="h-48 w-48 cursor-pointer rounded object-cover transition-opacity hover:opacity-90"
                                      onClick={() => {
                                        setLightboxAllMedia(mediaAttachments);
                                        setLightboxIndex(mediaAttachments.findIndex(a => a?._id === att._id));
                                        setLightboxMedia(att);
                                      }}
                                    />
                                  </div>
                                )}

                                {att?.fileType === "video" && att?.url && (
                                  <div className="relative">
                                    <video
                                      src={att.url?.startsWith('http') ? att.url : `${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}${att.url || ''}`}
                                      className="h-48 w-48 cursor-pointer rounded object-cover"
                                      onClick={() => {
                                        setLightboxAllMedia(mediaAttachments);
                                        setLightboxIndex(mediaAttachments.findIndex(a => a?._id === att._id));
                                        setLightboxMedia(att);
                                      }}
                                    />
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                      <div className="rounded-full bg-black/50 p-3">
                                        <Video className="h-6 w-6 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Reactions Display */}
                      {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.reactions.map((reaction, idx) => {
                            if (!reaction) return null;
                            const userReacted = Array.isArray(reaction?.users) && reaction.users.includes(String(currentUserId));
                            return (
                              <button
                                key={idx}
                                onClick={() => handleReaction(msg.messageId, reaction?.emoji)}
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all ${
                                  userReacted
                                    ? "border border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/30 dark:text-white"
                                    : "bg-black/10 hover:bg-black/15 dark:bg-black/20 dark:hover:bg-black/30"
                                }`}
                                title={userReacted ? "Remove reaction" : "Add reaction"}
                              >
                                <span>{reaction?.emoji || ''}</span>
                                <span className={`text-[10px] ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-300"}`}>
                                  {Array.isArray(reaction?.users) ? reaction.users.length : 0}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className={`text-[10px] ${isSelf ? "text-blue-50/80" : "text-slate-500 dark:text-gray-400"}`}>
                          {msg?.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          }) : ''}
                          {/* Recipients are told the words changed after they
                              may have read them. The previous text is not kept
                              — see the note on ChatMessage.editedAt — so this
                              marker is the whole disclosure, and leaving it off
                              would make edits silent. */}
                          {msg.editedAt && (
                            <span
                              className="ml-1.5 italic"
                              title={`Edited ${new Date(msg.editedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                            >
                              (edited)
                            </span>
                          )}
                          {/* Ticks, sender-side only — showing them on someone
                              else's message would be meaningless. */}
                          {isSelf && (
                            <span className="ml-1.5 inline-flex align-middle">
                              <MessageStatus status={deriveStatus(msg, recipientIds)} />
                            </span>
                          )}
                        </span>
                        {/* Hidden while selecting: in selection mode the whole bubble is
                            a checkbox, and a Reply or Copy click landing inside it would
                            bubble up and tick the message instead of doing what it says. */}
                        <div className={`relative flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 ${selecting ? "hidden" : ""}`}>
                          <button
                            onClick={() => handleReply(msg)}
                            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            title="Reply to message"
                          >
                            <ReplyIcon className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                          </button>
                        {/* Same rule as selection above: nothing to forward
                            by until the send has landed. */}
                        <button
                          onClick={() => startForward(msg.messageId)}
                          disabled={!msg.hasServerId}
                          className="rounded p-1 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10"
                          title={
                            msg.hasServerId
                              ? "Forward message"
                              : "Still sending — cannot forward yet"
                          }
                        >
                          <Forward className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                        </button>
                        {/* Offered on anyone's message: "delete for me" always
                            applies. The dialog decides whether "for everyone"
                            is available. */}
                        {!msg.deleted && msg.hasServerId && (
                          <button
                            onClick={() => setDeleteTarget(msg)}
                            className="rounded p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
                            title="Delete message"
                          >
                            <Trash2 className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400"}`} />
                          </button>
                        )}
                        {/* Your own message, still inside the 7-minute window.
                            The check is presentation only — the server
                            re-verifies both rules on the request, because a
                            client cannot be trusted to have hidden a button.
                            The `now` state ticks so this retires on time
                            rather than lingering until an unrelated repaint. */}
                        {messagingApi.canEditMessage(msg, currentUserId) && (
                          <button
                            onClick={() => startEdit(msg)}
                            className="rounded p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
                            title="Edit message (7 minutes)"
                          >
                            <Pencil className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                          </button>
                        )}
                          <button
                            onClick={() => copyToClipboard(msg.message || msg.text || '')}
                            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            title="Copy message"
                          >
                            {copiedText === (msg.message || msg.text) ? (
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <Copy className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"}`} />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setShowEmojiPicker(
                                showEmojiPicker === msg.messageId ? null : msg.messageId
                              )
                            }
                            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            title="Add reaction"
                          >
                            <Smile className={`h-3.5 w-3.5 ${isSelf ? "text-blue-50/80 hover:text-white" : "text-slate-400 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400"}`} />
                          </button>

                          {/* Emoji Picker Popup */}
                          {showEmojiPicker === msg.messageId && (
                            <div
                              ref={emojiPickerRef}
                              className={`absolute ${isSelf ? 'right-0' : 'left-0'} bottom-full z-50 mb-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 dark:border-[#232945] dark:bg-[#1a2332]`}
                            >
                              {commonEmojis.map((emoji, emojiIdx) => (
                                <button
                                  key={emojiIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(msg.messageId, emoji);
                                  }}
                                  className="rounded p-1.5 text-lg transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-white/10"
                                  title={`React with ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Jump-to-latest. Only once scrolled away, so it never covers the
          composer during normal use. */}
      {!atBottom && (
        <NewMessagesButton count={newSinceScroll} onClick={() => scrollToBottom()} />
      )}

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="flex items-start justify-between gap-2 overflow-hidden border-t border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-400/20 dark:bg-blue-500/10">
          <div className="min-w-0 flex-1 overflow-hidden text-sm text-slate-700 dark:text-gray-300">
            <div className="mb-1 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <ReplyIcon className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium truncate">Replying to {getSenderName(replyingTo?.senderId)}</span>
            </div>
            <div className="overflow-hidden text-xs text-slate-500 dark:text-gray-400" style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}>
              {replyingTo?.message || ''}
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="flex-shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* Attach feedback — capacity overflow, dropped folder, etc. */}
      {attachNotice && (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          <span className="flex-1">{attachNotice}</span>
          <button
            type="button"
            onClick={() => setAttachNotice(null)}
            className="shrink-0 rounded p-0.5 transition hover:bg-amber-100 dark:hover:bg-amber-400/20"
            aria-label="Dismiss"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* File Preview */}
      {selectedFiles.length > 0 && (
        <div className="border-t border-slate-200 bg-white px-4 py-2 dark:border-white/10 dark:bg-[#10131c]">
          <p className="mb-2 text-xs text-slate-500 dark:text-gray-400">
            Selected files ({selectedFiles.length}/{MAX_ATTACHMENTS}):
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <FileIcon className="h-4 w-4 text-slate-500 dark:text-gray-300" />
                <span className="max-w-[150px] truncate text-xs text-slate-700 dark:text-gray-300">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <XCircle className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formatting Toolbar */}
      {showFormatting && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#0d1017]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={formatBold}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={formatItalic}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs italic text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={formatStrikethrough}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs line-through text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Strikethrough (Ctrl+U)"
            >
              S
            </button>
            <button
              type="button"
              onClick={formatCode}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Code (Ctrl+E)"
            >
              &lt;/&gt;
            </button>
            <button
              type="button"
              onClick={formatHeading}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Heading (Ctrl+D)"
            >
              H1
            </button>
            <button
              type="button"
              onClick={formatBullet}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Bullet List (Ctrl+L)"
            >
              • List
            </button>
            <button
              type="button"
              onClick={formatNumbered}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#232945] dark:text-white dark:hover:bg-[#2a3142]"
              title="Numbered List (Ctrl+Shift+L)"
            >
              1. List
            </button>
          </div>
        </div>
      )}

      {/* (The canned "Quick Replies" strip used to sit here, above the
          composer. Removed — the composer typeahead already surfaces the same
          phrases when they're relevant to what you're typing, so this was a
          second, unprompted copy of them taking a permanent slice of the
          thread on every screen.) */}

      <FailedMessageBar scope={messagingApi.SCOPES.CHAT} threadId={conversationId} />

      {/* Input Area
          `safe-bottom` keeps the composer clear of the iPhone home indicator —
          `viewport-fit=cover` lets us paint into that strip, and anything
          interactive left underneath it is unpressable because the system
          gesture takes the touch first. */}
      <div
        style={{ "--safe-pad-b": "0.5rem" }}
        className="safe-bottom relative border-t border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-[#10131c] sm:px-3"
      >
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-[#232945] dark:bg-gray-900"
          >
            <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-white p-2 dark:border-[#232945] dark:bg-gray-900">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-500 dark:text-gray-400">
                Suggestions ({suggestions.length}) · <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">↑↓</kbd> to navigate · <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">Tab</kbd> or <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-gray-700">Enter</kbd> to select
              </span>
            </div>
            {suggestions.map((suggestion, idx) => (
              // Light-mode remaps in index.css match class substrings and cannot see the
              // dark:/hover: prefix, so a bg-white/... or bg-gray-800 spelling here gets
              // repainted in light mode even though it is a dark-mode-only colour. The
              // rgb()/rgba() arbitrary value is the same colour the rule cannot match.
              // Do not "tidy" it back to bg-white/5 or bg-gray-800.
              <button
                key={idx}
                onClick={() => acceptSuggestion(suggestion)}
                className={`w-full border-l-2 px-4 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-[rgb(31,41,55)] ${
                  idx === selectedSuggestionIndex
                    ? "border-blue-500 bg-blue-50 dark:bg-[rgb(31,41,55)]"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-1">
                    {suggestion.type === "history" && (
                      <Clock className="w-3 h-3 text-gray-400" />
                    )}
                    {suggestion.type === "quick" && (
                      <Zap className="w-3 h-3 text-yellow-400" />
                    )}
                    {suggestion.type === "task" && (
                      <Check className="w-3 h-3 text-green-400" />
                    )}
                    {suggestion.type === "project" && (
                      <FileIcon className="w-3 h-3 text-blue-400" />
                    )}
                    {suggestion.type === "frequent" && (
                      <Sparkles className="w-3 h-3 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-slate-800 dark:text-gray-200">
                      {suggestion.text}
                    </p>
                    <p className="text-xs capitalize text-slate-500 dark:text-gray-500">
                      {suggestion.type === "history" && "From your history"}
                      {suggestion.type === "quick" && "Quick reply"}
                      {suggestion.type === "task" && "Task suggestion"}
                      {suggestion.type === "project" && "Project suggestion"}
                      {suggestion.type === "frequent" && "Frequently used"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* No `accept` filter — the server takes any file type now (see
              config/s3Config.js), so restricting the OS picker here would just
              hide files a user is otherwise allowed to send. */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />

          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowComposerTools((v) => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                showComposerTools
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 dark:hover:bg-white/[0.065] dark:hover:text-white"
              }`}
              aria-label="Add attachment or formatting"
            >
              <Plus className={`h-4 w-4 transition-transform ${showComposerTools ? "rotate-45" : ""}`} />
            </button>

            {showComposerTools && (
              <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-[#131c24] dark:shadow-black/40">
                <button
                  type="button"
                  onClick={() => { fileInputRef.current?.click(); setShowComposerTools(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Paperclip className="h-4 w-4 text-sky-400" />
                  Attach files
                </button>
                <button
                  type="button"
                  onClick={() => { setShowFormatting((v) => !v); setShowComposerTools(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Type className="h-4 w-4 text-blue-400" />
                  Formatting
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1" onFocus={() => {
            // Scroll to bottom when focused
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }}>
            <MentionInput
              ref={textareaRef}
              value={input}
              onChange={(newValue, mentions) => {
                setInput(newValue);
                setMentionedUsers(mentions);
                if (newValue.length > 0) sendTypingIndicator();
                else stopTypingIndicator();
                // Auto-scroll to bottom when typing
                chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              // The picker offers people you can still reach. Rendering
              // existing mentions is a separate concern and uses the full list.
              users={activeMembers}
              currentUserId={currentUserId}
              placeholder="Write a message... (@ to mention someone)"
              rows={1}
              className="min-h-[2.75rem] max-h-[200px] w-full rounded-xl border-slate-200 bg-white py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400/50 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#101820] dark:text-white dark:placeholder-slate-500"
              onKeyDown={(e) => {
                // Handle suggestion navigation
                if (showSuggestions && suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedSuggestionIndex(prev =>
                      prev < suggestions.length - 1 ? prev + 1 : 0
                    );
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedSuggestionIndex(prev =>
                      prev > 0 ? prev - 1 : suggestions.length - 1
                    );
                    return;
                  }
                  if (e.key === "Tab") {
                    e.preventDefault();
                    acceptSuggestion(suggestions[selectedSuggestionIndex]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setShowSuggestions(false);
                    return;
                  }
                }

                // Send message on Enter (without Shift)
                if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  // Accept suggestion if visible
                  if (showSuggestions && suggestions.length > 0) {
                    acceptSuggestion(suggestions[selectedSuggestionIndex]);
                  } else {
                    handleSendMessage();
                  }
                  return;
                }

                // Keyboard shortcuts (Ctrl/Cmd + key)
                const isMac = /Mac|iPad|iPhone|iPod/.test(navigator.platform);
                const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

                // Check if we should handle this shortcut
                if (isCtrlOrCmd) {
                  const key = e.key.toLowerCase();
                  let handled = false;

                  // Check for Ctrl+Shift combinations
                  if (e.shiftKey) {
                    if (key === 'l') {
                      e.preventDefault();
                      e.stopPropagation();
                      formatNumbered();
                      handled = true;
                    }
                  } else {
                    // Regular Ctrl shortcuts
                    switch (key) {
                      case 'b':
                        e.preventDefault();
                        e.stopPropagation();
                        formatBold();
                        handled = true;
                        break;
                      case 'i':
                        e.preventDefault();
                        e.stopPropagation();
                        formatItalic();
                        handled = true;
                        break;
                      case 'u':
                        e.preventDefault();
                        e.stopPropagation();
                        formatStrikethrough();
                        handled = true;
                        break;
                      case 'e':
                      case 'k':
                        e.preventDefault();
                        e.stopPropagation();
                        formatCode();
                        handled = true;
                        break;
                      case 'd':
                        e.preventDefault();
                        e.stopPropagation();
                        formatHeading();
                        handled = true;
                        break;
                      case 'l':
                        e.preventDefault();
                        e.stopPropagation();
                        formatBullet();
                        handled = true;
                        break;
                    }
                  }

                  if (handled) {
                    return false;
                  }
                }
              }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() && selectedFiles.length === 0}
            className="flex h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
          >
            <Send className="h-4 w-4" />
            <span className="hidden text-sm sm:inline">Send</span>
          </button>
        </div>
      </div>

      {/* Media Lightbox */}
      {lightboxMedia && (
        <MediaLightbox
          media={lightboxMedia}
          allMedia={lightboxAllMedia}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxMedia(null)}
          onNavigate={(newIndex) => {
            setLightboxIndex(newIndex);
            setLightboxMedia(lightboxAllMedia[newIndex]);
          }}
        />
      )}

      <ForwardMessagesModal
        open={forwardOpen}
        onClose={closeForward}
        sourceScope={messagingApi.SCOPES.CHAT}
        sourceThreadId={conversationId}
        messageIds={selectedIds}
        // ChatPage already loads this list for its sidebar, so it is handed
        // down rather than refetched. The project surfaces pass nothing and
        // the picker loads its own.
        conversations={conversations}
        onDone={exitSelection}
      />

      <ThreadSummaryModal
        open={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        days={summaryDays}
        onDaysChange={setSummaryDays}
        loading={summaryLoading}
        summary={summary}
        onRegenerate={handleSummarize}
        onCopy={copyToClipboard}
        copied={copiedText === summary}
      />

    </div>
  );
};

export default ChatWindow;
