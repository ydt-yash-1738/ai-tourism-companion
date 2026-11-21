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
SARNATH_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "destinations" / "sarnath"
LUCKNOW_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "destinations" / "lucknow"


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
    assert len(pack["knowledge_chunks"]) == 18
    assert len(pack["tour_routes"]) == 3
    assert len(pack["facilities"]) == 10
    assert len(pack["nearby_places"]) == 10


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


def _ask(test_client, question: str, language: str = "en", destination_slug: str = "agra") -> dict:
    res = test_client.post(
        "/api/chat",
        json={"destination_slug": destination_slug, "question": question, "language": language, "persona": "quick"},
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


def test_curated_monument_prompts_are_answered(client):
    """The Guide's monument cards and topic cards must never land on a knowledge gap."""
    test_client, _ = client
    for question, lang in (
        ("Tell me the verified history, architecture, and folklore of the Taj Mahal Main Mausoleum.", "en"),
        ("Why were the Taj Mosque and Jawab Pavilion built as twins, and why is the Taj Mahal closed on Fridays?", "en"),
        ("क्या काले ताजमहल और कारीगरों के हाथ काटने की कहानी सच है या लोककथा?", "hi"),
        ("ताजमहल खुलने का समय, शुक्रवार नियम, शू-कवर और व्हीलचेयर सुगम मार्ग की जानकारी दें।", "hi"),
    ):
        assert _ask(test_client, question, lang)["is_knowledge_gap"] is False, question




def test_sarnath_multi_destination_full_uc_coverage(client):
    test_client, SessionMaker = client

    with SessionMaker() as db:
        first_summary = seed_destination_from_dir(db=db, slug="sarnath", data_dir=SARNATH_DATA_DIR)
        assert first_summary["monuments"] == 6
        assert first_summary["knowledge_chunks"] == 18
        assert first_summary["tour_routes"] == 3
        assert first_summary["facilities"] == 10
        assert first_summary["nearby_places"] == 10
        assert first_summary["synthetic_events"] == 25

        # Idempotent re-seeding should not duplicate rows
        chunk_count_before = db.query(KnowledgeChunk).count()
        event_count_before = db.query(AnalyticsEvent).count()
        seed_destination_from_dir(db=db, slug="sarnath", data_dir=SARNATH_DATA_DIR)
        assert db.query(KnowledgeChunk).count() == chunk_count_before
        assert db.query(AnalyticsEvent).count() == event_count_before

    health = test_client.get("/health").json()
    assert health["destinations_seeded"] == 2

    dests = test_client.get("/api/destinations").json()
    assert {d["slug"] for d in dests} == {"agra", "sarnath"}

    monuments = test_client.get("/api/destinations/sarnath/monuments").json()
    assert len(monuments) == 6
    assert any(m["slug"] == "dhamek-stupa" and m["step_free"] is True for m in monuments)

    pack = test_client.get("/api/destinations/sarnath/offline-pack").json()
    assert pack["destination"]["slug"] == "sarnath"
    assert len(pack["monuments"]) == 6
    assert len(pack["knowledge_chunks"]) == 18
    assert len(pack["tour_routes"]) == 3
    assert len(pack["facilities"]) == 10
    assert len(pack["nearby_places"]) == 10

    # UC-1 + UC-3: Chat returns both recorded history and Jataka deer folklore
    chat_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "sarnath",
            "question": "Tell me about Dhamek Stupa first sermon and the Golden Deer Jataka folklore",
            "language": "en",
            "persona": "scholar",
            "simple_language": False,
        },
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert chat_data["is_knowledge_gap"] is False
    assert len(chat_data["verified_history"]) >= 1
    assert len(chat_data["folklore_legends"]) >= 1

    # Hindi + kids + simple_language
    hi_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "sarnath",
            "question": "धमेख स्तूप और बुद्ध का प्रथम उपदेश क्या था?",
            "language": "hi",
            "persona": "kids",
            "simple_language": True,
        },
    )
    assert hi_res.status_code == 200
    assert hi_res.json()["is_knowledge_gap"] is False
    assert hi_res.json()["language"] == "hi"
    assert hi_res.json()["simple_language"] is True

    # Out-of-scope query returns Sarnath-specific follow-ups (never Agra Taj Mahal)
    gap_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "sarnath",
            "question": "Explain quantum entanglement in superconductors",
            "language": "en",
            "persona": "quick",
        },
    )
    assert gap_res.status_code == 200
    gap_data = gap_res.json()
    assert gap_data["is_knowledge_gap"] is True
    assert all("taj mahal" not in s.lower() for s in gap_data["follow_up_suggestions"])
    assert any("sarnath" in s.lower() or "buddha" in s.lower() for s in gap_data["follow_up_suggestions"])

    # UC-2: Vision with Dhamek Stupa GPS
    buf = BytesIO()
    Image.new("RGB", (320, 240), color=(210, 185, 150)).save(buf, format="PNG")
    buf.seek(0)
    vis = test_client.post(
        "/api/vision-ask",
        files={"image": ("dhamek.png", buf, "image/png")},
        data={
            "destination_slug": "sarnath",
            "question": "What stupa is this?",
            "language": "en",
            "persona": "quick",
            "lat": "25.3808",
            "lng": "83.0245",
        },
    )
    assert vis.status_code == 200
    assert vis.json()["matched_monument_slug"] == "dhamek-stupa"

    # UC-4 + UC-8: Tours filter
    tours = test_client.get("/api/destinations/sarnath/tours?max_minutes=60&step_free_only=true").json()
    assert len(tours) == 2
    assert all(r["duration_minutes"] <= 60 and r["step_free"] is True for r in tours)

    # UC-6: Facilities & Emergency SOS
    toilets = test_client.get(
        "/api/destinations/sarnath/facilities?facility_type=toilet&accessible_only=true&lat=25.3802&lng=83.0238"
    ).json()
    assert len(toilets) >= 2
    assert toilets[0]["slug"] == "sarnath-asi-park-accessible-toilet"
    assert toilets[0]["distance_meters"] <= toilets[1]["distance_meters"]

    sos = test_client.get("/api/destinations/sarnath/emergency?lat=25.3808&lng=83.0245").json()
    assert sos["destination_slug"] == "sarnath"
    assert sos["nearest_hospital"] is not None
    assert sos["nearest_police"] is not None
    helpline_nums = {h["number"] for h in sos["helplines"]}
    assert {"112", "108", "1090", "1363", "+91-542-2595406"}.issubset(helpline_nums)

    # UC-5: Nearby ODOP
    nearby = test_client.get("/api/destinations/sarnath/nearby?odop_only=true&group=elderly").json()
    assert len(nearby) >= 3
    assert all(p["is_odop"] is True and "elderly" in p["suitable_for"] for p in nearby)

    # UC-9: Analytics summary isolated per destination
    sarnath_summary = test_client.get("/api/analytics/summary?destination_slug=sarnath").json()
    assert sarnath_summary["destination_slug"] == "sarnath"
    assert sarnath_summary["synthetic_events"] == 25
    assert sarnath_summary["live_events"] >= 4
    assert any("quantum" in g["label"].lower() for g in sarnath_summary["knowledge_gaps"])

    agra_summary = test_client.get("/api/analytics/summary?destination_slug=agra").json()
    assert agra_summary["destination_slug"] == "agra"
    assert agra_summary["live_events"] == 0


