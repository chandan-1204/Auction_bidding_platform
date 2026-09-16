"""
Auth service — login, register, token generation.
"""
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Unauthorized
from app.core.security import create_access_token, hash_password, verify_password
from app.models.models import User
from app.repositories.repositories import UserRepository
from app.schemas.schemas import LoginRequest, TokenResponse, UserCreate, UserOut


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def login(self, credentials: LoginRequest) -> TokenResponse:
        user = await self.repo.get_by_username(credentials.username)
        if not user or not verify_password(credentials.password, user.hashed_password):
            raise Unauthorized("Invalid username or password.")
        if not user.is_active:
            raise Unauthorized("Account is disabled.")

        token = create_access_token(
            subject=user.id,
            role=user.role,
            extra_claims={"team_id": user.team_id},
        )
        return TokenResponse(
            access_token=token,
            role=user.role,
            user_id=user.id,
            username=user.username,
            team_id=user.team_id,
        )

    async def register(self, data: UserCreate) -> UserOut:
        # Check uniqueness
        if await self.repo.get_by_username(data.username):
            raise Unauthorized("Username already taken.")
        if await self.repo.get_by_email(data.email):
            raise Unauthorized("Email already registered.")

        user = await self.repo.create(
            username=data.username,
            email=data.email,
            hashed_password=hash_password(data.password),
            role=data.role,
            team_id=data.team_id,
        )
        return UserOut.model_validate(user)

    async def create_admin_if_missing(
        self,
        username: str,
        email: str,
        password: str,
    ) -> Optional[User]:
        existing = await self.repo.get_by_username(username)
        if existing:
            return existing
        return await self.repo.create(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            role="admin",
        )
