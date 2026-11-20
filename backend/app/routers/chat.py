from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import AnalyticsEvent, Monument
from app.db.session import get_db
from app.routers.deps import get_destination_or_404
from app.schemas.api import ChatRequest, ChatResponse
from app.services.ai_service import generate_chat_response

router = APIRouter(prefix="/api", tags=["Companion Chat (UC-1, UC-3, UC-7, UC-8)"])


@router.post("/chat", response_model=ChatResponse)
def ask_companion(req: ChatRequest, db: Session = Depends(get_db)):
    """Answer visitor text/voice questions grounded in curated heritage sources."""
    destination = get_destination_or_404(db, req.destination_slug)
    monument = None
    if req.monument_slug:
        monument = (
            db.query(Monument)
            .filter(
                Monument.destination_id == destination.id,
                Monument.slug == req.monument_slug,
            )
            .first()
        )

    response = generate_chat_response(db=db, destination=destination, req=req, monument=monument)

    # Record anonymised telemetry for UC-9 Tourism Department insights (zero PII)
    event = AnalyticsEvent(
        destination_id=destination.id,
        event_type="chat_query",
        session_hash=(req.session_hash or "anon")[:64],
        language=req.language[:16],
        persona=req.persona,
        monument_slug=response.matched_monument_slug or req.monument_slug,
        query_topic=req.question.strip()[:240],
        is_knowledge_gap=response.is_knowledge_gap,
        is_synthetic=False,
    )
    db.add(event)
    db.commit()

    return response

