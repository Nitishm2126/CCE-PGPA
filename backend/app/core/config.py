from pathlib import Path
from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base backend directory: backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and backend/.env file.
    """
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.is_file() else ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Core Application Info
    APP_NAME: str = "CCE Achieve API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # PostgreSQL Database Connection URL (SQLAlchemy 2.x with psycopg 3)
    # Expected format: postgresql+psycopg://<app_user>:<password>@<host>:<port>/cce_achieve
    DATABASE_URL: str = "postgresql+psycopg://cce_app_user:CHANGE_ME_PASSWORD@localhost:5432/cce_achieve"

    # CORS Configuration
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.strip().startswith("["):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        return [str(v)]


    # JWT Authentication Configuration
    JWT_SECRET_KEY: str = "change-this-jwt-secret-key-in-production-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Google Drive Storage Configuration (Phase 5)
    GOOGLE_SERVICE_ACCOUNT_FILE: Optional[str] = None
    GOOGLE_SERVICE_ACCOUNT_JSON: Optional[str] = None
    GOOGLE_DRIVE_FOLDER_ID: Optional[str] = None
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".pdf", ".png", ".jpg", ".jpeg"]
    ALLOWED_UPLOAD_MIME_TYPES: List[str] = [
        "application/pdf",
        "image/png",
        "image/jpeg",
    ]

    @property
    def max_upload_size_bytes(self) -> int:
        """Maximum file upload size in bytes."""
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def is_google_drive_configured(self) -> bool:
        """True if sufficient credentials and root folder ID are configured."""
        has_credentials = bool(self.GOOGLE_SERVICE_ACCOUNT_FILE or self.GOOGLE_SERVICE_ACCOUNT_JSON)
        return has_credentials and bool(self.GOOGLE_DRIVE_FOLDER_ID)


settings = Settings()
