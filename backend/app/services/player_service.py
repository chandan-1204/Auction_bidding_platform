"""
Player service — CRUD, photo upload, bulk import/export.
"""
import csv
import io
import os
from typing import List, Optional

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFound
from app.repositories.repositories import PlayerRepository
from app.schemas.schemas import PlayerCreate, PlayerOut, PlayerUpdate


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_CSV_SIZE = 2 * 1024 * 1024    # 2 MB


class PlayerService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PlayerRepository(db)

    async def create_player(self, data: PlayerCreate) -> PlayerOut:
        player = await self.repo.create(**data.model_dump())
        return PlayerOut.model_validate(player)

    async def get_player(self, player_id: str) -> PlayerOut:
        player = await self.repo.get_by_id(player_id)
        if not player:
            raise NotFound("Player")
        return PlayerOut.model_validate(player)

    async def list_players(
        self,
        tournament_id: str,
        status: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[PlayerOut]:
        players = await self.repo.get_by_tournament(tournament_id, status=status, category=category)
        return [PlayerOut.model_validate(p) for p in players]

    async def update_player(self, player_id: str, data: PlayerUpdate) -> PlayerOut:
        player = await self.repo.get_by_id(player_id)
        if not player:
            raise NotFound("Player")
        updates = data.model_dump(exclude_none=True)
        player = await self.repo.update(player, **updates)
        return PlayerOut.model_validate(player)

    async def delete_player(self, player_id: str):
        player = await self.repo.get_by_id(player_id)
        if not player:
            raise NotFound("Player")
        await self.repo.delete(player)

    async def upload_photo(self, player_id: str, file: UploadFile) -> PlayerOut:
        from app.core.exceptions import InvalidFileUpload

        player = await self.repo.get_by_id(player_id)
        if not player:
            raise NotFound("Player")

        # Validate file extension
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise InvalidFileUpload(f"Unsupported file extension '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

        # Validate file content size
        content = await file.read()
        if len(content) > MAX_PHOTO_SIZE:
            raise InvalidFileUpload(f"File size exceeds 5MB limit.")
        if len(content) == 0:
            raise InvalidFileUpload("File is empty.")

        # Save file securely
        media_dir = os.path.join(settings.MEDIA_DIR, "players")
        os.makedirs(media_dir, exist_ok=True)
        filename = f"{player_id}{ext}"
        filepath = os.path.join(media_dir, filename)

        with open(filepath, "wb") as f:
            f.write(content)

        photo_url = f"/media/players/{filename}"
        player = await self.repo.update(player, photo_url=photo_url)
        return PlayerOut.model_validate(player)

    async def bulk_import_csv(self, tournament_id: str, content: bytes) -> List[PlayerOut]:
        """Parse CSV and bulk create players."""
        from app.core.exceptions import InvalidFileUpload

        if len(content) > MAX_CSV_SIZE:
            raise InvalidFileUpload("CSV file size exceeds 2MB limit.")
        if len(content) == 0:
            raise InvalidFileUpload("CSV file is empty.")

        try:
            decoded = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                decoded = content.decode("latin-1")
            except Exception:
                raise InvalidFileUpload("Could not decode CSV text.")

        reader = csv.DictReader(io.StringIO(decoded))
        created = []
        for i, row in enumerate(reader):
            name = row.get("name", "").strip()
            if not name:
                continue
            player = await self.repo.create(
                tournament_id=tournament_id,
                name=name,
                gender=row.get("gender", "").strip() or None,
                age=int(row["age"]) if row.get("age") and row["age"].isdigit() else None,
                age_group=row.get("age_group", "").strip() or None,
                category=row.get("category", "").strip() or None,
                skill_level=row.get("skill_level", "").strip() or None,
                base_price=float(row["base_price"]) if row.get("base_price") else 500.0,
                auction_order=i,
            )
            created.append(PlayerOut.model_validate(player))
        return created

    def export_csv(self, players: List[PlayerOut]) -> str:
        output = io.StringIO()
        fields = ["id", "name", "gender", "age", "age_group", "category", "skill_level", "base_price", "status"]
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for p in players:
            writer.writerow({f: getattr(p, f, "") for f in fields})
        return output.getvalue()
