import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BookOpen, FileText, Search, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const roleBadgeStyles = {
  employee:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  admin:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
  hr: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
};

const formatRole = (role = "user") =>
  role.charAt(0).toUpperCase() + role.slice(1);

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Never";

const UserAvatar = ({ user, size = "h-10 w-10" }) =>
  user.profileImage ? (
    <img
      className={`${size} shrink-0 rounded-full object-cover`}
      src={`${API_BASE}${user.profileImage}`}
      alt={user.name}
    />
  ) : (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white`}
    >
      {user.name?.charAt(0)?.toUpperCase() || "?"}
    </span>
  );

const SuperAdminNotepadViewer = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [notepadContent, setNotepadContent] = useState("");
  const [showNotepadModal, setShowNotepadModal] = useState(false);

  useEffect(() => {
    const fetchUsersWithNotepads = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${API_BASE}/api/notepad/all-users`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        if (response.data.success) setUsers(response.data.data);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsersWithNotepads();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesSearch =
        !query ||
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.department?.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [roleFilter, searchQuery, users]);

  const usersWithNotes = users.filter((user) => user.notepad?.hasContent).length;
  const totalWords = users.reduce(
    (sum, user) => sum + (user.notepad?.wordCount || 0),
    0,
  );

  const viewNotepad = async (user) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/notepad/user/${user._id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (response.data.success) {
        setSelectedUser(response.data.data.user);
        setNotepadContent(response.data.data.notepad.content || "");
        setShowNotepadModal(true);
      }
    } catch (error) {
      console.error("Error fetching notepad:", error);
      toast.error("Failed to load notepad");
    }
  };

  const closeModal = () => {
    setShowNotepadModal(false);
    setSelectedUser(null);
    setNotepadContent("");
  };

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="super-admin"
        onLogout={onLogout}
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
              <BookOpen className="h-3.5 w-3.5" />
              Employee workspace
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Employee notepads
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Review notes saved by employees, administrators, and HR team members.
            </p>
          </header>

          <section className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-white/10 dark:bg-white/10">
            {[
              ["Team members", users.length, Users],
              ["With notes", usersWithNotes, FileText],
              ["Total words", totalWords.toLocaleString("en-IN"), BookOpen],
            ].map(([label, value, Icon]) => (
              <div
                key={label}
                className="flex min-w-0 items-center gap-3 bg-white px-3 py-4 dark:bg-[#10131c] sm:px-5"
              >
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-300 sm:flex">
                  {React.createElement(Icon, { className: "h-4 w-4" })}
                </span>
                <div className="min-w-0">
                  <div className="text-xl font-semibold text-slate-950 dark:text-white">
                    {isLoading ? "—" : value}
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
                <label className="relative block">
                  <span className="sr-only">Search users</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search name, email, or department"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:focus:bg-white/[0.05]"
                  />
                </label>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  aria-label="Filter users by role"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-slate-200"
                >
                  <option value="all">All roles</option>
                  <option value="employee">Employees</option>
                  <option value="admin">Administrators</option>
                  <option value="hr">HR</option>
                </select>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Showing {filteredUsers.length} of {users.length} team members
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-3 p-4 sm:p-5">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
                  <Search className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  No matching users
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Try changing the search term or role filter.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4 md:hidden">
                  {filteredUsers.map((user) => (
                    <article
                      key={user._id}
                      className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
                    >
                      <div className="flex items-start gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {user.email}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                            roleBadgeStyles[user.role] || roleBadgeStyles.employee
                          }`}
                        >
                          {formatRole(user.role)}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
                        <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
                          <p className="truncate">{user.department || "No department"}</p>
                          <p className="mt-0.5">Updated {formatDate(user.notepad?.lastModified)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => viewNotepad(user)}
                          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                          View note
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="bg-slate-50 dark:bg-white/[0.02]">
                      <tr className="border-b border-slate-200 dark:border-white/10">
                        {["User", "Role", "Department", "Notepad", "Updated", ""].map(
                          (heading) => (
                            <th
                              key={heading || "actions"}
                              className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                            >
                              {heading}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {filteredUsers.map((user) => (
                        <tr
                          key={user._id}
                          className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <UserAvatar user={user} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                  {user.name}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                roleBadgeStyles[user.role] || roleBadgeStyles.employee
                              }`}
                            >
                              {formatRole(user.role)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                            {user.department || "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            {user.notepad?.hasContent ? (
                              <div>
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                  Has content
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                  {user.notepad.wordCount} words
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">Empty</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(user.notepad?.lastModified)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => viewNotepad(user)}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              View note
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {showNotepadModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={closeModal}
          role="presentation"
        >
          <section
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notepad-title"
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={selectedUser} size="h-11 w-11" />
                <div className="min-w-0">
                  <h2
                    id="notepad-title"
                    className="truncate text-base font-semibold text-slate-950 dark:text-white"
                  >
                    {selectedUser.name}&apos;s notepad
                  </h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {selectedUser.email} · {formatRole(selectedUser.role)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
                aria-label="Close notepad"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="overflow-y-auto p-5 sm:p-6">
              {notepadContent ? (
                <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-5 font-sans text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-200">
                  {notepadContent}
                </pre>
              ) : (
                <div className="py-14 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
                    <FileText className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                    Empty notepad
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    This user has not saved any notes yet.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default SuperAdminNotepadViewer;
