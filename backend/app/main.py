from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import api_router
from app.services.background_jobs import init_scheduler, shutdown_scheduler

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "message": "Intelligent Calendar API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }


@app.on_event("startup")
async def startup_event():
    """Initialize background jobs on app startup"""
    init_scheduler()
    print("✓ Background scheduler started")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop background jobs on app shutdown"""
    shutdown_scheduler()
    print("✓ Background scheduler stopped")