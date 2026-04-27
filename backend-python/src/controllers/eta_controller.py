import json
from fastapi import APIRouter, HTTPException, Query
from src.config.database import get_pool
from src.config.redis import get_redis
from src.utils.distance import calculate_distance, calculate_eta

router = APIRouter(prefix="/stops", tags=["eta"])


@router.get("/{stop_id}/eta")
async def get_stop_eta(stop_id: int, trip_id: int = Query(...)):
    pool = await get_pool()
    redis = await get_redis()

    stop = await pool.fetchrow("SELECT * FROM bus_stops WHERE id = $1", stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    trip = await pool.fetchrow("SELECT * FROM trips WHERE id = $1", trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    cached = await redis.get(f"bus:location:{trip['bus_id']}")
    if not cached:
        raise HTTPException(status_code=404, detail="Bus location not available")

    location = json.loads(cached)
    distance = calculate_distance(
        {"lat": location["latitude"], "lng": location["longitude"]},
        {"lat": float(stop["latitude"]), "lng": float(stop["longitude"])},
    )
    speed = location.get("speed", 0)
    eta = calculate_eta(distance, speed)

    return {
        "stop_id": stop_id,
        "stop_name": stop["stop_name"],
        "distance_meters": round(distance, 2),
        "eta_minutes": eta,
        "current_speed": speed,
    }
