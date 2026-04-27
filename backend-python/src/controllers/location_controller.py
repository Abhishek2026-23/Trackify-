import json
import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel, field_validator
from src.config.database import get_pool
from src.config.redis import get_redis
from src.config.settings import settings
from src.socket.manager import sio
from loguru import logger

router = APIRouter(prefix="/location", tags=["location"])


class LocationUpdate(BaseModel):
    trip_id: int
    bus_id: int
    latitude: float
    longitude: float
    speed: Optional[float] = 0
    heading: Optional[int] = 0
    accuracy: Optional[float] = 10

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v):
        if not -90 <= v <= 90:
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_lng(cls, v):
        if not -180 <= v <= 180:
            raise ValueError("Longitude must be between -180 and 180")
        return v


@router.post("/update")
async def update_location(body: LocationUpdate):
    redis = await get_redis()
    pool = await get_pool()

    location_data = {
        **body.model_dump(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Cache in Redis (TTL = LOCATION_CACHE_TTL seconds)
    await redis.setex(
        f"bus:location:{body.bus_id}",
        settings.LOCATION_CACHE_TTL,
        json.dumps(location_data),
    )

    # Persist to PostgreSQL asynchronously (fire-and-forget)
    asyncio.create_task(_log_location(pool, body))

    # Broadcast via WebSocket
    await sio.emit("bus_location_update", location_data, room=f"route:{body.trip_id}")

    return {"success": True, "message": "Location updated"}


async def _log_location(pool, body: LocationUpdate):
    try:
        await pool.execute(
            """INSERT INTO location_logs (trip_id, bus_id, latitude, longitude, speed, heading, accuracy)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            body.trip_id, body.bus_id, body.latitude, body.longitude,
            body.speed, body.heading, body.accuracy,
        )
    except Exception as e:
        logger.error(f"Failed to log location: {e}")


@router.get("/live")
async def get_live_locations(route_id: Optional[int] = Query(None)):
    pool = await get_pool()
    redis = await get_redis()

    query = """
        SELECT t.id as trip_id, t.bus_id, b.bus_number, b.bus_type,
               r.route_number, r.route_name
        FROM trips t
        JOIN buses b ON t.bus_id = b.id
        JOIN routes r ON t.route_id = r.id
        WHERE t.trip_status = 'active'
    """
    params = []
    if route_id:
        query += " AND t.route_id = $1"
        params.append(route_id)

    rows = await pool.fetch(query, *params)

    results = []
    for row in rows:
        cached = await redis.get(f"bus:location:{row['bus_id']}")
        if cached:
            results.append({**dict(row), "location": json.loads(cached)})

    return {"buses": results}
