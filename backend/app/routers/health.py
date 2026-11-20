from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Destination
from app.db.session import get_db

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    """Return service health, database dialect, and count of seeded destinations."""
    dialect = db.bind.dialect.name if db.bind is not None else "unknown"
    destinations_count = db.query(Destination).count()
    return {
        "status": "ok",
        "environment": settings.APP_ENV,
        "database_dialect": dialect,
        "gemini_configured": settings.has_gemini_key,
        "sarvam_configured": settings.has_sarvam_key,
        "bhashini_configured": settings.has_bhashini_keys,
        "destinations_seeded": destinations_count,
    }

