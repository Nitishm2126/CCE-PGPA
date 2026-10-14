from datetime import datetime, timezone
from fastapi import APIRouter

from app.core.config import settings
from app.db.session import check_db_connection
from app.schemas.health import DatabaseStatus, HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check and database connectivity",
    description=(
        "Returns application operational status and verifies connectivity to the "
        "PostgreSQL 18 database named 'cce_achieve'. Connectivity is never claimed as "
        "verified unless an active connection test query succeeds."
    ),
)
def get_health() -> HealthResponse:
    db_status = check_db_connection()

    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        timestamp=datetime.now(timezone.utc),
        database=DatabaseStatus(
            connected=db_status["connected"],
            status=db_status["status"],
            database=db_status.get("database"),
            host=db_status.get("host"),
            message=db_status["message"],
            detail=db_status.get("detail"),
        ),
        storage_rule=(
            "All uploaded certificate and photo file binaries reside in Google Drive; "
            "PostgreSQL stores structured records and file metadata only."
        ),
    )
