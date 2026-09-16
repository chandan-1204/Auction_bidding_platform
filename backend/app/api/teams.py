"""Team endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import TeamCreate, TeamOut, TeamUpdate, TeamWithRoster
from app.services.team_service import TeamService

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/", response_model=List[TeamOut])
async def list_teams(
    tournament_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    svc = TeamService(db)
    return await svc.list_teams(tournament_id)


@router.post("/", response_model=TeamOut, status_code=201)
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = TeamService(db)
    return await svc.create_team(data)


@router.get("/{team_id}", response_model=TeamWithRoster)
async def get_team(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Captains can only view their own team
    if current_user.role == "captain" and current_user.team_id != team_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "UNAUTHORIZED", "message": "You can only view your own team."},
        )
    svc = TeamService(db)
    return await svc.get_team(team_id)


@router.patch("/{team_id}", response_model=TeamOut)
async def update_team(
    team_id: str,
    data: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = TeamService(db)
    return await svc.update_team(team_id, data)


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    svc = TeamService(db)
    await svc.delete_team(team_id)
