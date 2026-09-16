"""
FlyHigh Team Event — Live Auction Backend
Core application configuration via Pydantic Settings.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme-super-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://flyhigh:flyhigh_secret@localhost:5432/flyhigh_auction"

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if "sslmode=require" in v:
            v = v.replace("sslmode=require", "ssl=require")
        if "channel_binding=require&" in v:
            v = v.replace("channel_binding=require&", "")
        elif "&channel_binding=require" in v:
            v = v.replace("&channel_binding=require", "")
        elif "?channel_binding=require" in v:
            v = v.replace("?channel_binding=require", "")
        return v

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Admin seed account
    ADMIN_EMAIL: str = "admin@flyhigh.com"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_USERNAME: str = "admin"

    # Media
    MEDIA_DIR: str = "media"
    MAX_UPLOAD_SIZE_MB: int = 10

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
