"""
Seed script — creates initial data.

In development: creates admin + demo teams/players.
In production:  creates admin user only (from env vars).

Run: python -m app.scripts.seed
"""
import asyncio
import logging
import os
import sys

# Ensure the backend directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import Player, Team, Tournament, User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_ENV = os.getenv("APP_ENV", "development").lower()
IS_PRODUCTION = APP_ENV == "production"

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@flyhigh.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

DEMO_TEAMS = [
    {"name": "TEAM BLAZE", "captain_name": "Raj Kumar", "captain_username": "blaze_captain", "captain_password": "blaze123"},
    {"name": "NET MASTERS", "captain_name": "Priya Singh", "captain_username": "netmasters_captain", "captain_password": "netmasters123"},
    {"name": "COURT COMMANDOS", "captain_name": "Arjun Reddy", "captain_username": "commandos_captain", "captain_password": "commandos123"},
]

DEMO_PLAYERS = [
    {"name": "Manju", "age_group": "30+", "category": "Lower Intermediate", "skill_level": "Lower Intermediate", "base_price": 500, "auction_order": 1},
    {"name": "Chinmay", "age_group": "Open", "category": "Intermediate", "skill_level": "Intermediate", "base_price": 700, "auction_order": 2},
    {"name": "Sridhar", "age_group": "40+", "category": "Lower Intermediate", "skill_level": "Lower Intermediate", "base_price": 500, "auction_order": 3},
    {"name": "Jeevan Kumbar", "age_group": "20+", "category": "Lower Intermediate", "skill_level": "Lower Intermediate", "base_price": 500, "auction_order": 4},
    {"name": "Sriram", "age_group": "30+", "category": "Lower Intermediate", "skill_level": "Lower Intermediate", "base_price": 500, "auction_order": 5},
    {"name": "Khadeer", "age_group": "Open", "category": "Intermediate", "skill_level": "Intermediate", "base_price": 700, "auction_order": 6},
    {"name": "Chandru Reddy", "age_group": "Open", "category": "Beginner+", "skill_level": "Beginner+", "base_price": 300, "auction_order": 7},
    {"name": "Waseem", "age_group": "Open", "category": "Intermediate", "skill_level": "Intermediate", "base_price": 700, "auction_order": 8},
]


async def seed():
    async with AsyncSessionLocal() as db:
        await seed_with_session(db)
        await db.commit()
    logger.info("✅ Seed completed successfully!")


async def seed_with_session(db: AsyncSession):
    from sqlalchemy import select

    # ── Admin ──────────────────────────────────────────────────────────────
    if IS_PRODUCTION and ADMIN_PASSWORD == "admin123":
        logger.warning(
            "⚠️ ADMIN_PASSWORD is 'admin123' in PRODUCTION — "
            "set a strong ADMIN_PASSWORD environment variable!"
        )

    result = await db.execute(select(User).where(User.username == ADMIN_USERNAME))
    admin = result.scalar_one_or_none()
    if not admin:
        admin = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        await db.flush()
        if IS_PRODUCTION:
            logger.info(f"Created admin user: {ADMIN_USERNAME}")
        else:
            logger.info(f"Created admin: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
    else:
        logger.info(f"Admin already exists: {ADMIN_USERNAME}")

    # ── Skip demo data in production ──────────────────────────────────────
    if IS_PRODUCTION:
        logger.info("🔒 Production mode — skipping demo teams and players.")
        return

    # ── Tournament ────────────────────────────────────────────────────────
    result = await db.execute(select(Tournament).where(Tournament.name == "FlyHigh Team Event"))
    tournament = result.scalar_one_or_none()
    if not tournament:
        tournament = Tournament(
            name="FlyHigh Team Event",
            description="Annual badminton team auction event",
            sport="Badminton",
            status="ACTIVE",
        )
        db.add(tournament)
        await db.flush()
        logger.info("Created tournament: FlyHigh Team Event")
    else:
        logger.info("Tournament already exists")

    # ── Teams + Captains ──────────────────────────────────────────────────
    for team_data in DEMO_TEAMS:
        result = await db.execute(
            select(Team).where(
                Team.tournament_id == tournament.id,
                Team.name == team_data["name"],
            )
        )
        team = result.scalar_one_or_none()
        if not team:
            team = Team(
                tournament_id=tournament.id,
                name=team_data["name"],
                captain_name=team_data["captain_name"],
                captain_username=team_data["captain_username"],
                total_purse=5000.0,
                spent_amount=0.0,
                reserved_amount=0.0,
            )
            db.add(team)
            await db.flush()
            logger.info(f"Created team: {team.name}")

            # Create captain user
            result2 = await db.execute(select(User).where(User.username == team_data["captain_username"]))
            captain = result2.scalar_one_or_none()
            if not captain:
                captain = User(
                    username=team_data["captain_username"],
                    email=f"{team_data['captain_username']}@flyhigh.com",
                    hashed_password=hash_password(team_data["captain_password"]),
                    role="captain",
                    team_id=team.id,
                )
                db.add(captain)
                await db.flush()
                logger.info(f"  → Captain: {team_data['captain_username']} / {team_data['captain_password']}")
        else:
            logger.info(f"Team already exists: {team_data['name']}")

    # ── Players ───────────────────────────────────────────────────────────
    result = await db.execute(
        select(Player).where(Player.tournament_id == tournament.id)
    )
    existing_players = result.scalars().all()
    if not existing_players:
        for p_data in DEMO_PLAYERS:
            player = Player(
                tournament_id=tournament.id,
                status="AVAILABLE",
                **p_data,
            )
            db.add(player)
        await db.flush()
        logger.info(f"Created {len(DEMO_PLAYERS)} players")
    else:
        logger.info(f"Players already exist ({len(existing_players)} found)")


if __name__ == "__main__":
    asyncio.run(seed())

