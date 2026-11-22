# AI Tourism Companion — Project Context & Execution Tracker

**Initiative:** UP AI Mission, Department of IT & Electronics, Government of Uttar Pradesh  
**Source Spec:** [AI-Tourism-Companion.pdf](file:///c:/Users/yashd/OneDrive/Desktop/AI%20Tourism%20Companion/AI-Tourism-Companion.pdf)  
**Target:** Fulfill **9/9 Use Cases (UC-1 to UC-9)** and all **6 Key Requirements** using a single scalable Destination Content Pack architecture.

---

## 1. Chosen Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend & Android App** | **React + Vite + SCSS + Capacitor** | Single web codebase wrapped into an Android APK/AAB via Android Studio, plus `#admin` dashboard for UC-9. |
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

## 3. Multi-Destination Heritage Architecture

* **Live Destinations (`agra`, `sarnath` & `lucknow`):**
  * **Agra Heritage Zone (`data/destinations/agra/`):** Taj Mahal & Agra Fort, 6 monuments, 18 knowledge chunks, 3 audio tours, 10 facilities, 10 nearby/ODOP & street-food items, 25 synthetic events.
  * **Sarnath Buddhist Heritage Zone (`data/destinations/sarnath/`):** Dhamek Stupa, Ashoka Pillar & Lion Capital Museum, Dharmarajika Stupa, Mulagandhakuti Vihara, Chaukhandi Stupa — 6 monuments, 18 knowledge chunks, 3 audio tours, 10 facilities, 10 nearby/Varanasi ODOP & street-food items, 25 synthetic events.
  * **Lucknow Heritage Zone (`data/destinations/lucknow/`):** Rumi Darwaza, Bara Imambara, Bhool Bhulaiya, Asfi Mosque, Shahi Baoli, Chota Imambara — 6 monuments, 18 knowledge chunks, 3 audio tours, 10 facilities, 10 nearby/Lucknow ODOP & street-food items, 25 synthetic events.
* **Scalability:** Every database table and API endpoint is scoped by `destination_id` / `destination_slug`. Onboarding Varanasi, Ayodhya, Mathura-Vrindavan, Prayagraj, or Fatehpur Sikri only requires adding a new folder under `data/destinations/<slug>/`, registering its media/config in `frontend/src/data/destinationMedia.ts` & `upCities.ts`, and running the idempotent seed script—zero backend code changes.

---

## 4. Progress Tracker

### What Has Been Done
- [x] **Phase 0 — Workspace & Docs:** `context.md` and `.gitignore` created.
- [x] **Phase 1 — Backend & Starter Data (`backend/` + `data/destinations/agra/`):**
  - [x] Curated Agra Destination Content Pack (`destination.json`, `monuments.json`, `knowledge_base.json` with tagged `RECORDED_HISTORY` vs `FOLKLORE_TRADITION`, `tour_routes.json`, `facilities.json`, `nearby_odop.json`, `synthetic_events.json`)
  - [x] SQLAlchemy 2.0 + `pgvector` models (with SQLite JSON fallback for local dev)
  - [x] Grounded multi-table RAG chat & tailored itinerary planner (`UC-1`, `UC-3`, `UC-5`, `UC-7`, `UC-8`) combining `pgvector` knowledge chunks with live DB `monuments`, `tour_routes`, `nearby_places` (street food + UP ODOP), and `facilities` using Gemini 3.5 Flash-Lite + deterministic local/offline fallback
  - [x] GPS-assisted Vision recognition (`UC-2`) with Pillow resizing + Gemini Multimodal
  - [x] Self-guided time & step-free audio tour endpoint (`UC-4`, `UC-8`)
  - [x] Facilities & 1-tap Emergency SOS endpoints with Haversine distance (`UC-6`, `UC-8`)
  - [x] Personalised nearby attractions & UP ODOP recommender (`UC-5`)
  - [x] Anonymised Tourism Dept analytics & knowledge-gap tracker (`UC-9`)
  - [x] Offline site bundle endpoint (`GET /api/destinations/{slug}/offline-pack`)
  - [x] Idempotent CLI seed script (`backend/scripts/seed_destination.py`)
  - [x] Indian-language Voice & Translation API (`backend/app/routers/voice.py` + `voice_service.py` + `translate_service.py`) wiring **Sarvam AI** (`saaras:v4` STT, `bulbul:v3` TTS) + **Bhashini ULCA** + cached `/api/voice/translate` & TTS `auto_translate` + Capacitor `device_fallback`
  - [x] Automated pytest verification across all 9 UCs, `pgvector` PostgreSQL compilation, mocked Sarvam/Bhashini voice pipelines, and cached translation (`14/14 passed`)
- [x] **Phase 2A — Cloud Services Activated & Live Verified:**
  - [x] Free **Neon PostgreSQL (`pgvector 0.8.7`)** project connected via `backend/.env` (unused Neon boilerplate vars removed)
  - [x] Google AI Studio `GEMINI_API_KEY` configured (`gemini-3.5-flash-lite` + `gemini-embedding-001`); `backend/.env.example` sanitized
  - [x] `agra`, `sarnath`, and `lucknow` destination packs seeded into Neon PostgreSQL with **18/18 knowledge chunks embedded (`VECTOR(768)`) per destination (54 total)** and verified via live `<=>` cosine similarity search
  - [x] Live multi-table RAG, street-food recommendations, and constraint-aware itinerary planning verified across `agra`, `sarnath`, and `lucknow` (`mode: "gemini"`, strict `verified_history` vs `folklore_legends` split)
  - [x] **Sarvam AI** (`SARVAM_API_KEY`) configured in `backend/.env` and live-verified via Hindi TTS (`bulbul:v3`) + STT (`saaras:v4`) roundtrip *(Bhashini ULCA adapter pre-wired & unit-tested; keys left blank since ULCA is gated for institutional/startup registration)*

### What Needs To Be Done
- [ ] **Phase 2B — Render Deployment (Deferred until ready):**
  - [ ] Deploy `backend/` to **Render** using `backend/render.yaml` and set `DATABASE_URL`, `GEMINI_API_KEY`, `SARVAM_API_KEY`, `CORS_ORIGINS` (plus optional `BHASHINI_*` keys if institutional access is obtained)
  - [ ] *(Optional enhancement)* Pre-generate static Hindi/English MP3 audio files for `tour_routes.json` stops
- [ ] **Phase 3 — Frontend & Capacitor Android App (`frontend/`):**
  - [x] React + Vite + TypeScript + modular SCSS UI (`frontend/src/styles/`) themed around Uttar Pradesh Government & Digital India heritage (no Tailwind)
  - [x] Location-aware UP Heritage Cities landing view (`CitySelectorView.tsx`) with proximity matching across live destinations (`agra`, `sarnath`, & `lucknow` clickable; 5 UP heritage cities as upcoming placeholders)
  - [x] Build core Companion UI: Multilingual Chat (`UC-1`), Fact vs Folklore cards (`UC-3`), Persona selector (`UC-7`), Accessibility Mode `Aa+` & Sarvam/Web Speech Read Aloud (`UC-8`)
  - [x] Photo Point & Ask UI (`CameraTab.tsx`, `UC-2`) with live/demo GPS attachment
  - [x] Build Leaflet map + Audio Tour player with GPS proximity + manual controls (`TourTab.tsx`, `UC-4`)
  - [x] Build Facilities filter view + persistent offline 1-Tap SOS modal (`FacilitiesTab.tsx` + `EmergencyModal.tsx`, `UC-6`)
  - [x] Build Personalised Nearby & UP ODOP finder (`NearbyTab.tsx`, `UC-5`)
  - [x] Implement "Download Offline Pack" (`localStorage` cache per destination + online/offline failover + local keyword search)
  - [x] Build Tourism Department Analytics Dashboard (`#admin`, `AdminDashboard.tsx`) with Recharts & live destination switcher (`UC-9`)
  - [x] Full 10-language UI i18n (`frontend/src/data/i18n.ts`) + chunked cached batch translation (`translateCache.ts`) + auto-translated Sarvam AI / Web Speech TTS across `en, hi, mr, ta, bn, te, ur, fr, ja, es`
  - [x] Readable typography (`Outfit` + `Inter` + Indic `Noto Sans` scripts) and Android/mobile-optimized SCSS layouts (swipeable filter bars, non-zooming 16px inputs, compact featured city grid, safe-area bottom nav)
  - [x] Capacitor 8 Android project (`frontend/android`), status bar + splash plugins, camera/mic/location permissions, bundled Agra, Sarnath & Lucknow offline packs, custom icon & splash (see `frontend/ANDROID.md`)
- [ ] **Phase 4 — Verification & Demo Readiness:**
  - [x] Debug and signed release APKs built from the command line (`npm run android:debug` / `android:release`)
  - [ ] Test Airplane Mode offline fallback on Android device
  - [x] Added **Sarnath (`sarnath`)** and **Lucknow (`lucknow`)** as full UP destination packs across Neon `pgvector`, backend APIs, bundled offline packs, and frontend UI

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
| `POST /api/voice/tts` | UC-1, 4, 8 | Text-to-Speech (`Sarvam AI` → `Bhashini` → `device_fallback`, optional `auto_translate`) |
| `POST /api/voice/translate` | UC-1, 4, 5, 6 | Cached batch translation for UI cards, tour audio scripts & facilities |

---

## 7. Environment & Deployment Gotchas

1. **Java Version for Capacitor:** System `java` on PATH is JDK 8 (`1.8.0_431`), whereas Capacitor Android builds require **JDK 17 or 21**. Use Android Studio's bundled `jbr` when running Gradle/Capacitor builds.
2. **OneDrive Workspace Path:** The repo is inside `OneDrive\Desktop`. Pausing OneDrive sync during heavy `npm install` / Gradle builds prevents file-locking errors.
3. **Render Free Tier Cold Start:** Render free web services sleep after 15 min of inactivity (~30–50 s cold wake-up). The mobile app should rely on its cached offline pack on launch while waking the backend cleanly.
4. **Capacitor CORS Origins:** `CORS_ORIGINS` must allow `http://localhost`, `https://localhost`, and `capacitor://localhost` alongside Vite's `http://localhost:5173`.
5. **Secret Hygiene (`backend/.env` vs `.env.example`):** Keep all live secrets (`DATABASE_URL`, `GEMINI_API_KEY`, `SARVAM_API_KEY`) strictly in gitignored `backend/.env` and Render's Environment Variables—never in `.env.example` or `frontend/.env`.

