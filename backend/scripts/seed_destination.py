import argparse
import json
from pathlib import Path
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    AnalyticsEvent,
    Destination,
    Facility,
    KnowledgeChunk,
    Monument,
    NearbyPlace,
    TourRoute,
)
from app.db.session import SessionLocal, init_db
from app.services.ai_service import embed_text

DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[2] / "data" / "destinations"


def _load_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _upsert_fields(instance, data: dict, fields: list[str]) -> None:
    for field in fields:
        if field in data:
            setattr(instance, field, data[field])


def seed_destination_from_dir(
    db: Session,
    slug: str,
    data_dir: Path | None = None,
    with_embeddings: bool = False,
    skip_synthetic: bool = False,
) -> dict[str, int]:
    """Idempotently load or update a complete destination pack into the database."""
    target_dir = data_dir or (DEFAULT_DATA_ROOT / slug)
    if not target_dir.exists():
        raise FileNotFoundError(f"Destination data directory not found: {target_dir}")

    dest_data = _load_json(target_dir / "destination.json")
    destination = db.query(Destination).filter(Destination.slug == dest_data["slug"]).first()
    if destination is None:
        destination = Destination(slug=dest_data["slug"])
        db.add(destination)

    _upsert_fields(
        destination,
        dest_data,
        [
            "name",
            "name_hi",
            "state",
            "description",
            "description_hi",
            "center_lat",
            "center_lng",
            "supported_languages",
            "emergency_helplines",
            "metadata_json",
        ],
    )
    db.flush()

    monuments_data = _load_json(target_dir / "monuments.json")
    monument_by_slug: dict[str, Monument] = {}
    for m_item in monuments_data:
        monument = (
            db.query(Monument)
            .filter(Monument.destination_id == destination.id, Monument.slug == m_item["slug"])
            .first()
        )
        if monument is None:
            monument = Monument(destination_id=destination.id, slug=m_item["slug"])
            db.add(monument)
        _upsert_fields(
            monument,
            m_item,
            [
                "name",
                "name_hi",
                "short_summary",
                "short_summary_hi",
                "lat",
                "lng",
                "geofence_radius_m",
                "visit_duration_min",
                "visual_cues",
                "wheelchair_accessible",
                "has_ramp",
                "step_free",
                "rest_points",
                "stairs_warning",
                "accessibility_notes",
                "accessibility_notes_hi",
            ],
        )
        db.flush()
        monument_by_slug[monument.slug] = monument

    chunks_data = _load_json(target_dir / "knowledge_base.json")
    embedded_count = 0
    for c_item in chunks_data:
        chunk = (
            db.query(KnowledgeChunk)
            .filter(
                KnowledgeChunk.destination_id == destination.id,
                KnowledgeChunk.chunk_key == c_item["chunk_key"],
            )
            .first()
        )
        if chunk is None:
            chunk = KnowledgeChunk(destination_id=destination.id, chunk_key=c_item["chunk_key"])
            db.add(chunk)

        m_slug = c_item.get("monument_slug")
        chunk.monument_id = monument_by_slug[m_slug].id if m_slug in monument_by_slug else None
        _upsert_fields(
            chunk,
            c_item,
            ["title", "title_hi", "content", "content_hi", "content_type", "source_name", "tags"],
        )
        if with_embeddings and settings.has_gemini_key and chunk.embedding is None:
            vec = embed_text(f"{c_item['title']}\n{c_item['content']}")
            if vec is not None:
                chunk.embedding = vec
                embedded_count += 1

    tours_data = _load_json(target_dir / "tour_routes.json")
    for t_item in tours_data:
        route = (
            db.query(TourRoute)
            .filter(TourRoute.destination_id == destination.id, TourRoute.slug == t_item["slug"])
            .first()
        )
        if route is None:
            route = TourRoute(destination_id=destination.id, slug=t_item["slug"])
            db.add(route)
        _upsert_fields(
            route,
            t_item,
            ["title", "title_hi", "duration_minutes", "step_free", "description", "description_hi", "stops"],
        )

    facilities_data = _load_json(target_dir / "facilities.json")
    for f_item in facilities_data:
        facility = (
            db.query(Facility)
            .filter(Facility.destination_id == destination.id, Facility.slug == f_item["slug"])
            .first()
        )
        if facility is None:
            facility = Facility(destination_id=destination.id, slug=f_item["slug"])
            db.add(facility)
        _upsert_fields(
            facility,
            f_item,
            [
                "name",
                "name_hi",
                "facility_type",
                "lat",
                "lng",
                "timings",
                "address",
                "phone",
                "is_accessible",
                "is_emergency",
                "notes",
                "notes_hi",
            ],
        )

    nearby_data = _load_json(target_dir / "nearby_odop.json")
    for n_item in nearby_data:
        place = (
            db.query(NearbyPlace)
            .filter(NearbyPlace.destination_id == destination.id, NearbyPlace.slug == n_item["slug"])
            .first()
        )
        if place is None:
            place = NearbyPlace(destination_id=destination.id, slug=n_item["slug"])
            db.add(place)
        _upsert_fields(
            place,
            n_item,
            [
                "name",
                "name_hi",
                "category",
                "is_odop",
                "odop_product",
                "budget_tier",
                "suitable_for",
                "interests",
                "estimated_time_min",
                "timings",
                "entry_fee_inr",
                "how_to_reach",
                "official_source",
                "description",
                "description_hi",
                "lat",
                "lng",
                "address",
            ],
        )

    synthetic_count = 0
    synthetic_path = target_dir / "synthetic_events.json"
    if not skip_synthetic and synthetic_path.exists():
        events_data = _load_json(synthetic_path)
        for e_item in events_data:
            event_key = e_item["event_key"]
            ev = (
                db.query(AnalyticsEvent)
                .filter(
                    AnalyticsEvent.destination_id == destination.id,
                    AnalyticsEvent.event_key == event_key,
                )
                .first()
            )
            if ev is None:
                ev = AnalyticsEvent(destination_id=destination.id, event_key=event_key)
                db.add(ev)
            _upsert_fields(
                ev,
                e_item,
                [
                    "event_type",
                    "session_hash",
                    "language",
                    "persona",
                    "monument_slug",
                    "facility_type",
                    "query_topic",
                    "is_knowledge_gap",
                ],
            )
            ev.is_synthetic = True
            synthetic_count += 1

    db.commit()
    return {
        "monuments": len(monuments_data),
        "knowledge_chunks": len(chunks_data),
        "embedded_chunks": embedded_count,
        "tour_routes": len(tours_data),
        "facilities": len(facilities_data),
        "nearby_places": len(nearby_data),
        "synthetic_events": synthetic_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a UP heritage destination pack into the DB.")
    parser.add_argument("--slug", default="agra", help="Folder name under data/destinations/")
    parser.add_argument(
        "--with-embeddings",
        action="store_true",
        help="Generate 768-dim Gemini embeddings for chunks lacking embeddings (requires GEMINI_API_KEY).",
    )
    parser.add_argument(
        "--skip-synthetic",
        action="store_true",
        help="Do not load synthetic_events.json for UC-9 dashboard.",
    )
    args = parser.parse_args()

    init_db()
    with SessionLocal() as db:
        summary = seed_destination_from_dir(
            db=db,
            slug=args.slug,
            with_embeddings=args.with_embeddings,
            skip_synthetic=args.skip_synthetic,
        )
    print(f"Seeded destination '{args.slug}': {summary}")


if __name__ == "__main__":
    main()

