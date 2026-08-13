import React, { useEffect, useMemo, useState } from "react";
import { X, Search, Users, Shield } from "lucide-react";

/**
 * Read-only "who is in this group", for everyone.
 *
 * ─── WHY THIS EXISTS SEPARATELY FROM ManageGroupModal ───
 * ManageGroupModal is gated on admin/super-admin, because it renames the
 * group and adds/removes people. That left everyone else with only the
 * truncated "Members: Sahil Kureshi, Puja Shaw, Gopal Kashyap, Ani…" strip in
 * the header — no way to find out who the group actually contains, which is
 * information every participant legitimately has. Seeing the roster and
 * editing it are different privileges; this is the former.
 *
 * ─── NO FETCH ───
 * Members arrive fully populated on the conversation (name, role, isActive)
 * from `listThreads`, so this renders from data already in the page. Adding a
 * request here would be a spinner over information the client is holding.
 *
 * @param {object}   conversation  with `members`, `name`, `createdBy`
 * @param {string}   currentUserId
 */
const GroupMembersModal = ({ isOpen, onClose, conversation, currentUserId }) => {
  const [query, setQuery] = useState("");

  const { active, former } = useMemo(() => {
    const all = conversation?.members || [];
    return {
      active: all.filter((m) => m?.isActive !== false),
      // People who left the company are still returned by the server so their
      // old messages keep their author. They belong here too — but listed
      // apart, because reading them as current members is precisely the wrong
      // conclusion.
      former: all.filter((m) => m?.isActive === false),
    };
  }, [conversation]);

  // Escape closes, and the search resets on open — reopening to a filter left
  // over from last time looks like a group that has lost most of its members.
  // Runs before the early return below, since hooks cannot be conditional.
  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery("");
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const filter = (list) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => (m.name || "").toLowerCase().includes(q));
  };

  if (!isOpen || !conversation) return null;

  const initials = (name) =>
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  const renderRow = (member, { muted = false } = {}) => {
    const isYou = String(member._id) === String(currentUserId);
    const isCreator =
      conversation.createdBy &&
      String(member._id) === String(conversation.createdBy);

    return (
      <li
        key={member._id}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            muted
              ? "bg-slate-100 text-slate-400 dark:bg-white/[0.05] dark:text-slate-500"
              : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
          }`}
        >
          {initials(member.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`truncate text-sm font-medium ${
                muted
                  ? "text-slate-400 dark:text-slate-500"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {member.name || member._id}
            </span>
            {isYou && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">
                You
              </span>
            )}
          </div>
          {(member.role || isCreator) && (
            <p className="flex items-center gap-1 truncate text-xs capitalize text-slate-500 dark:text-slate-400">
              {isCreator && (
                <>
                  <Shield className="h-3 w-3 shrink-0 text-blue-500 dark:text-blue-400" />
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Group admin
                  </span>
                  {member.role && <span aria-hidden="true">·</span>}
                </>
              )}
              {member.role}
            </p>
          )}
        </div>
      </li>
    );
  };

  const shownActive = filter(active);
  const shownFormer = filter(former);
  const nothingMatched = query && !shownActive.length && !shownFormer.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#131c24]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-slate-950 dark:text-white">
                {conversation.name || "Group"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {active.length} member{active.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search — only once the list is long enough for scanning to be work. */}
        {active.length + former.length > 8 && (
          <div className="border-b border-slate-200 p-3 dark:border-white/10">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#101820] dark:text-white dark:placeholder-slate-500"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {nothingMatched ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No members match “{query}”.
            </p>
          ) : (
            <>
              <ul className="list-none space-y-0.5 p-0">
                {shownActive.map((m) => renderRow(m))}
              </ul>

              {shownFormer.length > 0 && (
                <>
                  <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    No longer with the company
                  </p>
                  <ul className="list-none space-y-0.5 p-0">
                    {shownFormer.map((m) => renderRow(m, { muted: true }))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupMembersModal;
