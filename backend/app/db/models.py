from datetime import datetime, timezone
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Destination(Base):
    """Top-level heritage destination pack (e.g., agra, lucknow, varanasi)."""

    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_hi: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="Uttar Pradesh")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_hi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    center_lat: Mapped[float] = mapped_column(Float, nullable=False)
    center_lng: Mapped[float] = mapped_column(Float, nullable=False)
    supported_languages: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    emergency_helplines: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    monuments = relationship("Monument", back_populates="destination", cascade="all, delete-orphan")
    knowledge_chunks = relationship(
        "KnowledgeChunk", back_populates="destination", cascade="all, delete-orphan"
    )
    tour_routes = relationship("TourRoute", back_populates="destination", cascade="all, delete-orphan")
    facilities = relationship("Facility", back_populates="destination", cascade="all, delete-orphan")
    nearby_places = relationship("NearbyPlace", back_populates="destination", cascade="all, delete-orphan")
    analytics_events = relationship(
        "AnalyticsEvent", back_populates="destination", cascade="all, delete-orphan"
    )


class Monument(Base):
    """Specific monument, gateway, or sub-stop inside a destination."""

    __tablename__ = "monuments"
    __table_args__ = (UniqueConstraint("destination_id", "slug", name="uq_monument_dest_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    destination_id: Mapped[int] = mapped_column(ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_hi: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    short_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    short_summary_hi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    geofence_radius_m: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    visit_duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    visual_cues: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    wheelchair_accessible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_ramp: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    step_free: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rest_points: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    stairs_warning: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    accessibility_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    accessibility_notes_hi: Mapped[str] = mapped_column(Text, nullable=False, default="")

    destination = relationship("Destination", back_populates="monuments")
    knowledge_chunks = relationship("KnowledgeChunk", back_populates="monument")


class KnowledgeChunk(Base):
    """Verified heritage content chunk strictly tagged as RECORDED_HISTORY or FOLKLORE_TRADITION."""

    __tablename__ = "knowledge_chunks"
    __table_args__ = (UniqueConstraint("destination_id", "chunk_key", name="uq_chunk_dest_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    destination_id: Mapped[int] = mapped_column(ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    monument_id: Mapped[int | None] = mapped_column(
        ForeignKey("monuments.id", ondelete="SET NULL"), nullable=True
    )
    chunk_key: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    title_hi: Mapped[str] = mapped_column(String(240), nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    source_name: Mapped[str] = mapped_column(String(240), nullable=False)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(768).with_variant(JSON(), "sqlite"), nullable=True
    )

    destination = relationship("Destination", back_populates="knowledge_chunks")
    monument = relationship("Monument", back_populates="knowledge_chunks")


class TourRoute(Base):
    """Curated time-based and accessibility-aware self-guided audio tour."""

    __tablename__ = "tour_routes"
    __table_args__ = (UniqueConstraint("destination_id", "slug", name="uq_tour_dest_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    destination_id: Mapped[int] = mapped_column(ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    title_hi: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    step_free: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_hi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    stops: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    destination = relationship("Destination", back_populates="tour_routes")


class Facility(Base):
    """Public utility, medical, police, help desk, or food outlet near the site."""

    __tablename__ = "facilities"
    __table_args__ = (UniqueConstraint("destination_id", "slug", name="uq_facility_dest_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    destination_id: Mapped[int] = mapped_column(ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_hi: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    facility_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    timings: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_accessible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_emergency: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes_hi: Mapped[str] = mapped_column(Text, nullable=False, default="")

    destination = relationship("Destination", back_populates="facilities")


class NearbyPlace(Base):
    """Nearby attraction, market, local cuisine, festival, or UP ODOP craft showcase."""

    __tablename__ = "nearby_places"
    __table_args__ = (UniqueConstraint("destination_id", "slug", name="uq_nearby_dest_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    destination_id: Mapped[int] = mapped_column(ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_hi: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    is_odop: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    odop_product: Mapped[str | None] = mapped_column(String(160), nullable=True)
    budget_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="low")
    suitable_for: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    interests: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    estimated_time_min: Mapped[int] = mapped_column(Integer, nullable=False, default=45)
    timings: Mapped[str] = mapped_column(String(180), nullable=False, default="")
    entry_fee_inr: Mapped[str] = mapped_column(String(160), nullable=False, default="Free")
    how_to_reach: Mapped[str] = mapped_column(Text, nullable=False, default="")
    official_source: Mapped[str] = mapped_column(String(200), nullable=False, default="UP Tourism")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_hi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str] = mapped_column(String(300), nullable=False, default="")

    destination = relationship("Destination", back_populates="nearby_places")


class AnalyticsEvent(Base):
    """Privacy-preserving anonymised interaction log for UC-9 Tourism Department insights (zero PII)."""

    __tablename__ = "analytics_events"
    __table_args__ = (UniqueConstraint("destination_id", "event_key", name="uq_analytics_dest_event_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    destination_id: Mapped[int] = mapped_column(ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    event_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    event_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    session_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="anon")
    language: Mapped[str] = mapped_column(String(16), index=True, nullable=False, default="en")
    persona: Mapped[str | None] = mapped_column(String(30), nullable=True)
    monument_slug: Mapped[str | None] = mapped_column(String(100), nullable=True)
    facility_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    query_topic: Mapped[str | None] = mapped_column(String(240), nullable=True)
    is_knowledge_gap: Mapped[bool] = mapped_column(Boolean, index=True, nullable=False, default=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, index=True, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    destination = relationship("Destination", back_populates="analytics_events")

