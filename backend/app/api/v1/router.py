from fastapi import APIRouter

from app.api.v1.endpoints import auth, files, health, hod, mentor, students

api_router = APIRouter()

# Register modular endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(students.router, prefix="/students", tags=["Students"])
api_router.include_router(mentor.router, prefix="/mentor", tags=["Mentor"])
api_router.include_router(hod.router, prefix="/hod", tags=["HOD"])
api_router.include_router(files.router, tags=["Files & Evidence"])
api_router.include_router(health.router, tags=["Health"])
