import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  Check,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import SheetViewer from "../components/sheets/SheetViewer";
import ShareSheetModal from "../components/sheets/ShareSheetModal";
import AccessHistoryModal from "../components/sheets/AccessHistoryModal";
import SheetFormModal from "../components/sheets/SheetFormModal";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeRole = (role) => {
  const normalized = String(role || "employee")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
  return normalized === "superadmin" ? "super-admin" : normalized;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getTypeMeta = (type) =>
  String(type || "").toLowerCase() === "google"
    ? {
        label: "Google Sheets",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
      }
    : {
        label: "Excel Online",
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
      };

const MetricCard = ({ icon, label, value, tone }) => {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  };

  return (
    <div className="app-panel flex items-center gap-3 rounded-2xl p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}
      >
        {React.createElement(icon, { className: "h-4 w-4" })}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-0.5 text-xl font-semibold text-slate-950 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
};

const SheetCard = ({
  sheet,
  canEdit,
  canShare,
  canViewHistory,
  onOpen,
  onEdit,
  onShare,
  onHistory,
  onDelete,
}) => {
  const type = getTypeMeta(sheet.type);

  return (
    <article className="app-panel flex min-h-[300px] flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3 border-b border-slate-200 p-4 dark:border-white/10">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${type.className}`}
        >
          <FileSpreadsheet className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
            {sheet.name || "Untitled sheet"}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {type.label}
            </span>
            {sheet.category && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="max-w-36 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {sheet.category}
                </span>
              </>
            )}
          </div>
        </div>
        {sheet.isShared && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
            <Users className="h-3 w-3" />
            Shared
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-3 min-h-[60px] text-sm leading-5 text-slate-600 dark:text-slate-300">
          {sheet.description ||
            "No description has been added for this sheet yet."}
        </p>

        <div className="mt-3 min-h-7">
          {Array.isArray(sheet.tags) && sheet.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sheet.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
              {sheet.tags.length > 3 && (
                <span className="px-1 py-1 text-[10px] text-slate-400">
                  +{sheet.tags.length - 3}
                </span>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(sheet.createdAt)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-40 truncate">
              {sheet.addedBy?.name || "Unknown contributor"}
            </span>
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <button
            type="button"
            onClick={() => onOpen(sheet)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            <Eye className="h-3.5 w-3.5" />
            Open sheet
          </button>
          {sheet.originalUrl && (
            <a
              href={sheet.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
              aria-label={`Open ${sheet.name} in a new tab`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(sheet)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-emerald-400/20 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-200"
              aria-label={`Edit ${sheet.name}`}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {canShare && (
            <button
              type="button"
              onClick={() => onShare(sheet)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-violet-400/20 dark:hover:bg-violet-400/10 dark:hover:text-violet-200"
              aria-label={`Share ${sheet.name}`}
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          )}
          {canViewHistory && (
            <button
              type="button"
              onClick={() => onHistory(sheet)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-blue-400/20 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
              aria-label={`View access history for ${sheet.name}`}
            >
              <Activity className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => onDelete(sheet)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-rose-400/20 dark:hover:bg-rose-400/10 dark:hover:text-rose-200"
              aria-label={`Delete ${sheet.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

const SheetManagerPage = ({ onLogout }) => {
  const [user] = useState(readUser);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const notificationTimer = useRef(null);

  const role = normalizeRole(user.role);
  const superAdmin = role === "super-admin";
  const adminUser = role === "admin" || superAdmin;

  const notify = useCallback((message, type = "success") => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    setNotification({ message, type });
    notificationTimer.current = setTimeout(
      () => setNotification(null),
      3500
    );
  }, []);

  useEffect(
    () => () => {
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    },
    []
  );

  const fetchSheets = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE}/api/sheets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        data.sort(
          (left, right) =>
            new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
        );
        setSheets(data);
      } catch (requestError) {
        console.error("Failed to fetch sheets:", requestError);
        setError(
          requestError.response?.data?.message ||
            "The shared sheets could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  const canEditSheet = (sheet) =>
    superAdmin ||
    String(sheet.addedBy?._id || sheet.addedBy) === String(user._id);

  const handleSaveSheet = async (payload) => {
    const token = localStorage.getItem("token");
    const editing = modal?.type === "edit";

    if (editing) {
      await axios.put(
        `${API_BASE}/api/sheets/${modal.sheet._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } else {
      await axios.post(`${API_BASE}/api/sheets`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    setModal(null);
    notify(editing ? "Sheet updated successfully." : "Sheet added successfully.");
    await fetchSheets({ refresh: true });
  };

  const handleDeleteSheet = async (sheet) => {
    if (
      !window.confirm(
        `Delete “${sheet.name}” from Shared Sheets? The source file will not be deleted.`
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/api/sheets/${sheet._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      notify("Sheet removed from the CRM.");
      await fetchSheets({ refresh: true });
    } catch (deleteError) {
      notify(
        deleteError.response?.data?.message || "The sheet could not be deleted.",
        "error"
      );
    }
  };

  const filteredSheets = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return sheets.filter((sheet) => {
      const searchableText = [
        sheet.name,
        sheet.description,
        sheet.category,
        ...(Array.isArray(sheet.tags) ? sheet.tags : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search || searchableText.includes(search);
      const matchesType =
        filterType === "all" ||
        String(sheet.type || "").toLowerCase() === filterType;
      return matchesSearch && matchesType;
    });
  }, [filterType, searchTerm, sheets]);

  const metrics = {
    total: sheets.length,
    shared: sheets.filter((sheet) => sheet.isShared).length,
    google: sheets.filter(
      (sheet) => String(sheet.type).toLowerCase() === "google"
    ).length,
    categories: new Set(
      sheets.map((sheet) => sheet.category).filter(Boolean)
    ).size,
  };

  return (
    <div className="app-shell sheet-manager-theme h-[100dvh] overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={role}
      />

      <main
        className={`app-main h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <section className="app-header overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <p className="app-eyebrow">Collaboration</p>
                  <h1 className="app-title">Sheet manager</h1>
                  <p className="app-description max-w-2xl">
                    Find team spreadsheets, open them securely, and manage access from one place.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchSheets({ refresh: true })}
                  disabled={loading || refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
                {superAdmin && (
                  <button
                    type="button"
                    onClick={() => setModal({ type: "add" })}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                  >
                    <Plus className="h-4 w-4" />
                    Add sheet
                  </button>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              icon={FileSpreadsheet}
              label="Available sheets"
              value={metrics.total}
              tone="blue"
            />
            <MetricCard
              icon={Users}
              label="Shared resources"
              value={metrics.shared}
              tone="violet"
            />
            <MetricCard
              icon={FileSpreadsheet}
              label="Google Sheets"
              value={metrics.google}
              tone="emerald"
            />
            <MetricCard
              icon={FolderKanban}
              label="Categories"
              value={metrics.categories}
              tone="amber"
            />
          </div>

          {error && (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => fetchSheets({ refresh: true })}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-transparent dark:hover:bg-rose-400/10"
              >
                Try again
              </button>
            </div>
          )}

          <section className="app-panel rounded-2xl p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <Filter className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  Browse sheets
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {filteredSheets.length} of {sheets.length} resources shown
                </p>
              </div>
              {(searchTerm || filterType !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterType("all");
                  }}
                  className="text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block">
                <span className="sr-only">Search shared sheets</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, description, category, or tags"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">Filter by sheet type</span>
                <FileSpreadsheet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-[#151923] dark:text-slate-200 dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10"
                >
                  <option value="all">All platforms</option>
                  <option value="google">Google Sheets</option>
                  <option value="excel">Excel Online</option>
                </select>
              </label>
            </div>
          </section>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-[300px] animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#10131c]"
                />
              ))}
            </div>
          ) : filteredSheets.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-[#10131c]">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.03]">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                {searchTerm || filterType !== "all"
                  ? "No matching sheets"
                  : "No shared sheets yet"}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {searchTerm || filterType !== "all"
                  ? "Try a broader search or clear the platform filter."
                  : "Shared spreadsheets will appear here once they are added to the CRM."}
              </p>
              {superAdmin && !searchTerm && filterType === "all" && (
                <button
                  type="button"
                  onClick={() => setModal({ type: "add" })}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  <Plus className="h-4 w-4" />
                  Add the first sheet
                </button>
              )}
            </section>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSheets.map((sheet) => (
                <SheetCard
                  key={sheet._id}
                  sheet={sheet}
                  canEdit={canEditSheet(sheet)}
                  canShare={superAdmin}
                  canViewHistory={adminUser}
                  onOpen={(selected) =>
                    setModal({ type: "viewer", sheet: selected })
                  }
                  onEdit={(selected) =>
                    setModal({ type: "edit", sheet: selected })
                  }
                  onShare={(selected) =>
                    setModal({ type: "share", sheet: selected })
                  }
                  onHistory={(selected) =>
                    setModal({ type: "history", sheet: selected })
                  }
                  onDelete={handleDeleteSheet}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {notification && (
        <div
          className={`fixed right-4 top-4 z-[70] flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl ${
            notification.type === "success"
              ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-400/20 dark:bg-[#10131c] dark:text-emerald-200"
              : "border-rose-200 bg-white text-rose-700 dark:border-rose-400/20 dark:bg-[#10131c] dark:text-rose-200"
          }`}
          role="status"
        >
          {notification.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {notification.message}
        </div>
      )}

      {(modal?.type === "add" || modal?.type === "edit") && (
        <SheetFormModal
          sheet={modal.type === "edit" ? modal.sheet : null}
          onClose={() => setModal(null)}
          onSubmit={handleSaveSheet}
        />
      )}

      {modal?.type === "share" && (
        <ShareSheetModal
          sheet={modal.sheet}
          onClose={() => setModal(null)}
          onSuccess={async () => {
            notify("Sharing settings updated.");
            await fetchSheets({ refresh: true });
          }}
        />
      )}

      {modal?.type === "history" && (
        <AccessHistoryModal
          sheet={modal.sheet}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "viewer" && (
        <SheetViewer
          sheet={modal.sheet}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default SheetManagerPage;
