# UP AI Tourism Companion — FastAPI Backend

Production-ready Python 3.11 + FastAPI backend powering all **9 Use Cases (UC-1 to UC-9)** and offline pack delivery, backed by **Neon PostgreSQL (`pgvector`)** (with zero-config SQLite fallback for local development) and **Gemini 3.5 Flash-Lite**.

## Local Quickstart

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env

# Seed the Agra heritage pack (safe to re-run anytime)
python -m scripts.seed_destination --slug agra

# Start API server + interactive Swagger docs at http://127.0.0.1:8000/docs
uvicorn app.main:app --reload
```

## Run Automated Tests

```powershell
cd backend
.\.venv\Scripts\pytest.exe -v
```

## Connecting Neon PostgreSQL + Gemini API

1. Create a free project on **Neon** (`https://neon.tech`) and copy the **Pooled** or **Direct** PostgreSQL connection string (`postgresql://...?sslmode=require`).
2. Put it in `backend/.env` as `DATABASE_URL=...` along with your `GEMINI_API_KEY=...` from Google AI Studio.
3. Run:
   ```powershell
   python -m scripts.seed_destination --slug agra --with-embeddings
   ```
   `init_db()` automatically enables `CREATE EXTENSION IF NOT EXISTS vector;` on PostgreSQL and creates all tables.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render Dashboard, create a **Blueprint** (auto-reads `backend/render.yaml`) or a **Web Service**:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`
3. Set `DATABASE_URL`, `GEMINI_API_KEY`, `SARVAM_API_KEY` (optional), `BHASHINI_USER_ID` / `BHASHINI_ULCA_API_KEY` (optional), and `CORS_ORIGINS` in Render Environment Variables.
4. Once deployed, seed the Neon DB either from your local shell (using Neon `DATABASE_URL`) or via Render Shell (`python -m scripts.seed_destination --slug agra --with-embeddings`).

## Voice Endpoints (Sarvam AI + Bhashini)

- `GET /api/voice/status` — Check which Indian-language voice providers are configured
- `POST /api/voice/stt` — Speech-to-Text (`saaras:v4` via Sarvam AI → Bhashini ASR → `device_fallback` for Capacitor native speech)
- `POST /api/voice/tts` — Text-to-Speech (`bulbul:v3` via Sarvam AI → Bhashini TTS → `device_fallback` for Capacitor native TTS)

