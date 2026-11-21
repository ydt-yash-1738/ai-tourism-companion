"""Export a destination's offline pack as static JSON for bundling inside the mobile app.

The app ships this file so it works on first launch with no network and no backend:
on-device search, tours, facilities, nearby places and SOS all read from it.

Usage:
    python -m scripts.export_offline_pack --slug agra --out ../frontend/public/packs/agra.json
"""

import argparse
import json
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.session import create_db_engine, get_db, init_db
from app.main import app
from scripts.seed_destination import seed_destination_from_dir

DATA_ROOT = Path(__file__).resolve().parents[2] / "data" / "destinations"


def export_pack(slug: str, out_path: Path) -> dict:
    settings.GEMINI_API_KEY = ""  # never call external APIs while exporting
    with tempfile.TemporaryDirectory() as tmp:
        engine = create_db_engine(f"sqlite:///{Path(tmp) / 'export.db'}")
        init_db(engine)
        session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
        with session_factory() as db:
            seed_destination_from_dir(db=db, slug=slug, data_dir=DATA_ROOT / slug)

        def override_get_db():
            db = session_factory()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        try:
            with TestClient(app) as client:
                res = client.get(f"/api/destinations/{slug}/offline-pack")
                res.raise_for_status()
                pack = res.json()
                # Synthetic-only insights, so the department dashboard can demo offline
                ins = client.get(
                    "/api/analytics/summary",
                    params={"destination_slug": slug, "include_synthetic": "true"},
                )
                ins.raise_for_status()
                insights = ins.json()
        finally:
            app.dependency_overrides.clear()
            engine.dispose()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    insights_path = out_path.with_name(f"{slug}-insights.json")
    insights_path.write_text(json.dumps(insights, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return pack


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", default="agra")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    pack = export_pack(args.slug, args.out)
    print(
        f"Exported '{args.slug}' pack to {args.out}: "
        f"{len(pack['monuments'])} monuments, {len(pack['knowledge_chunks'])} knowledge chunks, "
        f"{len(pack['facilities'])} facilities"
    )


if __name__ == "__main__":
    main()
