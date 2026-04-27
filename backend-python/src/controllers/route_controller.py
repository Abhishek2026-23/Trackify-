from fastapi import APIRouter, HTTPException
from src.config.database import get_pool

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("")
async def get_all_routes():
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM routes WHERE is_active = true ORDER BY route_number")
    return {"routes": [dict(r) for r in rows]}


@router.get("/{route_id}")
async def get_route_by_id(route_id: int):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM route_details_view WHERE route_id = $1", route_id)
    if not row:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"route": dict(row)}
