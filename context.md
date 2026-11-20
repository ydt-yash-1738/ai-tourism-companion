# AI Tourism Companion — Project Context & Execution Tracker

**Initiative:** UP AI Mission, Department of IT & Electronics, Government of Uttar Pradesh  
**Source Spec:** [AI-Tourism-Companion.pdf](file:///c:/Users/yashd/OneDrive/Desktop/AI%20Tourism%20Companion/AI-Tourism-Companion.pdf)  
**Target:** Fulfill **9/9 Use Cases (UC-1 to UC-9)** and all **6 Key Requirements** using a single scalable Destination Content Pack architecture.

---

## 1. Chosen Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend & Android App** | **React + Vite + Tailwind CSS + Capacitor** | Single web codebase wrapped into an Android APK/AAB via Android Studio, plus `/admin` web dashboard for UC-9. |
| **Backend API** | **FastAPI (Python 3.11)** on **Render** | High-speed async Python, automatic OpenAPI/Swagger docs, native compatibility with `google-genai`, Pillow, and `pgvector`. |
| **Database & Vectors** | **Neon PostgreSQL + `pgvector`** *(with SQLite fallback for zero-config local dev)* | Stores structured POIs, facilities, ODOP items, anonymised analytics, and 768-dim RAG embeddings in a single DB. |
| **AI & Vision** | **Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`, `google-genai`) + **`gemini-embedding-001`** (`output_dimensionality=768`) | Unified multimodal LLM (text RAG, camera image recognition, Hindi/English/regional multilingual responses, strict JSON output). |
| **Voice AI** | **Sarvam AI** (`saaras:v4` STT, `bulbul:v3` TTS) + **Bhashini ULCA** (plug-and-play adapter) + **Capacitor Native STT/TTS** (`device_fallback`) | Natural Indian-language voice across 12 languages with automatic failover to on-device Android speech when offline or unconfigured. |
| **Maps (Frontend)** | **Leaflet + OpenStreetMap** | Free, offline-cache friendly, supports custom facility/accessibility markers and walking routes. |

---

## 2. Database Choice: Neon vs Supabase (Free Tier)

**Winner for this project: Neon PostgreSQL**

| Feature | Neon (Free Tier) | Supabase (Free Tier) |
| :--- | :--- | :--- |
| **Storage Limit** | **1 GB** per project | 500 MB per project |
| **Compute / RAM** | Up to 2 CU (bursts up to 8 GB RAM) — handles `pgvector` HNSW index builds comfortably | Nano (~0.5 GB RAM) — tight for vector index builds |
| **Inactivity Behavior** | Scales to zero after **5 min** idle, **automatically wakes in ~1–2 s** on the next SQL query | **Hard-pauses after 7 days** of inactivity (requires manual dashboard unpause) |
| **Render Compatibility** | Standard IPv4 + SSL (`postgresql://...`) works directly with `psycopg` | Direct DB host is IPv6-only on free tier (requires Supavisor pooler connection string for Render) |
| **Active Projects** | Up to 100 projects | 2 active projects |

> **Implementation note:** FastAPI uses `pool_pre_ping=True` and `pool_recycle=300` so Neon's 5-minute scale-to-zero wake-ups are handled seamlessly without stale connection errors.

---

## 3. Flagship Destination & Multi-Destination Architecture

* **Starter Destination (`agra`):** **Agra Heritage Zone (Taj Mahal & Agra Fort)**, stored in `data/destinations/agra/`.
* **Scalability:** Every database table and API endpoint is scoped by `destination_id` / `destination_slug`. Onboarding Lucknow, Varanasi, Sarnath, Ayodhya, or Mathura-Vrindavan only requires adding a new folder under `data/destinations/<slug>/` and running the idempotent seed script—zero backend code changes.

---

## 4. Progress Tracker

### What Has Been Done
- [x] **Phase 0 — Workspace & Docs:** `context.md` and `.gitignore` created.
- [x] **Phase 1 — Backend & Starter Data (`backend/` + `data/destinations/agra/`):**
  - [x] Curated Agra Destination Content Pack (`destination.json`, `monuments.json`, `knowledge_base.json` with tagged `RECORDED_HISTORY` vs `FOLKLORE_TRADITION`, `tour_routes.json`, `facilities.json`, `nearby_odop.json`, `synthetic_events.json`)
  - [x] SQLAlchemy 2.0 + `pgvector` models (with SQLite JSON fallback for local dev)
  - [x] Grounded RAG chat service (`UC-1`, `UC-3`, `UC-7`, `UC-8`) with Gemini 3.5 Flash-Lite + deterministic local fallback
  - [x] GPS-assisted Vision recognition (`UC-2`) with Pillow resizing + Gemini Multimodal
  - [x] Self-guided time & step-free audio tour endpoint (`UC-4`, `UC-8`)
  - [x] Facilities & 1-tap Emergency SOS endpoints with Haversine distance (`UC-6`, `UC-8`)
  - [x] Personalised nearby attractions & UP ODOP recommender (`UC-5`)
  - [x] Anonymised Tourism Dept analytics & knowledge-gap tracker (`UC-9`)
  - [x] Offline site bundle endpoint (`GET /api/destinations/{slug}/offline-pack`)
  - [x] Idempotent CLI seed script (`backend/scripts/seed_destination.py`)
  - [x] Indian-language Voice API (`backend/app/routers/voice.py` + `voice_service.py`) wiring **Sarvam AI** (`saaras:v4` STT, `bulbul:v3` TTS) + **Bhashini ULCA** 2-step pipeline + Capacitor `device_fallback`
  - [x] Automated pytest verification across all 9 UCs, `pgvector` PostgreSQL compilation, and mocked Sarvam/Bhashini voice pipelines (`13/13 passed`)
- [x] **Phase 2A — Cloud Services Activated & Live Verified:**
  - [x] Free **Neon PostgreSQL (`pgvector 0.8.7`)** project connected via `backend/.env` (unused Neon boilerplate vars removed)
  - [x] Google AI Studio `GEMINI_API_KEY` configured (`gemini-3.5-flash-lite` + `gemini-embedding-001`); `backend/.env.example` sanitized
  - [x] `agra` destination pack seeded into Neon with **16/16 knowledge chunks embedded (`VECTOR(768)`)** and verified via live `<=>` cosine similarity search
  - [x] Live RAG generation verified across `scholar` (EN), `kids` (EN), and `quick` + `simple_language` (HI) modes (`mode: "gemini"`, strict `verified_history` vs `folklore_legends` split)
  - [x] **Sarvam AI** (`SARVAM_API_KEY`) configured in `backend/.env` and live-verified via Hindi TTS (`bulbul:v3`) + STT (`saaras:v4`) roundtrip *(Bhashini ULCA adapter pre-wired & unit-tested; keys left blank since ULCA is gated for institutional/startup registration)*

### What Needs To Be Done
- [ ] **Phase 2B — Render Deployment (Deferred until ready):**
  - [ ] Deploy `backend/` to **Render** using `backend/render.yaml` and set `DATABASE_URL`, `GEMINI_API_KEY`, `SARVAM_API_KEY`, `CORS_ORIGINS` (plus optional `BHASHINI_*` keys if institutional access is obtained)
  - [ ] *(Optional enhancement)* Pre-generate static Hindi/English MP3 audio files for `tour_routes.json` stops
- [ ] **Phase 3 — Frontend & Capacitor Android App (`frontend/`):**
  - [ ] Scaffold React + Vite + Tailwind CSS + Capacitor Android project
  - [ ] Build core Companion UI: Multilingual Chat (`UC-1`), Fact vs Folklore cards (`UC-3`), Persona selector (`UC-7`), Accessibility Mode & Read Aloud (`UC-8`)
  - [ ] Integrate `@capacitor/camera` for Point & Ask (`UC-2`)
  - [ ] Build Leaflet map + Audio Tour player with `@capacitor/geolocation` + manual controls (`UC-4`)
  - [ ] Build Facilities filter view + persistent offline 1-Tap SOS modal (`UC-6`)
  - [ ] Build Personalised Nearby & UP ODOP finder (`UC-5`)
  - [ ] Implement "Download Offline Pack" (`@capacitor/filesystem` / IndexedDB + `@capacitor/network`)
  - [ ] Build `/admin` Tourism Department Analytics Dashboard with Recharts (`UC-9`)
- [ ] **Phase 4 — Verification & Demo Readiness:**
  - [ ] Build Android APK via Android Studio (using Android Studio's bundled JDK 17/21)
  - [ ] Test Airplane Mode offline fallback on Android device
  - [ ] Add a second UP destination pack (e.g., `lucknow` or `varanasi`) if time permits to demonstrate multi-site scalability

---

## 5. End-to-End Chat RAG & Voice Flow

```text
User Question (text, or audio -> POST /api/voice/stt via Sarvam AI saaras:v4)
        │
        ▼
POST /api/chat  (chat.py)
  • Validates request & looks up Destination ("agra") + optional Monument in Neon PostgreSQL
        │
        ▼
Embed Question  (ai_service.py -> embed_text)
  • Calls `gemini-embedding-001` -> L2-normalized 768-dim vector
        │
        ▼
Vector Search in Neon PostgreSQL  (ai_service.py -> retrieve_chunks)
  • Runs pgvector cosine distance (`embedding <=> query_vec`) over `knowledge_chunks`
  • Selects Top-5 chunks; flags `is_knowledge_gap = true` if below threshold
        │
        ▼
Grounded Generation  (ai_service.py -> generate_chat_response)
  • Calls `gemini-3.5-flash-lite` with ONLY Top-5 DB chunks + language + persona + simple_language rules
  • Enforces JSON split into `verified_history` (source) vs `folklore_legends` (attribution)
        │
        ▼
Zero-PII Telemetry Log  (chat.py -> Neon `analytics_events`)
  • Logs language, persona, topic, matched monument, and `is_knowledge_gap` for UC-9
        │
        ▼
Structured `ChatResponse` JSON -> (Optional) POST /api/voice/tts (Sarvam AI bulbul:v3 / device_fallback)
```

---

## 6. Backend API Contract

| Endpoint | Use Case | Purpose |
| :--- | :--- | :--- |
| `GET /health` | Infra | Health check, DB dialect status, `gemini_configured` / `sarvam_configured` / `bhashini_configured`, seeded destination count |
| `GET /api/destinations` | Core | List available UP heritage destinations |
| `GET /api/destinations/{slug}` | Core | Destination overview, supported languages, helplines |
| `GET /api/destinations/{slug}/monuments` | UC-4, UC-8 | Monuments/spots with GPS and accessibility metadata |
| `GET /api/destinations/{slug}/offline-pack` | Req 5 | Complete downloadable JSON bundle for weak-network/offline use |
| `POST /api/chat` | UC-1, 3, 7, 8 | Multilingual, persona-aware, Fact/Folklore-separated RAG Q&A |
| `POST /api/vision-ask` | UC-2, 3, 7, 8 | Image upload + optional GPS → monument/carving recognition & explanation |
| `GET /api/destinations/{slug}/tours` | UC-4, UC-8 | Filterable by `max_minutes` and `step_free_only` |
| `GET /api/destinations/{slug}/facilities` | UC-6, UC-8 | Filter by `facility_type`, `accessible_only`, sorted by Haversine distance (`lat`, `lng`) |
| `GET /api/destinations/{slug}/emergency` | UC-6 | Nearest hospital, nearest police booth, and 1-tap emergency helplines |
| `GET /api/destinations/{slug}/nearby` | UC-5 | Filter by `interests`, `budget`, `group`, `max_minutes`, `odop_only` |
| `POST /api/analytics/events` | UC-9 | Record anonymised (zero-PII) interaction event |
| `GET /api/analytics/summary` | UC-9 | Aggregated questions, languages, spots, facilities, personas, and knowledge gaps |
| `GET /api/voice/status` | UC-1, 4, 8 | Check Sarvam AI & Bhashini voice provider status |
| `POST /api/voice/stt` | UC-1 | Speech-to-Text (`Sarvam AI` → `Bhashini` → `device_fallback`) |
| `POST /api/voice/tts` | UC-1, 4, 8 | Text-to-Speech (`Sarvam AI` → `Bhashini` → `device_fallback`) |

---

## 7. Environment & Deployment Gotchas

1. **Java Version for Capacitor:** System `java` on PATH is JDK 8 (`1.8.0_431`), whereas Capacitor Android builds require **JDK 17 or 21**. Use Android Studio's bundled `jbr` when running Gradle/Capacitor builds.
2. **OneDrive Workspace Path:** The repo is inside `OneDrive\Desktop`. Pausing OneDrive sync during heavy `npm install` / Gradle builds prevents file-locking errors.
3. **Render Free Tier Cold Start:** Render free web services sleep after 15 min of inactivity (~30–50 s cold wake-up). The mobile app should rely on its cached offline pack on launch while waking the backend cleanly.
4. **Capacitor CORS Origins:** `CORS_ORIGINS` must allow `http://localhost`, `https://localhost`, and `capacitor://localhost` alongside Vite's `http://localhost:5173`.
5. **Secret Hygiene (`backend/.env` vs `.env.example`):** Keep all live secrets (`DATABASE_URL`, `GEMINI_API_KEY`, `SARVAM_API_KEY`) strictly in gitignored `backend/.env` and Render's Environment Variables—never in `.env.example` or `frontend/.env`.