def test_sarnath_curated_prompts_are_answered(client):
    """All Sarnath monument spotlight, topic card, starter, and gap follow-up prompts must be answered."""
    test_client, SessionMaker = client
    with SessionMaker() as db:
        seed_destination_from_dir(db=db, slug="sarnath", data_dir=SARNATH_DATA_DIR)

    sarnath_prompts = [
        # Spotlight prompts (EN + HI)
        ("Tell me the verified history, Gupta carvings, and Jataka deer lore of Dhamek Stupa.", "en"),
        ("धमेख स्तूप का प्रमाणित इतिहास, गुप्तकालीन नक्काशी और मृग जातक कथा बताइए।", "hi"),
        ("What is inscribed on the Ashoka Pillar at Sarnath and how was it excavated?", "en"),
        ("सारनाथ के अशोक स्तंभ पर क्या उत्कीर्ण है और इसकी खोज कैसे हुई?", "hi"),
        ("Tell me about the Ashoka Lion Capital inside Sarnath Museum and its Friday closure.", "en"),
        ("सारनाथ संग्रहालय में रखे अशोक के सिंह स्तंभ और शुक्रवार अवकाश के बारे में बताइए।", "hi"),
        ("What happened at Dharmarajika Stupa in 1794 and what is history vs folklore there?", "en"),
        ("1794 में धर्मराजिका स्तूप के उत्खनन का इतिहास और इससे जुड़ी जनश्रुति बताइए।", "hi"),
        ("Tell me about Kosetsu Nosu’s frescoes and the Sacred Bodhi Tree at Mulagandhakuti Vihara.", "en"),
        ("मूलगंधकुटी विहार के भित्तिचित्र और पवित्र बोधि वृक्ष की परंपरा के बारे में बताइए।", "hi"),
        ("Why does Chaukhandi Stupa have an octagonal Mughal tower on top?", "en"),
        ("बौद्ध चौखंडी स्तूप के शिखर पर अष्टकोणीय मुगल मीनार क्यों बनी है?", "hi"),
        # Topic card prompts (EN + HI)
        ("Tell me about Buddha first sermon at Sarnath and the Golden Deer Jataka folklore.", "en"),
        ("सारनाथ में बुद्ध के प्रथम उपदेश और स्वर्ण मृग जातक लोककथा के बारे में बताइए।", "hi"),
        ("How was the Ashoka Lion Capital excavated and how did it become India's National Emblem?", "en"),
        ("सारनाथ का सिंह स्तंभ कैसे खोजा गया और यह भारत का राष्ट्रीय प्रतीक कैसे बना?", "hi"),
        ("Why does Chaukhandi Stupa have an octagonal Mughal tower on top of a Buddhist stupa?", "en"),
        ("चौखंडी स्तूप के ऊपर अष्टकोणीय मुगल मीनार क्यों बनी है और इसकी लोककथा क्या है?", "hi"),
        ("What are the Sarnath monument timings, ticket prices, Friday museum closure, and visitor rules?", "en"),
        ("सारनाथ स्मारक व संग्रहालय खुलने का समय, टिकट शुल्क, शुक्रवार अवकाश और प्रवेश नियम बताइए।", "hi"),
        # Starter prompts (EN + HI)
        ("Where did Buddha deliver his first sermon, and what is the Deer Park legend?", "en"),
        ("भगवान बुद्ध ने प्रथम उपदेश कहाँ दिया और स्वर्ण मृग जातक कथा क्या है?", "hi"),
        ("How did the Ashoka Lion Capital become India’s National Emblem?", "en"),
        ("अशोक का सिंह स्तंभ भारत का राष्ट्रीय प्रतीक कैसे बना?", "hi"),
        ("Why does Chaukhandi Stupa have a Mughal octagonal tower on top?", "en"),
        ("चौखंडी स्तूप के शिखर पर मुगल मीनार क्यों बनाई गई?", "hi"),
        ("When is Sarnath Museum closed, and are step-free paths available?", "en"),
        ("सारनाथ संग्रहालय किस दिन बंद रहता है और क्या रैंप मार्ग उपलब्ध है?", "hi"),
        # Gap follow-up suggestions (EN + HI)
        ("Where did Gautama Buddha deliver his first sermon?", "en"),
        ("How did the Sarnath Lion Capital become India's National Emblem?", "en"),
        ("Tell me the Golden Deer Jataka story of Sarnath", "en"),
        ("बुद्ध ने सारनाथ में पहला उपदेश कहाँ दिया था?", "hi"),
        ("अशोक का सिंह स्तंभ और सारनाथ संग्रहालय कब खुलता है?", "hi"),
    ]
    for question, lang in sarnath_prompts:
        res = _ask(test_client, question, lang, destination_slug="sarnath")
        assert res["is_knowledge_gap"] is False, f"{lang}: {question}"


