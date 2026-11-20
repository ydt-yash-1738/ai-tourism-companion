from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import (
    Destination,
    Facility,
    KnowledgeChunk,
    Monument,
    NearbyPlace,
    TourRoute,
)
from app.db.session import get_db
from app.routers.deps import enrich_tour_route, get_destination_or_404
from app.schemas.api import (
    DestinationOut,
    FacilityOut,
    KnowledgeChunkOut,
    MonumentOut,
    NearbyPlaceOut,
    OfflinePackResponse,
)

router = APIRouter(prefix="/api/destinations", tags=["Destinations & Offline Pack"])


@router.get("", response_model=list[DestinationOut])
def list_destinations(db: Session = Depends(get_db)):
    """List all seeded UP heritage destinations."""
    return db.query(Destination).order_by(Destination.name).all()


@router.get("/{slug}", response_model=DestinationOut)
def get_destination(slug: str, db: Session = Depends(get_db)):
    """Get overview, supported languages, and emergency helplines for a destination."""
    return get_destination_or_404(db, slug)


@router.get("/{slug}/monuments", response_model=list[MonumentOut])
def list_monuments(slug: str, db: Session = Depends(get_db)):
    """List monuments/stops with GPS geofence and accessibility metadata."""
    destination = get_destination_or_404(db, slug)
    return (
        db.query(Monument)
        .filter(Monument.destination_id == destination.id)
        .order_by(Monument.id)
        .all()
    )


@router.get("/{slug}/offline-pack", response_model=OfflinePackResponse)
def download_offline_pack(slug: str, db: Session = Depends(get_db)):
    """Return the complete destination content bundle for weak-network offline caching."""
    destination = get_destination_or_404(db, slug)
    monuments = (
        db.query(Monument)
        .filter(Monument.destination_id == destination.id)
        .order_by(Monument.id)
        .all()
    )
    monument_by_slug = {m.slug: m for m in monuments}
    chunks = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.destination_id == destination.id)
        .order_by(KnowledgeChunk.id)
        .all()
    )
    routes = (
        db.query(TourRoute)
        .filter(TourRoute.destination_id == destination.id)
        .order_by(TourRoute.duration_minutes)
        .all()
    )
    facilities = (
        db.query(Facility)
        .filter(Facility.destination_id == destination.id)
        .order_by(Facility.id)
        .all()
    )
    nearby = (
        db.query(NearbyPlace)
        .filter(NearbyPlace.destination_id == destination.id)
        .order_by(NearbyPlace.id)
        .all()
    )

    return OfflinePackResponse(
        destination=DestinationOut.model_validate(destination),
        monuments=[MonumentOut.model_validate(m) for m in monuments],
        knowledge_chunks=[KnowledgeChunkOut.model_validate(c) for c in chunks],
        tour_routes=[enrich_tour_route(r, monument_by_slug) for r in routes],
        facilities=[FacilityOut.model_validate(f) for f in facilities],
        nearby_places=[NearbyPlaceOut.model_validate(n) for n in nearby],
        generated_at=datetime.now(timezone.utc),
    )

