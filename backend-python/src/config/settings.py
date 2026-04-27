from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    ENV: str = "development"
    PORT: int = 5000

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "bus_tracking"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_EXPIRES_IN: int = 604800  # 7 days in seconds

    # CORS
    CORS_ORIGIN: str = "http://localhost:3000,http://localhost:19006"

    # Rate limiting
    RATE_LIMIT_WINDOW_MS: int = 60000
    RATE_LIMIT_MAX_REQUESTS: int = 100

    # GPS / Cache
    LOCATION_CACHE_TTL: int = 30

    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGIN.split(",")]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
