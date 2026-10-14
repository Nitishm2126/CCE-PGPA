from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

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
