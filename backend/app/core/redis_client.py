"""Redis client and helpers for auction state coordination."""
import json
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None


# ── Auction State Keys ──────────────────────────────────────────────────────

AUCTION_STATE_KEY = "auction:state:{auction_id}"
AUCTION_TIMER_KEY = "auction:timer:{auction_id}"
CURRENT_PLAYER_KEY = "auction:current_player:{auction_id}"


async def set_auction_state(redis: aioredis.Redis, auction_id: str, state: dict):
    await redis.set(AUCTION_STATE_KEY.format(auction_id=auction_id), json.dumps(state))


async def get_auction_state(redis: aioredis.Redis, auction_id: str) -> Optional[dict]:
    raw = await redis.get(AUCTION_STATE_KEY.format(auction_id=auction_id))
    return json.loads(raw) if raw else None


async def delete_auction_state(redis: aioredis.Redis, auction_id: str):
    await redis.delete(AUCTION_STATE_KEY.format(auction_id=auction_id))


async def set_timer_end(redis: aioredis.Redis, auction_id: str, end_timestamp: float):
    """Store authoritative timer end timestamp in Redis."""
    await redis.set(
        AUCTION_TIMER_KEY.format(auction_id=auction_id),
        str(end_timestamp),
        ex=300,  # expire after 5 minutes safety net
    )


async def get_timer_end(redis: aioredis.Redis, auction_id: str) -> Optional[float]:
    val = await redis.get(AUCTION_TIMER_KEY.format(auction_id=auction_id))
    return float(val) if val else None
