from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import AnalyticsEvent
from app.db.session import get_db
from app.routers.deps import get_destination_or_404
from app.schemas.api import PersonaType, VisionResponse
from app.services.ai_service import identify_vision

MAX_IMAGE_BYTES = 10 * 1024 * 1024

router = APIRouter(prefix="/api", tags=["Point & Ask Vision (UC-2)"])


@router.post("/vision-ask", response_model=VisionResponse)
async def vision_ask(
    image: UploadFile = File(...),
    destination_slug: str = Form("agra"),
    question: str = Form(""),
    language: str = Form("en"),
    persona: PersonaType = Form("quick"),
    simple_language: bool = Form(False),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    session_hash: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Identify a building, gateway, carving, or inscription from a camera photo."""
    destination = get_destination_or_404(db, destination_slug)
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 10 MB limit.",
        )

    try:
        result = identify_vision(
            db=db,
            destination=destination,
            image_bytes=image_bytes,
            question=question,
            language=language,
            persona=persona,
            simple_language=simple_language,
            lat=lat,
            lng=lng,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    event = AnalyticsEvent(
        destination_id=destination.id,
        event_type="vision_query",
        session_hash=(session_hash or "anon")[:64],
        language=language[:16],
        persona=persona,
        monument_slug=result.matched_monument_slug,
        query_topic=(question.strip() or f"Camera: {result.identified_name}")[:240],
        is_knowledge_gap=result.is_knowledge_gap,
        is_synthetic=False,
    )
    db.add(event)
    db.commit()

    return result

