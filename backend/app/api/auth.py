"""Auth endpoints."""
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import LoginRequest, TokenResponse, UserCreate, UserOut, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and get a JWT token."""
    svc = AuthService(db)
    return await svc.login(credentials)


@router.post("/login/form", response_model=TokenResponse, include_in_schema=False)
async def login_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 password form — used by Swagger UI."""
    svc = AuthService(db)
    return await svc.login(LoginRequest(username=form.username, password=form.password))


@router.post("/register", response_model=UserOut)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Create a new user account (admin only)."""
    svc = AuthService(db)
    return await svc.register(data)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user."""
    return UserOut.model_validate(current_user)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List users, optionally filtered by role (admin only)."""
    from app.repositories.repositories import UserRepository
    repo = UserRepository(db)
    users = await repo.list_all()
    if role:
        users = [u for u in users if u.role == role]
    return [UserOut.model_validate(u) for u in users]


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Update a user account or password (admin only)."""
    from app.core.exceptions import NotFound
    from app.core.security import hash_password
    from app.repositories.repositories import UserRepository

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFound("User")

    updates = data.model_dump(exclude_none=True)
    if "password" in updates and updates["password"]:
        updates["hashed_password"] = hash_password(updates.pop("password"))

    user = await repo.update(user, **updates)
    await db.commit()
    return UserOut.model_validate(user)

