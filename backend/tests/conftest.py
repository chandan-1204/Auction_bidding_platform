"""
Test configuration and shared fixtures.
Uses an in-memory SQLite database for fast tests.
"""
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.models import Team, Tournament, User

from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean_database(engine):
    from app.services.auction_service import _auction_locks
    _auction_locks.clear()
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    yield
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    _auction_locks.clear()


@pytest_asyncio.fixture
async def db(engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with session_factory() as session:
        yield session
        await session.commit()


@pytest_asyncio.fixture
async def client(engine) -> AsyncGenerator[AsyncClient, None]:
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(db) -> User:
    user = User(
        username="testadmin",
        email="testadmin@test.com",
        hashed_password=hash_password("adminpass"),
        role="admin",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def tournament(db, admin_user) -> Tournament:
    t = Tournament(name="Test Tournament", sport="Badminton", status="ACTIVE")
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


@pytest_asyncio.fixture
async def team(db, tournament) -> Team:
    t = Team(
        tournament_id=tournament.id,
        name="Test Team Alpha",
        total_purse=5000.0,
        spent_amount=0.0,
        reserved_amount=0.0,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


@pytest_asyncio.fixture
async def captain_user(db, team) -> User:
    user = User(
        username="testcaptain",
        email="testcaptain@test.com",
        hashed_password=hash_password("captainpass"),
        role="captain",
        team_id=team.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_token(client: AsyncClient, username: str, password: str) -> str:
    resp = await client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


async def admin_headers(client: AsyncClient, admin_user: User) -> dict:
    token = await get_token(client, admin_user.username, "adminpass")
    return {"Authorization": f"Bearer {token}"}


async def captain_headers(client: AsyncClient, captain_user: User) -> dict:
    token = await get_token(client, captain_user.username, "captainpass")
    return {"Authorization": f"Bearer {token}"}
