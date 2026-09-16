/**
 * AdminSettingsPage — Complete Tournament Day Readiness & Settings Area.
 *
 * Configures:
 * - Tournament Name, Sport, Description
 * - Tournament Mode: Practice Auction vs LIVE TOURNAMENT
 * - Pre-Auction Checklist (all 10 system diagnostics)
 * - Team Names, Logos, Captain Accounts, Starting Purse
 * - Base Price, Bid Increment, Auction Timer
 * - Player List, Photos, Categories, Auction Order
 * - Prominent RESET TOURNAMENT function protected by password & confirmation phrase
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Activity,
  Save,
  RotateCcw,
  Users,
  Trophy,
  DollarSign,
  Clock,
  ExternalLink,
  Key,
  UserPlus,
  Edit2,
  Image,
  ArrowUpDown,
  Lock,
  Loader,
  Check,
} from "lucide-react";
import {
  auctionApi,
  authApi,
  playerApi,
  teamApi,
  tournamentApi,
  getApiError,
} from "@/services/api";
import ConnectionStatusIndicator from "@/components/ConnectionStatusIndicator";
import type {
  Auction,
  ChecklistOut,
  Player,
  Team,
  Tournament,
  User,
} from "@/types";

const DEMO_TOURNAMENT_KEY = "flyhigh_tournament_id";

export default function AdminSettingsPage() {
  const [tournamentId, setTournamentId] = useState<string | null>(
    localStorage.getItem(DEMO_TOURNAMENT_KEY)
  );
  const [auctionId, setAuctionId] = useState<string | null>(
    localStorage.getItem("flyhigh_auction_id")
  );

  // Forms state
  const [tName, setTName] = useState("");
  const [tSport, setTSport] = useState("Badminton");
  const [tDesc, setTDesc] = useState("");
  const [tMode, setTMode] = useState<"PRACTICE" | "LIVE">("LIVE");

  // Auction rules form
  const [startingPurse, setStartingPurse] = useState(5000);
  const [basePrice, setBasePrice] = useState(500);
  const [bidIncrement, setBidIncrement] = useState(100);
  const [timerSeconds, setTimerSeconds] = useState(15);

  // Loading states
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [refreshingChecklist, setRefreshingChecklist] = useState(false);

  // Reset Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPhrase, setResetConfirmPhrase] = useState("");
  const [resetTargetMode, setResetTargetMode] = useState<"PRACTICE" | "LIVE">("PRACTICE");

  // Captain Account Modal state
  const [showCaptainModal, setShowCaptainModal] = useState(false);
  const [newCapUsername, setNewCapUsername] = useState("");
  const [newCapEmail, setNewCapEmail] = useState("");
  const [newCapPassword, setNewCapPassword] = useState("");
  const [newCapTeamId, setNewCapTeamId] = useState("");
  const [creatingCaptain, setCreatingCaptain] = useState(false);

  // Team Edit Modal state
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamFormName, setTeamFormName] = useState("");
  const [teamFormLogo, setTeamFormLogo] = useState("");
  const [teamFormCaptain, setTeamFormCaptain] = useState("");
  const [teamFormPurse, setTeamFormPurse] = useState(5000);
  const [savingTeam, setSavingTeam] = useState(false);

  // Player Edit Modal state
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerFormName, setPlayerFormName] = useState("");
  const [playerFormPhoto, setPlayerFormPhoto] = useState("");
  const [playerFormCategory, setPlayerFormCategory] = useState("");
  const [playerFormBasePrice, setPlayerFormBasePrice] = useState(500);
  const [playerFormOrder, setPlayerFormOrder] = useState(1);
  const [savingPlayer, setSavingPlayer] = useState(false);

  // Auto-discover tournament if not stored
  useEffect(() => {
    if (!tournamentId) {
      tournamentApi
        .list()
        .then((r) => {
          if (r.data && r.data.length > 0) {
            const tid = r.data[0].id;
            setTournamentId(tid);
            localStorage.setItem(DEMO_TOURNAMENT_KEY, tid);
          }
        })
        .catch(() => {});
    }
  }, [tournamentId]);

  // Fetch active auction
  useEffect(() => {
    if (tournamentId) {
      auctionApi
        .getActive(tournamentId)
        .then((r) => {
          if (r.data) {
            setAuctionId(r.data.id);
            localStorage.setItem("flyhigh_auction_id", r.data.id);
            if (r.data.bid_increment) setBidIncrement(r.data.bid_increment);
            if (r.data.timer_seconds) setTimerSeconds(r.data.timer_seconds);
          }
        })
        .catch(() => {});
    }
  }, [tournamentId]);

  // Query tournament
  const { data: tournament, refetch: refetchTournament } = useQuery<Tournament>({
    queryKey: ["tournament", tournamentId],
    queryFn: () => tournamentApi.get(tournamentId!).then((r) => r.data),
    enabled: !!tournamentId,
  });

  // Synchronize general tournament fields
  useEffect(() => {
    if (tournament) {
      setTName(tournament.name || "");
      setTSport(tournament.sport || "Badminton");
      setTDesc(tournament.description || "");
      setTMode(tournament.mode === "PRACTICE" ? "PRACTICE" : "LIVE");
    }
  }, [tournament]);

  // Query Checklist
  const { data: checklist, refetch: refetchChecklist, isFetching: isFetchingChecklist } =
    useQuery<ChecklistOut>({
      queryKey: ["checklist", tournamentId],
      queryFn: () => tournamentApi.getChecklist(tournamentId!).then((r) => r.data),
      enabled: !!tournamentId,
      refetchInterval: 15_000,
    });

  // Query Teams
  const { data: teams = [], refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ["teams", tournamentId],
    queryFn: () => teamApi.list(tournamentId!).then((r) => r.data),
    enabled: !!tournamentId,
  });

  // Query Players
  const { data: players = [], refetch: refetchPlayers } = useQuery<Player[]>({
    queryKey: ["players", tournamentId],
    queryFn: () => playerApi.list(tournamentId!).then((r) => r.data),
    enabled: !!tournamentId,
  });

  // Query Captain Users
  const { data: captainUsers = [], refetch: refetchCaptains } = useQuery<User[]>({
    queryKey: ["captains"],
    queryFn: () => authApi.listUsers("captain").then((r) => r.data),
  });

  // Set default starting purse from first team
  useEffect(() => {
    if (teams.length > 0 && teams[0].total_purse) {
      setStartingPurse(teams[0].total_purse);
    }
  }, [teams]);

  // Set default base price from players if available
  useEffect(() => {
    if (players.length > 0 && players[0].base_price) {
      setBasePrice(players[0].base_price);
    }
  }, [players]);

  // Save General Tournament Info & Mode
  const handleSaveGeneral = async () => {
    if (!tournamentId) return;
    setSavingGeneral(true);
    try {
      await tournamentApi.update(tournamentId, {
        name: tName,
        sport: tSport,
        description: tDesc,
        mode: tMode,
      });
      toast.success("Tournament settings saved successfully!");
      refetchTournament();
      refetchChecklist();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingGeneral(false);
    }
  };

  // Save Auction Rules
  const handleSaveRules = async () => {
    if (!tournamentId) return;
    setSavingRules(true);
    try {
      if (auctionId) {
        await auctionApi.updateConfig(auctionId, {
          starting_purse: Number(startingPurse),
          base_price: Number(basePrice),
          bid_increment: Number(bidIncrement),
          timer_seconds: Number(timerSeconds),
        });
      }
      // Update team total purses
      await Promise.all(
        teams.map((team) =>
          teamApi.update(team.id, { total_purse: Number(startingPurse) })
        )
      );
      toast.success("Auction rules and purse updated across all teams!");
      refetchTeams();
      refetchChecklist();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingRules(false);
    }
  };

  // Handle Team Edit
  const openTeamEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamFormName(team.name);
    setTeamFormLogo(team.logo_url || "");
    setTeamFormCaptain(team.captain_username || "");
    setTeamFormPurse(team.total_purse);
  };

  const handleSaveTeamEdit = async () => {
    if (!editingTeam) return;
    setSavingTeam(true);
    try {
      await teamApi.update(editingTeam.id, {
        name: teamFormName,
        logo_url: teamFormLogo || null,
        captain_username: teamFormCaptain || null,
        total_purse: Number(teamFormPurse),
      });
      toast.success(`Team "${teamFormName}" updated!`);
      setEditingTeam(null);
      refetchTeams();
      refetchChecklist();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingTeam(false);
    }
  };

  // Handle Create Captain Account
  const handleCreateCaptain = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCaptain(true);
    try {
      await authApi.register({
        username: newCapUsername,
        email: newCapEmail,
        password: newCapPassword,
        role: "captain",
        team_id: newCapTeamId || null,
      });
      toast.success(`Captain account "${newCapUsername}" created!`);
      setShowCaptainModal(false);
      setNewCapUsername("");
      setNewCapEmail("");
      setNewCapPassword("");
      setNewCapTeamId("");
      refetchCaptains();
      refetchChecklist();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCreatingCaptain(false);
    }
  };

  // Handle Player Edit
  const openPlayerEdit = (p: Player) => {
    setEditingPlayer(p);
    setPlayerFormName(p.name);
    setPlayerFormPhoto(p.photo_url || "");
    setPlayerFormCategory(p.category || "");
    setPlayerFormBasePrice(p.base_price);
    setPlayerFormOrder(p.auction_order);
  };

  const handleSavePlayerEdit = async () => {
    if (!editingPlayer) return;
    setSavingPlayer(true);
    try {
      await playerApi.update(editingPlayer.id, {
        name: playerFormName,
        photo_url: playerFormPhoto || null,
        category: playerFormCategory || null,
        base_price: Number(playerFormBasePrice),
        auction_order: Number(playerFormOrder),
      });
      toast.success(`Player "${playerFormName}" updated!`);
      setEditingPlayer(null);
      refetchPlayers();
      refetchChecklist();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingPlayer(false);
    }
  };

  // Handle Tournament Reset
  const handleResetTournament = async () => {
    if (!tournamentId) return;
    if (!resetPassword) {
      toast.error("Admin password is required to reset the tournament.");
      return;
    }

    if (tMode === "LIVE" && resetConfirmPhrase !== "RESET-LIVE-AUCTION") {
      toast.error('In LIVE mode, you must type "RESET-LIVE-AUCTION" exactly.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await tournamentApi.reset(tournamentId, {
        password: resetPassword,
        mode: resetTargetMode,
        confirm_phrase: resetConfirmPhrase || undefined,
      });

      toast.success(res.data.message || "Tournament successfully reset!");
      setShowResetModal(false);
      setResetPassword("");
      setResetConfirmPhrase("");
      setTMode(resetTargetMode);

      // Refetch everything
      refetchTournament();
      refetchChecklist();
      refetchTeams();
      refetchPlayers();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setResetLoading(false);
    }
  };

  const isLive = tMode === "LIVE";
  const allReady = checklist?.all_ready ?? false;

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in space-y-8 pb-20">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-6 border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gradient">Tournament Settings</h1>
            <ConnectionStatusIndicator mode={tMode} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure tournament identity, auction rules, team purses, captain accounts, and pre-auction readiness.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshingChecklist(true);
              refetchChecklist().finally(() => setRefreshingChecklist(false));
            }}
            className="btn btn-secondary btn-sm flex items-center gap-2"
            disabled={isFetchingChecklist || refreshingChecklist}
          >
            <RefreshCw
              size={14}
              className={isFetchingChecklist || refreshingChecklist ? "spin" : ""}
            />
            Check Diagnostics
          </button>

          <a
            href="/live"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
          >
            <span>Live Arena</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* ── 1. PRE-AUCTION DIAGNOSTIC CHECKLIST ─────────────────────────────── */}
      <div className="glass-card p-6 border-2 border-slate-700/60 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-lg ${
                allReady
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              }`}
            >
              {allReady ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>Tournament Day Readiness Checklist</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold tracking-wide ${
                    allReady
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {allReady ? "ALL 10 SYSTEMS GO" : "SETUP INCOMPLETE"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Authoritative verification of live connections, auction parameters, teams, and captains.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Current Arena Mode:</span>
            <span
              className={`ml-2 text-xs font-black uppercase px-2 py-0.5 rounded ${
                isLive
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {tMode}
            </span>
          </div>
        </div>

        {/* 10 Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {checklist?.items?.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                item.status
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                  : "bg-red-950/20 border-red-500/30 text-red-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-200">
                  {item.label}
                </span>
                {item.status ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-red-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate" title={item.details}>
                {item.details}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. TOURNAMENT MODE SWITCHER ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Practice Mode Card */}
        <div
          onClick={() => setTMode("PRACTICE")}
          className={`glass-card p-6 cursor-pointer border-2 transition-all relative ${
            tMode === "PRACTICE"
              ? "border-amber-500 bg-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
              : "border-slate-800 hover:border-slate-600 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Activity size={20} />
              <span className="text-base tracking-wide">PRACTICE AUCTION MODE</span>
            </div>
            {tMode === "PRACTICE" && (
              <span className="badge badge-yellow text-xs px-2 py-0.5">ACTIVE</span>
            )}
          </div>
          <p className="text-xs text-slate-300 mb-3 leading-relaxed">
            Safe rehearsal & test environment. Captains and auctioneers can practice bidding, timers, and sold actions.
            Practice data can be cleared at any time without impacting live tournament records.
          </p>
          <ul className="text-xs text-slate-400 space-y-1">
            <li className="flex items-center gap-1.5">
              <Check size={12} className="text-amber-400" /> Non-destructive testing
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={12} className="text-amber-400" /> Simple one-click reset
            </li>
          </ul>
        </div>

        {/* Live Mode Card */}
        <div
          onClick={() => setTMode("LIVE")}
          className={`glass-card p-6 cursor-pointer border-2 transition-all relative ${
            tMode === "LIVE"
              ? "border-emerald-500 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              : "border-slate-800 hover:border-slate-600 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Sparkles size={20} />
              <span className="text-base tracking-wide">LIVE TOURNAMENT MODE</span>
            </div>
            {tMode === "LIVE" && (
              <span className="badge badge-green text-xs px-2 py-0.5">ACTIVE</span>
            )}
          </div>
          <p className="text-xs text-slate-300 mb-3 leading-relaxed">
            High-integrity production tournament mode. Strict safeguards are activated: accidental reset is locked behind
            two-factor confirmation, SOLD players are permanently protected, and auction records are immutable.
          </p>
          <ul className="text-xs text-slate-400 space-y-1">
            <li className="flex items-center gap-1.5">
              <Check size={12} className="text-emerald-400" /> Accidental reset protection enabled
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={12} className="text-emerald-400" /> SOLD players cannot be resold
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={12} className="text-emerald-400" /> Audit trail permanently logged
            </li>
          </ul>
        </div>
      </div>

      {/* ── 3. TOURNAMENT IDENTITY & AUCTION RULES ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tournament Identity */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 border-b border-white/10 pb-3">
            <Trophy size={18} className="text-blue-400" />
            <span>Tournament Identity</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tournament Name *
            </label>
            <input
              type="text"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              placeholder="e.g. FlyHigh Premier League 2026"
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Sport Category
              </label>
              <input
                type="text"
                value={tSport}
                onChange={(e) => setTSport(e.target.value)}
                placeholder="e.g. Badminton, Cricket"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Active Arena Mode
              </label>
              <select
                value={tMode}
                onChange={(e) => setTMode(e.target.value as "PRACTICE" | "LIVE")}
                className="input w-full font-semibold"
              >
                <option value="LIVE">LIVE TOURNAMENT</option>
                <option value="PRACTICE">PRACTICE AUCTION</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Event Description / Rules Overview
            </label>
            <textarea
              rows={3}
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              placeholder="Official player auction rules and guidelines for captains..."
              className="input w-full text-xs leading-relaxed"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveGeneral}
              disabled={savingGeneral || !tName.trim()}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              {savingGeneral ? <Loader size={14} className="spin" /> : <Save size={14} />}
              Save Tournament Info
            </button>
          </div>
        </div>

        {/* Auction Financials & Rules */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 border-b border-white/10 pb-3">
            <DollarSign size={18} className="text-emerald-400" />
            <span>Auction Rules & Purse Limits</span>
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Starting Team Purse (₹) *
              </label>
              <input
                type="number"
                min={100}
                step={100}
                value={startingPurse}
                onChange={(e) => setStartingPurse(Number(e.target.value))}
                className="input w-full font-mono"
              />
              <span className="text-[11px] text-slate-400">
                Purse allocated to each team
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Base Price (₹) *
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                className="input w-full font-mono"
              />
              <span className="text-[11px] text-slate-400">
                Opening bid for incoming players
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bid Increment (₹) *
              </label>
              <input
                type="number"
                min={10}
                step={25}
                value={bidIncrement}
                onChange={(e) => setBidIncrement(Number(e.target.value))}
                className="input w-full font-mono"
              />
              <span className="text-[11px] text-slate-400">
                Minimum step between bids
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Auction Countdown Timer (Seconds) *
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(Number(e.target.value))}
                className="input w-full font-mono"
              />
              <span className="text-[11px] text-slate-400">
                Resets on each accepted bid
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs text-blue-200">
            Saving these rules synchronizes the active auction parameters and updates starting purses across all teams in this tournament.
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveRules}
              disabled={savingRules}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              {savingRules ? <Loader size={14} className="spin" /> : <Save size={14} />}
              Update Auction Rules
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. TEAMS & CAPTAIN ACCOUNTS ───────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users size={20} className="text-purple-400" />
              <span>Teams & Captain Accounts</span>
            </h2>
            <p className="text-xs text-slate-400">
              Configure team names, logos, purses, and authenticate active captain accounts.
            </p>
          </div>

          <button
            onClick={() => setShowCaptainModal(true)}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <UserPlus size={14} />
            New Captain Account
          </button>
        </div>

        {/* Teams Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-400 uppercase">
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Assigned Captain</th>
                <th className="py-3 px-4">Total Purse</th>
                <th className="py-3 px-4">Spent / Reserved</th>
                <th className="py-3 px-4">Available Purse</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {team.logo_url ? (
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="w-9 h-9 rounded-lg object-cover bg-slate-800 border border-white/10"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center font-bold text-xs text-blue-300">
                          {team.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-100">{team.name}</p>
                        <p className="text-xs text-slate-400">
                          {team.captain_name || "No Captain Name Set"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Key size={13} className="text-slate-400" />
                      <span className="font-mono text-xs text-slate-200">
                        {team.captain_username || (
                          <span className="text-amber-400 italic">Unassigned</span>
                        )}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                    ₹{team.total_purse.toLocaleString()}
                  </td>

                  <td className="py-3 px-4 font-mono text-xs text-slate-400">
                    ₹{team.spent_amount.toLocaleString()} / ₹
                    {team.reserved_amount.toLocaleString()}
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                    ₹{team.available_purse.toLocaleString()}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openTeamEdit(team)}
                      className="btn btn-ghost btn-xs text-blue-400 hover:text-blue-300"
                    >
                      <Edit2 size={13} className="mr-1 inline" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. PLAYER LIST, PHOTOS, CATEGORIES & AUCTION ORDER ─────────────────── */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ArrowUpDown size={20} className="text-amber-400" />
              <span>Player List & Auction Sequence</span>
            </h2>
            <p className="text-xs text-slate-400">
              Configure player photos, categories, base prices, and tournament auction ordering (#1, #2, #3...).
            </p>
          </div>

          <a
            href="/admin/players"
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            <span>Full Player Manager</span>
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Players Table */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10">
              <tr className="border-b border-white/10 text-xs text-slate-400 uppercase">
                <th className="py-2.5 px-4 w-16">Order</th>
                <th className="py-2.5 px-4">Player</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Base Price</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {players
                .slice()
                .sort((a, b) => a.auction_order - b.auction_order)
                .map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2 px-4 font-mono font-bold text-amber-400">
                      #{p.auction_order}
                    </td>

                    <td className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        {p.photo_url ? (
                          <img
                            src={p.photo_url}
                            alt={p.name}
                            className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-white/10"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-100">{p.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {p.skill_level || "Standard"} • {p.gender || "All"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-2 px-4">
                      <span className="badge badge-blue text-xs">
                        {p.category || "General"}
                      </span>
                    </td>

                    <td className="py-2 px-4 font-mono font-semibold text-slate-200">
                      ₹{p.base_price.toLocaleString()}
                    </td>

                    <td className="py-2 px-4">
                      <span
                        className={`badge text-xs ${
                          p.status === "SOLD"
                            ? "badge-green"
                            : p.status === "LIVE"
                            ? "badge-red animate-pulse"
                            : p.status === "UNSOLD"
                            ? "badge-gray"
                            : "badge-blue"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => openPlayerEdit(p)}
                        className="btn btn-ghost btn-xs text-amber-400 hover:text-amber-300"
                      >
                        <Edit2 size={13} className="mr-1 inline" />
                        Edit Order/Info
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 6. PROMINENT DANGER ZONE: RESET TOURNAMENT ────────────────────────── */}
      <div className="glass-card p-6 border-2 border-red-500/40 bg-red-950/10 rounded-2xl relative overflow-hidden shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <ShieldAlert size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-red-400 tracking-wide">
              RESET TOURNAMENT
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
              This will clear all auction bids, roster assignments, and auction events. Team spent/reserved amounts will
              be reset to 0, and players will return to AVAILABLE status.
              <br />
              <strong className="text-red-300">
                {isLive
                  ? "⚠️ In LIVE TOURNAMENT mode: Protected against accidental clicks. Requires admin password and explicit confirmation phrase."
                  : "ℹ️ In PRACTICE AUCTION mode: Fast resets allowed for mock bidding runs."}
              </strong>
            </p>

            <div className="mt-5">
              <button
                onClick={() => {
                  setResetTargetMode(tMode);
                  setShowResetModal(true);
                }}
                className="btn btn-danger font-bold text-sm px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-red-900/30"
                id="reset-tournament-btn"
              >
                <RotateCcw size={16} />
                RESET TOURNAMENT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: RESET TOURNAMENT CONFIRMATION ──────────────────────────────── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated max-w-lg w-full p-6 border-2 border-red-500/50 shadow-2xl fade-in">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-black tracking-wide">
                Confirm Tournament Reset
              </h3>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to reset the tournament? All live bidding history and rosters will be cleared.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Mode After Reset
                </label>
                <select
                  value={resetTargetMode}
                  onChange={(e) =>
                    setResetTargetMode(e.target.value as "PRACTICE" | "LIVE")
                  }
                  className="input w-full font-semibold"
                >
                  <option value="PRACTICE">PRACTICE AUCTION (Recommended for testing)</option>
                  <option value="LIVE">LIVE TOURNAMENT (Official tournament)</option>
                </select>
              </div>

              {isLive && (
                <div>
                  <label className="block text-xs font-semibold text-red-300 mb-1">
                    Accidental Reset Safeguard: Type "RESET-LIVE-AUCTION" *
                  </label>
                  <input
                    type="text"
                    value={resetConfirmPhrase}
                    onChange={(e) => setResetConfirmPhrase(e.target.value)}
                    placeholder="RESET-LIVE-AUCTION"
                    className="input w-full font-mono border-red-500/50 text-red-300"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Administrator Password *
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="input w-full"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                onClick={() => setShowResetModal(false)}
                className="btn btn-ghost btn-sm"
                disabled={resetLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleResetTournament}
                disabled={
                  resetLoading ||
                  !resetPassword ||
                  (isLive && resetConfirmPhrase !== "RESET-LIVE-AUCTION")
                }
                className="btn btn-danger btn-sm flex items-center gap-2"
              >
                {resetLoading ? <Loader size={14} className="spin" /> : <RotateCcw size={14} />}
                Confirm & Reset Tournament
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE CAPTAIN ACCOUNT ────────────────────────────────────── */}
      {showCaptainModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCaptain}
            className="glass-card-elevated max-w-md w-full p-6 border border-white/20 shadow-2xl fade-in"
          >
            <div className="flex items-center gap-2 mb-4 text-purple-400">
              <UserPlus size={20} />
              <h3 className="text-lg font-bold">Create Captain Account</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Captain Username *
                </label>
                <input
                  type="text"
                  required
                  value={newCapUsername}
                  onChange={(e) => setNewCapUsername(e.target.value)}
                  placeholder="e.g. captain_eagles"
                  className="input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Captain Email *
                </label>
                <input
                  type="email"
                  required
                  value={newCapEmail}
                  onChange={(e) => setNewCapEmail(e.target.value)}
                  placeholder="e.g. captain@flyhigh.org"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account Password *
                </label>
                <input
                  type="password"
                  required
                  value={newCapPassword}
                  onChange={(e) => setNewCapPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assign to Team (Optional)
                </label>
                <select
                  value={newCapTeamId}
                  onChange={(e) => setNewCapTeamId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">-- Select Team --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowCaptainModal(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingCaptain}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                {creatingCaptain ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: EDIT TEAM ─────────────────────────────────────────────────── */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated max-w-md w-full p-6 border border-white/20 shadow-2xl fade-in">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <Edit2 size={20} />
              <h3 className="text-lg font-bold">Edit Team</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={teamFormName}
                  onChange={(e) => setTeamFormName(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Logo URL
                </label>
                <input
                  type="url"
                  value={teamFormLogo}
                  onChange={(e) => setTeamFormLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Captain Username
                </label>
                <input
                  type="text"
                  value={teamFormCaptain}
                  onChange={(e) => setTeamFormCaptain(e.target.value)}
                  placeholder="Username of captain account"
                  className="input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Total Purse (₹)
                </label>
                <input
                  type="number"
                  value={teamFormPurse}
                  onChange={(e) => setTeamFormPurse(Number(e.target.value))}
                  className="input w-full font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTeamEdit}
                disabled={savingTeam}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                {savingTeam ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT PLAYER ───────────────────────────────────────────────── */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated max-w-md w-full p-6 border border-white/20 shadow-2xl fade-in">
            <div className="flex items-center gap-2 mb-4 text-amber-400">
              <Edit2 size={20} />
              <h3 className="text-lg font-bold">Edit Player Details</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Player Name *
                </label>
                <input
                  type="text"
                  required
                  value={playerFormName}
                  onChange={(e) => setPlayerFormName(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Photo URL
                </label>
                <input
                  type="url"
                  value={playerFormPhoto}
                  onChange={(e) => setPlayerFormPhoto(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="input w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={playerFormCategory}
                    onChange={(e) => setPlayerFormCategory(e.target.value)}
                    placeholder="Icon / All-Rounder"
                    className="input w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Auction Order #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={playerFormOrder}
                    onChange={(e) => setPlayerFormOrder(Number(e.target.value))}
                    className="input w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Base Price (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={playerFormBasePrice}
                  onChange={(e) => setPlayerFormBasePrice(Number(e.target.value))}
                  className="input w-full font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingPlayer(null)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePlayerEdit}
                disabled={savingPlayer}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                {savingPlayer ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
