from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables or backend/.env."""

    DATABASE_URL: str = "sqlite:///./local_dev.db"
    GEMINI_API_KEY: str = ""
    GEMINI_CHAT_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_EMBED_MODEL: str = "gemini-embedding-001"
    VOICE_PROVIDER: str = "auto"
    SARVAM_API_KEY: str = ""
    SARVAM_STT_MODEL: str = "saaras:v4"
    SARVAM_TTS_MODEL: str = "bulbul:v3"
    SARVAM_TTS_SPEAKER: str = "shubh"
    BHASHINI_USER_ID: str = ""
    BHASHINI_ULCA_API_KEY: str = ""
    BHASHINI_PIPELINE_ID: str = "64392f96daac500b55c543cd"
    CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://localhost:3000,"
        "http://localhost,"
        "https://localhost,"
        "capacitor://localhost"
    )
    APP_ENV: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def normalized_database_url(self) -> str:
        """Convert postgres:// or postgresql:// URLs to SQLAlchemy psycopg3 driver URLs."""
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            return "postgresql+psycopg://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            return "postgresql+psycopg://" + url[len("postgresql://") :]
        return url

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a clean list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def has_gemini_key(self) -> bool:
        """Return True when a non-empty Gemini API key is configured."""
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip())

    @property
    def has_sarvam_key(self) -> bool:
        """Return True when a Sarvam AI API subscription key is configured."""
        return bool(self.SARVAM_API_KEY and self.SARVAM_API_KEY.strip())

    @property
    def has_bhashini_keys(self) -> bool:
        """Return True when Bhashini ULCA user ID and API key are configured."""
        return bool(
            self.BHASHINI_USER_ID
            and self.BHASHINI_USER_ID.strip()
            and self.BHASHINI_ULCA_API_KEY
            and self.BHASHINI_ULCA_API_KEY.strip()
        )


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()


settings = get_settings()

