/**
 * Shared UI Components — Player card, timer, bid list, connection status, etc.
 */
import { Clock, Wifi, WifiOff, TrendingUp, User as UserIcon } from "lucide-react";
import type { AuctionStateOut, Bid, Player, Team } from "@/types";
import { getRemainingSeconds } from "@/services/socket";

// ── Connection Status Indicator ──────────────────────────────────────────────
export function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`connection-dot ${connected ? "connected" : "disconnected"}`} />
      <span className="text-xs font-medium" style={{ color: connected ? "#10b981" : "#ef4444" }}>
        {connected ? "Live" : "Reconnecting…"}
      </span>
      {connected ? (
        <Wifi size={14} style={{ color: "#10b981" }} />
      ) : (
        <WifiOff size={14} style={{ color: "#ef4444" }} />
      )}
    </div>
  );
}

// ── Auction State Badge ───────────────────────────────────────────────────────
export function AuctionStateBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "badge-gray" },
    READY: { label: "Ready", className: "badge-blue" },
    LIVE: { label: "🔴 LIVE", className: "badge-red" },
    PAUSED: { label: "⏸ Paused", className: "badge-yellow" },
    SOLD: { label: "✅ Sold", className: "badge-green" },
    UNSOLD: { label: "❌ Unsold", className: "badge-gray" },
    COMPLETED: { label: "🏆 Completed", className: "badge-purple" },
  };
  const { label, className } = config[state] ?? { label: state, className: "badge-gray" };
  return <span className={`badge ${className}`}>{label}</span>;
}

// ── Player Avatar ─────────────────────────────────────────────────────────────
export function PlayerAvatar({
  player,
  size = "normal",
}: {
  player: Player | null;
  size?: "normal" | "large";
}) {
  if (!player) return null;
  const initial = player.name?.charAt(0).toUpperCase() ?? "?";
  const cls = size === "large" ? "player-avatar-lg" : "player-avatar";

  if (player.photo_url) {
    return (
      <img
        src={player.photo_url}
        alt={player.name}
        className={size === "large" ? "player-photo-lg" : "player-photo"}
      />
    );
  }
  return <div className={cls}>{initial}</div>;
}

