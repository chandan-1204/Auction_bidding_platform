/**
 * Admin Teams Management page.
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Plus, Edit2, Trash2, Users, Wallet, Check, X, Loader, ChevronDown, ChevronUp,
} from "lucide-react";
import { teamApi, getApiError } from "@/services/api";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import type { Team, TeamWithRoster } from "@/types";
import { LoadingSpinner } from "@/components/AuctionComponents";

export default function AdminTeamsPage() {
  const { tournamentId } = useActiveTournament();
  const queryClient = useQueryClient();
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["teams", tournamentId],
    queryFn: () => teamApi.list(tournamentId).then((r) => r.data),
    enabled: !!tournamentId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); toast.success("Team deleted"); },
    onError: (err) => toast.error(getApiError(err)),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingTeam) return teamApi.update(editingTeam.id, data);
      return teamApi.create({ ...data, tournament_id: tournamentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success(editingTeam ? "Team updated" : "Team created");
      setEditingTeam(null);
      setShowAddForm(false);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  if (!tournamentId) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "var(--color-text-muted)" }}>
          Please select a tournament from the auction page first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gradient">Team Management</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {teams.length} teams registered
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setShowAddForm(true); setEditingTeam(null); }}
        >
          <Plus size={14} /> Add Team
        </button>
      </div>

      {(showAddForm || editingTeam) && (
        <TeamForm
          initial={editingTeam}
          loading={saveMutation.isPending}
          onSave={(d) => saveMutation.mutate(d)}
          onCancel={() => { setShowAddForm(false); setEditingTeam(null); }}
        />
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              expanded={expandedTeam === team.id}
              onExpand={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
              onEdit={() => { setEditingTeam(team); setShowAddForm(false); }}
              onDelete={() => { if (confirm(`Delete ${team.name}?`)) deleteMutation.mutate(team.id); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team, expanded, onExpand, onEdit, onDelete,
}: {
  team: Team;
  expanded: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pct = team.total_purse > 0
    ? ((team.available_purse / team.total_purse) * 100).toFixed(0)
    : "0";

  return (
    <div className="glass-card-elevated p-5">
      <div className="flex items-center gap-4 mb-4">
        <div
          className="flex items-center justify-center rounded-2xl text-2xl font-black flex-shrink-0"
          style={{
            width: 56,
            height: 56,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: "white",
            boxShadow: "0 0 20px rgba(59,130,246,0.3)",
          }}
        >
          {team.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-lg truncate">{team.name}</h3>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {team.captain_name ?? "No captain set"}
          </p>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-ghost btn-sm" onClick={onEdit} aria-label="Edit team">
            <Edit2 size={13} />
          </button>
          <button className="btn btn-danger btn-sm" onClick={onDelete} aria-label="Delete team">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Purse breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span style={{ color: "var(--color-text-muted)" }}>Total Purse</span>
          <span className="font-bold">₹{team.total_purse.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "var(--color-text-muted)" }}>Spent</span>
          <span style={{ color: "#ef4444" }}>₹{team.spent_amount.toLocaleString("en-IN")}</span>
        </div>
        {team.reserved_amount > 0 && (
          <div className="flex justify-between">
            <span style={{ color: "var(--color-text-muted)" }}>Reserved</span>
            <span style={{ color: "#f59e0b" }}>₹{team.reserved_amount.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Available</span>
          <span style={{ color: "#10b981" }}>₹{team.available_purse.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Bar */}
      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #10b981, #34d399)",
          }}
        />
      </div>
      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
        {pct}% remaining · {team.captain_username ?? "no captain username"}
      </p>
    </div>
  );
}

function TeamForm({
  initial,
  loading,
  onSave,
  onCancel,
}: {
  initial: Team | null;
  loading: boolean;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    captain_name: initial?.captain_name ?? "",
    captain_username: initial?.captain_username ?? "",
    total_purse: initial?.total_purse ?? 5000,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="glass-card-elevated p-6 mb-6 slide-in-right">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">{initial ? `Edit: ${initial.name}` : "Add New Team"}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}><X size={14} /></button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Team Name *</label>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. TEAM BLAZE" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Captain Name</label>
          <input className="input" value={form.captain_name} onChange={(e) => set("captain_name", e.target.value)} placeholder="Captain's display name" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Captain Username</label>
          <input className="input" value={form.captain_username} onChange={(e) => set("captain_username", e.target.value)} placeholder="Login username" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Total Purse (₹)</label>
          <input className="input" type="number" value={form.total_purse} onChange={(e) => set("total_purse", Number(e.target.value))} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || loading}
        >
          {loading ? <Loader size={14} className="spin" /> : <Check size={14} />}
          {initial ? "Save Changes" : "Add Team"}
        </button>
      </div>
    </div>
  );
}
