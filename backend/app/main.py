"""
FlyHigh Team Event — Live Auction Backend
FastAPI application entry point.
"""
import logging
import os
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, auctions, players, teams, tournaments
from app.core.config import settings
from app.core.redis_client import close_redis, get_redis
from app.websocket.socket_manager import sio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 FlyHigh Auction API starting up...")
    logger.info(f"   Environment: {settings.APP_ENV}")
    logger.info(f"   CORS origins: {settings.allowed_origins_list}")

    # Warm up Redis connection
    try:
        redis = await get_redis()
        await redis.ping()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.warning(f"⚠️ Redis warmup warning: {e}")

    # Ensure media directory exists
    os.makedirs(os.path.join(settings.MEDIA_DIR, "players"), exist_ok=True)
    os.makedirs(os.path.join(settings.MEDIA_DIR, "teams"), exist_ok=True)

    yield

    logger.info("🛑 Shutting down...")
    await close_redis()


app = FastAPI(
    title="FlyHigh Team Event — Live Auction API",
    description="Real-time sports auction platform backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST Routers ──────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(tournaments.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(auctions.router)

# ── Static Media ──────────────────────────────────────────────────────────────
os.makedirs(settings.MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.MEDIA_DIR), name="media")


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    """
    Production health check — verifies database and Redis connectivity.
    Returns HTTP 200 if all systems are healthy, 503 otherwise.
    """
    health = {
        "status": "ok",
        "service": "flyhigh-auction-api",
        "environment": settings.APP_ENV,
        "database": "ok",
        "redis": "ok",
    }
    is_healthy = True

    # Check database
    try:
        from app.core.database import engine
        from sqlalchemy import text

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        health["database"] = f"error: {str(e)}"
        is_healthy = False

    # Check Redis
    try:
        redis = await get_redis()
        await redis.ping()
    except Exception as e:
        health["redis"] = f"error: {str(e)}"
        is_healthy = False

    if not is_healthy:
        health["status"] = "degraded"
        return JSONResponse(content=health, status_code=503)

    return health


# ── Mount Socket.IO ───────────────────────────────────────────────────────────
# Wrap FastAPI with Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")