// ── Countdown Timer ───────────────────────────────────────────────────────────
export function CountdownTimer({
  timerEndAt,
  timerSeconds,
  auctionState,
}: {
  timerEndAt: string | null;
  timerSeconds: number;
  auctionState: string;
}) {
  const secs = getRemainingSeconds(timerEndAt);
  const isCritical = secs <= 5 && secs > 0 && auctionState === "LIVE";
  const isPaused = auctionState === "PAUSED";

  const display = isPaused
    ? "⏸"
    : auctionState !== "LIVE"
    ? "--"
    : String(secs).padStart(2, "0");

  const color = isCritical
    ? "var(--color-danger)"
    : isPaused
    ? "var(--color-warning)"
    : "var(--color-accent-glow)";

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={16} style={{ color: "var(--color-text-muted)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
          Timer
        </span>
      </div>
      <span
        className={`timer-display ${isCritical ? "timer-critical" : ""}`}
        style={{ color }}
        aria-label={`${secs} seconds remaining`}
      >
        {display}
      </span>
      {auctionState === "LIVE" && (
        <div
          className="mt-2 h-1 rounded-full overflow-hidden"
          style={{ width: 80, background: "rgba(255,255,255,0.1)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (secs / timerSeconds) * 100)}%`,
              background: isCritical ? "var(--color-danger)" : "var(--color-accent)",
              transition: "width 0.5s linear",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Current Player Card ────────────────────────────────────────────────────────
export function CurrentPlayerCard({
  player,
  currentBid,
  highestBidder,
  auctionState,
}: {
  player: Player | null;
  currentBid: number | null;
  highestBidder: string | null;
  auctionState: string;
}) {
  if (!player) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center min-h-48">
        <UserIcon size={48} style={{ color: "var(--color-text-muted)", opacity: 0.4 }} />
        <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
          No player selected
        </p>
      </div>
    );
  }

  const isSold = auctionState === "SOLD";
  const isUnsold = auctionState === "UNSOLD";

  return (
    <div
      className="glass-card-elevated p-6 relative overflow-hidden"
      style={
        isSold
          ? { borderColor: "rgba(16,185,129,0.4)" }
          : isUnsold
          ? { borderColor: "rgba(239,68,68,0.3)" }
          : {}
      }
    >
      {/* SOLD/UNSOLD overlay */}
      {(isSold || isUnsold) && (
        <div
          className="absolute inset-0 flex items-center justify-center sold-overlay"
          style={{
            background: isSold
              ? "rgba(16,185,129,0.08)"
              : "rgba(239,68,68,0.08)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span
            className="text-6xl font-black"
            style={{
              color: isSold ? "#10b981" : "#ef4444",
              textShadow: `0 0 30px ${isSold ? "#10b981" : "#ef4444"}`,
              letterSpacing: 4,
            }}
          >
            {isSold ? "SOLD!" : "UNSOLD"}
          </span>
        </div>
      )}

      <div className="flex items-center gap-5">
        <PlayerAvatar player={player} />
        <div className="flex-1 min-w-0">
          <h3 className="text-2xl font-black truncate">{player.name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {player.category && (
              <span className="badge badge-blue">{player.category}</span>
            )}
            {player.age_group && (
              <span className="badge badge-purple">{player.age_group}</span>
            )}
            {player.skill_level && player.skill_level !== player.category && (
              <span className="badge badge-gray">{player.skill_level}</span>
            )}
          </div>
          <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
            Base price:{" "}
            <span className="font-bold" style={{ color: "var(--color-text)" }}>
              ₹{player.base_price.toLocaleString("en-IN")}
            </span>
          </p>
        </div>
      </div>

      {currentBid !== null && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="bid-amount-display text-center">
            ₹{currentBid.toLocaleString("en-IN")}
          </div>
          {highestBidder && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <TrendingUp size={14} style={{ color: "#10b981" }} />
              <span className="text-sm font-semibold" style={{ color: "#10b981" }}>
                {highestBidder}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bid History List ──────────────────────────────────────────────────────────
export function BidHistoryList({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) {
    return (
      <div className="text-center py-6" style={{ color: "var(--color-text-muted)" }}>
        <p className="text-sm">No bids yet</p>
      </div>
    );
  }
  return (
    <div className="bid-history space-y-2">
      {bids.map((bid, i) => (
        <div
          key={bid.id}
          className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? "bid-glow-enter" : ""}`}
          style={{
            background: i === 0
              ? "rgba(59,130,246,0.08)"
              : "rgba(255,255,255,0.02)",
            border: `1px solid ${i === 0 ? "rgba(59,130,246,0.2)" : "transparent"}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full text-xs font-bold"
              style={{
                width: 28,
                height: 28,
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                color: "white",
              }}
            >
              {bid.team_name?.charAt(0) ?? "?"}
            </div>
            <div>
              <p className="text-sm font-semibold">{bid.team_name ?? bid.team_id.slice(0, 8)}</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                #{bid.sequence_number}
              </p>
            </div>
          </div>
          <span className="font-bold text-sm" style={{ color: "#fbbf24" }}>
            ₹{bid.amount.toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Team Purse Cards ──────────────────────────────────────────────────────────
export function TeamPurseCard({
  team,
  isHighestBidder,
}: {
  team: Team;
  isHighestBidder: boolean;
}) {
  const pct = team.total_purse > 0
    ? ((team.available_purse / team.total_purse) * 100).toFixed(0)
    : "0";

  return (
    <div
      className="stat-card"
      style={
        isHighestBidder
          ? { borderColor: "rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.05)" }
          : {}
      }
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg text-xs font-black"
            style={{
              width: 32,
              height: 32,
              background: isHighestBidder
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: "white",
            }}
          >
            {team.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-bold truncate max-w-24">{team.name}</p>
            {isHighestBidder && (
              <span className="badge badge-green text-xs">Highest Bidder</span>
            )}
          </div>
        </div>
        <span className="text-lg font-black" style={{ color: "#fbbf24" }}>
          ₹{team.available_purse.toLocaleString("en-IN")}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.1)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: isHighestBidder
              ? "linear-gradient(90deg, #10b981, #34d399)"
              : "linear-gradient(90deg, #3b82f6, #6366f1)",
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Spent: ₹{team.spent_amount.toLocaleString("en-IN")}
        </span>
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {pct}% left
        </span>
      </div>
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────────────────────────
export function LoadingSpinner({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-48 gap-4">
      <div className="loader" />
      <p style={{ color: "var(--color-text-muted)" }}>{message}</p>
    </div>
  );
}
