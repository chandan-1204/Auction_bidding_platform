"""
SQLAlchemy ORM models for the FlyHigh Auction platform.
All models use UUIDs as primary keys.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────
# User
# ─────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="captain")  # admin | captain
    is_active = Column(Boolean, default=True, nullable=False)
    team_id = Column(UUID(as_uuid=False), ForeignKey("teams.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    team = relationship("Team", back_populates="captain_user", foreign_keys=[team_id])


# ─────────────────────────────────────────────────────────────
# Tournament
# ─────────────────────────────────────────────────────────────
class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sport = Column(String(64), default="Badminton")
    status = Column(String(32), default="DRAFT")  # DRAFT | ACTIVE | COMPLETED
    mode = Column(String(32), default="LIVE", nullable=False)  # PRACTICE | LIVE
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    auctions = relationship("Auction", back_populates="tournament")
    teams = relationship("Team", back_populates="tournament")
    players = relationship("Player", back_populates="tournament")


# ─────────────────────────────────────────────────────────────
# Team
# ─────────────────────────────────────────────────────────────
class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    tournament_id = Column(UUID(as_uuid=False), ForeignKey("tournaments.id"), nullable=False)
    name = Column(String(128), nullable=False)
    logo_url = Column(String(512), nullable=True)
    captain_name = Column(String(128), nullable=True)
    captain_username = Column(String(64), nullable=True)

    # Purse fields (all in INR)
    total_purse = Column(Float, default=5000.0, nullable=False)
    spent_amount = Column(Float, default=0.0, nullable=False)
    reserved_amount = Column(Float, default=0.0, nullable=False)  # reserved for current highest bid

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    tournament = relationship("Tournament", back_populates="teams")
    captain_user = relationship("User", back_populates="team", foreign_keys="[User.team_id]")
    roster_entries = relationship("RosterEntry", back_populates="team")
    bids = relationship("Bid", back_populates="team")

    __table_args__ = (
        UniqueConstraint("tournament_id", "name", name="uq_team_name_per_tournament"),
        Index("ix_teams_tournament_id", "tournament_id"),
    )

    @property
    def available_purse(self) -> float:
        return self.total_purse - self.spent_amount - self.reserved_amount


# ─────────────────────────────────────────────────────────────
# Player
# ─────────────────────────────────────────────────────────────
class Player(Base):
    __tablename__ = "players"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    tournament_id = Column(UUID(as_uuid=False), ForeignKey("tournaments.id"), nullable=False)
    name = Column(String(128), nullable=False)
    photo_url = Column(String(512), nullable=True)
    gender = Column(String(16), nullable=True)   # Male | Female | Other
    age = Column(Integer, nullable=True)
    age_group = Column(String(32), nullable=True)  # e.g. "20+", "30+", "40+"
    category = Column(String(64), nullable=True)   # e.g. "Intermediate", "Beginner+"
    skill_level = Column(String(64), nullable=True)
    base_price = Column(Float, default=500.0, nullable=False)
    status = Column(String(32), default="AVAILABLE", nullable=False)
    # AVAILABLE | UPCOMING | LIVE | SOLD | UNSOLD | SKIPPED
    auction_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    tournament = relationship("Tournament", back_populates="players")
    roster_entry = relationship("RosterEntry", back_populates="player", uselist=False)
    bids = relationship("Bid", back_populates="player")

    __table_args__ = (
        Index("ix_players_tournament_status", "tournament_id", "status"),
        Index("ix_players_auction_order", "tournament_id", "auction_order"),
    )


# ─────────────────────────────────────────────────────────────
# Auction
# ─────────────────────────────────────────────────────────────
class Auction(Base):
    __tablename__ = "auctions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    tournament_id = Column(UUID(as_uuid=False), ForeignKey("tournaments.id"), nullable=False)

    # State machine: DRAFT | READY | LIVE | PAUSED | SOLD | UNSOLD | COMPLETED
    state = Column(String(32), default="DRAFT", nullable=False)
    mode = Column(String(32), default="LIVE", nullable=False)  # PRACTICE | LIVE

    # Currently active player
    current_player_id = Column(UUID(as_uuid=False), ForeignKey("players.id"), nullable=True)
    current_bid = Column(Float, nullable=True)
    highest_bidder_team_id = Column(UUID(as_uuid=False), ForeignKey("teams.id"), nullable=True)

    # Config
    starting_purse = Column(Float, default=5000.0, nullable=False)
    base_price = Column(Float, default=500.0, nullable=False)
    bid_increment = Column(Float, default=100.0, nullable=False)
    timer_seconds = Column(Integer, default=15, nullable=False)

    # Timestamps
    timer_end_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    tournament = relationship("Tournament", back_populates="auctions")
    current_player = relationship("Player", foreign_keys=[current_player_id])
    highest_bidder_team = relationship("Team", foreign_keys=[highest_bidder_team_id])
    bids = relationship("Bid", back_populates="auction")
    events = relationship("AuctionEvent", back_populates="auction")

    __table_args__ = (
        Index("ix_auctions_tournament_state", "tournament_id", "state"),
    )


# ─────────────────────────────────────────────────────────────
# Bid
# ─────────────────────────────────────────────────────────────
class Bid(Base):
    __tablename__ = "bids"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    auction_id = Column(UUID(as_uuid=False), ForeignKey("auctions.id"), nullable=False)
    player_id = Column(UUID(as_uuid=False), ForeignKey("players.id"), nullable=False)
    team_id = Column(UUID(as_uuid=False), ForeignKey("teams.id"), nullable=False)
    amount = Column(Float, nullable=False)
    sequence_number = Column(Integer, nullable=False, default=0)
    is_accepted = Column(Boolean, default=True, nullable=False)
    rejection_reason = Column(String(128), nullable=True)
    placed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    auction = relationship("Auction", back_populates="bids")
    player = relationship("Player", back_populates="bids")
    team = relationship("Team", back_populates="bids")

    __table_args__ = (
        Index("ix_bids_auction_player", "auction_id", "player_id"),
        Index("ix_bids_team", "team_id"),
        Index("ix_bids_placed_at", "placed_at"),
    )


# ─────────────────────────────────────────────────────────────
# RosterEntry — records a sold player in a team's roster
# ─────────────────────────────────────────────────────────────
class RosterEntry(Base):
    __tablename__ = "roster_entries"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    auction_id = Column(UUID(as_uuid=False), ForeignKey("auctions.id"), nullable=False)
    team_id = Column(UUID(as_uuid=False), ForeignKey("teams.id"), nullable=False)
    player_id = Column(UUID(as_uuid=False), ForeignKey("players.id"), nullable=False)
    sold_price = Column(Float, nullable=False)
    sold_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    team = relationship("Team", back_populates="roster_entries")
    player = relationship("Player", back_populates="roster_entry")

    __table_args__ = (
        UniqueConstraint("auction_id", "player_id", name="uq_roster_player_per_auction"),
        Index("ix_roster_team", "team_id"),
    )


# ─────────────────────────────────────────────────────────────
# AuctionEvent — audit log of all auction state changes
# ─────────────────────────────────────────────────────────────
class AuctionEvent(Base):
    __tablename__ = "auction_events"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    auction_id = Column(UUID(as_uuid=False), ForeignKey("auctions.id"), nullable=False)
    event_type = Column(String(64), nullable=False)  # started | bid | sold | unsold | paused | etc.
    payload = Column(Text, nullable=True)  # JSON string
    actor_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    auction = relationship("Auction", back_populates="events")

    __table_args__ = (
        Index("ix_auction_events_auction", "auction_id"),
        Index("ix_auction_events_created_at", "created_at"),
    )
