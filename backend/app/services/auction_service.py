"""
Auction service — the core auction engine.

Implements the full auction state machine:
  DRAFT → READY → LIVE → PAUSED → LIVE → SOLD/UNSOLD → READY/NEXT → COMPLETED

All bid validation and purse management happens here.
The backend is authoritative — never trust frontend values.
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuctionExpired,
    AuctionNotLive,
    AuctionPaused,
    BidTooLow,
    InsufficientPurse,
    InvalidStateTransition,
    NoBidderForSold,
    NotFound,
    PlayerAlreadySold,
    PlayerNotAvailable,
    TeamAlreadyHighestBidder,
)
from app.models.models import Auction, Player, Team, utcnow
from app.repositories.repositories import (
    AuctionEventRepository,
    AuctionRepository,
    BidRepository,
    PlayerRepository,
    RosterRepository,
    TeamRepository,
)
from app.schemas.schemas import (
    AuctionCreate,
    AuctionOut,
    AuctionStateOut,
    AuctionUpdate,
    BidOut,
    PlayerOut,
    PlaceBidRequest,
)

# Valid state transitions
VALID_TRANSITIONS = {
    "DRAFT": ["READY"],
    "READY": ["LIVE", "COMPLETED"],
    "LIVE": ["PAUSED", "SOLD", "UNSOLD"],
    "PAUSED": ["LIVE", "UNSOLD"],
    "SOLD": ["READY"],
    "UNSOLD": ["READY"],
    "COMPLETED": [],
}


def utcnow_ts() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


_auction_locks: dict[str, asyncio.Lock] = {}
_locks_guard = asyncio.Lock()


async def get_auction_lock(auction_id: str) -> asyncio.Lock:
    async with _locks_guard:
        if auction_id not in _auction_locks:
            _auction_locks[auction_id] = asyncio.Lock()
        return _auction_locks[auction_id]


class AuctionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.auction_repo = AuctionRepository(db)
        self.team_repo = TeamRepository(db)
        self.player_repo = PlayerRepository(db)
        self.bid_repo = BidRepository(db)
        self.roster_repo = RosterRepository(db)
        self.event_repo = AuctionEventRepository(db)

    # ── State Machine ──────────────────────────────────────────────────────

    def _assert_valid_transition(self, auction: Auction, target: str):
        allowed = VALID_TRANSITIONS.get(auction.state, [])
        if target not in allowed:
            raise InvalidStateTransition(auction.state, target)

    # ── Create / Config ────────────────────────────────────────────────────

    async def create_auction(self, data: AuctionCreate, actor_id: Optional[str] = None) -> AuctionOut:
        auction = await self.auction_repo.create(
            tournament_id=data.tournament_id,
            state="DRAFT",
            starting_purse=data.starting_purse,
            base_price=data.base_price,
            bid_increment=data.bid_increment,
            timer_seconds=data.timer_seconds,
        )
        await self.event_repo.log(auction.id, "created", actor_user_id=actor_id)
        return AuctionOut.model_validate(auction)

    async def update_config(self, auction_id: str, data: AuctionUpdate) -> AuctionOut:
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")
        if auction.state == "COMPLETED":
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Completed auction configuration cannot be modified.")
        updates = data.model_dump(exclude_none=True)
        await self.auction_repo.update(auction, **updates)
        return AuctionOut.model_validate(auction)

    async def get_auction(self, auction_id: str) -> AuctionOut:
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")
        return AuctionOut.model_validate(auction)

    async def get_state(self, auction_id: str) -> AuctionStateOut:
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")
        return await self._build_state_out(auction)

    async def _build_state_out(self, auction: Auction) -> AuctionStateOut:
        current_player = None
        if auction.current_player_id:
            player = await self.player_repo.get_by_id(auction.current_player_id)
            if player:
                current_player = PlayerOut.model_validate(player)

        bidder_name = None
        if auction.highest_bidder_team_id:
            team = await self.team_repo.get_by_id(auction.highest_bidder_team_id)
            if team:
                bidder_name = team.name

        return AuctionStateOut(
            id=auction.id,
            state=auction.state,
            mode=getattr(auction, "mode", "LIVE"),
            current_player=current_player,
            current_bid=auction.current_bid,
            highest_bidder_team_id=auction.highest_bidder_team_id,
            highest_bidder_team_name=bidder_name,
            timer_end_at=auction.timer_end_at,
            bid_increment=auction.bid_increment,
            timer_seconds=auction.timer_seconds,
        )

    # ── Admin Controls ─────────────────────────────────────────────────────

    async def start_auction(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Transition DRAFT → READY."""
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")
        self._assert_valid_transition(auction, "READY")
        await self.auction_repo.update(auction, state="READY", started_at=utcnow_ts())
        await self.event_repo.log(auction.id, "started", actor_user_id=actor_id)
        return await self._build_state_out(auction)

    async def set_current_player(
        self, auction_id: str, player_id: str, actor_id: Optional[str] = None
    ) -> AuctionStateOut:
        """Put a player into LIVE bidding state."""
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")

        if auction.state not in ("READY", "LIVE", "PAUSED"):
            raise InvalidStateTransition(auction.state, "LIVE")

        player = await self.player_repo.get_by_id(player_id)
        if not player:
            raise NotFound("Player")
        if player.status == "SOLD":
            raise PlayerAlreadySold()
        if player.status not in ("AVAILABLE", "UPCOMING"):
            raise PlayerNotAvailable()

        # Set player to LIVE status
        await self.player_repo.update(player, status="LIVE")

        # Reset auction state for this player
        timer_end = utcnow_ts() + timedelta(seconds=auction.timer_seconds)
        await self.auction_repo.update(
            auction,
            state="LIVE",
            current_player_id=player_id,
            current_bid=player.base_price,
            highest_bidder_team_id=None,
            timer_end_at=timer_end,
        )
        await self.event_repo.log(
            auction.id, "player_set",
            payload=json.dumps({"player_id": player_id, "base_price": player.base_price}),
            actor_user_id=actor_id,
        )
        # Reload to populate relationships
        auction = await self.auction_repo.get_by_id(auction_id)
        return await self._build_state_out(auction)

    async def pause_auction(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")
        self._assert_valid_transition(auction, "PAUSED")
        await self.auction_repo.update(auction, state="PAUSED")
        await self.event_repo.log(auction.id, "paused", actor_user_id=actor_id)
        return await self._build_state_out(auction)

    async def resume_auction(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")
        self._assert_valid_transition(auction, "LIVE")
        # Reset timer on resume
        timer_end = utcnow_ts() + timedelta(seconds=auction.timer_seconds)
        await self.auction_repo.update(auction, state="LIVE", timer_end_at=timer_end)
        await self.event_repo.log(auction.id, "resumed", actor_user_id=actor_id)
        return await self._build_state_out(auction)

    async def admin_bid(self, auction_id: str, amount: float, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Admin manual bid increment (no team association)."""
        auction = await self.auction_repo.get_by_id_locked(auction_id)
        if not auction:
            raise NotFound("Auction")
        if auction.state != "LIVE":
            raise AuctionNotLive()

        # Release previous team reservation if any
        if auction.highest_bidder_team_id:
            prev_team = await self.team_repo.get_by_id_locked(auction.highest_bidder_team_id)
            if prev_team:
                await self.team_repo.update(prev_team, reserved_amount=0.0)

        timer_end = utcnow_ts() + timedelta(seconds=auction.timer_seconds)
        await self.auction_repo.update(
            auction, current_bid=amount, highest_bidder_team_id=None, timer_end_at=timer_end
        )
        await self.event_repo.log(
            auction.id, "admin_bid",
            payload=json.dumps({"amount": amount}),
            actor_user_id=actor_id,
        )
        auction = await self.auction_repo.get_by_id(auction_id)
        return await self._build_state_out(auction)

    async def undo_last_bid(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Undo the last accepted bid and revert auction state."""
        auction = await self.auction_repo.get_by_id_locked(auction_id)
        if not auction:
            raise NotFound("Auction")
        if auction.state not in ("LIVE", "PAUSED"):
            raise InvalidStateTransition(auction.state, "UNDO")

        # Get last 2 accepted bids
        bids = await self.bid_repo.get_by_auction(auction_id, limit=2)
        accepted = [b for b in bids if b.is_accepted]

        if not accepted:
            raise NotFound("No bids to undo")

        last_bid = accepted[0]

        # Release reservation for the team whose bid is being undone
        last_team = await self.team_repo.get_by_id_locked(last_bid.team_id)
        if last_team:
            await self.team_repo.update(last_team, reserved_amount=0.0)

        # Revert to previous bid if exists
        if len(accepted) >= 2:
            prev_bid = accepted[1]
            prev_team = await self.team_repo.get_by_id_locked(prev_bid.team_id)
            if prev_team:
                await self.team_repo.update(prev_team, reserved_amount=prev_bid.amount)
            await self.auction_repo.update(
                auction,
                current_bid=prev_bid.amount,
                highest_bidder_team_id=prev_bid.team_id,
            )
        else:
            # Revert to base price, no bidder
            player = await self.player_repo.get_by_id(auction.current_player_id)
            base = player.base_price if player else auction.base_price
            await self.auction_repo.update(
                auction, current_bid=base, highest_bidder_team_id=None
            )

        # Mark last bid as rejected
        from sqlalchemy import update as sql_update
        from app.models.models import Bid
        await self.db.execute(
            sql_update(Bid)
            .where(Bid.id == last_bid.id)
            .values(is_accepted=False, rejection_reason="UNDO_BY_ADMIN")
        )
        await self.event_repo.log(auction.id, "bid_undone", actor_user_id=actor_id)
        auction = await self.auction_repo.get_by_id(auction_id)
        return await self._build_state_out(auction)

    async def mark_sold(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Finalize the current player as SOLD to the highest bidder."""
        auction = await self.auction_repo.get_by_id_locked(auction_id)
        if not auction:
            raise NotFound("Auction")

        if auction.state not in ("LIVE", "PAUSED"):
            raise InvalidStateTransition(auction.state, "SOLD")

        if not auction.highest_bidder_team_id:
            raise NoBidderForSold()

        player_id = auction.current_player_id
        player = await self.player_repo.get_by_id(player_id)
        if not player:
            raise NotFound("Player")

        sold_price = auction.current_bid or player.base_price
        team_id = auction.highest_bidder_team_id

        # Update player status
        await self.player_repo.update(player, status="SOLD")

        # Convert team reservation to spent
        team = await self.team_repo.get_by_id_locked(team_id)
        if team:
            assert team.spent_amount + sold_price <= team.total_purse + 0.001, "Purse invariant violation"
            new_spent = team.spent_amount + sold_price
            await self.team_repo.update(team, spent_amount=new_spent, reserved_amount=0.0)

        # Create roster entry
        await self.roster_repo.create(
            auction_id=auction_id,
            team_id=team_id,
            player_id=player_id,
            sold_price=sold_price,
        )

        # Update auction state
        await self.auction_repo.update(
            auction,
            state="SOLD",
            current_player_id=player_id,
        )

        await self.event_repo.log(
            auction.id, "sold",
            payload=json.dumps({"player_id": player_id, "team_id": team_id, "price": sold_price}),
            actor_user_id=actor_id,
        )
        auction = await self.auction_repo.get_by_id(auction_id)
        return await self._build_state_out(auction)

    async def mark_unsold(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Mark current player as UNSOLD."""
        auction = await self.auction_repo.get_by_id_locked(auction_id)
        if not auction:
            raise NotFound("Auction")

        if auction.state not in ("LIVE", "PAUSED"):
            raise InvalidStateTransition(auction.state, "UNSOLD")

        player = await self.player_repo.get_by_id(auction.current_player_id)
        if player:
            await self.player_repo.update(player, status="UNSOLD")

        # Release any reservation
        if auction.highest_bidder_team_id:
            team = await self.team_repo.get_by_id_locked(auction.highest_bidder_team_id)
            if team:
                await self.team_repo.update(team, reserved_amount=0.0)

        await self.auction_repo.update(
            auction, state="UNSOLD", highest_bidder_team_id=None, current_bid=None
        )
        await self.event_repo.log(auction.id, "unsold", actor_user_id=actor_id)
        auction = await self.auction_repo.get_by_id(auction_id)
        return await self._build_state_out(auction)

    async def skip_player(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Skip current player, return player to AVAILABLE status, release any reservations."""
        auction = await self.auction_repo.get_by_id_locked(auction_id)
        if not auction:
            raise NotFound("Auction")
        if auction.state not in ("LIVE", "PAUSED", "READY"):
            raise InvalidStateTransition(auction.state, "SKIPPED")

        if auction.current_player_id:
            player = await self.player_repo.get_by_id(auction.current_player_id)
            if player:
                await self.player_repo.update(player, status="AVAILABLE")

        if auction.highest_bidder_team_id:
            team = await self.team_repo.get_by_id_locked(auction.highest_bidder_team_id)
            if team:
                await self.team_repo.update(team, reserved_amount=0.0)

        await self.auction_repo.update(
            auction,
            state="READY",
            current_player_id=None,
            current_bid=None,
            highest_bidder_team_id=None,
            timer_end_at=None,
        )
        await self.event_repo.log(auction.id, "player_skipped", actor_user_id=actor_id)
        return await self._build_state_out(auction)

    async def next_player(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Move auction to READY state for next player."""
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")

        if auction.state not in ("SOLD", "UNSOLD"):
            raise InvalidStateTransition(auction.state, "READY")

        await self.auction_repo.update(
            auction,
            state="READY",
            current_player_id=None,
            current_bid=None,
            highest_bidder_team_id=None,
            timer_end_at=None,
        )
        await self.event_repo.log(auction.id, "next_player", actor_user_id=actor_id)
        auction = await self.auction_repo.get_by_id(auction_id)
        return await self._build_state_out(auction)

    async def complete_auction(self, auction_id: str, actor_id: Optional[str] = None) -> AuctionStateOut:
        """Mark auction as COMPLETED."""
        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")
        self._assert_valid_transition(auction, "COMPLETED")
        await self.auction_repo.update(auction, state="COMPLETED", completed_at=utcnow_ts())
        await self.event_repo.log(auction.id, "completed", actor_user_id=actor_id)
        auction = await self.auction_repo.get_by_id(auction_id)
        return await self._build_state_out(auction)

    # ── Bid Placement ─────────────────────────────────────────────────────

    async def place_bid(
        self, auction_id: str, team_id: str, amount: float, actor_id: Optional[str] = None
    ) -> BidOut:
        """
        Place a bid from a team. All validation is done server-side.

        Uses row-level locking on both auction and team rows, plus an in-process
        asyncio lock per auction to serialize concurrent bid evaluations and prevent
        race conditions.
        """
        lock = await get_auction_lock(auction_id)
        async with lock:
            # Lock auction row first (deterministic lock order prevents deadlocks)
            auction = await self.auction_repo.get_by_id_locked(auction_id)
            if not auction:
                raise NotFound("Auction")

            # Validate auction state
            if auction.state == "PAUSED":
                raise AuctionPaused()
            if auction.state != "LIVE":
                raise AuctionNotLive()

            # Check server authoritative timer expiration
            if auction.timer_end_at and ensure_utc(auction.timer_end_at) < utcnow_ts():
                raise AuctionExpired()

            # Validate player
            if not auction.current_player_id:
                raise PlayerNotAvailable()

            # Validate team isn't already highest bidder
            if auction.highest_bidder_team_id == team_id:
                raise TeamAlreadyHighestBidder()

            # Lock team row
            team = await self.team_repo.get_by_id_locked(team_id)
            if not team:
                raise NotFound("Team")

            # Validate bid amount
            player = await self.player_repo.get_by_id(auction.current_player_id)
            base = player.base_price if player else auction.base_price

            if auction.highest_bidder_team_id is None:
                # First bid for this player — must meet or exceed base price
                minimum_bid = base
            else:
                # Subsequent bid — must exceed current bid by at least bid_increment
                minimum_bid = (auction.current_bid or base) + auction.bid_increment

            if amount < minimum_bid:
                raise BidTooLow(minimum=minimum_bid, received=amount)

            # Validate purse
            available = team.total_purse - team.spent_amount - team.reserved_amount
            if available < amount:
                raise InsufficientPurse(available=available, required=amount)

            assert team.spent_amount + amount <= team.total_purse + 0.001, "Purse invariant violation"

            # ── All validations passed — commit the bid ──

            # Release reservation from previous highest bidder
            prev_bidder_id = auction.highest_bidder_team_id
            if prev_bidder_id and prev_bidder_id != team_id:
                prev_team = await self.team_repo.get_by_id_locked(prev_bidder_id)
                if prev_team:
                    await self.team_repo.update(prev_team, reserved_amount=0.0)

            # Reserve amount for this team
            await self.team_repo.update(team, reserved_amount=amount)

            # Get next sequence number
            seq = await self.bid_repo.get_max_sequence(auction_id, auction.current_player_id) + 1

            # Record bid
            bid = await self.bid_repo.create(
                auction_id=auction_id,
                player_id=auction.current_player_id,
                team_id=team_id,
                amount=amount,
                sequence_number=seq,
                is_accepted=True,
            )

            # Update auction state
            timer_end = utcnow_ts() + timedelta(seconds=auction.timer_seconds)
            await self.auction_repo.update(
                auction,
                current_bid=amount,
                highest_bidder_team_id=team_id,
                timer_end_at=timer_end,
            )

            await self.event_repo.log(
                auction.id, "bid",
                payload=json.dumps({"team_id": team_id, "amount": amount, "seq": seq}),
                actor_user_id=actor_id,
            )

            await self.db.commit()

            return BidOut(
                id=bid.id,
                auction_id=bid.auction_id,
                player_id=bid.player_id,
                team_id=bid.team_id,
                amount=bid.amount,
                sequence_number=bid.sequence_number,
                is_accepted=bid.is_accepted,
                rejection_reason=bid.rejection_reason,
                placed_at=bid.placed_at,
                team_name=team.name,
            )

    # ── Results ───────────────────────────────────────────────────────────

    async def get_results(self, auction_id: str):
        from app.schemas.schemas import AuctionResultTeam, AuctionResults, RosterEntryOut
        from app.repositories.repositories import TournamentRepository

        auction = await self.auction_repo.get_by_id(auction_id)
        if not auction:
            raise NotFound("Auction")

        t_repo = TournamentRepository(self.db)
        tournament = await t_repo.get_by_id(auction.tournament_id)

        teams = await self.team_repo.get_by_tournament(auction.tournament_id)
        roster_entries = await self.roster_repo.get_by_auction(auction_id)

        # Group entries by team
        team_entries: dict = {str(t.id): [] for t in teams}
        for entry in roster_entries:
            tid = str(entry.team_id)
            if tid in team_entries:
                team_entries[tid].append(RosterEntryOut.model_validate(entry))

        result_teams = []
        for team in teams:
            entries = team_entries.get(str(team.id), [])
            result_teams.append(AuctionResultTeam(
                team_id=str(team.id),
                team_name=team.name,
                players_purchased=len(entries),
                total_spent=team.spent_amount,
                remaining_purse=team.available_purse,
                players=entries,
            ))

        sold = sum(1 for e in roster_entries)
        all_players = await self.player_repo.get_by_tournament(auction.tournament_id)
        unsold = sum(1 for p in all_players if p.status == "UNSOLD")

        return AuctionResults(
            auction_id=auction_id,
            tournament_name=tournament.name if tournament else "Unknown",
            total_players_sold=sold,
            total_players_unsold=unsold,
            teams=result_teams,
        )
