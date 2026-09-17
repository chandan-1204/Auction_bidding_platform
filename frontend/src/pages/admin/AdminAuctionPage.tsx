/**
 * Admin Auction Control Page — the main auctioneer interface.
 *
 * Layout:
 * - Top bar: status + connection + controls
 * - Left: Current player card
 * - Center: Bid amount + timer
 * - Right: Action buttons
 * - Bottom: Team purse grid + bid history + player queue
 */
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Play,
  Pause,
  SkipForward,
  Hammer,
  XCircle,
  RotateCcw,
  Plus,
  CheckCircle,
  List,
  ChevronRight,
  Settings,
  RefreshCw,
  Loader,
} from "lucide-react";
import { auctionApi, playerApi, teamApi, tournamentApi, getApiError } from "@/services/api";
import { useAuctionState } from "@/hooks/useAuctionState";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import { useAuthStore } from "@/store/authStore";
import {
  ConnectionStatus,
  AuctionStateBadge,
  CurrentPlayerCard,
  BidHistoryList,
  TeamPurseCard,
  CountdownTimer,
  LoadingSpinner,
} from "@/components/AuctionComponents";
import type { Auction, Player, Team, Tournament } from "@/types";

export default function AdminAuctionPage() {
  const { tournamentId, setTournamentId } = useActiveTournament();
  const [auctionId, setAuctionId] = useState<string | null>(
    localStorage.getItem("flyhigh_auction_id")
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [bidTeamId, setBidTeamId] = useState<string>("");

  const { state, bids, connected, loading, secondsLeft, refetch } = useAuctionState({
    auctionId,
  });

  // Fetch tournaments
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: () => auctionApi.getActive("").then(() => []).catch(() => []),
    enabled: false,
  });

  // Fetch players
  const { data: players = [], refetch: refetchPlayers } = useQuery<Player[]>({
    queryKey: ["players", tournamentId],
    queryFn: () => playerApi.list(tournamentId!).then((r) => r.data),
    enabled: !!tournamentId,
  });

  // Fetch teams
  const { data: teamsData = [], refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ["teams", tournamentId],
    queryFn: () => teamApi.list(tournamentId!).then((r) => r.data),
    enabled: !!tournamentId,
  });

  useEffect(() => {
    setTeams(teamsData);
  }, [teamsData]);

  // Fetch active auction when tournamentId is set
  useEffect(() => {
    if (!tournamentId) return;
    auctionApi.getActive(tournamentId)
      .then((r) => {
        if (r.data) {
          setAuctionId(r.data.id);
          localStorage.setItem("flyhigh_auction_id", r.data.id);
        }
      })
      .catch(() => {});
  }, [tournamentId]);

  // Update teams from socket events
  useEffect(() => {
    if (teamsData.length > 0) setTeams(teamsData);
  }, [teamsData]);

  const doAction = useCallback(
    async (key: string, fn: () => Promise<any>, successMsg?: string) => {
      if (!auctionId) return;
      setActionLoading(key);
      try {
        await fn();
        if (successMsg) toast.success(successMsg);
        refetch();
        refetchTeams();
      } catch (err) {
        toast.error(getApiError(err));
      } finally {
        setActionLoading(null);
      }
    },
    [auctionId, refetch, refetchTeams]
  );

  const handleCreateAuction = async () => {
    if (!tournamentId) {
      toast.error("Please select a tournament first");
      return;
    }
    if (auctionId && !window.confirm("Start a new auction for this tournament? Current auction records will remain in history.")) {
      return;
    }
    setActionLoading("create");
    try {
      const res = await auctionApi.create({
        tournament_id: tournamentId,
        starting_purse: 5000,
        base_price: 500,
        bid_increment: 100,
        timer_seconds: 15,
        mode: "LIVE",
      });
      setAuctionId(res.data.id);
      localStorage.setItem("flyhigh_auction_id", res.data.id);
      toast.success("Auction created and ready!");
      refetch();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetPlayer = async (player: Player) => {
    if (!auctionId) return;
    setActionLoading(`player-${player.id}`);
    try {
      await auctionApi.setPlayer(auctionId, player.id);
      setSelectedPlayer(player);
      toast.success(`Now auctioning: ${player.name}`);
      refetch();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdminBid = async (increment: number) => {
    if (!state?.current_bid && !state?.current_player) return;
    const newAmount = (state?.current_bid ?? 0) + increment;
    await doAction(
      "bid",
      () => auctionApi.adminBid(auctionId!, newAmount, bidTeamId || undefined),
      `Bid raised to ₹${newAmount.toLocaleString("en-IN")}`
    );
  };

  const handleSoldClick = () => {
    if (state?.highest_bidder_team_id) {
      doAction("sold", () => auctionApi.markSold(auctionId!), `Player SOLD to ${state.highest_bidder_team_name}!`);
    } else {
      setShowSellModal(true);
    }
  };

  const handleSellToTeam = async (teamId: string, teamName: string) => {
    setShowSellModal(false);
    await doAction("sold", () => auctionApi.markSold(auctionId!, { team_id: teamId }), `Player SOLD to ${teamName}!`);
  };

  const availablePlayers = players.filter((p) => p.status === "AVAILABLE");
  const currentPlayer = state?.current_player ?? null;

  // No tournament setup
  if (!tournamentId) {
    return (
      <div className="p-8 fade-in">
        <SetupPanel onSetup={(tid, aid) => {
          setTournamentId(tid);
          if (aid) {
            setAuctionId(aid);
            localStorage.setItem("flyhigh_auction_id", aid);
          }
        }} />
      </div>
    );
  }

  return (
    <div className="p-6 fade-in" style={{ minHeight: "100vh" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-gradient">Live Auction</h1>
          {state && <AuctionStateBadge state={state.state} />}
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus connected={connected} />
          <button className="btn btn-ghost btn-sm" onClick={refetch} title="Refresh auction state">
            <RefreshCw size={14} />
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCreateAuction}
            disabled={actionLoading === "create"}
            title="Create or restart auction"
          >
            {actionLoading === "create" ? <Loader size={14} className="spin" /> : <Plus size={14} />}
            {auctionId ? "New Auction" : "Create Auction"}
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading auction state…" />
      ) : !auctionId ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color: "var(--color-text-muted)" }}>No active auction. Create one above.</p>
        </div>
      ) : (
        <>
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Left: Current Player */}
            <div className="lg:col-span-1">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
                CURRENT PLAYER
              </h2>
              <CurrentPlayerCard
                player={currentPlayer}
                currentBid={state?.current_bid ?? null}
                highestBidder={state?.highest_bidder_team_name ?? null}
                auctionState={state?.state ?? "READY"}
              />
            </div>

            {/* Center: Timer */}
            <div className="lg:col-span-1">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
                AUCTION TIMER
              </h2>
              <div className="glass-card-elevated p-6 flex flex-col items-center justify-center min-h-48">
                <CountdownTimer
                  timerEndAt={state?.timer_end_at ?? null}
                  timerSeconds={state?.timer_seconds ?? 15}
                  auctionState={state?.state ?? "READY"}
                />
                <div className="mt-6 text-center">
                  <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                    Min. next bid
                  </p>
                  <p className="text-xl font-bold" style={{ color: "var(--color-accent-glow)" }}>
                    ₹{((state?.current_bid ?? 0) + (state?.bid_increment ?? 100)).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="lg:col-span-1">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
                CONTROLS
              </h2>
              <div className="glass-card p-4 space-y-3">
                {/* Start/Pause/Resume */}
                {state?.state === "DRAFT" && (
                  <button
                    className="btn btn-success w-full"
                    id="start-auction-btn"
                    onClick={() => doAction("start", () => auctionApi.start(auctionId!), "Auction started!")}
                    disabled={!!actionLoading}
                  >
                    <Play size={16} />
                    START AUCTION
                  </button>
                )}
                {state?.state === "LIVE" && (
                  <button
                    className="btn btn-warning w-full"
                    id="pause-auction-btn"
                    onClick={() => doAction("pause", () => auctionApi.pause(auctionId!), "Auction paused")}
                    disabled={!!actionLoading}
                  >
                    <Pause size={16} />
                    PAUSE
                  </button>
                )}
                {state?.state === "PAUSED" && (
                  <button
                    className="btn btn-primary w-full"
                    id="resume-auction-btn"
                    onClick={() => doAction("resume", () => auctionApi.resume(auctionId!), "Auction resumed")}
                    disabled={!!actionLoading}
                  >
                    <Play size={16} />
                    RESUME
                  </button>
                )}

                <div className="divider" />

                {/* Bid increments */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                    RAISE BID
                  </p>
                  {teams.length > 0 && (
                    <select
                      value={bidTeamId}
                      onChange={(e) => setBidTeamId(e.target.value)}
                      className="text-xs bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 max-w-[130px] truncate"
                      title="Optionally select a team to bid on their behalf"
                    >
                      <option value="">Bidder: Any</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleAdminBid(100)}
                    disabled={state?.state !== "LIVE" || !!actionLoading}
                  >
                    +₹100
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleAdminBid(500)}
                    disabled={state?.state !== "LIVE" || !!actionLoading}
                  >
                    +₹500
                  </button>
                </div>

                {/* Undo */}
                <button
                  className="btn btn-ghost btn-sm w-full"
                  id="undo-bid-btn"
                  onClick={() => doAction("undo", () => auctionApi.undoBid(auctionId!), "Last bid undone")}
                  disabled={state?.state !== "LIVE" || !!actionLoading}
                >
                  <RotateCcw size={14} />
                  UNDO LAST BID
                </button>

                <div className="divider" />

                {/* Sold / Unsold */}
                <button
                  className="btn btn-success w-full"
                  id="sold-btn"
                  onClick={handleSoldClick}
                  disabled={!["LIVE", "PAUSED"].includes(state?.state ?? "") || !!actionLoading}
                >
                  <CheckCircle size={16} />
                  {state?.highest_bidder_team_name
                    ? `SOLD to ${state.highest_bidder_team_name}`
                    : "SOLD (Select Team)"}
                </button>
                {state?.highest_bidder_team_id && ["LIVE", "PAUSED"].includes(state?.state ?? "") && (
                  <button
                    type="button"
                    className="text-xs text-emerald-400 hover:underline text-center w-full block py-0.5"
                    onClick={() => setShowSellModal(true)}
                  >
                    Sell to another team…
                  </button>
                )}
                <button
                  className="btn btn-danger w-full"
                  id="unsold-btn"
                  onClick={() => doAction("unsold", () => auctionApi.markUnsold(auctionId!), "Player marked unsold")}
                  disabled={!["LIVE", "PAUSED"].includes(state?.state ?? "") || !!actionLoading}
                >
                  <XCircle size={16} />
                  UNSOLD
                </button>

                {/* Next player */}
                {["SOLD", "UNSOLD"].includes(state?.state ?? "") && (
                  <button
                    className="btn btn-primary w-full"
                    id="next-player-btn"
                    onClick={() => doAction("next", () => auctionApi.nextPlayer(auctionId!), "Ready for next player")}
                    disabled={!!actionLoading}
                  >
                    <SkipForward size={16} />
                    NEXT PLAYER
                  </button>
                )}

                {/* Complete */}
                {state?.state === "READY" && availablePlayers.length === 0 && (
                  <button
                    className="btn btn-danger w-full"
                    onClick={() => doAction("complete", () => auctionApi.complete(auctionId!), "Auction completed!")}
                    disabled={!!actionLoading}
                  >
                    <Hammer size={16} />
                    COMPLETE AUCTION
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Team Purses */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
              TEAM PURSES
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <TeamPurseCard
                  key={team.id}
                  team={team}
                  isHighestBidder={team.id === state?.highest_bidder_team_id}
                />
              ))}
            </div>
          </div>

          {/* Bottom: Bid History + Player Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bid History */}
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
                RECENT BIDS
              </h2>
              <div className="glass-card p-4">
                <BidHistoryList bids={bids} />
              </div>
            </div>

            {/* Player Queue */}
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
                <List size={14} />
                PLAYER QUEUE ({availablePlayers.length} available)
              </h2>
              <div className="glass-card p-4 space-y-2 max-h-72 overflow-y-auto">
                {availablePlayers.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                    All players have been auctioned
                  </p>
                ) : (
                  availablePlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleSetPlayer(player)}
                      disabled={state?.state !== "READY" && state?.state !== "LIVE" || !!actionLoading}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid transparent",
                        cursor: state?.state === "READY" ? "pointer" : "default",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)";
                        (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                      }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0"
                        style={{
                          width: 32,
                          height: 32,
                          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                          color: "white",
                        }}
                      >
                        {player.auction_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{player.name}</p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {player.category} • ₹{player.base_price}
                        </p>
                      </div>
                      {(state?.state === "READY" || state?.state === "LIVE") && (
                        <ChevronRight size={14} style={{ color: "var(--color-text-muted)" }} />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL: SELECT WINNING TEAM TO SELL ────────────────────────────────── */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated max-w-md w-full p-6 border border-emerald-500/40 shadow-2xl fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle size={20} />
                <h3 className="text-lg font-black tracking-wide">Select Winning Team</h3>
              </div>
              <button
                onClick={() => setShowSellModal(false)}
                className="btn btn-ghost btn-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
              <p className="text-xs text-slate-300">Selling player:</p>
              <p className="text-base font-bold text-white">{currentPlayer?.name}</p>
              <p className="text-xs text-emerald-400 font-semibold mt-1">
                Final Sold Price: ₹{(state?.current_bid ?? currentPlayer?.base_price ?? 0).toLocaleString("en-IN")}
              </p>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Click a team to finalize the sale:
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {teams.map((t) => {
                const remaining = t.total_purse - t.spent_amount;
                const canAfford = remaining >= (state?.current_bid ?? currentPlayer?.base_price ?? 0);
                return (
                  <button
                    key={t.id}
                    disabled={!canAfford || !!actionLoading}
                    onClick={() => handleSellToTeam(t.id, t.name)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      canAfford
                        ? "bg-slate-900/60 hover:bg-emerald-950/40 border-slate-700 hover:border-emerald-500/60 cursor-pointer"
                        : "opacity-40 bg-slate-900/20 border-slate-800 cursor-not-allowed"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-xs text-slate-400">
                        Remaining Purse: ₹{remaining.toLocaleString("en-IN")}
                      </p>
                    </div>
                    {canAfford ? (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded">
                        Sell to Team
                      </span>
                    ) : (
                      <span className="text-xs text-red-400 font-semibold">
                        Over Budget
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Setup Panel ───────────────────────────────────────────────────────────────
function SetupPanel({ onSetup }: { onSetup: (tid: string, aid: string | null) => void }) {
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    tournamentApi.list().then((r) => setTournaments(r.data)).catch(() => {});
  }, []);

  const handleSelect = async (tid: string) => {
    setLoading(true);
    try {
      const res = await auctionApi.getActive(tid);
      onSetup(tid, res.data?.id ?? null);
    } catch {
      onSetup(tid, null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto text-center">
      <h2 className="text-3xl font-black mb-4 text-gradient">Select Tournament</h2>
      <p className="mb-6" style={{ color: "var(--color-text-muted)" }}>
        Choose a tournament to manage the live auction
      </p>
      <div className="space-y-3">
        {tournaments.map((t) => (
          <button
            key={t.id}
            className="btn btn-primary btn-lg w-full"
            onClick={() => handleSelect(t.id)}
            disabled={loading}
          >
            {t.name}
          </button>
        ))}
        {tournaments.length === 0 && !loading && (
          <p style={{ color: "var(--color-text-muted)" }}>
            No tournaments found. Seed the database first.
          </p>
        )}
      </div>
    </div>
  );
}