def test_lucknow_multi_destination_full_uc_coverage(client):
    test_client, SessionMaker = client

    with SessionMaker() as db:
        first_summary = seed_destination_from_dir(db=db, slug="lucknow", data_dir=LUCKNOW_DATA_DIR)
        assert first_summary["monuments"] == 6
        assert first_summary["knowledge_chunks"] == 18
        assert first_summary["tour_routes"] == 3
        assert first_summary["facilities"] == 10
        assert first_summary["nearby_places"] == 10
        assert first_summary["synthetic_events"] == 25

        # Idempotent re-seeding should not duplicate rows
        chunk_count_before = db.query(KnowledgeChunk).count()
        event_count_before = db.query(AnalyticsEvent).count()
        seed_destination_from_dir(db=db, slug="lucknow", data_dir=LUCKNOW_DATA_DIR)
        assert db.query(KnowledgeChunk).count() == chunk_count_before
        assert db.query(AnalyticsEvent).count() == event_count_before

    health = test_client.get("/health").json()
    assert health["destinations_seeded"] == 2

    dests = test_client.get("/api/destinations").json()
    assert {d["slug"] for d in dests} == {"agra", "lucknow"}

    monuments = test_client.get("/api/destinations/lucknow/monuments").json()
    assert len(monuments) == 6
    assert any(m["slug"] == "bara-imambara" and m["step_free"] is True for m in monuments)

    pack = test_client.get("/api/destinations/lucknow/offline-pack").json()
    assert pack["destination"]["slug"] == "lucknow"
    assert len(pack["monuments"]) == 6
    assert len(pack["knowledge_chunks"]) == 18
    assert len(pack["tour_routes"]) == 3
    assert len(pack["facilities"]) == 10
    assert len(pack["nearby_places"]) == 10

    # UC-1 + UC-3: Chat returns both recorded history and famine folklore
    chat_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "lucknow",
            "question": "Why was the Bara Imambara built during a famine, and what is the built by day, undone by night story?",
            "language": "en",
            "persona": "scholar",
            "simple_language": False,
        },
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert chat_data["is_knowledge_gap"] is False
    assert len(chat_data["verified_history"]) >= 1
    assert len(chat_data["folklore_legends"]) >= 1

    # Hindi + kids + simple_language
    hi_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "lucknow",
            "question": "बड़ा इमामबाड़ा किसने और अकाल के समय क्यों बनवाया?",
            "language": "hi",
            "persona": "kids",
            "simple_language": True,
        },
    )
    assert hi_res.status_code == 200
    assert hi_res.json()["is_knowledge_gap"] is False
    assert hi_res.json()["language"] == "hi"
    assert hi_res.json()["simple_language"] is True

    # Out-of-scope query returns Lucknow-specific follow-ups (never Agra Taj Mahal)
    gap_res = test_client.post(
        "/api/chat",
        json={
            "destination_slug": "lucknow",
            "question": "Explain quantum entanglement in superconductors",
            "language": "en",
            "persona": "quick",
        },
    )
    assert gap_res.status_code == 200
    gap_data = gap_res.json()
    assert gap_data["is_knowledge_gap"] is True
    assert all("taj mahal" not in s.lower() for s in gap_data["follow_up_suggestions"])
    assert any(
        "bara imambara" in s.lower() or "bhool bhulaiya" in s.lower() or "chikankari" in s.lower()
        for s in gap_data["follow_up_suggestions"]
    )

    # UC-2: Vision with Bara Imambara GPS
    buf = BytesIO()
    Image.new("RGB", (320, 240), color=(215, 200, 175)).save(buf, format="PNG")
    buf.seek(0)
    vis = test_client.post(
        "/api/vision-ask",
        files={"image": ("imambara.png", buf, "image/png")},
        data={
            "destination_slug": "lucknow",
            "question": "What monument is this?",
            "language": "en",
            "persona": "quick",
            "lat": "26.8691",
            "lng": "80.9124",
        },
    )
    assert vis.status_code == 200
    assert vis.json()["matched_monument_slug"] == "bara-imambara"

    # UC-4 + UC-8: Tours filter
    tours = test_client.get("/api/destinations/lucknow/tours?max_minutes=60&step_free_only=true").json()
    assert len(tours) == 2
    assert all(r["duration_minutes"] <= 60 and r["step_free"] is True for r in tours)

    # UC-6: Facilities & Emergency SOS
    toilets = test_client.get(
        "/api/destinations/lucknow/facilities?facility_type=toilet&accessible_only=true&lat=26.8699&lng=80.9125"
    ).json()
    assert len(toilets) >= 2
    assert toilets[0]["slug"] == "bara-imambara-accessible-toilet"
    assert toilets[0]["distance_meters"] <= toilets[1]["distance_meters"]

    sos = test_client.get("/api/destinations/lucknow/emergency?lat=26.8691&lng=80.9124").json()
    assert sos["destination_slug"] == "lucknow"
    assert sos["nearest_hospital"] is not None
    assert sos["nearest_police"] is not None
    helpline_nums = {h["number"] for h in sos["helplines"]}
    assert {"112", "108", "1090", "1363", "+91-9454403847"}.issubset(helpline_nums)

    # UC-5: Nearby ODOP
    nearby = test_client.get("/api/destinations/lucknow/nearby?odop_only=true&group=elderly").json()
    assert len(nearby) >= 3
    assert all(p["is_odop"] is True and "elderly" in p["suitable_for"] for p in nearby)

    # UC-9: Analytics summary isolated per destination
    lucknow_summary = test_client.get("/api/analytics/summary?destination_slug=lucknow").json()
    assert lucknow_summary["destination_slug"] == "lucknow"
    assert lucknow_summary["synthetic_events"] == 25
    assert lucknow_summary["live_events"] >= 4
    assert any("quantum" in g["label"].lower() for g in lucknow_summary["knowledge_gaps"])

    agra_summary = test_client.get("/api/analytics/summary?destination_slug=agra").json()
    assert agra_summary["destination_slug"] == "agra"
    assert agra_summary["live_events"] == 0


