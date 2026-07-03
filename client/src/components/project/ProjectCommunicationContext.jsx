import React, { useMemo } from "react";
import {
  Calendar,
  ChevronRight,
  FileText,
  FolderOpen,
  ListTodo,
  Pin,
  Users,
  X,
} from "lucide-react";

const getInitials = (value = "") => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
};

const formatDate = (value) => {
  if (!value) return "No deadline set";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function ProjectCommunicationContext({
  project,
  tasks,
  messages,
  userRole,
  onClose,
  onOpenPinned,
  onOpenTasks,
}) {
  const isClient = userRole === "client";

  const participants = useMemo(() => {
    const clientParticipants = (project?.clients || []).map((client) => ({
      id: client._id,
      name: client.clientName || client.businessName || "Client",
      role: "Client",
      color: "bg-sky-500/20 text-sky-300 border-sky-400/20",
    }));

    const teamParticipants = (project?.assignedTo || []).map((member) => ({
      id: member._id,
      name: isClient
        ? member.employeeId || member.designation || "Team member"
        : member.name || member.employeeId || "Team member",
      role: member.designation || "Project team",
      color: "bg-teal-500/20 text-teal-200 border-teal-400/20",
    }));

    return [...clientParticipants, ...teamParticipants];
  }, [isClient, project]);

  const pinnedMessage = useMemo(
    () => messages.find((message) => message.isPinned),
    [messages]
  );

  const openTasks = useMemo(
    () => tasks.filter((task) => !["completed", "rejected"].includes(task.status)),
    [tasks]
  );

  const nextTask = useMemo(() => {
    const datedTasks = openTasks
      .filter((task) => task.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return datedTasks[0];
  }, [openTasks]);

  const nextDeadline = nextTask?.dueDate || project?.endDate;

  const sharedFiles = useMemo(() => {
    const seen = new Set();
    return messages
      .flatMap((message) => message.attachments || [])
      .filter((attachment) => {
        const key = attachment._id || attachment.url || attachment.filename;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(-4)
      .reverse();
  }, [messages]);

  return (
    <aside className="absolute inset-y-0 right-0 z-40 flex w-[min(22rem,92vw)] flex-col border-l border-white/10 bg-[#0d151c] shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Project details</h2>
          <p className="mt-0.5 text-xs text-slate-500">Conversation context</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Close project details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section className="border-b border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <Users className="h-4 w-4 text-teal-400" />
            Participants
            <span className="ml-auto text-xs font-normal text-slate-500">
              {participants.length}
            </span>
          </div>
          <div className="flex -space-x-2">
            {participants.slice(0, 6).map((participant) => (
              <div
                key={participant.id || `${participant.name}-${participant.role}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-semibold ring-2 ring-[#0d151c] ${participant.color}`}
                title={`${participant.name} - ${participant.role}`}
              >
                {getInitials(participant.name)}
              </div>
            ))}
            {participants.length > 6 && (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-[11px] font-semibold text-slate-300 ring-2 ring-[#0d151c]">
                +{participants.length - 6}
              </div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {participants.slice(0, 3).map((participant) => (
              <div key={`${participant.id}-label`} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-300">{participant.name}</span>
                <span className="truncate text-slate-500">{participant.role}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <Pin className="h-4 w-4 text-amber-400" />
            Pinned decision
          </div>
          <button
            type="button"
            onClick={onOpenPinned}
            className="group w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-teal-400/25 hover:bg-white/[0.055]"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 text-xs leading-5 text-slate-300">
                  {pinnedMessage?.message || "No project decision has been pinned yet."}
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {pinnedMessage ? "Open pinned messages" : "Pin a message to keep it visible here"}
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 text-slate-600 transition group-hover:text-teal-400" />
            </div>
          </button>
        </section>

        <section className="border-b border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <Calendar className="h-4 w-4 text-teal-400" />
            Next deadline
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-sm font-medium text-slate-200">
              {nextTask?.title || project?.projectName}
            </p>
            <p className="mt-1 text-xs text-slate-500">{formatDate(nextDeadline)}</p>
          </div>
        </section>

        <section className="border-b border-white/10 p-4">
          <button
            type="button"
            onClick={onOpenTasks}
            className="mb-3 flex w-full items-center gap-2 text-left text-sm font-medium text-white"
          >
            <ListTodo className="h-4 w-4 text-teal-400" />
            Open tasks
            <span className="ml-auto rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-300">
              {openTasks.length}
            </span>
          </button>
          <div className="space-y-2">
            {openTasks.slice(0, 4).map((task) => (
              <button
                key={task._id}
                type="button"
                onClick={onOpenTasks}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                  {task.title}
                </span>
                <span className="text-[11px] capitalize text-slate-600">{task.status}</span>
              </button>
            ))}
            {openTasks.length === 0 && (
              <p className="px-2 py-1 text-xs text-slate-500">No open tasks</p>
            )}
          </div>
        </section>

        <section className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <FolderOpen className="h-4 w-4 text-teal-400" />
            Shared files
            <span className="ml-auto text-xs font-normal text-slate-500">
              {sharedFiles.length}
            </span>
          </div>
          <div className="space-y-2">
            {sharedFiles.map((attachment) => (
              <div
                key={attachment._id || attachment.url || attachment.filename}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.025] p-2.5"
              >
                <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-300">{attachment.filename}</p>
                  <p className="mt-0.5 text-[11px] uppercase text-slate-600">
                    {attachment.fileType || "File"}
                  </p>
                </div>
              </div>
            ))}
            {sharedFiles.length === 0 && (
              <p className="text-xs text-slate-500">Files shared in this conversation appear here.</p>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
