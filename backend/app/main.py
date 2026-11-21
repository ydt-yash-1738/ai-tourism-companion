from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

APP_ORIGINS = {"https://localhost", "http://localhost", "capacitor://localhost"}

from app.core.config import settings
from app.db.session import init_db
from app.routers import (
    analytics,
    chat,
    destinations,
    facilities,
    health,
    nearby,
    tours,
    vision,
    voice,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize database schema (and pgvector extension on PostgreSQL) on startup."""
    init_db()
    yield


app = FastAPI(
    title="UP AI Tourism Companion API",
    description=(
        "Backend API supporting all 9 Use Cases for the Government of Uttar Pradesh "
        "AI Tourism Companion (Multilingual Grounded RAG, Vision, Audio Tours, Facilities/SOS, "
        "Personalised Nearby & UP ODOP, Accessibility, Offline Packs, and Tourism Analytics)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # The Android app (Capacitor WebView) always calls from these origins, so allow them
    # regardless of the deployment's CORS_ORIGINS setting.
    allow_origins=sorted(set(settings.cors_origins_list) | APP_ORIGINS),
    # Local testing from any port (vite dev, a static server) on this machine
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(destinations.router)
app.include_router(chat.router)
app.include_router(vision.router)
app.include_router(tours.router)
app.include_router(facilities.router)
app.include_router(nearby.router)
app.include_router(analytics.router)
app.include_router(voice.router)

