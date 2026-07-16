import React from "react";
import {
  Calendar,
  Users,
  User,
  MessageSquare,
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

      <div className="flex h-full flex-col p-5 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 truncate text-lg font-semibold text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
              {project.projectName}
            </h3>
            <div className="flex flex-wrap gap-2.5">
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

          {/* Status & Priority Badges */}
          <div className="flex flex-col gap-2.5">
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

        {/* Description */}
        {project.description && (
          <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {project.description}
          </p>
        )}

        {/* Meta Information */}
        <div className="mb-5 grid grid-cols-2 gap-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            <div>
              <div className="text-slate-400 dark:text-slate-500">Start</div>
              <div className="text-slate-700 dark:text-slate-300">{formatDate(project.startDate)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <div>
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
        <div className="mb-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-1.5 flex items-center justify-between text-xs">
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

        {/* Assigned Users & Clients */}
        <div className="mb-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          {project.assignedTo?.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                {project.assignedTo.length} assigned
              </span>
            </div>
          )}
          {project.clients?.length > 0 && (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-slate-400" />
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

        {/* Actions */}
        <div className="mt-auto flex flex-wrap gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            onClick={() => onView(project)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </button>

          {onCommunication && (
            <button
              onClick={() => onCommunication(project)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => onEdit(project)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(project)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProjectCard;
