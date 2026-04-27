"""Entry point: python run.py"""
import uvicorn
from src.config.settings import settings

if __name__ == "__main__":
    uvicorn.run(
        "src.main:socket_app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.ENV != "production",
        log_level=settings.LOG_LEVEL.lower(),
    )
