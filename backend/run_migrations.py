"""
CCE-PGPA Production Database Migration Runner
Safely executes Alembic migrations up to head against the configured DATABASE_URL.
Never logs, exposes, or prints database passwords or raw connection strings.
"""
import logging
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Ensure backend root is in search path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from alembic import command
from alembic.config import Config
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migration_runner")


def sanitize_url(raw_url: str) -> str:
    """Mask credentials in database URL for safe logging."""
    try:
        parsed = urlparse(raw_url)
        netloc = ""
        if parsed.username:
            netloc += parsed.username
            if parsed.password:
                netloc += ":****"
            netloc += "@"
        if parsed.hostname:
            netloc += parsed.hostname
        if parsed.port:
            netloc += f":{parsed.port}"
        return f"{parsed.scheme}://{netloc}{parsed.path}"
    except Exception:
        return "<sanitized database url>"


def run_migrations():
    ini_path = BACKEND_DIR / "alembic.ini"
    if not ini_path.is_file():
        logger.error("alembic.ini not found at %s", ini_path)
        sys.exit(1)

    safe_target = sanitize_url(settings.DATABASE_URL)
    logger.info("Target database: %s", safe_target)
    logger.info("Initializing Alembic configuration...")

    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))

    try:
        logger.info("Executing: alembic upgrade head")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migration completed successfully to head.")
    except Exception as exc:
        logger.error("Database migration failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    run_migrations()
