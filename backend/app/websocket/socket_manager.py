"""
Socket.IO real-time event handler for the auction.

Architecture:
- Server is authoritative for all state
- Timer is broadcast as an end timestamp; clients compute remaining seconds
- Pub/Sub through Socket.IO rooms per auction_id
- Bid events come through REST, then are broadcast here
"""
import json
import logging
from typing import Optional

import socketio
from jose import JWTError

from app.core.config import settings
from app.core.security import decode_access_token

logger = logging.getLogger(__name__)

# Create async Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.allowed_origins_list,
    logger=False,
    engineio_logger=False,
)


def get_sio() -> socketio.AsyncServer:
    return sio


# ── Event Helpers ────────────────────────────────────────────────────────────

async def broadcast_auction_state(auction_id: str, state_data: dict):
    """Broadcast full auction state to all clients in the auction room."""
    await sio.emit("auction:state", state_data, room=f"auction:{auction_id}")


async def broadcast_bid(auction_id: str, bid_data: dict):
    """Broadcast a new bid event."""
    await sio.emit("auction:bid", bid_data, room=f"auction:{auction_id}")


async def broadcast_sold(auction_id: str, data: dict):
    await sio.emit("auction:sold", data, room=f"auction:{auction_id}")


async def broadcast_unsold(auction_id: str, data: dict):
    await sio.emit("auction:unsold", data, room=f"auction:{auction_id}")


async def broadcast_notification(auction_id: str, message: str, level: str = "info"):
    await sio.emit(
        "notification:new",
        {"message": message, "level": level},
        room=f"auction:{auction_id}",
    )


async def broadcast_team_purse(auction_id: str, team_data: dict):
    await sio.emit("team:purse_updated", team_data, room=f"auction:{auction_id}")


async def broadcast_event(auction_id: str, event_name: str, payload: dict):
    """Generic broadcaster for auction events like reset, mode_change, etc."""
    await sio.emit(f"auction:{event_name}", payload, room=f"auction:{auction_id}")


# ── Connection Handlers ──────────────────────────────────────────────────────

@sio.event
async def connect(sid, environ, auth):
    """Authenticate and join the client to the appropriate rooms."""
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token")

    user_id = None
    role = "guest"
    team_id = None

    if token:
        try:
            payload = decode_access_token(token)
            user_id = payload.get("sub")
            role = payload.get("role", "guest")
            team_id = payload.get("team_id")
        except JWTError:
            pass  # Allow unauthenticated spectators

    await sio.save_session(sid, {
        "user_id": user_id,
        "role": role,
        "team_id": team_id,
    })
    logger.info(f"Socket connected: sid={sid} role={role} user_id={user_id}")


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    logger.info(f"Socket disconnected: sid={sid} user={session.get('user_id')}")


@sio.event
async def join_auction(sid, data):
    """Client requests to join an auction room."""
    auction_id = data.get("auction_id") if isinstance(data, dict) else None
    if not auction_id:
        await sio.emit("error", {"message": "auction_id required"}, to=sid)
        return

    room = f"auction:{auction_id}"
    await sio.enter_room(sid, room)
    logger.info(f"SID {sid} joined room {room}")

    # Send acknowledgment
    await sio.emit("joined", {"auction_id": auction_id, "room": room}, to=sid)


@sio.event
async def leave_auction(sid, data):
    auction_id = data.get("auction_id") if isinstance(data, dict) else None
    if auction_id:
        await sio.leave_room(sid, f"auction:{auction_id}")


@sio.event
async def ping_auction(sid, data):
    """Keep-alive ping — server responds with pong and server timestamp."""
    from datetime import datetime, timezone
    await sio.emit("pong_auction", {
        "server_time": datetime.now(timezone.utc).isoformat()
    }, to=sid)
