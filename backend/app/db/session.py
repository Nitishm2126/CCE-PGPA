from typing import Any, Dict, Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# Create SQLAlchemy 2.x Engine
# pool_pre_ping=True ensures stale connections are tested and recycled
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG and settings.APP_ENV == "development",
)

# Session factory for generating local database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a SQLAlchemy session.
    Automatically closes the session when the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> Dict[str, Any]:
    """
    Attempts to connect and execute a basic query (SELECT 1).
    Used by health checks to accurately reflect connection status.
    Will never claim connectivity is verified unless this test succeeds.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "connected": True,
            "database": engine.url.database or "cce_achieve",
            "host": engine.url.host,
            "status": "connected",
            "message": "Database connection verified successfully.",
        }
    except Exception as exc:
        return {
            "connected": False,
            "database": engine.url.database or "cce_achieve",
            "host": engine.url.host,
            "status": "unverified",
            "message": (
                "Database connection not verified. "
                "Ensure PostgreSQL 18 is running, database 'cce_achieve' is created, "
                "and backend/.env has valid credentials."
            ),
            "detail": str(exc),
        }
