"""
Auction endpoints — state machine controls and bid placement.
All state mutations broadcast via Socket.IO after DB commit.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.core.database import get_db
from app.core.exceptions import Unauthorized
from app.models.models import User
from app.repositories.repositories import BidRepository, TeamRepository
from app.schemas.schemas import (
    AuctionCreate,
    AuctionOut,
    AuctionResults,
    AuctionStateOut,
    AuctionUpdate,
    BidOut,
    MarkSoldIn,
    PlaceBidRequest,
)
from app.services.auction_service import AuctionService
from app.websocket.socket_manager import (
    broadcast_auction_state,
    broadcast_bid,
    broadcast_sold,
    broadcast_team_purse,
    broadcast_unsold,
    get_sio,
)

router = APIRouter(prefix="/api/auctions", tags=["auctions"])


def _state_dict(state: AuctionStateOut) -> dict:
    return json.loads(state.model_dump_json())


async def _broadcast_state(auction_id: str, state: AuctionStateOut):
    await broadcast_auction_state(auction_id, _state_dict(state))


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/", response_model=AuctionOut, status_code=201)
async def create_auction(
    data: AuctionCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    return await svc.create_auction(data, actor_id=admin.id)


@router.get("/active", response_model=Optional[AuctionStateOut])
async def get_active_auction(
    tournament_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.repositories.repositories import AuctionRepository
    repo = AuctionRepository(db)
    auction = await repo.get_active_by_tournament(tournament_id)
    if not auction:
        return None
    svc = AuctionService(db)
    return await svc._build_state_out(auction)


@router.get("/{auction_id}", response_model=AuctionOut)
async def get_auction(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    svc = AuctionService(db)
    return await svc.get_auction(auction_id)


@router.get("/{auction_id}/state", response_model=AuctionStateOut)
async def get_auction_state(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    svc = AuctionService(db)
    return await svc.get_state(auction_id)


@router.patch("/{auction_id}/config", response_model=AuctionOut)
async def update_auction_config(
    auction_id: str,
    data: AuctionUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    return await svc.update_config(auction_id, data)


# ── Admin Controls ────────────────────────────────────────────────────────────

@router.post("/{auction_id}/start", response_model=AuctionStateOut)
async def start_auction(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.start_auction(auction_id, actor_id=admin.id)
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/player/{player_id}", response_model=AuctionStateOut)
async def set_current_player(
    auction_id: str,
    player_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.set_current_player(auction_id, player_id, actor_id=admin.id)
    sio = get_sio()
    await sio.emit("auction:next_player", _state_dict(state), room=f"auction:{auction_id}")
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/pause", response_model=AuctionStateOut)
async def pause_auction(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.pause_auction(auction_id, actor_id=admin.id)
    sio = get_sio()
    await sio.emit("auction:paused", _state_dict(state), room=f"auction:{auction_id}")
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/resume", response_model=AuctionStateOut)
async def resume_auction(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.resume_auction(auction_id, actor_id=admin.id)
    sio = get_sio()
    await sio.emit("auction:resumed", _state_dict(state), room=f"auction:{auction_id}")
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/admin-bid", response_model=AuctionStateOut)
async def admin_bid(
    auction_id: str,
    amount: float = Query(..., gt=0),
    team_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.admin_bid(auction_id, amount, team_id=team_id, actor_id=admin.id)
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/undo-bid", response_model=AuctionStateOut)
async def undo_bid(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.undo_last_bid(auction_id, actor_id=admin.id)
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/sold", response_model=AuctionStateOut)
async def mark_sold(
    auction_id: str,
    payload: Optional[MarkSoldIn] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    team_id = payload.team_id if payload else None
    svc = AuctionService(db)
    state = await svc.mark_sold(auction_id, team_id=team_id, actor_id=admin.id)
    await broadcast_sold(auction_id, _state_dict(state))
    await _broadcast_state(auction_id, state)
    # Also broadcast team purse updates
    from app.repositories.repositories import AuctionRepository, TeamRepository as TR
    a_repo = AuctionRepository(db)
    auction = await a_repo.get_by_id(auction_id)
    if auction:
        t_repo = TR(db)
        teams = await t_repo.get_by_tournament(auction.tournament_id)
        for t in teams:
            from app.schemas.schemas import TeamOut
            await broadcast_team_purse(auction_id, json.loads(TeamOut.model_validate(t).model_dump_json()))
    return state


@router.post("/{auction_id}/unsold", response_model=AuctionStateOut)
async def mark_unsold(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.mark_unsold(auction_id, actor_id=admin.id)
    await broadcast_unsold(auction_id, _state_dict(state))
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/skip", response_model=AuctionStateOut)
async def skip_player(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.skip_player(auction_id, actor_id=admin.id)
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/next-player", response_model=AuctionStateOut)
async def next_player(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.next_player(auction_id, actor_id=admin.id)
    await _broadcast_state(auction_id, state)
    return state


@router.post("/{auction_id}/complete", response_model=AuctionStateOut)
async def complete_auction(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    svc = AuctionService(db)
    state = await svc.complete_auction(auction_id, actor_id=admin.id)
    sio = get_sio()
    await sio.emit("auction:completed", _state_dict(state), room=f"auction:{auction_id}")
    await _broadcast_state(auction_id, state)
    return state


# ── Bid Placement ──────────────────────────────────────────────────────────

@router.post("/{auction_id}/bid", response_model=BidOut)
async def place_bid(
    auction_id: str,
    data: PlaceBidRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Captain places a bid. The team_id comes from the authenticated user —
    never trust the client to provide their own team_id.
    """
    if not current_user.team_id:
        raise Unauthorized("Your account is not associated with a team.")

    # Allow admin to test bid on any team they specify via data.auction_id == auction_id check
    team_id = current_user.team_id

    svc = AuctionService(db)
    bid = await svc.place_bid(
        auction_id=auction_id,
        team_id=team_id,
        amount=data.amount,
        actor_id=current_user.id,
    )

    # Broadcast new state and bid to all clients
    state = await svc.get_state(auction_id)
    await broadcast_bid(auction_id, json.loads(bid.model_dump_json()))
    await _broadcast_state(auction_id, state)

    # Broadcast team purse update
    t_repo = TeamRepository(db)
    team = await t_repo.get_by_id(team_id)
    if team:
        from app.schemas.schemas import TeamOut
        await broadcast_team_purse(auction_id, json.loads(TeamOut.model_validate(team).model_dump_json()))

    return bid


# ── Bid History ────────────────────────────────────────────────────────────

@router.get("/{auction_id}/bids", response_model=List[BidOut])
async def get_bid_history(
    auction_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    bid_repo = BidRepository(db)
    bids = await bid_repo.get_by_auction(auction_id, limit=limit)
    result = []
    for bid in bids:
        bo = BidOut.model_validate(bid)
        if bid.team:
            bo.team_name = bid.team.name
        if bid.player:
            bo.player_name = bid.player.name
        result.append(bo)
    return result


# ── Results ────────────────────────────────────────────────────────────────

@router.get("/{auction_id}/results", response_model=AuctionResults)
async def get_results(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    svc = AuctionService(db)
    return await svc.get_results(auction_id)


@router.get("/{auction_id}/results/export-csv")
async def export_results_csv(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    import csv, io
    svc = AuctionService(db)
    results = await svc.get_results(auction_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Team", "Player", "Category", "Sold Price"])
    for team in results.teams:
        for entry in team.players:
            player = entry.player
            writer.writerow([
                team.team_name,
                player.name if player else entry.player_id,
                player.category if player else "",
                entry.sold_price,
            ])
    output.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=auction_results.csv"},
    )