def test_lucknow_curated_prompts_are_answered(client):
    """All Lucknow monument spotlight, topic card, starter, and gap follow-up prompts must be answered."""
    test_client, SessionMaker = client
    with SessionMaker() as db:
        seed_destination_from_dir(db=db, slug="lucknow", data_dir=LUCKNOW_DATA_DIR)

    lucknow_prompts = [
        # Spotlight prompts (EN + HI)
        ("Who built the Bara Imambara, and why is its central hall famous?", "en"),
        ("बड़ा इमामबाड़ा किसने बनवाया और इसका मध्य हॉल क्यों प्रसिद्ध है?", "hi"),
        ("What is the Bhool Bhulaiya, and what do the tunnel legends say?", "en"),
        ("भूलभुलैया क्या है और सुरंगों की लोककथा क्या कहती है?", "hi"),
        ("When was the Rumi Darwaza built, and what does its name mean?", "en"),
        ("रूमी दरवाज़ा कब बना और इसके नाम का अर्थ क्या है?", "hi"),
        ("Tell me about the Asfi Mosque and how to visit it respectfully.", "en"),
        ("आसफ़ी मस्जिद के बारे में बताइए और वहाँ सम्मानपूर्वक कैसे जाएँ?", "hi"),
        ("How did the Shahi Baoli stepwell work and what is the legend about it?", "en"),
        ("शाही बावली कैसे काम करती थी और इससे जुड़ी लोककथा क्या है?", "hi"),
        ("Who built the Chota Imambara and why is it called the Palace of Lights?", "en"),
        ("छोटा इमामबाड़ा किसने बनवाया और इसे रोशनी का महल क्यों कहा जाता है?", "hi"),
        # Topic card prompts (EN + HI)
        ("Why was the Bara Imambara built during a famine, and what is the built by day, undone by night story?", "en"),
        ('अकाल के समय बड़ा इमामबाड़ा क्यों बना और "दिन में बनाओ, रात में गिराओ" की कहानी क्या है?', "hi"),
        ("How does the central hall of the Bara Imambara stand without beams?", "en"),
        ("बड़ा इमामबाड़ा का मध्य हॉल बिना बीम के कैसे खड़ा है?", "hi"),
        ("What is Chikankari, Lucknow's ODOP craft?", "en"),
        ("लखनऊ का ODOP शिल्प चिकनकारी क्या है?", "hi"),
        ("How should I dress and behave when visiting the Bara Imambara and Asfi Mosque?", "en"),
        ("बड़ा इमामबाड़ा और आसफ़ी मस्जिद जाते समय पहनावा और व्यवहार कैसा हो?", "hi"),
        # Starter prompts (EN + HI)
        ("Who built the Bara Imambara, and why during a famine?", "en"),
        ("बड़ा इमामबाड़ा किसने और अकाल के समय क्यों बनवाया?", "hi"),
        ("How does the great hall stand without any beams?", "en"),
        ("विशाल हॉल बिना बीम के कैसे खड़ा है?", "hi"),
        ("Are the secret tunnels of the Bhool Bhulaiya real?", "en"),
        ("क्या भूलभुलैया की गुप्त सुरंगें सच हैं?", "hi"),
        ("What does the name Rumi Darwaza mean?", "en"),
        ("रूमी दरवाज़ा नाम का अर्थ क्या है?", "hi"),
        # Gap follow-up suggestions (EN + HI)
        ("Who built the Bara Imambara?", "en"),
        ("What is the Bhool Bhulaiya?", "en"),
        ("What is Chikankari, Lucknow's ODOP craft?", "en"),
        ("बड़ा इमामबाड़ा किसने बनवाया?", "hi"),
        ("भूलभुलैया क्या है?", "hi"),
        ("लखनऊ का ODOP शिल्प चिकनकारी क्या है?", "hi"),
    ]
    for question, lang in lucknow_prompts:
        res = _ask(test_client, question, lang, destination_slug="lucknow")
        assert res["is_knowledge_gap"] is False, f"{lang}: {question}"


