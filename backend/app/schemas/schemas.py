"""
Pydantic v2 schemas for request/response validation.
Organized by domain: auth, users, teams, players, auctions, bids.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ─────────────────────────────────────────────────────────────
# Base / Shared
# ─────────────────────────────────────────────────────────────
class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    username: str
    team_id: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(default="captain")
    team_id: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("admin", "captain"):
            raise ValueError("role must be 'admin' or 'captain'")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=6)
    is_active: Optional[bool] = None
    team_id: Optional[str] = None


class UserOut(OrmModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
    team_id: Optional[str]
    created_at: datetime


# ─────────────────────────────────────────────────────────────
# Tournament
# ─────────────────────────────────────────────────────────────
class TournamentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sport: str = "Badminton"
    mode: Optional[str] = "LIVE"


class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sport: Optional[str] = None
    status: Optional[str] = None
    mode: Optional[str] = None


class TournamentOut(OrmModel):
    id: str
    name: str
    description: Optional[str]
    sport: str
    status: str
    mode: str = "LIVE"
    created_at: datetime


# ─────────────────────────────────────────────────────────────
# Team
# ─────────────────────────────────────────────────────────────
class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    tournament_id: str
    captain_name: Optional[str] = None
    captain_username: Optional[str] = None
    total_purse: float = Field(default=5000.0, ge=0)
    logo_url: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    captain_name: Optional[str] = None
    captain_username: Optional[str] = None
    total_purse: Optional[float] = Field(default=None, ge=0)
    logo_url: Optional[str] = None


class TeamOut(OrmModel):
    id: str
    tournament_id: str
    name: str
    logo_url: Optional[str]
    captain_name: Optional[str]
    captain_username: Optional[str]
    total_purse: float
    spent_amount: float
    reserved_amount: float
    available_purse: float
    created_at: datetime


class TeamWithRoster(TeamOut):
    roster_entries: List["RosterEntryOut"] = []


# ─────────────────────────────────────────────────────────────
# Player
# ─────────────────────────────────────────────────────────────
class PlayerCreate(BaseModel):
    tournament_id: str
    name: str = Field(..., min_length=1, max_length=128)
    photo_url: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=5, le=120)
    age_group: Optional[str] = None
    category: Optional[str] = None
    skill_level: Optional[str] = None
    base_price: float = Field(default=500.0, ge=0)
    auction_order: int = Field(default=0, ge=0)
    notes: Optional[str] = None


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    photo_url: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=5, le=120)
    age_group: Optional[str] = None
    category: Optional[str] = None
    skill_level: Optional[str] = None
    base_price: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None
    auction_order: Optional[int] = None
    notes: Optional[str] = None


class PlayerOut(OrmModel):
    id: str
    tournament_id: str
    name: str
    photo_url: Optional[str]
    gender: Optional[str]
    age: Optional[int]
    age_group: Optional[str]
    category: Optional[str]
    skill_level: Optional[str]
    base_price: float
    status: str
    auction_order: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────
# Auction
# ─────────────────────────────────────────────────────────────
class AuctionCreate(BaseModel):
    tournament_id: str
    starting_purse: float = Field(default=5000.0, ge=0)
    base_price: float = Field(default=500.0, ge=0)
    bid_increment: float = Field(default=100.0, ge=1)
    timer_seconds: int = Field(default=15, ge=5, le=120)
    mode: Optional[str] = "LIVE"


class AuctionUpdate(BaseModel):
    base_price: Optional[float] = None
    bid_increment: Optional[float] = None
    timer_seconds: Optional[int] = None
    starting_purse: Optional[float] = None
    mode: Optional[str] = None


class AuctionOut(OrmModel):
    id: str
    tournament_id: str
    state: str
    mode: str = "LIVE"
    current_player_id: Optional[str]
    current_bid: Optional[float]
    highest_bidder_team_id: Optional[str]
    starting_purse: float
    base_price: float
    bid_increment: float
    timer_seconds: int
    timer_end_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class AuctionStateOut(OrmModel):
    """Full auction state snapshot for Socket.IO broadcasts."""
    id: str
    state: str
    mode: str = "LIVE"
    current_player: Optional[PlayerOut]
    current_bid: Optional[float]
    highest_bidder_team_id: Optional[str]
    highest_bidder_team_name: Optional[str]
    timer_end_at: Optional[datetime]
    bid_increment: float
    timer_seconds: int


class MarkSoldIn(BaseModel):
    team_id: Optional[str] = None


class ResetTournamentRequest(BaseModel):
    password: str = Field(..., min_length=1)
    mode: Optional[str] = "LIVE"  # LIVE
    confirm_phrase: Optional[str] = None  # required in LIVE mode: "RESET-LIVE-AUCTION"


class ChecklistItem(BaseModel):
    id: str
    label: str
    status: bool
    details: str


class ChecklistOut(BaseModel):
    all_ready: bool
    mode: str
    items: List[ChecklistItem]


# ─────────────────────────────────────────────────────────────
# Bid
# ─────────────────────────────────────────────────────────────
class PlaceBidRequest(BaseModel):
    auction_id: str
    amount: float = Field(..., gt=0)


class BidOut(OrmModel):
    id: str
    auction_id: str
    player_id: str
    team_id: str
    amount: float
    sequence_number: int
    is_accepted: bool
    rejection_reason: Optional[str]
    placed_at: datetime

    # Denormalized for convenience
    team_name: Optional[str] = None
    player_name: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# RosterEntry
# ─────────────────────────────────────────────────────────────
class RosterEntryOut(OrmModel):
    id: str
    auction_id: str
    team_id: str
    player_id: str
    sold_price: float
    sold_at: datetime
    player: Optional[PlayerOut] = None


# ─────────────────────────────────────────────────────────────
# Auction History / Results
# ─────────────────────────────────────────────────────────────
class AuctionResultTeam(BaseModel):
    team_id: str
    team_name: str
    players_purchased: int
    total_spent: float
    remaining_purse: float
    players: List[RosterEntryOut] = []


class AuctionResults(BaseModel):
    auction_id: str
    tournament_name: str
    total_players_sold: int
    total_players_unsold: int
    teams: List[AuctionResultTeam]


# Update forward refs
TeamWithRoster.model_rebuild()
