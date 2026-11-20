from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Destination, Monument, TourRoute
from app.schemas.api import TourRouteOut, TourStopOut


def get_destination_or_404(db: Session, slug: str) -> Destination:
    """Fetch a destination by slug or raise HTTP 404."""
    destination = db.query(Destination).filter(Destination.slug == slug).first()
    if destination is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination '{slug}' not found.",
        )
    return destination


def enrich_tour_route(route: TourRoute, monument_by_slug: dict[str, Monument]) -> TourRouteOut:
    """Attach monument GPS, localized names, and accessibility info to each route stop."""
    enriched_stops: list[TourStopOut] = []
    for raw_stop in route.stops or []:
        m_slug = raw_stop.get("monument_slug", "")
        monument = monument_by_slug.get(m_slug)
        enriched_stops.append(
            TourStopOut(
                order=raw_stop.get("order", len(enriched_stops) + 1),
                monument_slug=m_slug,
                monument_name=monument.name if monument else m_slug,
                monument_name_hi=monument.name_hi if monument else "",
                lat=monument.lat if monument else None,
                lng=monument.lng if monument else None,
                geofence_radius_m=monument.geofence_radius_m if monument else 30,
                duration_min=raw_stop.get("duration_min", 10),
                audio_script_en=raw_stop.get("audio_script_en", ""),
                audio_script_hi=raw_stop.get("audio_script_hi", ""),
                audio_url_en=raw_stop.get("audio_url_en"),
                audio_url_hi=raw_stop.get("audio_url_hi"),
                accessibility_tip=raw_stop.get("accessibility_tip", ""),
                step_free=monument.step_free if monument else route.step_free,
            )
        )
    return TourRouteOut(
        id=route.id,
        slug=route.slug,
        title=route.title,
        title_hi=route.title_hi,
        duration_minutes=route.duration_minutes,
        step_free=route.step_free,
        description=route.description,
        description_hi=route.description_hi,
        stops=enriched_stops,
    )

