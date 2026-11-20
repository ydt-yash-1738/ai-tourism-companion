from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.models import NearbyPlace
from app.db.session import get_db
from app.routers.deps import get_destination_or_404
from app.schemas.api import NearbyPlaceOut
from app.services.geo import haversine_meters

router = APIRouter(prefix="/api/destinations", tags=["Nearby & UP ODOP (UC-5)"])

_ALLOWED_BUDGETS: dict[str, set[str]] = {
    "free": {"free"},
    "low": {"free", "low"},
    "medium": {"free", "low", "medium"},
    "high": {"free", "low", "medium", "high"},
}


@router.get("/{slug}/nearby", response_model=list[NearbyPlaceOut])
def recommend_nearby(
    slug: str,
    interests: str | None = Query(default=None, description="Comma-separated: heritage,crafts,food,shopping,spiritual"),
    budget: str | None = Query(default=None, description="free, low, medium, high"),
    group: str | None = Query(default=None, description="solo, family, kids, elderly"),
    max_minutes: int | None = Query(default=None, ge=10, le=720),
    odop_only: bool = Query(default=False),
    lat: float | None = Query(default=None, ge=-90.0, le=90.0),
    lng: float | None = Query(default=None, ge=-180.0, le=180.0),
    db: Session = Depends(get_db),
):
    """Recommend personalised nearby sites, markets, local food, festivals, and UP ODOP crafts."""
    destination = get_destination_or_404(db, slug)
    query = db.query(NearbyPlace).filter(NearbyPlace.destination_id == destination.id)
    if odop_only:
        query = query.filter(NearbyPlace.is_odop.is_(True))
    if max_minutes is not None:
        query = query.filter(NearbyPlace.estimated_time_min <= max_minutes)

    places = query.all()
    interest_set = (
        {i.strip().lower() for i in interests.split(",") if i.strip()} if interests else set()
    )
    allowed_budgets = _ALLOWED_BUDGETS.get(budget.lower()) if budget else None
    group_key = group.strip().lower() if group else None

    ranked: list[tuple[tuple[int, int, int], NearbyPlaceOut]] = []
    for place in places:
        if allowed_budgets and place.budget_tier.lower() not in allowed_budgets:
            continue
        suitable = {s.lower() for s in (place.suitable_for or [])}
        if group_key and group_key not in suitable:
            continue

        place_interests = {i.lower() for i in (place.interests or [])}
        overlap = len(interest_set & place_interests) if interest_set else 0
        if interest_set and overlap == 0 and place.category.lower() not in interest_set:
            continue

        dist = (
            haversine_meters(lat, lng, place.lat, place.lng)
            if (lat is not None and lng is not None)
            else None
        )
        out = NearbyPlaceOut(
            id=place.id,
            slug=place.slug,
            name=place.name,
            name_hi=place.name_hi,
            category=place.category,
            is_odop=place.is_odop,
            odop_product=place.odop_product,
            budget_tier=place.budget_tier,
            suitable_for=place.suitable_for,
            interests=place.interests,
            estimated_time_min=place.estimated_time_min,
            timings=place.timings,
            entry_fee_inr=place.entry_fee_inr,
            how_to_reach=place.how_to_reach,
            official_source=place.official_source,
            description=place.description,
            description_hi=place.description_hi,
            lat=place.lat,
            lng=place.lng,
            address=place.address,
            distance_meters=dist,
        )
        score_key = (-overlap, 0 if place.is_odop else 1, dist if dist is not None else 0)
        ranked.append((score_key, out))

    ranked.sort(key=lambda item: item[0])
    return [item[1] for item in ranked]

