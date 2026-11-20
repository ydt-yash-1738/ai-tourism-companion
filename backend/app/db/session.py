from collections.abc import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Declarative base for all SQLAlchemy ORM models."""


def create_db_engine(database_url: str) -> Engine:
    """Create a SQLAlchemy engine tuned for either SQLite or Neon PostgreSQL."""
    is_sqlite = database_url.startswith("sqlite")
    if is_sqlite:
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            future=True,
        )
    # pool_pre_ping handles Neon's 5-minute scale-to-zero auto-suspend wake-ups gracefully.
    return create_engine(
        database_url,
        pool_pre_ping=True,
        pool_recycle=300,
        future=True,
    )


engine = create_db_engine(settings.normalized_database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def init_db(target_engine: Engine | None = None) -> None:
    """Ensure pgvector extension (on PostgreSQL) and create all tables if absent."""
    eng = target_engine or engine
    from app.db import models  # noqa: F401  Ensure all models are registered on Base.metadata

    if eng.dialect.name == "postgresql":
        with eng.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    Base.metadata.create_all(bind=eng)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

