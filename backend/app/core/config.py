"""
FlyHigh Team Event — Live Auction Backend
Core application configuration via Pydantic Settings.
"""
import logging
from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Default secret used only in development — never in production
_DEFAULT_SECRET = "changeme-super-secret-key-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_ENV: str = "development"
    SECRET_KEY: str = _DEFAULT_SECRET
    # JWT_SECRET is an alias — if set, it overrides SECRET_KEY
    JWT_SECRET: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Frontend URL (used for CORS and redirects)
    FRONTEND_URL: Optional[str] = None

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

    # CORS — accepts both CORS_ORIGINS and ALLOWED_ORIGINS env vars
    CORS_ORIGINS: Optional[str] = None
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Admin seed account
    ADMIN_EMAIL: str = "admin@flyhigh.com"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_USERNAME: str = "admin"

    # Media
    MEDIA_DIR: str = "media"
    MAX_UPLOAD_SIZE_MB: int = 10

    @model_validator(mode="after")
    def _resolve_aliases(self) -> "Settings":
        # JWT_SECRET env var takes precedence over SECRET_KEY
        if self.JWT_SECRET:
            self.SECRET_KEY = self.JWT_SECRET
        # CORS_ORIGINS env var takes precedence over ALLOWED_ORIGINS
        if self.CORS_ORIGINS:
            self.ALLOWED_ORIGINS = self.CORS_ORIGINS
        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def allowed_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        # Auto-include FRONTEND_URL if set and not already present
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)
        return origins

    def validate_production_config(self) -> None:
        """Log warnings for unsafe production configuration."""
        if self.is_production:
            if self.SECRET_KEY == _DEFAULT_SECRET:
                logger.critical(
                    "🚨 CRITICAL: SECRET_KEY is set to the default value in production! "
                    "Set a strong SECRET_KEY or JWT_SECRET environment variable."
                )
            if self.ADMIN_PASSWORD == "admin123":
                logger.warning(
                    "⚠️ ADMIN_PASSWORD is set to 'admin123' — change this for production!"
                )
            if "localhost" in self.DATABASE_URL:
                logger.warning(
                    "⚠️ DATABASE_URL contains 'localhost' — is this intentional in production?"
                )
            if "localhost" in self.REDIS_URL:
                logger.warning(
                    "⚠️ REDIS_URL contains 'localhost' — is this intentional in production?"
                )


@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    s.validate_production_config()
    return s


settings = get_settings()
