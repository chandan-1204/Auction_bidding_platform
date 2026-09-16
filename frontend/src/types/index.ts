// ──────────────────────────────────────────────────────────────
// Shared TypeScript types for the FlyHigh Auction platform
// Mirroring the Pydantic schemas from the backend
// ──────────────────────────────────────────────────────────────

export type UserRole = "admin" | "captain";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  team_id: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
  username: string;
  team_id: string | null;
}

// ── Tournament ──────────────────────────────────────────────────
export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  status: string;
  mode?: "PRACTICE" | "LIVE";
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: boolean;
  details: string;
}

export interface ChecklistOut {
  all_ready: boolean;
  mode: "PRACTICE" | "LIVE";
  items: ChecklistItem[];
}

export interface ResetTournamentRequest {
  password: string;
  mode?: "PRACTICE" | "LIVE";
  confirm_phrase?: string;
}


// ── Team ────────────────────────────────────────────────────────
export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string | null;
  captain_name: string | null;
  captain_username: string | null;
  total_purse: number;
  spent_amount: number;
  reserved_amount: number;
  available_purse: number;
  created_at: string;
}

export interface TeamWithRoster extends Team {
  roster_entries: RosterEntry[];
}

// ── Player ──────────────────────────────────────────────────────
export type PlayerStatus = "AVAILABLE" | "UPCOMING" | "LIVE" | "SOLD" | "UNSOLD" | "SKIPPED";

export interface Player {
  id: string;
  tournament_id: string;
  name: string;
  photo_url: string | null;
  gender: string | null;
  age: number | null;
  age_group: string | null;
  category: string | null;
  skill_level: string | null;
  base_price: number;
  status: PlayerStatus;
  auction_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Auction ─────────────────────────────────────────────────────
export type AuctionState =
  | "DRAFT"
  | "READY"
  | "LIVE"
  | "PAUSED"
  | "SOLD"
  | "UNSOLD"
  | "COMPLETED";

export interface Auction {
  id: string;
  tournament_id: string;
  state: AuctionState;
  mode?: "PRACTICE" | "LIVE";
  current_player_id: string | null;
  current_bid: number | null;
  highest_bidder_team_id: string | null;
  starting_purse: number;
  base_price: number;
  bid_increment: number;
  timer_seconds: number;
  timer_end_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionStateOut {
  id: string;
  state: AuctionState;
  mode?: "PRACTICE" | "LIVE";
  current_player: Player | null;
  current_bid: number | null;
  highest_bidder_team_id: string | null;
  highest_bidder_team_name: string | null;
  timer_end_at: string | null;
  bid_increment: number;
  timer_seconds: number;
}

// ── Bid ─────────────────────────────────────────────────────────
export interface Bid {
  id: string;
  auction_id: string;
  player_id: string;
  team_id: string;
  amount: number;
  sequence_number: number;
  is_accepted: boolean;
  rejection_reason: string | null;
  placed_at: string;
  team_name?: string;
  player_name?: string;
}

// ── Roster ─────────────────────────────────────────────────────
export interface RosterEntry {
  id: string;
  auction_id: string;
  team_id: string;
  player_id: string;
  sold_price: number;
  sold_at: string;
  player?: Player;
}

// ── Results ────────────────────────────────────────────────────
export interface AuctionResultTeam {
  team_id: string;
  team_name: string;
  players_purchased: number;
  total_spent: number;
  remaining_purse: number;
  players: RosterEntry[];
}

export interface AuctionResults {
  auction_id: string;
  tournament_name: string;
  total_players_sold: number;
  total_players_unsold: number;
  teams: AuctionResultTeam[];
}

// ── Auth Store ─────────────────────────────────────────────────
export interface AuthState {
  token: string | null;
  user: User | null;
  role: UserRole | null;
  teamId: string | null;
}

// ── Socket Events ──────────────────────────────────────────────
export interface SocketBidEvent extends Bid {
  team_name: string;
}

export interface SocketNotification {
  message: string;
  level: "info" | "success" | "warning" | "error";
}
