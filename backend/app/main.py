from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.endpoints.health import get_health
from app.api.v1.router import api_router
from app.core.config import settings
from app.schemas.health import HealthResponse

LOG_FILE = Path(__file__).resolve().parent.parent / "oauth_callback.log"

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Backend API for CCE Achieve PGPA Student Achievement Management System. "
        "PostgreSQL 18 stores structured records and file metadata; all certificate "
        "and photo binaries are stored in Google Drive."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

@app.middleware("http")
async def log_oauth_requests(request: Request, call_next):
    is_target = "/google" in request.url.path or "/health" in request.url.path
    if is_target:
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now(timezone.utc).isoformat()}] INCOMING: {request.method} {request.url.path} (query: {request.url.query})\n")
        except Exception:
            pass
    response = await call_next(request)
    if is_target:
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now(timezone.utc).isoformat()}] COMPLETED: {request.method} {request.url.path} -> {response.status_code}\n")
        except Exception:
            pass
    return response

# Configure Cross-Origin Resource Sharing (CORS)
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Mount API v1 router (/api/v1)
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )


@app.get(
    "/",
    summary="Root Service Information",
    tags=["Root"],
)
def root():
    """
    Root endpoint confirming service availability and basic system information.
    """
    return {
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_PREFIX}/health",
        "storage_architecture_mandate": (
            "All certificate and photo file binaries reside in Google Drive. "
            "PostgreSQL stores structured records and file metadata only."
        ),
    }


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Root Health Check",
    tags=["Health"],
)
def root_health() -> HealthResponse:
    """
    Root-level health check endpoint confirming service operational status,
    PostgreSQL connectivity, and Google Drive storage configuration.
    """
    return get_health()