def test_street_food_and_nearby_recommendations_all_cities(client):
    """Street food queries across Agra, Sarnath, and Lucknow return verified DB places with coordinates."""
    test_client, SessionMaker = client
    with SessionMaker() as db:
        seed_destination_from_dir(db=db, slug="sarnath", data_dir=SARNATH_DATA_DIR)
        seed_destination_from_dir(db=db, slug="lucknow", data_dir=LUCKNOW_DATA_DIR)

    cases = [
        ("agra", "en", "What is the best street food in Agra and where can I eat chaat or petha?"),
        ("agra", "hi", "आगरा में सबसे अच्छा स्ट्रीट फ़ूड, चाट और पेठा कहाँ मिलता है?"),
        ("sarnath", "en", "What local street food, kachori, lassi, or monastery cafes are near Sarnath?"),
        ("sarnath", "hi", "सारनाथ में स्थानीय स्ट्रीट फ़ूड, कचौड़ी-लस्सी और मठ मार्ग के व्यंजन कहाँ मिलते हैं?"),
        ("lucknow", "en", "What is the best street food in Lucknow like chaat, kebabs, and kulfi?"),
        ("lucknow", "hi", "लखनऊ में बास्केट चाट, कबाब और कुल्फी जैसा सबसे अच्छा स्ट्रीट फ़ूड कहाँ मिलता है?"),
    ]
    for slug, lang, question in cases:
        res = _ask(test_client, question, lang, destination_slug=slug)
        assert res["is_knowledge_gap"] is False, f"{slug} ({lang}): {question}"
        places = res["recommended_places"]
        assert len(places) >= 2, f"Expected recommended_places for {slug} ({lang})"
        assert all(p["lat"] is not None and p["lng"] is not None and p["source_slug"] for p in places)


