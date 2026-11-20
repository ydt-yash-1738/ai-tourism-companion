from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.models import AnalyticsEvent, Facility
from app.db.session import get_db
from app.routers.deps import get_destination_or_404
from app.schemas.api import EmergencyResponse, FacilityOut, HelplineOut
from app.services.geo import haversine_meters

router = APIRouter(prefix="/api/destinations", tags=["Facilities & Emergency SOS (UC-6, UC-8)"])


def _to_facility_out(
    facility: Facility,
    ref_lat: float | None,
    ref_lng: float | None,
) -> FacilityOut:
    dist = (
        haversine_meters(ref_lat, ref_lng, facility.lat, facility.lng)
        if (ref_lat is not None and ref_lng is not None)
        else None
    )
    return FacilityOut(
        id=facility.id,
        slug=facility.slug,
        name=facility.name,
        name_hi=facility.name_hi,
        facility_type=facility.facility_type,
        lat=facility.lat,
        lng=facility.lng,
        timings=facility.timings,
        address=facility.address,
        phone=facility.phone,
        is_accessible=facility.is_accessible,
        is_emergency=facility.is_emergency,
        notes=facility.notes,
        notes_hi=facility.notes_hi,
        distance_meters=dist,
    )


@router.get("/{slug}/facilities", response_model=list[FacilityOut])
def list_facilities(
    slug: str,
    facility_type: str | None = Query(default=None),
    accessible_only: bool = Query(default=False),
    lat: float | None = Query(default=None, ge=-90.0, le=90.0),
    lng: float | None = Query(default=None, ge=-180.0, le=180.0),
    session_hash: str | None = Query(default=None, max_length=64),
    db: Session = Depends(get_db),
):
    """Find toilets, parking, drinking water, medical aid, police, help desks, or food outlets."""
    destination = get_destination_or_404(db, slug)
    query = db.query(Facility).filter(Facility.destination_id == destination.id)
    if facility_type:
        query = query.filter(Facility.facility_type == facility_type)
    if accessible_only:
        query = query.filter(Facility.is_accessible.is_(True))

    items = [_to_facility_out(f, lat, lng) for f in query.all()]
    if lat is not None and lng is not None:
        items.sort(key=lambda item: item.distance_meters if item.distance_meters is not None else 9_999_999)

    if facility_type:
        db.add(
            AnalyticsEvent(
                destination_id=destination.id,
                event_type="facility_search",
                session_hash=(session_hash or "anon")[:64],
                facility_type=facility_type[:40],
                query_topic=f"Facility lookup: {facility_type}",
                is_knowledge_gap=False,
                is_synthetic=False,
            )
        )
        db.commit()

    return items


@router.get("/{slug}/emergency", response_model=EmergencyResponse)
def get_emergency_help(
    slug: str,
    lat: float | None = Query(default=None, ge=-90.0, le=90.0),
    lng: float | None = Query(default=None, ge=-180.0, le=180.0),
    db: Session = Depends(get_db),
):
    """Return nearest medical center, nearest police help, and 1-tap SOS helplines."""
    destination = get_destination_or_404(db, slug)
    ref_lat = lat if lat is not None else destination.center_lat
    ref_lng = lng if lng is not None else destination.center_lng

    medical = (
        db.query(Facility)
        .filter(Facility.destination_id == destination.id, Facility.facility_type == "medical")
        .all()
    )
    police = (
        db.query(Facility)
        .filter(Facility.destination_id == destination.id, Facility.facility_type == "police")
        .all()
    )

    medical_out = sorted(
        (_to_facility_out(f, ref_lat, ref_lng) for f in medical),
        key=lambda item: item.distance_meters or 9_999_999,
    )
    police_out = sorted(
        (_to_facility_out(f, ref_lat, ref_lng) for f in police),
        key=lambda item: item.distance_meters or 9_999_999,
    )

    helplines = [HelplineOut.model_validate(h) for h in (destination.emergency_helplines or [])]
    return EmergencyResponse(
        destination_slug=destination.slug,
        nearest_hospital=medical_out[0] if medical_out else None,
        nearest_police=police_out[0] if police_out else None,
        helplines=helplines,
    )

