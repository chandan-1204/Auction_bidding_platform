"""Player endpoints — CRUD, photo upload, CSV import/export."""
import io
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import PlayerCreate, PlayerOut, PlayerUpdate
from app.services.player_service import PlayerService

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("/", response_model=List[PlayerOut])
async def list_players(
    tournament_id: str = Query(...),
    status: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    svc = PlayerService(db)
    return await svc.list_players(tournament_id, status=status, category=category)


@router.post("/", response_model=PlayerOut, status_code=201)
async def create_player(
    data: PlayerCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = PlayerService(db)
    return await svc.create_player(data)


@router.get("/export-csv")
async def export_players_csv(
    tournament_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = PlayerService(db)
    players = await svc.list_players(tournament_id)
    csv_content = svc.export_csv(players)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=players.csv"},
    )


@router.post("/import-csv", response_model=List[PlayerOut])
async def import_players_csv(
    tournament_id: str = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    content = await file.read()
    svc = PlayerService(db)
    return await svc.bulk_import_csv(tournament_id, content)


@router.get("/{player_id}", response_model=PlayerOut)
async def get_player(
    player_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    svc = PlayerService(db)
    return await svc.get_player(player_id)


@router.patch("/{player_id}", response_model=PlayerOut)
async def update_player(
    player_id: str,
    data: PlayerUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = PlayerService(db)
    return await svc.update_player(player_id, data)


@router.delete("/{player_id}", status_code=204)
async def delete_player(
    player_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = PlayerService(db)
    await svc.delete_player(player_id)


@router.post("/{player_id}/photo", response_model=PlayerOut)
async def upload_photo(
    player_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = PlayerService(db)
    return await svc.upload_photo(player_id, file)
