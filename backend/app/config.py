from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "sqlite:///./dev.db"
    secret_key: str = "dev-only-change-me"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.env.strip().lower() in ("production", "prod")

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        # Render/Heroku style URLs -> SQLAlchemy + psycopg3 driver
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]


INSECURE_DEV_SECRETS = {
    "dev-only-change-me",
    "change-me-to-a-long-random-string-at-least-32-chars",
    "test-secret-key-that-is-at-least-32-bytes-long",
}


def validate_production_security(settings: Settings) -> None:
    if settings.is_production:
        if settings.secret_key in INSECURE_DEV_SECRETS or len(settings.secret_key) < 32:
            raise RuntimeError(
                "Insecure SECRET_KEY: refusing to boot in production with default or weak secret key. "
                "Generate a strong secret key (e.g. python -c 'import secrets; print(secrets.token_urlsafe(48))')."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
