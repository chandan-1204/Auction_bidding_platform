"""
Team service — CRUD and purse management.
"""
from typing import List, Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFound
from app.models.models import Team
from app.repositories.repositories import TeamRepository
from app.schemas.schemas import TeamCreate, TeamOut, TeamUpdate, TeamWithRoster


class TeamService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TeamRepository(db)

    async def create_team(self, data: TeamCreate) -> TeamOut:
        team = await self.repo.create(
            tournament_id=data.tournament_id,
            name=data.name,
            captain_name=data.captain_name,
            captain_username=data.captain_username,
            total_purse=data.total_purse,
            logo_url=data.logo_url,
            spent_amount=0.0,
            reserved_amount=0.0,
        )
        return TeamOut.model_validate(team)

    async def get_team(self, team_id: str) -> TeamWithRoster:
        team = await self.repo.get_by_id(team_id)
        if not team:
            raise NotFound("Team")
        return TeamWithRoster.model_validate(team)

    async def list_teams(self, tournament_id: str) -> List[TeamOut]:
        teams = await self.repo.get_by_tournament(tournament_id)
        return [TeamOut.model_validate(t) for t in teams]

    async def update_team(self, team_id: str, data: TeamUpdate) -> TeamOut:
        team = await self.repo.get_by_id(team_id)
        if not team:
            raise NotFound("Team")
        updates = data.model_dump(exclude_none=True)
        team = await self.repo.update(team, **updates)
        return TeamOut.model_validate(team)

    async def delete_team(self, team_id: str):
        team = await self.repo.get_by_id(team_id)
        if not team:
            raise NotFound("Team")
        await self.repo.delete(team)