def test_tailored_travel_plan_with_constraints(client):
    """Itinerary requests respect wheelchair/step-free, time, budget, food, and craft constraints."""
    test_client, SessionMaker = client
    with SessionMaker() as db:
        seed_destination_from_dir(db=db, slug="sarnath", data_dir=SARNATH_DATA_DIR)
        seed_destination_from_dir(db=db, slug="lucknow", data_dir=LUCKNOW_DATA_DIR)

    agra_plan = _ask(
        test_client,
        "Create a 3-hour wheelchair-accessible Agra travel plan for a family on a low budget including food and crafts",
        "en",
        destination_slug="agra",
    )
    assert agra_plan["is_knowledge_gap"] is False
    stops = agra_plan["itinerary_stops"]
    assert len(stops) >= 3
    assert all(s["lat"] is not None and s["lng"] is not None and s["source_slug"] for s in stops)
    # Stairs-heavy Agra spots (upper Taj marble plinth & Musamman Burj) must be skipped in step-free plans
    stop_slugs = {s["source_slug"] for s in stops}
    assert "taj-mahal-mausoleum" not in stop_slugs
    assert "musamman-burj" not in stop_slugs
    assert any(s["category"] == "food" for s in stops)
    assert any(s["category"] == "craft" for s in stops)
    assert sum(s["duration_min"] or 0 for s in stops) <= 180
    assert "friday" in agra_plan["answer_summary"].lower()

    sarnath_plan = _ask(
        test_client,
        "Create a 3-hour step-free Sarnath travel plan for a family including local food and Banarasi crafts",
        "en",
        destination_slug="sarnath",
    )
    assert sarnath_plan["is_knowledge_gap"] is False
    assert len(sarnath_plan["itinerary_stops"]) >= 3
    assert all(s["lat"] is not None and s["lng"] is not None for s in sarnath_plan["itinerary_stops"])

    lucknow_plan = _ask(
        test_client,
        "लखनऊ में परिवार के लिए 3 घंटे की व्हीलचेयर-सुगम यात्रा योजना बनाएं जिसमें चिकनकारी और स्ट्रीट फ़ूड शामिल हों",
        "hi",
        destination_slug="lucknow",
    )
    assert lucknow_plan["is_knowledge_gap"] is False
    lko_stops = lucknow_plan["itinerary_stops"]
    assert len(lko_stops) >= 3
    assert "bhool-bhulaiya" not in {s["source_slug"] for s in lko_stops}
    assert all(s["lat"] is not None and s["lng"] is not None for s in lko_stops)

