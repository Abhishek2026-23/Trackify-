import redis.asyncio as aioredis
from loguru import logger
from src.config.settings import settings

_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis | None:
    global _client
    if _client is None:
        try:
            _client = aioredis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
            )
            await _client.ping()
            logger.info("✓ Redis connected")
        except Exception as e:
            logger.warning(f"Redis not available: {e} — real-time caching disabled")
            _client = None
    return _client


async def close_redis():
    global _client
    if _client:
        await _client.aclose()
        _client = None
