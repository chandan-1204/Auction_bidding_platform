/**
 * Captain Dashboard — mobile-first live auction bidding interface.
 *
 * Mobile-optimized layout showing:
 * - Team name, purse, spent, reserved
 * - Current player (name, category, photo)
 * - Current bid and highest bidder
 * - Countdown timer
 * - Large BID button (fixed at bottom)
 * - Purchased players list
 */
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Wallet,
  TrendingUp,
  Clock,
  Zap,
  LogOut,
  User,
  Trophy,
  AlertCircle,
  Loader,
  RefreshCw,
} from "lucide-react";
import { auctionApi, teamApi, getApiError } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { useAuctionState } from "@/hooks/useAuctionState";
import {
  ConnectionStatus,
  AuctionStateBadge,
  PlayerAvatar,
  CountdownTimer,
  LoadingSpinner,
} from "@/components/AuctionComponents";
import type { Team, TeamWithRoster } from "@/types";

const TOURNAMENT_KEY = "flyhigh_tournament_id";

export default function CaptainDashboard() {
  const { user, teamId, logout } = useAuth();
  const tournamentId = localStorage.getItem(TOURNAMENT_KEY);
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [bidLoading, setBidLoading] = useState(false);
  const [lastBidError, setLastBidError] = useState<string | null>(null);
  const [justBid, setJustBid] = useState(false);

  const { state, bids, connected, loading, secondsLeft, refetch } = useAuctionState({ auctionId });

  // Fetch team data
  const { data: team, refetch: refetchTeam } = useQuery<TeamWithRoster>({
    queryKey: ["team", teamId],
    queryFn: () => teamApi.get(teamId!).then((r) => r.data),
    enabled: !!teamId,
    refetchInterval: 5000,
  });

  // Find active auction
  useEffect(() => {
    const tid = tournamentId;
    if (!tid) return;
    auctionApi.getActive(tid)
      .then((r) => { if (r.data) setAuctionId(r.data.id); })
      .catch(() => {});
  }, [tournamentId]);

  // Refresh team after auction events
  useEffect(() => {
    refetchTeam();
  }, [state?.state, refetchTeam]);

  const isHighestBidder = state?.highest_bidder_team_id === teamId;
  const isLive = state?.state === "LIVE";
  const isPaused = state?.state === "PAUSED";
  const nextBid = (state?.current_bid ?? 0) + (state?.bid_increment ?? 100);

  const canBid =
    isLive &&
    !isHighestBidder &&
    !!auctionId &&
    !!state?.current_player &&
    (team?.available_purse ?? 0) >= nextBid;

  const handleBid = useCallback(async () => {
    if (!auctionId || !canBid) return;
    setBidLoading(true);
    setLastBidError(null);
    try {
      await auctionApi.placeBid(auctionId, nextBid);
      setJustBid(true);
      setTimeout(() => setJustBid(false), 2000);
      toast.success(`Bid placed: ₹${nextBid.toLocaleString("en-IN")}`);
      refetchTeam();
      refetch();
    } catch (err) {
      const msg = getApiError(err);
      setLastBidError(msg);
      toast.error(msg);
    } finally {
      setBidLoading(false);
    }
  }, [auctionId, canBid, nextBid, refetch, refetchTeam]);

  const getBidButtonText = () => {
    if (bidLoading) return "Placing Bid…";
    if (!isLive && !isPaused) return "Auction Not Live";
    if (isPaused) return "Auction Paused";
    if (isHighestBidder) return "You're the Highest Bidder!";
    if (!state?.current_player) return "Waiting for Next Player";
    if ((team?.available_purse ?? 0) < nextBid) return "Insufficient Purse";
    return `BID ₹${nextBid.toLocaleString("en-IN")}`;
  };

  const getButtonClass = () => {
    if (isHighestBidder) return "btn-success";
    if (!canBid) return "btn-ghost";
    return "btn-primary";
  };

  if (!tournamentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card-elevated p-8 text-center max-w-sm">
          <AlertCircle size={48} style={{ color: "var(--color-warning)", margin: "0 auto 16px" }} />
          <h2 className="text-xl font-bold mb-2">No Tournament Found</h2>
          <p style={{ color: "var(--color-text-muted)" }}>
            The auctioneer hasn't set up the tournament yet. Please wait.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between py-4 sticky top-0 z-30"
        style={{
          background: "rgba(10, 14, 26, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-border)",
          margin: "0 -16px",
          padding: "12px 16px",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl font-black text-lg"
            style={{ width: 40, height: 40, background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white" }}
          >
            {team?.name?.charAt(0) ?? user?.username?.charAt(0) ?? "C"}
          </div>
          <div>
            <p className="font-black text-sm">{team?.name ?? user?.username}</p>
            <ConnectionStatus connected={connected} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={refetch}><RefreshCw size={13} /></button>
          <button className="btn btn-ghost btn-sm" onClick={logout}><LogOut size={13} /></button>
        </div>
      </div>

      <div className="pt-4 space-y-4 fade-in">
        {/* Purse Card */}
        {team && (
          <div className="glass-card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} style={{ color: "var(--color-accent)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
                Team Purse
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-black" style={{ color: "#10b981" }}>
                  ₹{team.available_purse.toLocaleString("en-IN")}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Available</p>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: "#ef4444" }}>
                  ₹{team.spent_amount.toLocaleString("en-IN")}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Spent</p>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: "#f59e0b" }}>
                  ₹{team.reserved_amount.toLocaleString("en-IN")}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reserved</p>
              </div>
            </div>
            {/* Purse bar */}
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (team.available_purse / team.total_purse) * 100)}%`,
                  background: "linear-gradient(90deg, #10b981, #34d399)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Auction State */}
        {state && (
          <div className="flex items-center justify-between glass-card px-4 py-3">
            <AuctionStateBadge state={state.state} />
            {state.state === "LIVE" && (
              <CountdownTimer
                timerEndAt={state.timer_end_at}
                timerSeconds={state.timer_seconds}
                auctionState={state.state}
              />
            )}
          </div>
        )}

        {/* Current Player */}
        {state?.current_player ? (
          <div
            className="glass-card-elevated p-5 text-center relative overflow-hidden"
            style={
              state.state === "SOLD"
                ? { borderColor: "rgba(16,185,129,0.4)" }
                : state.state === "UNSOLD"
                ? { borderColor: "rgba(239,68,68,0.3)" }
                : {}
            }
          >
            {/* SOLD overlay */}
            {state.state === "SOLD" && (
              <div
                className="absolute inset-0 flex items-center justify-center sold-overlay"
                style={{ background: "rgba(16,185,129,0.08)", zIndex: 10, pointerEvents: "none" }}
              >
                <span className="text-5xl font-black" style={{ color: "#10b981", textShadow: "0 0 30px #10b981" }}>
                  SOLD!
                </span>
              </div>
            )}
            {state.state === "UNSOLD" && (
              <div
                className="absolute inset-0 flex items-center justify-center sold-overlay"
                style={{ background: "rgba(239,68,68,0.08)", zIndex: 10, pointerEvents: "none" }}
              >
                <span className="text-5xl font-black" style={{ color: "#ef4444" }}>UNSOLD</span>
              </div>
            )}

            <div className="flex justify-center mb-3">
              <PlayerAvatar player={state.current_player} size="normal" />
            </div>
            <h2 className="text-2xl font-black mb-2">{state.current_player.name}</h2>
            <div className="flex justify-center gap-2 mb-4 flex-wrap">
              {state.current_player.category && (
                <span className="badge badge-blue">{state.current_player.category}</span>
              )}
              {state.current_player.age_group && (
                <span className="badge badge-purple">{state.current_player.age_group}</span>
              )}
            </div>

            {/* Current Bid */}
            <div className="bid-amount-display mb-2">
              ₹{(state.current_bid ?? state.current_player.base_price).toLocaleString("en-IN")}
            </div>

            {state.highest_bidder_team_name && (
              <div className="flex items-center justify-center gap-2">
                <TrendingUp size={14} style={{ color: isHighestBidder ? "#10b981" : "#94a3b8" }} />
                <span
                  className="text-sm font-semibold"
                  style={{ color: isHighestBidder ? "#10b981" : "var(--color-text-muted)" }}
                >
                  {isHighestBidder ? "YOU are leading!" : state.highest_bidder_team_name}
                </span>
              </div>
            )}

            {!state.highest_bidder_team_name && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No bids yet — base price ₹{state.current_player.base_price}
              </p>
            )}
          </div>
        ) : (
          <div className="glass-card-elevated p-8 text-center">
            {loading ? (
              <LoadingSpinner message="Connecting to auction…" />
            ) : (
              <>
                <Zap size={48} style={{ color: "var(--color-text-muted)", opacity: 0.4, margin: "0 auto 12px" }} />
                <p style={{ color: "var(--color-text-muted)" }}>
                  {state?.state === "COMPLETED"
                    ? "Auction completed!"
                    : "Waiting for next player…"}
                </p>
              </>
            )}
          </div>
        )}

        {/* Error message */}
        {lastBidError && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl text-sm"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
          >
            <AlertCircle size={14} />
            {lastBidError}
          </div>
        )}

        {/* Purchased Players */}
        {team && team.roster_entries && team.roster_entries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} style={{ color: "#f59e0b" }} />
              <h3 className="text-sm font-semibold">
                My Players ({team.roster_entries.length})
              </h3>
            </div>
            <div className="space-y-2">
              {team.roster_entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center rounded-full text-sm font-bold"
                      style={{ width: 32, height: 32, background: "linear-gradient(135deg, #10b981, #059669)", color: "white" }}
                    >
                      {entry.player?.name?.charAt(0) ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{entry.player?.name ?? "Player"}</p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {entry.player?.category}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#10b981" }}>
                    ₹{entry.sold_price.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed BID button */}
      <div className="bid-button-mobile">
        <button
          id="captain-bid-btn"
          className={`btn ${getButtonClass()} btn-xl w-full`}
          onClick={handleBid}
          disabled={!canBid || bidLoading}
          style={
            isHighestBidder
              ? { cursor: "default" }
              : canBid
              ? { boxShadow: "0 8px 32px rgba(59,130,246,0.5)" }
              : {}
          }
          aria-label={getBidButtonText()}
        >
          {bidLoading ? (
            <Loader size={20} className="spin" />
          ) : isHighestBidder ? (
            <TrendingUp size={20} />
          ) : (
            <Zap size={20} />
          )}
          {getBidButtonText()}
        </button>
      </div>
    </div>
  );
}
