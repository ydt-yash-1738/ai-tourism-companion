from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.models import Monument, TourRoute
from app.db.session import get_db
from app.routers.deps import enrich_tour_route, get_destination_or_404
from app.schemas.api import TourRouteOut

router = APIRouter(prefix="/api/destinations", tags=["Self-Guided Audio Tours (UC-4, UC-8)"])


@router.get("/{slug}/tours", response_model=list[TourRouteOut])
def list_tours(
    slug: str,
    max_minutes: int | None = Query(default=None, ge=10, le=720),
    step_free_only: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    """Return time-filtered and accessibility-filtered walking audio tours."""
    destination = get_destination_or_404(db, slug)
    query = db.query(TourRoute).filter(TourRoute.destination_id == destination.id)
    if max_minutes is not None:
        query = query.filter(TourRoute.duration_minutes <= max_minutes)
    if step_free_only:
        query = query.filter(TourRoute.step_free.is_(True))

    routes = query.order_by(TourRoute.duration_minutes).all()
    monuments = db.query(Monument).filter(Monument.destination_id == destination.id).all()
    monument_by_slug = {m.slug: m for m in monuments}
    return [enrich_tour_route(route, monument_by_slug) for route in routes]

