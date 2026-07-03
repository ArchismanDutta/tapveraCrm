import React, { useEffect, useMemo, useState } from "react";
import API from "../../api";
import Sidebar from "../../components/dashboard/Sidebar";
import {
  AlertCircle,
  Briefcase,
  Check,
  Edit2,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";

const permissionLabels = {
  canManageUsers: "Manage users",
  canManageClients: "Manage clients",
  canManageProjects: "Manage projects",
  canAssignTasks: "Assign tasks",
  canApproveLeaves: "Approve leaves",
  canApproveShifts: "Approve shifts",
  canViewReports: "View reports",
  canManageAttendance: "Manage attendance",
};

const emptyPositionForm = () => ({
  name: "",
  level: 50,
  department: "all",
  description: "",
  permissions: Object.keys(permissionLabels).reduce(
    (permissions, key) => ({ ...permissions, [key]: false }),
    {},
  ),
});

const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:focus:bg-white/[0.05]";

const PositionManagement = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchPosition, setSearchPosition] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [positionForm, setPositionForm] = useState(emptyPositionForm);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  useEffect(() => {
    if (!notification) return undefined;
    const timer = window.setTimeout(() => setNotification(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  useEffect(() => {
    let mounted = true;
    const loadPage = async () => {
      try {
        setPageLoading(true);
        const [positionsResult, usersResult, statsResult] =
          await Promise.allSettled([
            API.get("/api/positions"),
            API.get("/api/positions/users/list"),
            API.get("/api/positions/stats"),
          ]);
        if (!mounted) return;
        if (positionsResult.status === "fulfilled") {
          setPositions(
            Array.isArray(positionsResult.value.data)
              ? positionsResult.value.data
              : [],
          );
        }
        if (usersResult.status === "fulfilled") {
          setUsers(
            Array.isArray(usersResult.value.data) ? usersResult.value.data : [],
          );
        }
        if (statsResult.status === "fulfilled") {
          setStats(statsResult.value.data || null);
        }
        if (
          [positionsResult, usersResult, statsResult].some(
            (result) => result.status === "rejected",
          )
        ) {
          showNotification("Some position data could not be loaded", "error");
        }
      } catch (error) {
        console.error("Error loading position management:", error);
        if (mounted) showNotification("Position data could not be loaded", "error");
      } finally {
        if (mounted) setPageLoading(false);
      }
    };
    loadPage();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchPositions = async () => {
    const response = await API.get("/api/positions");
    setPositions(Array.isArray(response.data) ? response.data : []);
  };

  const fetchUsers = async () => {
    const response = await API.get("/api/positions/users/list");
    setUsers(Array.isArray(response.data) ? response.data : []);
  };

  const fetchStats = async () => {
    const response = await API.get("/api/positions/stats");
    setStats(response.data || null);
  };

  const filteredPositions = useMemo(() => {
    const query = searchPosition.trim().toLowerCase();
    if (!query) return positions;
    return positions.filter((position) =>
      [position.name, position.description, position.department].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [positions, searchPosition]);

  const filteredUsers = useMemo(() => {
    const query = searchUser.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.name, user.email, user.employeeId, user.position].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [searchUser, users]);

  const resetPositionForm = () => setPositionForm(emptyPositionForm());

  const closePositionModal = () => {
    setShowPositionModal(false);
    setEditingPosition(null);
    resetPositionForm();
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedUser(null);
    resetPositionForm();
  };

  const handleCreatePosition = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      await API.post("/api/positions", positionForm);
      showNotification("Position created successfully", "success");
      closePositionModal();
      await Promise.all([fetchPositions(), fetchStats()]);
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Position could not be created",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePosition = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      await API.put(`/api/positions/${editingPosition._id}`, positionForm);
      showNotification("Position updated successfully", "success");
      closePositionModal();
      await Promise.all([fetchPositions(), fetchStats()]);
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Position could not be updated",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePosition = async (positionId) => {
    if (!window.confirm("Are you sure you want to delete this position?")) return;
    try {
      await API.delete(`/api/positions/${positionId}`);
      showNotification("Position deleted successfully", "success");
      await Promise.all([fetchPositions(), fetchStats()]);
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Position could not be deleted",
        "error",
      );
    }
  };

  const handleAssignPosition = async () => {
    if (!selectedUser || !positionForm.name) return;
    try {
      setLoading(true);
      await API.patch(`/api/positions/users/${selectedUser._id}/assign`, {
        position: positionForm.name,
        positionLevel: positionForm.level,
      });
      showNotification("Position assigned successfully", "success");
      closeAssignModal();
      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Position could not be assigned",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const openEditPosition = (position) => {
    setEditingPosition(position);
    setPositionForm({
      ...emptyPositionForm(),
      name: position.name || "",
      level: position.level ?? 50,
      department: position.department || "all",
      description: position.description || "",
      permissions: {
        ...emptyPositionForm().permissions,
        ...(position.permissions || {}),
      },
    });
    setShowPositionModal(true);
  };

  const openAssignPosition = (user) => {
    setSelectedUser(user);
    const existingPosition = positions.find(
      (position) => position.name === user.position,
    );
    setPositionForm(
      existingPosition
        ? {
            ...emptyPositionForm(),
            name: existingPosition.name,
            level: existingPosition.level,
          }
        : emptyPositionForm(),
    );
    setShowAssignModal(true);
  };

  const togglePermission = (key) => {
    setPositionForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: !current.permissions[key],
      },
    }));
  };

  const summary = {
    totalPositions: stats?.totalPositions ?? positions.length,
    activePositions:
      stats?.activePositions ??
      positions.filter((position) => position.status === "active").length,
    assignedUsers:
      stats?.usersWithPositions ?? users.filter((user) => user.position).length,
    unassignedUsers:
      stats?.usersWithoutPositions ?? users.filter((user) => !user.position).length,
  };

  const metrics = [
    ["Total positions", summary.totalPositions, Briefcase, "text-blue-600 dark:text-blue-300"],
    ["Active positions", summary.activePositions, Shield, "text-emerald-600 dark:text-emerald-300"],
    ["Assigned users", summary.assignedUsers, Users, "text-violet-600 dark:text-violet-300"],
    ["Unassigned", summary.unassignedUsers, UserCog, "text-amber-600 dark:text-amber-300"],
  ];

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole="super-admin"
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          {notification && (
            <div
              className={`fixed right-4 top-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${
                notification.type === "success"
                  ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-400/20 dark:bg-[#151923] dark:text-emerald-200"
                  : "border-rose-200 bg-white text-rose-700 dark:border-rose-400/20 dark:bg-[#151923] dark:text-rose-200"
              }`}
            >
              {notification.type === "success" ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {notification.message}
            </div>
          )}

          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
              <Briefcase className="h-3.5 w-3.5" />
              Organization structure
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Position management
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Define organizational positions, permissions, hierarchy, and employee assignments.
            </p>
          </header>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Position summary">
            {metrics.map(([label, value, Icon, tone]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                      {pageLoading ? "—" : value}
                    </p>
                  </div>
                  <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05] sm:flex">
                    {React.createElement(Icon, { className: `h-4 w-4 ${tone}` })}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <nav className="flex gap-1 border-b border-slate-200 p-2 dark:border-white/10 sm:px-4" aria-label="Position management sections">
              {[
                ["positions", "Manage positions", Briefcase],
                ["users", "Assign to users", Users],
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                    activeTab === id
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
                  }`}
                >
                  {React.createElement(Icon, { className: "h-4 w-4" })}
                  {label}
                </button>
              ))}
            </nav>

            <div className="p-4 sm:p-5">
              {activeTab === "positions" ? (
                <PositionsPanel
                  positions={filteredPositions}
                  total={positions.length}
                  query={searchPosition}
                  setQuery={setSearchPosition}
                  loading={pageLoading}
                  onCreate={() => {
                    resetPositionForm();
                    setEditingPosition(null);
                    setShowPositionModal(true);
                  }}
                  onEdit={openEditPosition}
                  onDelete={handleDeletePosition}
                />
              ) : (
                <UsersPanel
                  users={filteredUsers}
                  total={users.length}
                  query={searchUser}
                  setQuery={setSearchUser}
                  loading={pageLoading}
                  onAssign={openAssignPosition}
                />
              )}
            </div>
          </section>
        </div>
      </main>

      {showPositionModal && (
        <PositionModal
          editingPosition={editingPosition}
          form={positionForm}
          setForm={setPositionForm}
          loading={loading}
          onTogglePermission={togglePermission}
          onClose={closePositionModal}
          onSubmit={
            editingPosition ? handleUpdatePosition : handleCreatePosition
          }
        />
      )}

      {showAssignModal && selectedUser && (
        <AssignPositionModal
          user={selectedUser}
          positions={positions}
          form={positionForm}
          setForm={setPositionForm}
          loading={loading}
          onClose={closeAssignModal}
          onAssign={handleAssignPosition}
        />
      )}
    </div>
  );
};

const SearchField = ({ value, onChange, placeholder }) => (
  <label className="relative block w-full sm:max-w-md">
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
    />
  </label>
);

const EmptyState = ({ title, description }) => (
  <div className="py-14 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
      <Search className="h-5 w-5" />
    </span>
    <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

const PositionsPanel = ({
  positions,
  total,
  query,
  setQuery,
  loading,
  onCreate,
  onEdit,
  onDelete,
}) => (
  <div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SearchField value={query} onChange={setQuery} placeholder="Search positions" />
      <button type="button" onClick={onCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
        <Plus className="h-4 w-4" /> Create position
      </button>
    </div>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Showing {positions.length} of {total} positions</p>

    {loading ? (
      <LoadingRows />
    ) : positions.length === 0 ? (
      <EmptyState title="No positions found" description={query ? "Try a different search term." : "Create the first organizational position."} />
    ) : (
      <>
        <div className="mt-4 space-y-3 md:hidden">
          {positions.map((position) => (
            <PositionCard key={position._id} position={position} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
        <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50 dark:bg-white/[0.025]">
                <tr className="border-b border-slate-200 dark:border-white/10">
                  {["Position", "Level", "Department", "Description", "Permissions", ""].map((heading) => (
                    <th key={heading || "actions"} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {positions.map((position) => (
                  <tr key={position._id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]">
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 dark:text-white">{position.name}</td>
                    <td className="px-4 py-3.5"><LevelBadge level={position.level} /></td>
                    <td className="px-4 py-3.5 text-sm capitalize text-slate-600 dark:text-slate-300">{position.department || "All"}</td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">{position.description || "—"}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">{Object.values(position.permissions || {}).filter(Boolean).length} enabled</td>
                    <td className="px-4 py-3.5"><RowActions onEdit={() => onEdit(position)} onDelete={() => onDelete(position._id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}
  </div>
);

const PositionCard = ({ position, onEdit, onDelete }) => (
  <article className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{position.name}</h3>
        <p className="mt-1 truncate text-xs capitalize text-slate-500 dark:text-slate-400">{position.department || "All departments"}</p>
      </div>
      <LevelBadge level={position.level} />
    </div>
    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{position.description || "No description"}</p>
    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-white/10">
      <span className="text-xs text-slate-500 dark:text-slate-400">{Object.values(position.permissions || {}).filter(Boolean).length} permissions</span>
      <RowActions onEdit={() => onEdit(position)} onDelete={() => onDelete(position._id)} />
    </div>
  </article>
);

const LevelBadge = ({ level }) => (
  <span className="whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">Level {level}</span>
);

const RowActions = ({ onEdit, onDelete }) => (
  <div className="flex justify-end gap-2">
    <button type="button" onClick={onEdit} className="rounded-lg bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300" aria-label="Edit position"><Edit2 className="h-4 w-4" /></button>
    <button type="button" onClick={onDelete} className="rounded-lg bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300" aria-label="Delete position"><Trash2 className="h-4 w-4" /></button>
  </div>
);

const UsersPanel = ({ users, total, query, setQuery, loading, onAssign }) => (
  <div>
    <SearchField value={query} onChange={setQuery} placeholder="Search employees" />
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Showing {users.length} of {total} employees</p>
    {loading ? (
      <LoadingRows />
    ) : users.length === 0 ? (
      <EmptyState title="No employees found" description="Try a different name, ID, email, or position." />
    ) : (
      <>
        <div className="mt-4 space-y-3 md:hidden">
          {users.map((user) => <UserCard key={user._id} user={user} onAssign={onAssign} />)}
        </div>
        <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-slate-50 dark:bg-white/[0.025]">
                <tr className="border-b border-slate-200 dark:border-white/10">
                  {["Employee", "Role", "Department", "Current position", ""].map((heading) => <th key={heading || "actions"} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {users.map((user) => (
                  <tr key={user._id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.025]">
                    <td className="px-4 py-3.5"><UserIdentity user={user} /></td>
                    <td className="px-4 py-3.5 text-sm capitalize text-slate-600 dark:text-slate-300">{user.role}</td>
                    <td className="px-4 py-3.5 text-sm capitalize text-slate-600 dark:text-slate-300">{user.department || "—"}</td>
                    <td className="px-4 py-3.5">{user.position ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">{user.position}</span> : <span className="text-xs text-slate-400">Not assigned</span>}</td>
                    <td className="px-4 py-3.5 text-right"><AssignButton user={user} onAssign={onAssign} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}
  </div>
);

const UserIdentity = ({ user }) => (
  <div className="flex items-center gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">{user.name?.charAt(0)?.toUpperCase() || "?"}</span>
    <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.employeeId} · {user.email}</p></div>
  </div>
);

const UserCard = ({ user, onAssign }) => (
  <article className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
    <UserIdentity user={user} />
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
      <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400"><p className="truncate capitalize">{user.department || "No department"}</p><p className="mt-0.5 truncate">{user.position || "Not assigned"}</p></div>
      <AssignButton user={user} onAssign={onAssign} />
    </div>
  </article>
);

const AssignButton = ({ user, onAssign }) => (
  <button type="button" onClick={() => onAssign(user)} className="h-9 shrink-0 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700">Assign position</button>
);

const LoadingRows = () => (
  <div className="mt-4 space-y-3">{[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />)}</div>
);

const ModalShell = ({ title, description, onClose, children, maxWidth = "max-w-2xl" }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <section className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]`} role="dialog" aria-modal="true">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#10131c]/95">
        <div><h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>{description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}</div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white" aria-label="Close dialog"><X className="h-5 w-5" /></button>
      </header>
      {children}
    </section>
  </div>
);

const PositionModal = ({ editingPosition, form, setForm, loading, onTogglePermission, onClose, onSubmit }) => (
  <ModalShell title={editingPosition ? "Edit position" : "Create position"} description="Set the hierarchy level, department, and permissions for this position." onClose={onClose}>
    <form onSubmit={onSubmit} className="space-y-5 p-5">
      <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Position name</span><input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} placeholder="e.g. Team Lead" required /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Level (0–100)</span><input type="number" min="0" max="100" value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: Number.parseInt(event.target.value, 10) || 0 }))} className={fieldClass} required /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Department</span><select value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} className={`${fieldClass} dark:bg-[#151923]`}><option value="all">All departments</option><option value="executives">Executives</option><option value="development">Development</option><option value="marketingAndSales">Marketing & Sales</option><option value="humanResource">Human Resource</option></select></label>
      </div>
      <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${fieldClass} min-h-24 resize-y py-3`} rows={3} placeholder="Describe the responsibilities of this position" /></label>
      <fieldset><legend className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Permissions</legend><div className="grid gap-2 sm:grid-cols-2">{Object.entries(permissionLabels).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.04]"><input type="checkbox" checked={form.permissions[key] || false} onChange={() => onTogglePermission(key)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />{label}</label>)}</div></fieldset>
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10"><button type="button" onClick={onClose} disabled={loading} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]">Cancel</button><button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}{loading ? "Saving..." : editingPosition ? "Update position" : "Create position"}</button></div>
    </form>
  </ModalShell>
);

const AssignPositionModal = ({ user, positions, form, setForm, loading, onClose, onAssign }) => (
  <ModalShell title="Assign position" description="Choose the position and hierarchy level for this employee." onClose={onClose} maxWidth="max-w-md">
    <div className="space-y-4 p-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.025]"><UserIdentity user={user} /></div>
      <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Position</span><select value={form.name} onChange={(event) => { const selected = positions.find((position) => position.name === event.target.value); setForm((current) => ({ ...current, name: selected?.name || "", level: selected?.level || 0 })); }} className={`${fieldClass} dark:bg-[#151923]`} required><option value="">Select a position</option>{positions.filter((position) => position.status === "active").sort((first, second) => second.level - first.level).map((position) => <option key={position._id} value={position.name}>{position.name} (Level {position.level})</option>)}</select></label>
      {form.name && <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"><Shield className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Position level {form.level}</p><p className="mt-1 text-xs opacity-80">This updates the employee’s hierarchy level and position assignment.</p></div></div>}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10"><button type="button" onClick={onClose} disabled={loading} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]">Cancel</button><button type="button" onClick={onAssign} disabled={loading || !form.name} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}{loading ? "Assigning..." : "Assign position"}</button></div>
    </div>
  </ModalShell>
);

export default PositionManagement;
