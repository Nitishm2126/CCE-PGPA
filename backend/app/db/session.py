from typing import Any, Dict, Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# Create SQLAlchemy 2.x Engine
# Sized to smoothly support 64 concurrent cohort members and faculty:
# - pool_size=30: maintains active persistent connections
# - max_overflow=40: accommodates concurrent traffic peaks (up to 70 total connections)
# - pool_timeout=30: protects against thread pool exhaustion under heavy bursts
# - pool_recycle=1800: prevents stale connection timeouts on PostgreSQL 18
# - pool_pre_ping=True: tests connection health before checkout
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=30,
    max_overflow=40,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    echo=False,
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
