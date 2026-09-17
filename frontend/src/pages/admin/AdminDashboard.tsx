/**
 * Admin Dashboard — overview stats + quick actions.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gavel, Users, UserCheck, Trophy, ArrowRight, TrendingUp, Zap } from "lucide-react";
import { playerApi, teamApi, auctionApi } from "@/services/api";
import { useActiveTournament } from "@/hooks/useActiveTournament";
import type { Player, Team } from "@/types";

export default function AdminDashboard() {
  const { tournamentId } = useActiveTournament();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctionState, setAuctionState] = useState<any>(null);

  useEffect(() => {
    if (!tournamentId) return;
    playerApi.list(tournamentId).then((r) => setPlayers(r.data)).catch(() => {});
    teamApi.list(tournamentId).then((r) => setTeams(r.data)).catch(() => {});
    auctionApi.getActive(tournamentId).then((r) => setAuctionState(r.data)).catch(() => {});
  }, [tournamentId]);

  const soldPlayers = players.filter((p) => p.status === "SOLD").length;
  const availablePlayers = players.filter((p) => p.status === "AVAILABLE").length;
  const totalSpent = teams.reduce((s, t) => s + t.spent_amount, 0);

  const stats = [
    { label: "Total Players", value: players.length, icon: Users, color: "#3b82f6" },
    { label: "Players Sold", value: soldPlayers, icon: Trophy, color: "#10b981" },
    { label: "Available", value: availablePlayers, icon: Gavel, color: "#f59e0b" },
    { label: "Total Spent", value: `₹${totalSpent.toLocaleString("en-IN")}`, icon: TrendingUp, color: "#6366f1" },
  ];

  return (
    <div className="p-6 fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient mb-2">
          Welcome back, Admin
        </h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          FlyHigh Team Event — Live Auction Platform
        </p>
        {auctionState && (
          <div className="flex items-center gap-2 mt-3">
            <span className="connection-dot connected" />
            <span className="text-sm font-medium" style={{ color: "#10b981" }}>
              Auction is {auctionState.state.toLowerCase()}
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{label}</p>
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 36, height: 36, background: `${color}20` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickAction
            to="/admin/auction"
            icon={Gavel}
            title="Live Auction"
            desc="Control the auction in real-time"
            gradient="linear-gradient(135deg, #3b82f6, #6366f1)"
          />
          <QuickAction
            to="/admin/players"
            icon={Users}
            title="Manage Players"
            desc="Add, edit, and organize players"
            gradient="linear-gradient(135deg, #10b981, #059669)"
          />
          <QuickAction
            to="/admin/teams"
            icon={UserCheck}
            title="Manage Teams"
            desc="Configure teams and purses"
            gradient="linear-gradient(135deg, #f59e0b, #d97706)"
          />
          <QuickAction
            to="/admin/results"
            icon={Trophy}
            title="View Results"
            desc="See auction results and export"
            gradient="linear-gradient(135deg, #6366f1, #8b5cf6)"
          />
        </div>
      </div>

      {/* Teams Summary */}
      {teams.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Team Purses</h2>
            <Link to="/admin/teams" className="text-sm" style={{ color: "var(--color-accent)" }}>
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => {
              const pct = team.total_purse > 0
                ? ((team.available_purse / team.total_purse) * 100).toFixed(0)
                : "0";
              return (
                <div key={team.id} className="stat-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex items-center justify-center rounded-xl font-black"
                      style={{ width: 40, height: 40, background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white" }}
                    >
                      {team.name.charAt(0)}
                    </div>
                    <p className="font-bold truncate">{team.name}</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #10b981, #34d399)" }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--color-text-muted)" }}>Available</span>
                    <span className="font-bold" style={{ color: "#10b981" }}>
                      ₹{team.available_purse.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!tournamentId && (
        <div className="glass-card-elevated p-8 text-center">
          <Zap size={48} style={{ color: "var(--color-accent)", margin: "0 auto 16px" }} />
          <h3 className="text-xl font-bold mb-2">No Tournament Selected</h3>
          <p style={{ color: "var(--color-text-muted)" }}>
            Go to the Auction page and select a tournament to get started.
          </p>
          <Link to="/admin/auction" className="btn btn-primary btn-lg mt-6 inline-flex">
            Go to Auction
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickAction({
  to, icon: Icon, title, desc, gradient,
}: {
  to: string; icon: any; title: string; desc: string; gradient: string;
}) {
  return (
    <Link
      to={to}
      className="stat-card flex items-center gap-4 group hover:scale-[1.02] transition-transform"
      style={{ textDecoration: "none" }}
    >
      <div
        className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 48, height: 48, background: gradient }}
      >
        <Icon size={22} color="white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{title}</p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
      </div>
      <ArrowRight size={16} style={{ color: "var(--color-text-muted)" }} className="group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}
