import socketio
from src.config.settings import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origins,
    transports=["websocket", "polling"],
)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def join_route(sid, route_id):
    await sio.enter_room(sid, f"route:{route_id}")
    print(f"Socket {sid} joined route:{route_id}")


@sio.event
async def leave_route(sid, route_id):
    await sio.leave_room(sid, f"route:{route_id}")
    print(f"Socket {sid} left route:{route_id}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
