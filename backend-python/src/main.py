from contextlib import asynccontextmanager
import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config.settings import settings
from src.config.database import get_pool, close_pool
from src.config.redis import get_redis, close_redis
from src.socket.manager import sio
from src.controllers import auth_controller, bus_controller, route_controller, location_controller, eta_controller
from src.utils.logger import logger  # noqa: F401 – sets up loguru sinks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_pool()
    await get_redis()  # optional — won't crash if Redis is down
    yield
    # Shutdown
    await close_pool()
    await close_redis()


app = FastAPI(title="Bus Tracking API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
PREFIX = "/api/v1"
app.include_router(auth_controller.router, prefix=PREFIX)
app.include_router(bus_controller.router, prefix=PREFIX)
app.include_router(route_controller.router, prefix=PREFIX)
app.include_router(location_controller.router, prefix=PREFIX)
app.include_router(eta_controller.router, prefix=PREFIX)


@app.get(f"{PREFIX}/health")
async def health():
    from datetime import datetime, timezone
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"{request.method} {request.url} → {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error" if settings.ENV == "production" else str(exc)},
    )


# Mount Socket.IO as ASGI sub-app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
