"""
Repository layer — all database access goes through here.
Keeps route handlers and services thin.
"""
from typing import List, Optional, Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import (
    Auction,
    AuctionEvent,
    Bid,
    Player,
    RosterEntry,
    Team,
    Tournament,
    User,
    utcnow,
)


# ─────────────────────────────────────────────────────────────
# User Repository
# ─────────────────────────────────────────────────────────────
class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def list_all(self) -> Sequence[User]:
        result = await self.db.execute(select(User).order_by(User.created_at))
        return result.scalars().all()

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, **kwargs) -> User:
        for k, v in kwargs.items():
            setattr(user, k, v)
        user.updated_at = utcnow()
        await self.db.flush()
        await self.db.refresh(user)
        return user


# ─────────────────────────────────────────────────────────────
# Tournament Repository
# ─────────────────────────────────────────────────────────────
class TournamentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tournament_id: str) -> Optional[Tournament]:
        result = await self.db.execute(
            select(Tournament).where(Tournament.id == tournament_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> Sequence[Tournament]:
        result = await self.db.execute(select(Tournament).order_by(Tournament.created_at.desc()))
        return result.scalars().all()

    async def create(self, **kwargs) -> Tournament:
        t = Tournament(**kwargs)
        self.db.add(t)
        await self.db.flush()
        await self.db.refresh(t)
        return t

    async def update(self, tournament: Tournament, **kwargs) -> Tournament:
        for k, v in kwargs.items():
            setattr(tournament, k, v)
        tournament.updated_at = utcnow()
        await self.db.flush()
        await self.db.refresh(tournament)
        return tournament

    async def delete(self, tournament: Tournament):
        await self.db.delete(tournament)
        await self.db.flush()


# ─────────────────────────────────────────────────────────────
# Team Repository
# ─────────────────────────────────────────────────────────────
class TeamRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, team_id: str) -> Optional[Team]:
        result = await self.db.execute(
            select(Team)
            .where(Team.id == team_id)
            .options(selectinload(Team.roster_entries).selectinload(RosterEntry.player))
        )
        return result.scalar_one_or_none()

    async def get_by_id_locked(self, team_id: str) -> Optional[Team]:
        """Get team with row-level lock for bid processing."""
        result = await self.db.execute(
            select(Team).where(Team.id == team_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_by_tournament(self, tournament_id: str) -> Sequence[Team]:
        result = await self.db.execute(
            select(Team)
            .where(Team.tournament_id == tournament_id)
            .options(selectinload(Team.roster_entries).selectinload(RosterEntry.player))
            .order_by(Team.name)
        )
        return result.scalars().all()

    async def create(self, **kwargs) -> Team:
        team = Team(**kwargs)
        self.db.add(team)
        await self.db.flush()
        await self.db.refresh(team)
        return team

    async def update(self, team: Team, **kwargs) -> Team:
        for k, v in kwargs.items():
            setattr(team, k, v)
        team.updated_at = utcnow()
        await self.db.flush()
        await self.db.refresh(team)
        return team

    async def delete(self, team: Team):
        await self.db.delete(team)
        await self.db.flush()


# ─────────────────────────────────────────────────────────────
# Player Repository
# ─────────────────────────────────────────────────────────────
class PlayerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, player_id: str) -> Optional[Player]:
        result = await self.db.execute(select(Player).where(Player.id == player_id))
        return result.scalar_one_or_none()

    async def get_by_tournament(
        self,
        tournament_id: str,
        status: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Sequence[Player]:
        q = select(Player).where(Player.tournament_id == tournament_id)
        if status:
            q = q.where(Player.status == status)
        if category:
            q = q.where(Player.category == category)
        q = q.order_by(Player.auction_order, Player.name)
        result = await self.db.execute(q)
        return result.scalars().all()

    async def get_next_available(self, tournament_id: str, current_order: int = -1) -> Optional[Player]:
        result = await self.db.execute(
            select(Player)
            .where(
                Player.tournament_id == tournament_id,
                Player.status == "AVAILABLE",
                Player.auction_order > current_order,
            )
            .order_by(Player.auction_order, Player.name)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Player:
        player = Player(**kwargs)
        self.db.add(player)
        await self.db.flush()
        await self.db.refresh(player)
        return player

    async def update(self, player: Player, **kwargs) -> Player:
        for k, v in kwargs.items():
            setattr(player, k, v)
        player.updated_at = utcnow()
        await self.db.flush()
        await self.db.refresh(player)
        return player

    async def delete(self, player: Player):
        await self.db.delete(player)
        await self.db.flush()

    async def bulk_create(self, players: List[dict]) -> List[Player]:
        objs = [Player(**p) for p in players]
        self.db.add_all(objs)
        await self.db.flush()
        return objs


# ─────────────────────────────────────────────────────────────
# Auction Repository
# ─────────────────────────────────────────────────────────────
class AuctionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, auction_id: str) -> Optional[Auction]:
        result = await self.db.execute(
            select(Auction)
            .where(Auction.id == auction_id)
            .options(
                selectinload(Auction.current_player),
                selectinload(Auction.highest_bidder_team),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id_locked(self, auction_id: str) -> Optional[Auction]:
        """Row-level lock for bid processing — prevents race conditions."""
        result = await self.db.execute(
            select(Auction).where(Auction.id == auction_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_active_by_tournament(self, tournament_id: str) -> Optional[Auction]:
        result = await self.db.execute(
            select(Auction)
            .where(
                Auction.tournament_id == tournament_id,
                Auction.state.notin_(["COMPLETED", "DRAFT"]),
            )
            .options(
                selectinload(Auction.current_player),
                selectinload(Auction.highest_bidder_team),
            )
            .order_by(Auction.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_by_tournament(self, tournament_id: str) -> Sequence[Auction]:
        result = await self.db.execute(
            select(Auction)
            .where(Auction.tournament_id == tournament_id)
            .order_by(Auction.created_at.desc())
        )
        return result.scalars().all()

    async def create(self, **kwargs) -> Auction:
        auction = Auction(**kwargs)
        self.db.add(auction)
        await self.db.flush()
        await self.db.refresh(auction)
        return auction

    async def update(self, auction: Auction, **kwargs) -> Auction:
        for k, v in kwargs.items():
            setattr(auction, k, v)
        auction.updated_at = utcnow()
        await self.db.flush()
        return auction


# ─────────────────────────────────────────────────────────────
# Bid Repository
# ─────────────────────────────────────────────────────────────
class BidRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_auction(self, auction_id: str, limit: int = 50) -> Sequence[Bid]:
        result = await self.db.execute(
            select(Bid)
            .where(Bid.auction_id == auction_id, Bid.is_accepted == True)
            .order_by(Bid.placed_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_by_player(self, auction_id: str, player_id: str) -> Sequence[Bid]:
        result = await self.db.execute(
            select(Bid)
            .where(Bid.auction_id == auction_id, Bid.player_id == player_id)
            .order_by(Bid.placed_at.desc())
        )
        return result.scalars().all()

    async def get_max_sequence(self, auction_id: str, player_id: str) -> int:
        from sqlalchemy import func
        result = await self.db.execute(
            select(func.max(Bid.sequence_number)).where(
                Bid.auction_id == auction_id, Bid.player_id == player_id
            )
        )
        val = result.scalar_one_or_none()
        return val or 0

    async def create(self, **kwargs) -> Bid:
        bid = Bid(**kwargs)
        self.db.add(bid)
        await self.db.flush()
        await self.db.refresh(bid)
        return bid


# ─────────────────────────────────────────────────────────────
# RosterEntry Repository
# ─────────────────────────────────────────────────────────────
class RosterRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_team(self, team_id: str) -> Sequence[RosterEntry]:
        result = await self.db.execute(
            select(RosterEntry)
            .where(RosterEntry.team_id == team_id)
            .options(selectinload(RosterEntry.player))
            .order_by(RosterEntry.sold_at)
        )
        return result.scalars().all()

    async def get_by_auction(self, auction_id: str) -> Sequence[RosterEntry]:
        result = await self.db.execute(
            select(RosterEntry)
            .where(RosterEntry.auction_id == auction_id)
            .options(selectinload(RosterEntry.player), selectinload(RosterEntry.team))
            .order_by(RosterEntry.sold_at)
        )
        return result.scalars().all()

    async def create(self, **kwargs) -> RosterEntry:
        entry = RosterEntry(**kwargs)
        self.db.add(entry)
        await self.db.flush()
        await self.db.refresh(entry)
        return entry


# ─────────────────────────────────────────────────────────────
# AuctionEvent Repository
# ─────────────────────────────────────────────────────────────
class AuctionEventRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(self, auction_id: str, event_type: str, payload: str = None, actor_user_id: str = None) -> AuctionEvent:
        event = AuctionEvent(
            auction_id=auction_id,
            event_type=event_type,
            payload=payload,
            actor_user_id=actor_user_id,
        )
        self.db.add(event)
        await self.db.flush()
        return event

    async def get_by_auction(self, auction_id: str, limit: int = 100) -> Sequence[AuctionEvent]:
        result = await self.db.execute(
            select(AuctionEvent)
            .where(AuctionEvent.auction_id == auction_id)
            .order_by(AuctionEvent.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
