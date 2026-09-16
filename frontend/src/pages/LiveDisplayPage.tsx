/**
 * LiveDisplayPage — Big-Screen / TV / Projector Display for the Auction Hall.
 *
 * Designed specifically for large monitors and 4K/1080p projectors:
 * - High-contrast stadium aesthetic
 * - Massive typography visible across a large room
 * - Real-time Socket.IO synchronization
 * - Giant animated countdown timer
 * - Live team purse ribbons
 * - Dramatic SOLD / UNSOLD celebrations
 * - Fullscreen toggle for clean presentation
 */
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Radio,
  Maximize,
  Minimize,
  Users,
  Flame,
  Clock,
  Sparkles,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { auctionApi, teamApi, tournamentApi } from "@/services/api";
import { useAuctionState } from "@/hooks/useAuctionState";
import { PlayerAvatar } from "@/components/AuctionComponents";
import ConnectionStatusIndicator from "@/components/ConnectionStatusIndicator";
import type { Team, Tournament } from "@/types";

export default function LiveDisplayPage() {
  const [auctionId, setAuctionId] = useState<string | null>(
    localStorage.getItem("flyhigh_auction_id")
  );
  const [tournamentId, setTournamentId] = useState<string | null>(
    localStorage.getItem("flyhigh_tournament_id")
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-discover tournament and active auction if not set
  useEffect(() => {
    if (!tournamentId) {
      tournamentApi.list().then((r) => {
        if (r.data && r.data.length > 0) {
          const tid = r.data[0].id;
          setTournamentId(tid);
          localStorage.setItem("flyhigh_tournament_id", tid);
        }
      }).catch(() => {});
    }
  }, [tournamentId]);

  useEffect(() => {
    if (tournamentId && !auctionId) {
      auctionApi.getActive(tournamentId).then((r) => {
        if (r.data?.id) {
          setAuctionId(r.data.id);
          localStorage.setItem("flyhigh_auction_id", r.data.id);
        }
      }).catch(() => {});
    }
  }, [tournamentId, auctionId]);

  const { state, bids, connected, secondsLeft } = useAuctionState({
    auctionId,
  });

  // Query tournament details
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["tournaments_live"],
    queryFn: () => tournamentApi.list().then((r) => r.data),
    staleTime: 60_000,
  });

  // Query teams for purse ribbon
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["teams_live", tournamentId],
    queryFn: () => teamApi.list(tournamentId!).then((r) => r.data),
    enabled: !!tournamentId,
    refetchInterval: 4000,
  });

  const activeTournament = tournaments.find((t) => t.id === tournamentId) ?? tournaments[0];
  const player = state?.current_player;
  const isSold = state?.state === "SOLD";
  const isUnsold = state?.state === "UNSOLD";
  const isLive = state?.state === "LIVE";
  const isPaused = state?.state === "PAUSED";

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Timer ring calculations
  const timerTotal = state?.timer_seconds ?? 15;
  const timerRatio = Math.max(0, Math.min(1, secondsLeft / timerTotal));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timerRatio);

  const getTimerColor = () => {
    if (secondsLeft <= 3) return "#ef4444";
    if (secondsLeft <= 6) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div
      className="min-h-screen flex flex-col text-slate-100 overflow-hidden select-none"
      style={{
        background: "radial-gradient(circle at top center, #131b2e 0%, #080c14 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header
        className="px-8 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(10,15,26,0.7)" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff",
              boxShadow: "0 0 20px rgba(59,130,246,0.4)",
            }}
          >
            FH
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-wide flex items-center gap-2">
              <span>{activeTournament?.name || "FLYHIGH LIVE AUCTION"}</span>
              <span className="badge badge-live text-xs tracking-wider px-2 py-0.5">
                LIVE ARENA
              </span>
            </h1>
            <p className="text-xs text-slate-400">Official Live Bidding & Stage Telecast</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ConnectionStatusIndicator />

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* ── MAIN STAGE ──────────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 md:p-8 flex flex-col justify-between max-w-7xl mx-auto w-full">
        {/* SOLD POPUP CELEBRATION */}
        {isSold && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md"
            style={{ background: "rgba(0,0,0,0.85)" }}
          >
            <div
              className="glass-card-elevated p-10 md:p-14 text-center max-w-2xl w-full border-2 border-emerald-500/50 shadow-2xl relative overflow-hidden animate-bounce-short"
              style={{
                background: "linear-gradient(145deg, rgba(16,185,129,0.15) 0%, rgba(15,23,42,0.95) 100%)",
                boxShadow: "0 0 80px rgba(16,185,129,0.35)",
              }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/40 animate-pulse">
                  <Sparkles size={44} className="text-emerald-400" />
                </div>
              </div>
              <div className="inline-block px-5 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-black tracking-widest text-lg mb-4">
                HAMMER DOWN — SOLD!
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-2">
                {player?.name}
              </h2>
              <p className="text-lg text-slate-300 mb-6 font-medium">
                acquired by{" "}
                <span className="text-emerald-400 font-bold text-2xl">
                  {state?.highest_bidder_team_name ?? "Leading Team"}
                </span>
              </p>
              <div className="inline-block px-8 py-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
                <span className="text-sm text-slate-400 uppercase tracking-widest block mb-1 font-semibold">
                  Winning Bid
                </span>
                <span className="text-4xl md:text-5xl font-black text-emerald-400">
                  ₹{(state?.current_bid ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* UNSOLD POPUP */}
        {isUnsold && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md"
            style={{ background: "rgba(0,0,0,0.85)" }}
          >
            <div className="glass-card p-10 text-center max-w-lg w-full border border-red-500/30">
              <h2 className="text-3xl font-black text-red-400 mb-2">UNSOLD</h2>
              <p className="text-slate-300 text-lg mb-2">{player?.name}</p>
              <p className="text-sm text-slate-400">No bids received. Returned to pool.</p>
            </div>
          </div>
        )}

        {/* ACTIVE PLAYER STAGE */}
        {player ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto">
            {/* Player Info Card (5 cols) */}
            <div className="lg:col-span-5 glass-card-elevated p-8 rounded-3xl border border-white/10 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
              <div
                className="absolute top-0 left-0 right-0 h-2"
                style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)" }}
              />

              <div className="relative mb-6">
                <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={150} />
                <span className="absolute -bottom-2 right-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white border-2 border-slate-900 shadow">
                  #{player.auction_order || 1}
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
                {player.name}
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {player.category || "General"}
                </span>
                {player.gender && (
                  <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {player.gender}
                  </span>
                )}
                {player.age_group && (
                  <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {player.age_group}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-white/10">
                <div className="p-3 rounded-xl bg-white/5">
                  <span className="text-xs text-slate-400 block mb-0.5">Base Price</span>
                  <span className="text-lg font-bold text-slate-200">
                    ₹{player.base_price.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/5">
                  <span className="text-xs text-slate-400 block mb-0.5">Category</span>
                  <span className="text-lg font-bold text-slate-200">
                    {player.skill_level || player.category || "Standard"}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Bid & Timer Spotlight (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Massive Current Bid Display */}
              <div
                className="glass-card-elevated p-8 md:p-10 rounded-3xl border border-cyan-500/20 shadow-2xl relative overflow-hidden"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(6,182,212,0.12) 0%, rgba(15,23,42,0.9) 80%)",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm md:text-base font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                    <Flame size={20} className="animate-pulse text-amber-400" />
                    Current Highest Bid
                  </span>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    Min Increment: +₹{state?.bid_increment ?? 100}
                  </span>
                </div>

                <div className="text-6xl md:text-8xl font-black tracking-tight text-white mb-4">
                  <span className="text-cyan-400 mr-2">₹</span>
                  {((state?.current_bid ?? 0)).toLocaleString("en-IN")}
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/10 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-300 font-black">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Leading Team</span>
                      <span className="text-lg md:text-xl font-bold text-white">
                        {state?.highest_bidder_team_name ?? "Awaiting opening bid"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total Bids</span>
                    <span className="text-lg font-bold text-slate-200">{bids.length} bids</span>
                  </div>
                </div>
              </div>

              {/* Huge Circular Timer & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                {/* SVG Countdown Meter */}
                <div className="glass-card p-6 rounded-2xl flex items-center justify-center gap-6">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        stroke={getTimerColor()}
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-500 ease-linear"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span
                        className="text-4xl font-black transition-colors"
                        style={{ color: getTimerColor() }}
                      >
                        {secondsLeft}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        Sec
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                      Timer Status
                    </span>
                    <h3
                      className="text-xl font-black"
                      style={{ color: isPaused ? "#f59e0b" : isLive ? "#10b981" : "#94a3b8" }}
                    >
                      {isPaused ? "PAUSED" : isLive ? "TICKING" : state?.state}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {isLive ? "Next bid resets timer" : "Waiting for auctioneer"}
                    </p>
                  </div>
                </div>

                {/* Recent Bids Feed */}
                <div className="glass-card p-4 rounded-2xl h-44 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                    <Clock size={12} /> Recent Bids
                  </span>
                  <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                    {bids.slice(0, 3).map((b, idx) => (
                      <div
                        key={b.id || idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-xs"
                      >
                        <span className="font-semibold text-slate-200 truncate max-w-[120px]">
                          {b.team_name}
                        </span>
                        <span className="font-bold text-cyan-400">
                          ₹{b.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                    {bids.length === 0 && (
                      <p className="text-xs text-slate-500 text-center my-auto">
                        No bids placed yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="my-auto text-center py-20 glass-card rounded-3xl max-w-2xl mx-auto p-12">
            <Trophy size={64} className="mx-auto mb-4 text-blue-400 animate-bounce-short" />
            <h2 className="text-3xl font-black text-white mb-2">AUCTION STAGE READY</h2>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              Waiting for the auctioneer to introduce the next player onto the stage.
            </p>
          </div>
        )}
      </main>

      {/* ── BOTTOM TEAM PURSE STRIP ─────────────────────────────────────────── */}
      <footer
        className="px-8 py-3 border-t bg-slate-950/80 backdrop-blur-md"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between gap-4 overflow-x-auto py-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
            <Wallet size={14} className="text-emerald-400" />
            Team Purses
          </div>

          <div className="flex items-center gap-4 min-w-max">
            {teams.map((t) => (
              <div
                key={t.id}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 text-xs"
              >
                <span className="font-bold text-white">{t.name}</span>
                <span className="text-slate-400 font-mono">
                  Rem:{" "}
                  <span className="text-emerald-400 font-bold">
                    ₹{t.available_purse.toLocaleString("en-IN")}
                  </span>
                </span>
                <span className="text-slate-500">
                  (Spent: ₹{t.spent_amount.toLocaleString("en-IN")})
                </span>
              </div>
            ))}
            {teams.length === 0 && (
              <span className="text-xs text-slate-500">Teams loading...</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
