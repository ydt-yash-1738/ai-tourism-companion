from io import BytesIO
from pathlib import Path
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.models import AnalyticsEvent, KnowledgeChunk, Monument
from app.db.session import create_db_engine, get_db, init_db
from app.main import app
from scripts.seed_destination import seed_destination_from_dir
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

AGRA_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "destinations" / "agra"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Provide a FastAPI TestClient wired to an isolated, seeded temporary SQLite DB."""
    # Ensure deterministic local mode during automated unit tests
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")

    db_file = tmp_path / "test_companion.db"
    test_engine = create_db_engine(f"sqlite:///{db_file}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine, future=True)
    init_db(test_engine)

    with TestingSessionLocal() as db:
        seed_destination_from_dir(db=db, slug="agra", data_dir=AGRA_DATA_DIR)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, TestingSessionLocal
    app.dependency_overrides.clear()
    test_engine.dispose()


def test_health_and_destinations(client):
    test_client, _ = client
    res = test_client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["destinations_seeded"] == 1

    dests = test_client.get("/api/destinations").json()
    assert len(dests) == 1
    assert dests[0]["slug"] == "agra"

    monuments = test_client.get("/api/destinations/agra/monuments").json()
    assert len(monuments) == 6
    assert any(m["step_free"] is True and m["has_ramp"] is True for m in monuments)

    pack = test_client.get("/api/destinations/agra/offline-pack").json()
    assert pack["destination"]["slug"] == "agra"
    assert len(pack["monuments"]) == 6
    assert len(pack["knowledge_chunks"]) >= 16
    assert len(pack["tour_routes"]) == 3
    assert len(pack["facilities"]) == 10
    assert len(pack["nearby_places"]) == 8


def test_idempotent_reseeding(client):
    _, SessionMaker = client
    with SessionMaker() as db:
        first_monuments = db.query(Monument).count()
        first_chunks = db.query(KnowledgeChunk).count()
        first_events = db.query(AnalyticsEvent).count()

        seed_destination_from_dir(db=db, slug="agra", data_dir=AGRA_DATA_DIR)

        assert db.query(Monument).count() == first_monuments
        assert db.query(KnowledgeChunk).count() == first_chunks
        assert db.query(AnalyticsEvent).count() == first_events


def test_chat_fact_vs_folklore_personas_and_gap(client):
    test_client, _ = client

    # UC-1 + UC-3: returns both verified history and folklore clearly separated
    res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "agra",
            "question": "Tell me about the Black Taj Mahal myth and Shah Jahan",
            "language": "en",
            "persona": "scholar",
            "simple_language": False,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_knowledge_gap"] is False
    assert len(data["verified_history"]) >= 1
    assert len(data["folklore_legends"]) >= 1
    assert data["mode"] == "local_fallback"

    # UC-1 Hindi + UC-7 Kids + UC-8 Simple language
    hi_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "agra",
            "question": "ताजमहल क्यों बनाया गया?",
            "language": "hi",
            "persona": "kids",
            "simple_language": True,
        },
    )
    assert hi_res.status_code == 200
    hi_data = hi_res.json()
    assert hi_data["is_knowledge_gap"] is False
    assert hi_data["language"] == "hi"
    assert hi_data["simple_language"] is True

    # Out-of-scope query triggers knowledge gap & logs for UC-9
    gap_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "agra",
            "question": "Explain quantum entanglement in superconductors",
            "language": "en",
            "persona": "quick",
        },
    )
    assert gap_res.status_code == 200
    assert gap_res.json()["is_knowledge_gap"] is True


def test_vision_ask_with_gps_hint(client):
    test_client, _ = client
    buf = BytesIO()
    Image.new("RGB", (320, 240), color=(240, 235, 225)).save(buf, format="PNG")
    buf.seek(0)

    res = test_client.post(
        "/api/vision-ask",
        files={"image": ("taj.png", buf, "image/png")},
        data={
            "destination_slug": "agra",
            "question": "What monument is this?",
            "language": "en",
            "persona": "quick",
            "lat": "27.1751",
            "lng": "78.0421",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["matched_monument_slug"] == "taj-mahal-mausoleum"
    assert len(data["architectural_features"]) >= 1
    assert len(data["candidate_monuments"]) >= 1


def test_tours_time_and_step_free_filters(client):
    test_client, _ = client
    res = test_client.get("/api/destinations/agra/tours?max_minutes=60&step_free_only=true")
    assert res.status_code == 200
    routes = res.json()
    assert len(routes) == 2
    assert all(r["duration_minutes"] <= 60 and r["step_free"] is True for r in routes)
    assert all(stop["lat"] is not None for stop in routes[0]["stops"])


def test_facilities_and_emergency_sos(client):
    test_client, _ = client
    res = test_client.get(
        "/api/destinations/agra/facilities?facility_type=toilet&accessible_only=true&lat=27.1714&lng=78.0378"
    )
    assert res.status_code == 200
    toilets = res.json()
    assert len(toilets) >= 2
    assert toilets[0]["slug"] == "taj-west-gate-accessible-toilet"
    assert toilets[0]["distance_meters"] <= toilets[1]["distance_meters"]

    sos = test_client.get("/api/destinations/agra/emergency?lat=27.1720&lng=78.0425")
    assert sos.status_code == 200
    sos_data = sos.json()
    assert sos_data["nearest_hospital"] is not None
    assert sos_data["nearest_police"] is not None
    helpline_nums = {h["number"] for h in sos_data["helplines"]}
    assert {"112", "108", "1090", "1363"}.issubset(helpline_nums)


def test_nearby_odop_and_group_personalisation(client):
    test_client, _ = client
    res = test_client.get("/api/destinations/agra/nearby?odop_only=true&group=elderly")
    assert res.status_code == 200
    places = res.json()
    assert len(places) >= 2
    assert all(p["is_odop"] is True and "elderly" in p["suitable_for"] for p in places)


def test_analytics_events_and_summary(client):
    test_client, _ = client

    # Verify strict zero-PII enforcement rejects arbitrary personal fields
    bad = test_client.post(
        "/api/analytics/events",
        json={
            "destination_slug": "agra",
            "event_type": "spot_visit",
            "email": "visitor@example.com",
        },
    )
    assert bad.status_code == 422

    # Valid anonymised spot_visit event
    ok = test_client.post(
        "/api/analytics/events",
        json={
            "destination_slug": "agra",
            "event_type": "spot_visit",
            "language": "en",
            "persona": "quick",
            "monument_slug": "taj-mahal-mausoleum",
            "query_topic": "Visited main dome",
        },
    )
    assert ok.status_code == 201

    # Also trigger a chat gap so live_events + gaps are included
    test_client.post(
        "/api/chat",
        json={
            "destination_slug": "agra",
            "question": "Explain quantum entanglement in superconductors",
            "language": "en",
        },
    )

    summary = test_client.get("/api/analytics/summary?destination_slug=agra").json()
    assert summary["synthetic_events"] == 25
    assert summary["live_events"] >= 2
    assert len(summary["top_questions"]) >= 1
    assert len(summary["language_breakdown"]) >= 2
    assert len(summary["popular_spots"]) >= 1
    assert len(summary["facility_demand"]) >= 1
    assert any("quantum" in g["label"].lower() for g in summary["knowledge_gaps"])


def test_pgvector_dialect_compilation():
    ddl = str(CreateTable(KnowledgeChunk.__table__).compile(dialect=postgresql.dialect()))
    assert "VECTOR(768)" in ddl

    stmt = select(KnowledgeChunk.embedding.cosine_distance([0.0] * 768))
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "<=>" in compiled



def _ask(test_client, question: str, language: str = "en") -> dict:
    res = test_client.post(
        "/api/chat",
        json={"destination_slug": "agra", "question": question, "language": language, "persona": "quick"},
    )
    assert res.status_code == 200
    return res.json()


def test_hindi_tokenizer_keeps_words_whole():
    from app.services.ai_service import _tokenize

    assert _tokenize("ताजमहल किसने बनवाया?") == ["ताजमहल", "बनवाया"]


def test_history_leads_and_hindi_retrieval(client):
    test_client, _ = client

    en = _ask(test_client, "Why was the Taj Mahal built?")
    assert en["is_knowledge_gap"] is False
    assert "Shah Jahan" in en["answer_summary"]
    assert "hands" not in en["answer_summary"].lower()

    hi = _ask(test_client, "ताजमहल किसने बनवाया?", "hi")
    assert hi["is_knowledge_gap"] is False
    assert "शाहजहाँ" in hi["answer_summary"]


def test_folklore_headline_is_labelled(client):
    test_client, _ = client
    data = _ask(test_client, "Is the Black Taj real?")
    assert data["answer_summary"].startswith("According to local tradition")
    assert len(data["folklore_legends"]) >= 1


def test_out_of_scope_questions_are_gaps(client):
    test_client, _ = client
    for question in ("Who built Fatehpur Sikri?", "What is the entry fee for foreigners?"):
        data = _ask(test_client, question)
        assert data["is_knowledge_gap"] is True, question
        assert data["verified_history"] == []
