/**
 * Admin Layout — sidebar + topbar + content area.
 */
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Gavel,
  Trophy,
  History,
  LogOut,
  Zap,
  ChevronRight,
  Settings,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { tournamentApi } from "@/services/api";
import ConnectionStatusIndicator from "@/components/ConnectionStatusIndicator";
import type { Tournament } from "@/types";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/auction", icon: Gavel, label: "Live Auction" },
  { to: "/admin/players", icon: Users, label: "Players" },
  { to: "/admin/teams", icon: UserCheck, label: "Teams" },
  { to: "/admin/history", icon: History, label: "Bid History" },
  { to: "/admin/results", icon: Trophy, label: "Results" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const tournamentId = localStorage.getItem("flyhigh_tournament_id");

  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["admin_tournaments"],
    queryFn: () => tournamentApi.list().then((r) => r.data),
    staleTime: 30_000,
  });

  const activeTournament =
    tournaments.find((t) => t.id === tournamentId) ?? tournaments[0];


  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside
        style={{
          background: "rgba(10, 14, 26, 0.95)",
          borderRight: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Logo */}
        <div
          className="p-6"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 40,
                height: 40,
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                boxShadow: "0 0 20px rgba(59,130,246,0.4)",
              }}
            >
              <Zap size={20} color="white" />
            </div>
            <div>
              <p className="font-black text-sm text-gradient">FLYHIGH</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Admin Panel
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? "text-white"
                    : "hover:bg-white/5"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))",
                      border: "1px solid rgba(59,130,246,0.3)",
                      color: "white",
                    }
                  : { color: "var(--color-text-muted)" }
              }
            >
              <Icon size={18} />
              {label}
              <ChevronRight size={14} className="ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div
          className="p-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3 mb-3 px-2">
            <div
              className="flex items-center justify-center rounded-full text-sm font-bold"
              style={{
                width: 36,
                height: 36,
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                color: "white",
              }}
            >
              {user?.username?.charAt(0).toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.username}</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Administrator
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-ghost btn-sm w-full"
            id="admin-logout-btn"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{ overflowY: "auto", minHeight: "100vh", flex: 1 }}
        className="flex flex-col"
      >
        {/* Sticky Admin Topbar */}
        <header
          className="px-6 py-3 flex items-center justify-between border-b sticky top-0 z-30 backdrop-blur-md"
          style={{
            borderColor: "var(--color-border)",
            background: "rgba(10, 14, 26, 0.85)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">TOURNAMENT:</span>
            <span className="text-sm font-extrabold text-slate-100 tracking-wide">
              {activeTournament?.name || "FLYHIGH LIVE AUCTION"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatusIndicator />
            <a
              href="/live"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-500/20 bg-blue-500/10"
              title="Open public projector screen in new window"
            >
              <span>Projector Display</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
