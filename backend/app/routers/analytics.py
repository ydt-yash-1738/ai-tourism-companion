from collections import Counter
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.models import AnalyticsEvent
from app.db.session import get_db
from app.routers.deps import get_destination_or_404
from app.schemas.api import (
    AnalyticsEventCreate,
    AnalyticsEventOut,
    AnalyticsSummaryResponse,
    CountItem,
)

router = APIRouter(prefix="/api/analytics", tags=["Tourism Dept Insights (UC-9)"])


def _counter_to_items(counter: Counter[str], limit: int = 10) -> list[CountItem]:
    return [CountItem(label=label, count=count) for label, count in counter.most_common(limit)]


@router.post("/events", response_model=AnalyticsEventOut, status_code=status.HTTP_201_CREATED)
def record_analytics_event(payload: AnalyticsEventCreate, db: Session = Depends(get_db)):
    """Record an anonymised interaction event (zero PII accepted)."""
    destination = get_destination_or_404(db, payload.destination_slug)
    event = AnalyticsEvent(
        destination_id=destination.id,
        event_type=payload.event_type,
        session_hash=payload.session_hash,
        language=payload.language,
        persona=payload.persona,
        monument_slug=payload.monument_slug,
        facility_type=payload.facility_type,
        query_topic=payload.query_topic,
        is_knowledge_gap=payload.is_knowledge_gap,
        is_synthetic=False,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    destination_slug: str = Query(default="agra"),
    include_synthetic: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    """Aggregate visitor questions, languages, spots, facility demand, and knowledge gaps."""
    destination = get_destination_or_404(db, destination_slug)
    query = db.query(AnalyticsEvent).filter(AnalyticsEvent.destination_id == destination.id)
    if not include_synthetic:
        query = query.filter(AnalyticsEvent.is_synthetic.is_(False))

    events = query.all()
    synthetic_count = sum(1 for e in events if e.is_synthetic)
    live_count = len(events) - synthetic_count

    questions: Counter[str] = Counter()
    languages: Counter[str] = Counter()
    spots: Counter[str] = Counter()
    facilities: Counter[str] = Counter()
    personas: Counter[str] = Counter()
    gaps: Counter[str] = Counter()

    for ev in events:
        if ev.language:
            languages[ev.language] += 1
        if ev.persona:
            personas[ev.persona] += 1
        if ev.monument_slug:
            spots[ev.monument_slug] += 1
        if ev.facility_type:
            facilities[ev.facility_type] += 1
        if ev.event_type in ("chat_query", "vision_query") and ev.query_topic:
            questions[ev.query_topic] += 1
        if ev.is_knowledge_gap and ev.query_topic:
            gaps[ev.query_topic] += 1

    return AnalyticsSummaryResponse(
        destination_slug=destination.slug,
        total_events=len(events),
        synthetic_events=synthetic_count,
        live_events=live_count,
        top_questions=_counter_to_items(questions),
        language_breakdown=_counter_to_items(languages),
        popular_spots=_counter_to_items(spots),
        facility_demand=_counter_to_items(facilities),
        persona_breakdown=_counter_to_items(personas),
        knowledge_gaps=_counter_to_items(gaps),
    )

