import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  Check,
  LoaderCircle,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const AVAILABLE_ROLES = [
  {
    value: "admin",
    label: "Admins",
    description: "Share with every administrator",
    icon: Shield,
  },
  {
    value: "hr",
    label: "HR team",
    description: "Share with people in the HR role",
    icon: Users,
  },
  {
    value: "employee",
    label: "Employees",
    description: "Share with everyone in the employee role",
    icon: UserPlus,
  },
];

const getInitialUsers = (sheet) =>
  (sheet.sharedWith || [])
    .map((share) => ({
      userId:
        typeof share.user === "object" ? share.user?._id : share.user,
      permission: share.permission || "view",
    }))
    .filter((share) => share.userId);

const getInitialRoles = (sheet) =>
  (sheet.sharedWithRoles || [])
    .map((share) => ({
      role: share.role,
      permission: share.permission || "view",
    }))
    .filter((share) => share.role);

const ShareSheetModal = ({ sheet, onClose, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(() =>
    getInitialUsers(sheet),
  );
  const [selectedRoles, setSelectedRoles] = useState(() =>
    getInitialRoles(sheet),
  );
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setSelectedUsers(getInitialUsers(sheet));
    setSelectedRoles(getInitialRoles(sheet));
  }, [sheet]);

  useEffect(() => {
    let isMounted = true;

    const fetchUsers = async () => {
      try {
        setIsFetchingUsers(true);
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const responseUsers = Array.isArray(response.data)
          ? response.data
          : response.data?.data;

        if (isMounted) setUsers(Array.isArray(responseUsers) ? responseUsers : []);
      } catch (requestError) {
        console.error("Error fetching users:", requestError);
        if (isMounted) setError("We couldn't load the people list. Please try again.");
      } finally {
        if (isMounted) setIsFetchingUsers(false);
      }
    };

    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSaving, onClose]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const ownerId =
      typeof sheet.addedBy === "object" ? sheet.addedBy?._id : sheet.addedBy;

    return users.filter((user) => {
      if (user._id === ownerId) return false;
      if (!query) return true;

      return [user.name, user.email, user.employeeId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [searchTerm, sheet.addedBy, users]);

  const toggleUserSelection = (userId) => {
    setSelectedUsers((current) =>
      current.some((share) => share.userId === userId)
        ? current.filter((share) => share.userId !== userId)
        : [...current, { userId, permission: "view" }],
    );
  };

  const updateUserPermission = (userId, permission) => {
    setSelectedUsers((current) =>
      current.map((share) =>
        share.userId === userId ? { ...share, permission } : share,
      ),
    );
  };

  const toggleRoleSelection = (role) => {
    setSelectedRoles((current) =>
      current.some((share) => share.role === role)
        ? current.filter((share) => share.role !== role)
        : [...current, { role, permission: "view" }],
    );
  };

  const updateRolePermission = (role, permission) => {
    setSelectedRoles((current) =>
      current.map((share) =>
        share.role === role ? { ...share, permission } : share,
      ),
    );
  };

  const handleShare = async () => {
    try {
      setIsSaving(true);
      setError("");
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_BASE}/api/sheets/${sheet._id}/share`,
        { userShares: selectedUsers, roleShares: selectedRoles },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      await onSuccess?.();
      onClose();
    } catch (requestError) {
      console.error("Error sharing sheet:", requestError);
      setError(
        requestError.response?.data?.message ||
          "We couldn't update sharing. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = selectedUsers.length + selectedRoles.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Users className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="share-sheet-title"
                    className="text-lg font-semibold text-slate-900 dark:text-white"
                  >
                    Share sheet
                  </h2>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {sheet.name}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Choose who can open this resource and whether they can edit it.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              aria-label="Close share sheet dialog"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <section aria-labelledby="share-roles-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3
                  id="share-roles-heading"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  Share by role
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Give access to an entire group at once.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {AVAILABLE_ROLES.map((roleOption) => {
                const RoleIcon = roleOption.icon;
                const roleShare = selectedRoles.find(
                  (share) => share.role === roleOption.value,
                );
                const isSelected = Boolean(roleShare);

                return (
                  <div
                    key={roleOption.value}
                    className={`rounded-xl border p-3 transition ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleRoleSelection(roleOption.value)}
                      aria-pressed={isSelected}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        <RoleIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {roleOption.label}
                          </span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {roleOption.description}
                        </span>
                      </span>
                    </button>

                    {isSelected && (
                      <label className="mt-3 block border-t border-blue-200 pt-3 text-xs font-medium text-slate-600 dark:border-blue-900/70 dark:text-slate-300">
                        Permission
                        <select
                          value={roleShare.permission}
                          onChange={(event) =>
                            updateRolePermission(
                              roleOption.value,
                              event.target.value,
                            )
                          }
                          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value="view">Can view</option>
                          <option value="edit">Can edit</option>
                        </select>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="share-people-heading">
            <div className="mb-3">
              <h3
                id="share-people-heading"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                Share with people
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Add individual team members for more precise access.
              </p>
            </div>

            <label className="relative block">
              <span className="sr-only">Search people</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, email or employee ID"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {isFetchingUsers ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-10 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading people...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
                  <Users className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    No people found
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Try a different name, email or employee ID.
                  </p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const userShare = selectedUsers.find(
                    (share) => share.userId === user._id,
                  );
                  const isSelected = Boolean(userShare);
                  const detail = [user.email, user.employeeId]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <div
                      key={user._id}
                      className={`rounded-xl border p-3 transition sm:flex sm:items-center sm:gap-3 ${
                        isSelected
                          ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleUserSelection(user._id)}
                        aria-pressed={isSelected}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
                          {user.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                              {user.name || "Unnamed user"}
                            </span>
                            {isSelected && (
                              <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            )}
                          </span>
                          {detail && (
                            <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                              {detail}
                            </span>
                          )}
                        </span>
                      </button>

                      {isSelected && (
                        <label className="mt-3 block text-xs font-medium text-slate-600 sm:mt-0 sm:w-32 dark:text-slate-300">
                          <span className="sr-only">Permission for {user.name}</span>
                          <select
                            value={userShare.permission}
                            onChange={(event) =>
                              updateUserPermission(user._id, event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="view">Can view</option>
                            <option value="edit">Can edit</option>
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedCount === 0
              ? "Only you can access this sheet."
              : `${selectedCount} ${selectedCount === 1 ? "recipient" : "recipients"} selected`}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={isSaving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isSaving ? "Saving..." : "Save sharing"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ShareSheetModal;
