/**
 * Admin Users Management Page — view, register, edit, and manage accounts.
 * Mobile-responsive with dedicated card layout on phones.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  Search,
  KeyRound,
  CheckCircle2,
  XCircle,
  X,
  Loader,
  RefreshCw,
  Mail,
  User as UserIcon,
} from "lucide-react";
import { authApi, teamApi, getApiError } from "@/services/api";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import type { User, Team } from "@/types";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { tournamentId } = useActiveTournament();

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states for creating new user
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"captain" | "admin">("captain");
  const [newTeamId, setNewTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form states for updating existing user
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editTeamId, setEditTeamId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch users
  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ["admin_users", roleFilter],
    queryFn: () =>
      authApi.listUsers(roleFilter === "all" ? undefined : roleFilter).then((r) => r.data),
  });

  // Fetch tournament teams for team assignment
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["admin_teams", tournamentId],
    queryFn: () => teamApi.list(tournamentId).then((r) => r.data),
    enabled: !!tournamentId,
  });

  // Create User Mutation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim() || !newPassword) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.register({
        username: newUsername.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        team_id: newRole === "captain" && newTeamId ? newTeamId : null,
      });
      toast.success(`User "${newUsername}" registered successfully!`);
      setShowCreateModal(false);
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("captain");
      setNewTeamId("");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditUser = (u: User) => {
    setEditingUser(u);
    setEditEmail(u.email || "");
    setEditPassword("");
    setEditIsActive(u.is_active);
    setEditTeamId(u.team_id || "");
  };

  // Save Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const payload: any = {
        email: editEmail.trim().toLowerCase(),
        is_active: editIsActive,
        team_id: editTeamId || null,
      };
      if (editPassword) {
        payload.password = editPassword;
      }
      await authApi.updateUser(editingUser.id, payload);
      toast.success(`User "${editingUser.username}" updated!`);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle User Active Status
  const toggleUserActive = async (u: User) => {
    try {
      await authApi.updateUser(u.id, { is_active: !u.is_active });
      toast.success(`User ${u.username} ${u.is_active ? "deactivated" : "activated"}`);
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const getTeamName = (tId: string | null | undefined) => {
    if (!tId) return null;
    const team = teams.find((t) => t.id === tId);
    return team ? team.name : "Assigned Team";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gradient flex items-center gap-3">
            <Users size={28} />
            Users & Accounts
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Register and manage system accounts for administrators and team captains
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => refetch()}
            title="Refresh list"
          >
            <RefreshCw size={14} />
          </button>
          <button
            id="register-user-btn"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <UserPlus size={16} />
            <span>Register User</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            className="input pl-10 text-sm py-2"
            placeholder="Search by username or email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Role Tabs */}
        <div
          className="flex items-center p-1 rounded-xl gap-1 self-start sm:self-auto"
          style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--color-border)" }}
        >
          <button
            onClick={() => setRoleFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              roleFilter === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter("captain")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              roleFilter === "captain" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Captains ({users.filter((u) => u.role === "captain").length})
          </button>
          <button
            onClick={() => setRoleFilter("admin")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              roleFilter === "admin" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Admins ({users.filter((u) => u.role === "admin").length})
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader size={24} className="spin mx-auto mb-3 text-blue-400" />
          <p className="text-sm text-slate-400">Loading registered users…</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <UserIcon size={36} className="mx-auto mb-3 text-slate-500" />
          <p className="font-semibold text-slate-300">No users found</p>
          <p className="text-xs text-slate-500 mt-1">
            {searchTerm ? "Try a different search query" : "Click 'Register User' above to create an account"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block glass-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr
                  className="border-b text-xs font-semibold text-slate-400 uppercase tracking-wider"
                  style={{ borderColor: "var(--color-border)", background: "rgba(255,255,255,0.02)" }}
                >
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Team</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                          style={{
                            background:
                              u.role === "admin"
                                ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                                : "linear-gradient(135deg, #3b82f6, #06b6d4)",
                          }}
                        >
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100">{u.username}</p>
                          <p className="text-xs text-slate-500">ID: {u.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{u.email || "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`badge ${
                          u.role === "admin" ? "badge-purple" : "badge-blue"
                        }`}
                      >
                        {u.role === "admin" ? "Admin" : "Captain"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getTeamName(u.team_id) ? (
                        <span className="badge badge-green">{getTeamName(u.team_id)}</span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleUserActive(u)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                        title="Click to toggle active status"
                      >
                        {u.is_active ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={14} /> Active
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <XCircle size={14} /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditUser(u)}
                        className="btn btn-ghost btn-xs text-blue-400 hover:text-blue-300"
                      >
                        Edit / Reset Pwd
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (Perfect for phone screens) */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map((u) => (
              <div key={u.id} className="glass-card-elevated p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shrink-0"
                      style={{
                        background:
                          u.role === "admin"
                            ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                            : "linear-gradient(135deg, #3b82f6, #06b6d4)",
                      }}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-100">{u.username}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">{u.email}</p>
                    </div>
                  </div>

                  <span
                    className={`badge ${
                      u.role === "admin" ? "badge-purple" : "badge-blue"
                    }`}
                  >
                    {u.role === "admin" ? "Admin" : "Captain"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-b border-white/5 text-xs text-slate-400 mb-3">
                  <div>
                    <span>Team: </span>
                    <span className="font-semibold text-slate-200">
                      {getTeamName(u.team_id) || "None"}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => toggleUserActive(u)}
                      className="flex items-center gap-1 font-semibold"
                    >
                      {u.is_active ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={13} /> Active
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <XCircle size={13} /> Inactive
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => openEditUser(u)}
                    className="btn btn-ghost btn-sm text-xs w-full justify-center"
                  >
                    <KeyRound size={13} />
                    Edit User / Password
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal: Register New User ── */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <UserPlus size={20} className="text-blue-400" />
                Register New User
              </h2>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="e.g. striker_captain"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  className="input text-sm"
                  placeholder="e.g. captain@flyhigh.internal"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  className="input text-sm"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account Role *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole("captain")}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 ${
                      newRole === "captain"
                        ? "border-blue-500 bg-blue-500/20 text-white"
                        : "border-slate-700 bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    <UserCheck size={14} /> Team Captain
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole("admin")}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 ${
                      newRole === "admin"
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-slate-700 bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    <Shield size={14} /> Admin
                  </button>
                </div>
              </div>

              {newRole === "captain" && teams.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign to Team
                  </label>
                  <select
                    className="input text-sm"
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                  >
                    <option value="">-- Unassigned (or select team) --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader size={14} className="spin" /> Registering…
                    </>
                  ) : (
                    "Register User"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit User / Reset Password ── */}
      {editingUser && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <KeyRound size={20} className="text-indigo-400" />
                Edit User: {editingUser.username}
              </h2>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setEditingUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  className="input text-sm"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password <span className="text-slate-500 font-normal">(Leave blank to keep unchanged)</span>
                </label>
                <input
                  type="password"
                  className="input text-sm"
                  placeholder="Enter new password to reset"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>

              {editingUser.role === "captain" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign to Team
                  </label>
                  <select
                    className="input text-sm"
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                  >
                    <option value="">-- No Team Assigned --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700"
                />
                <label htmlFor="edit-is-active" className="text-xs text-slate-300 font-medium">
                  Account is active (can sign in)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={() => setEditingUser(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <>
                      <Loader size={14} className="spin" /> Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
