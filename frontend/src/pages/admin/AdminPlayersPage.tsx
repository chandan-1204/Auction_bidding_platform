/**
 * Admin Players Management page — full CRUD with photo upload, CSV import/export.
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  Trash2,
  Image,
  X,
  Check,
  Loader,
} from "lucide-react";
import { playerApi, teamApi, getApiError, downloadBlob } from "@/services/api";
import { auctionApi } from "@/services/api";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import type { Player, Tournament } from "@/types";
import { AuctionStateBadge, LoadingSpinner } from "@/components/AuctionComponents";

export default function AdminPlayersPage() {
  const { tournamentId } = useActiveTournament();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Player> & { tournament_id?: string }>({});
  const csvInputRef = useRef<HTMLInputElement>(null);

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ["players", tournamentId, statusFilter],
    queryFn: () =>
      playerApi.list(tournamentId, statusFilter || undefined).then((r) => r.data),
    enabled: !!tournamentId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playerApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success("Player deleted");
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPlayer) {
        return playerApi.update(editingPlayer.id, data);
      } else {
        return playerApi.create({ ...data, tournament_id: tournamentId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success(editingPlayer ? "Player updated" : "Player created");
      setEditingPlayer(null);
      setShowAddForm(false);
      setFormData({});
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const handlePhotoUpload = async (player: Player, file: File) => {
    try {
      await playerApi.uploadPhoto(player.id, file);
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await playerApi.exportCsv(tournamentId);
      downloadBlob(res.data, "players.csv");
      toast.success("CSV exported");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await playerApi.importCsv(tournamentId, file);
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success(`Imported ${res.data.length} players`);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    AVAILABLE: "badge-blue",
    LIVE: "badge-red",
    SOLD: "badge-green",
    UNSOLD: "badge-gray",
    UPCOMING: "badge-yellow",
    SKIPPED: "badge-gray",
  };

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gradient">Player Management</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {filtered.length} of {players.length} players
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={handleExportCsv}>
            <Download size={14} />
            Export CSV
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => csvInputRef.current?.click()}
          >
            <Upload size={14} />
            Import CSV
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            hidden
            onChange={handleImportCsv}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowAddForm(true); setFormData({}); setEditingPlayer(null); }}
          >
            <Plus size={14} />
            Add Player
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            className="input"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "38px" }}
          />
        </div>
        <select
          className="input"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="SOLD">Sold</option>
          <option value="UNSOLD">Unsold</option>
          <option value="LIVE">Live</option>
        </select>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingPlayer) && (
        <PlayerForm
          initial={editingPlayer ?? formData}
          loading={saveMutation.isPending}
          onSave={(data) => saveMutation.mutate(data)}
          onCancel={() => { setShowAddForm(false); setEditingPlayer(null); setFormData({}); }}
        />
      )}

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["#", "Photo", "Name", "Category", "Age Group", "Base Price", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left p-4 text-xs font-semibold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((player) => (
                <tr
                  key={player.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {player.auction_order}
                  </td>
                  <td className="p-4">
                    <PlayerPhotoCell player={player} onUpload={handlePhotoUpload} />
                  </td>
                  <td className="p-4 font-semibold text-sm">{player.name}</td>
                  <td className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {player.category ?? "—"}
                  </td>
                  <td className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {player.age_group ?? "—"}
                  </td>
                  <td className="p-4 text-sm font-semibold">
                    ₹{player.base_price.toLocaleString("en-IN")}
                  </td>
                  <td className="p-4">
                    <span className={`badge ${statusColor[player.status] ?? "badge-gray"}`}>
                      {player.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditingPlayer(player); setShowAddForm(false); }}
                        aria-label={`Edit ${player.name}`}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm(`Delete ${player.name}?`)) {
                            deleteMutation.mutate(player.id);
                          }
                        }}
                        aria-label={`Delete ${player.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: "var(--color-text-muted)" }}>
              No players found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Photo Cell ─────────────────────────────────────────────────────────────
function PlayerPhotoCell({
  player,
  onUpload,
}: {
  player: Player;
  onUpload: (player: Player, file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative group cursor-pointer"
      style={{ width: 40, height: 40 }}
      onClick={() => ref.current?.click()}
      title="Click to upload photo"
    >
      {player.photo_url ? (
        <img
          src={player.photo_url}
          alt={player.name}
          className="rounded-full object-cover"
          style={{ width: 40, height: 40 }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-sm font-bold"
          style={{
            width: 40,
            height: 40,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: "white",
          }}
        >
          {player.name.charAt(0)}
        </div>
      )}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <Image size={14} color="white" />
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(player, file);
        }}
      />
    </div>
  );
}

// ── Player Form ───────────────────────────────────────────────────────────
function PlayerForm({
  initial,
  loading,
  onSave,
  onCancel,
}: {
  initial: Partial<Player>;
  loading: boolean;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    age_group: initial.age_group ?? "",
    category: initial.category ?? "",
    skill_level: initial.skill_level ?? "",
    base_price: initial.base_price ?? 500,
    auction_order: initial.auction_order ?? 0,
    gender: initial.gender ?? "",
    notes: initial.notes ?? "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="glass-card-elevated p-6 mb-6 slide-in-right">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">{initial.name ? `Edit: ${initial.name}` : "Add New Player"}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Name *</label>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Player name" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Category</label>
          <input className="input" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Intermediate" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Age Group</label>
          <input className="input" value={form.age_group} onChange={(e) => set("age_group", e.target.value)} placeholder="e.g. 30+" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Skill Level</label>
          <input className="input" value={form.skill_level} onChange={(e) => set("skill_level", e.target.value)} placeholder="e.g. Beginner+" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Base Price (₹)</label>
          <input className="input" type="number" value={form.base_price} onChange={(e) => set("base_price", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Auction Order</label>
          <input className="input" type="number" value={form.auction_order} onChange={(e) => set("auction_order", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-muted)" }}>Gender</label>
          <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
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
          {initial.name ? "Save Changes" : "Add Player"}
        </button>
      </div>
    </div>
  );
}
