"""
TrackAI Backend - FastAPI Application
Main entry point for the GPS tracking and analytics platform
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TrackAI backend...")
    init_db()
    logger.info("Database initialized successfully")
    yield
    logger.info("Shutting down TrackAI backend...")

app = FastAPI(
    title="TrackAI API",
    description="AI-Powered Real-Time GPS Tracking and Analytics Platform",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://track-ai-tau.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes import locations, users, analytics, geofences, notifications, sos
from app.routes import realtime
from app.routes.ws_routes import router as ws_router
from app.routes.ai_assistant import router as ai_router

app.include_router(users.router,         prefix="/api/users",         tags=["users"])
app.include_router(locations.router,     prefix="/api/locations",     tags=["locations"])
app.include_router(analytics.router,     prefix="/api/analytics",     tags=["analytics"])
app.include_router(geofences.router,     prefix="/api/geofences",     tags=["geofences"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(sos.router,           prefix="/api/sos",           tags=["sos"])
app.include_router(ws_router,            prefix="/api",               tags=["websocket"])
app.include_router(ai_router,            prefix="/api/ai",            tags=["ai"])  # ← NEW

@app.get("/")
async def root():
    return {"name": "TrackAI API", "status": "running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)