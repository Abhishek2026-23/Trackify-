import sys
from loguru import logger
from src.config.settings import settings

logger.remove()
logger.add(sys.stdout, level=settings.LOG_LEVEL, colorize=True,
           format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add("logs/error.log", level="ERROR", rotation="10 MB")
logger.add("logs/combined.log", rotation="10 MB")
