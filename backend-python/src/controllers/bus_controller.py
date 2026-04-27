from fastapi import APIRouter, HTTPException
from src.config.database import get_pool

router = APIRouter(prefix="/buses", tags=["buses"])


@router.get("")
async def get_active_buses():
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM active_trips_view ORDER BY route_number")
    return {"trips": [dict(r) for r in rows]}


@router.get("/{bus_id}")
async def get_bus_by_id(bus_id: int):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM buses WHERE id = $1", bus_id)
    if not row:
        raise HTTPException(status_code=404, detail="Bus not found")
    return {"bus": dict(row)}
