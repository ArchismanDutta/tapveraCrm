import React from "react";
import {
  Calendar,
  Users,
  User,
  MessageSquare,
  MessageCircle,
  Edit2,
  Trash2,
  Eye,
  Globe,
  TrendingUp,
  Package,
  Mail,
  Server,
  FileText,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { getTaskProgress } from "../../utils/projectProgress";

const PROJECT_TYPE_ICONS = {
  Website: Globe,
  SEO: TrendingUp,
  "Google Marketing": Package,
  SMO: Mail,
  Hosting: Server,
  "Invoice App": FileText,
};

const ProjectCard = ({
  project,
  onView,
  onEdit,
  onDelete,
  onCommunication,
  canEdit = false,
  canDelete = false,
  remarkCount = 0,
}) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "new":
        return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300";
      case "ongoing":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
      case "expired":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300";
      case "completed":
        return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300";
      default:
        return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300";
      case "medium":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300";
      case "low":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
      default:
        return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpiringSoon = () => {
    if (!project.endDate) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = () => {
    if (!project.endDate) return false;
    return new Date(project.endDate) < new Date();
  };

  const progress = getTaskProgress(project.tasks);

  return (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-[#11141b] dark:hover:border-blue-500/30">
      {/* Accent Bar */}
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
          isExpired()
            ? "from-rose-400 to-rose-600"
            : isExpiringSoon()
            ? "from-amber-400 to-amber-600"
            : "from-blue-500 via-cyan-500 to-emerald-500"
        }`}
      />

      {/* Density is deliberately tighter on a phone.
          At the desktop spacing (p-6, mb-4/mb-5 between six stacked sections)
          one card ran about 900px tall on a 390px screen — you could see one
          and a bit, so scanning a project list meant scrolling past cards
          rather than comparing them. Padding, gaps and type all step up at
          `sm`, where the extra room is real. */}
      <div className="flex h-full flex-col p-3.5 sm:p-6">
        {/* Header
            Stacks under 400px. Side-by-side, the status/priority column claims
            a fixed ~80px of a 375px card and the project name — the one thing
            you scan a card for — gets truncated to a few characters. Above
            that width the original two-column layout is kept. */}
        <div className="mb-2.5 flex flex-col gap-2 xs:flex-row xs:items-start xs:justify-between xs:gap-4 sm:mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 truncate text-base font-semibold text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300 sm:text-lg">
              {project.projectName}
            </h3>
            <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
              {project.type?.slice(0, 2).map((type, idx) => {
                const Icon = PROJECT_TYPE_ICONS[type] || FileText;
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                  >
                    <Icon className="h-3 w-3" />
                    {type}
                  </span>
                );
              })}
              {project.type?.length > 2 && (
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                  +{project.type.length - 2}
                </span>
              )}
            </div>
          </div>

          {/* Status & Priority Badges.
              Side by side on a phone (they're two short words and the row is
              otherwise empty); stacked into a column from `xs`, where they sit
              beside the title instead of under it. */}
          <div className="flex flex-row gap-1.5 xs:flex-col xs:gap-2.5">
            <span
              className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(
                project.status
              )}`}
            >
              {project.status}
            </span>
            <span
              className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${getPriorityColor(
                project.priority
              )}`}
            >
              {project.priority}
            </span>
          </div>
        </div>

        {/* Description — two lines on a phone, three where there's room. The
            third line costs 24px on every card in the list for the tail of a
            sentence that is already cut off. */}
        {project.description && (
          <p className="mb-2.5 line-clamp-2 text-[13px] leading-5 text-slate-500 dark:text-slate-400 sm:mb-4 sm:line-clamp-3 sm:text-sm sm:leading-6">
            {project.description}
          </p>
        )}

        {/* Meta Information */}
        <div className="mb-2.5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:mb-5 sm:gap-5 sm:pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 dark:text-slate-500">Start</div>
              <div className="truncate text-slate-700 dark:text-slate-300">{formatDate(project.startDate)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 dark:text-slate-500">End</div>
              <div
                className={
                  isExpired()
                    ? "text-rose-600 dark:text-rose-300"
                    : isExpiringSoon()
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-slate-700 dark:text-slate-300"
                }
              >
                {formatDate(project.endDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Task Progress */}
        <div className="mb-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:mb-5 sm:pt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">Task progress</span>
            <span className="text-slate-500 dark:text-slate-400">
              {progress.total === 0
                ? "No tasks yet"
                : `${progress.completed}/${progress.total} tasks (${progress.percent}%)`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        {/* Assigned Users & Clients — one row, not two.
            These are two counts of three or four characters each; giving them
            a stacked block with `space-y-3` spent ~50px of card height on
            about 90px worth of text. */}
        <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:mb-5 sm:pt-4">
          {project.assignedTo?.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                {project.assignedTo.length} assigned
              </span>
            </div>
          )}
          {project.clients?.length > 0 && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                {project.clients.length} client{project.clients.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Expiry Warning */}
        {(isExpired() || isExpiringSoon()) && (
          <div
            className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              isExpired()
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{isExpired() ? "Project expired" : "Expiring soon"}</span>
          </div>
        )}

        {/* Actions — one row, always.
            Wrapping was the worst of it: five buttons in a `flex-wrap` put
            View/Chat/Remarks on the first line and stranded Edit and Delete on
            a second, adding ~56px to every card for two icons. Which buttons
            exist depends on permissions, so the wrap point moved per-user too.

            An auto-flow grid gives every button an equal share of one row
            regardless of how many render, so the row height is fixed and the
            layout is the same for everyone. Labels are hidden below `xs` — at
            five-up on a 360px card there is roughly 60px per cell, which fits
            an icon comfortably and "Remarks" not at all. Each button keeps an
            `aria-label`, so hiding the text costs nothing to a screen reader.

            Heights come from the global coarse-pointer rule in index.css, which
            lifts every button to a 44px minimum on touch — these were 32px. */}
        <div className="mt-auto grid auto-cols-fr grid-flow-col gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:gap-2.5 sm:pt-4">
          <button
            onClick={() => onView(project)}
            aria-label="View project"
            title="View project"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 py-2 text-xs font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:px-3"
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xs:inline">View</span>
          </button>

          {onCommunication && (
            <button
              onClick={() => onCommunication(project)}
              aria-label="Open project chat"
              title="Open project chat"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20 sm:px-3"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xs:inline">Chat</span>
            </button>
          )}

          <button
            onClick={() => onView(project)}
            aria-label={remarkCount > 0 ? `Client remarks, ${remarkCount} unread` : "Client remarks"}
            title="Client remarks"
            className="relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2 py-2 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-500/25 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20 sm:px-3"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xs:inline">Remarks</span>
            {remarkCount > 0 && (
              <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-semibold leading-none text-white dark:bg-purple-500">
                {remarkCount > 99 ? "99+" : remarkCount}
              </span>
            )}
          </button>

          {canEdit && (
            <button
              onClick={() => onEdit(project)}
              aria-label="Edit project"
              title="Edit project"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white sm:px-3"
            >
              <Edit2 className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(project)}
              aria-label="Delete project"
              title="Delete project"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 sm:px-3"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProjectCard;
