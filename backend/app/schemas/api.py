from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

ContentType = Literal["RECORDED_HISTORY", "FOLKLORE_TRADITION"]
PersonaType = Literal["kids", "quick", "scholar", "pilgrim"]
EventType = Literal[
    "chat_query",
    "vision_query",
    "spot_visit",
    "facility_search",
    "tour_start",
    "nearby_view",
]


class HelplineOut(BaseModel):
    label: str
    label_hi: str = ""
    number: str
    category: str = "emergency"


class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    name_hi: str
    state: str
    description: str
    description_hi: str
    center_lat: float
    center_lng: float
    supported_languages: list[str]
    emergency_helplines: list[HelplineOut]
    metadata_json: dict[str, Any]


class MonumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    name_hi: str
    short_summary: str
    short_summary_hi: str
    lat: float
    lng: float
    geofence_radius_m: int
    visit_duration_min: int
    visual_cues: list[str]
    wheelchair_accessible: bool
    has_ramp: bool
    step_free: bool
    rest_points: list[str]
    stairs_warning: bool
    accessibility_notes: str
    accessibility_notes_hi: str


class KnowledgeChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chunk_key: str
    monument_id: int | None
    title: str
    title_hi: str
    content: str
    content_hi: str
    content_type: ContentType
    source_name: str
    tags: list[str]


class HistoryFactItem(BaseModel):
    text: str
    source: str


class FolkloreItem(BaseModel):
    text: str
    attribution: str


class ChatMessageItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    destination_slug: str = "agra"
    question: str = Field(..., min_length=1, max_length=1000)
    language: str = Field(default="en", min_length=2, max_length=16)
    persona: PersonaType = "quick"
    simple_language: bool = False
    monument_slug: str | None = None
    session_hash: str | None = Field(default=None, max_length=64)
    conversation_history: list[ChatMessageItem] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer_summary: str
    verified_history: list[HistoryFactItem] = Field(default_factory=list)
    folklore_legends: list[FolkloreItem] = Field(default_factory=list)
    follow_up_suggestions: list[str] = Field(default_factory=list)
    is_knowledge_gap: bool = False
    matched_monument_slug: str | None = None
    language: str
    persona: PersonaType
    simple_language: bool
    mode: Literal["gemini", "local_fallback"]


class VisionResponse(BaseModel):
    identified_name: str
    confidence: Literal["high", "medium", "low"]
    architectural_features: list[str] = Field(default_factory=list)
    answer_summary: str
    verified_history: list[HistoryFactItem] = Field(default_factory=list)
    folklore_legends: list[FolkloreItem] = Field(default_factory=list)
    matched_monument_slug: str | None = None
    candidate_monuments: list[str] = Field(default_factory=list)
    is_knowledge_gap: bool = False
    language: str
    persona: PersonaType
    mode: Literal["gemini", "local_fallback"]


class TourStopOut(BaseModel):
    order: int
    monument_slug: str
    monument_name: str = ""
    monument_name_hi: str = ""
    lat: float | None = None
    lng: float | None = None
    geofence_radius_m: int = 30
    duration_min: int
    audio_script_en: str
    audio_script_hi: str
    audio_url_en: str | None = None
    audio_url_hi: str | None = None
    accessibility_tip: str = ""
    step_free: bool = False


class TourRouteOut(BaseModel):
    id: int
    slug: str
    title: str
    title_hi: str
    duration_minutes: int
    step_free: bool
    description: str
    description_hi: str
    stops: list[TourStopOut]


class FacilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    name_hi: str
    facility_type: str
    lat: float
    lng: float
    timings: str
    address: str
    phone: str | None = None
    is_accessible: bool
    is_emergency: bool
    notes: str
    notes_hi: str
    distance_meters: int | None = None


class EmergencyResponse(BaseModel):
    destination_slug: str
    nearest_hospital: FacilityOut | None = None
    nearest_police: FacilityOut | None = None
    helplines: list[HelplineOut] = Field(default_factory=list)


class NearbyPlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    name_hi: str
    category: str
    is_odop: bool
    odop_product: str | None = None
    budget_tier: str
    suitable_for: list[str]
    interests: list[str]
    estimated_time_min: int
    timings: str
    entry_fee_inr: str
    how_to_reach: str
    official_source: str
    description: str
    description_hi: str
    lat: float
    lng: float
    address: str
    distance_meters: int | None = None


class OfflinePackResponse(BaseModel):
    destination: DestinationOut
    monuments: list[MonumentOut]
    knowledge_chunks: list[KnowledgeChunkOut]
    tour_routes: list[TourRouteOut]
    facilities: list[FacilityOut]
    nearby_places: list[NearbyPlaceOut]
    generated_at: datetime


class AnalyticsEventCreate(BaseModel):
    """Strict zero-PII whitelist for telemetry events."""

    model_config = ConfigDict(extra="forbid")

    destination_slug: str = "agra"
    event_type: EventType
    session_hash: str = Field(default="anon", max_length=64)
    language: str = Field(default="en", max_length=16)
    persona: PersonaType | None = None
    monument_slug: str | None = Field(default=None, max_length=100)
    facility_type: str | None = Field(default=None, max_length=40)
    query_topic: str | None = Field(default=None, max_length=240)
    is_knowledge_gap: bool = False


class AnalyticsEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    language: str
    persona: str | None
    monument_slug: str | None
    facility_type: str | None
    query_topic: str | None
    is_knowledge_gap: bool
    is_synthetic: bool
    created_at: datetime


class CountItem(BaseModel):
    label: str
    count: int


class AnalyticsSummaryResponse(BaseModel):
    destination_slug: str
    total_events: int
    synthetic_events: int
    live_events: int
    top_questions: list[CountItem]
    language_breakdown: list[CountItem]
    popular_spots: list[CountItem]
    facility_demand: list[CountItem]
    persona_breakdown: list[CountItem]
    knowledge_gaps: list[CountItem]


VoiceProviderChoice = Literal["auto", "sarvam", "bhashini"]
VoiceProviderUsed = Literal["sarvam", "bhashini", "device_fallback"]


class VoiceStatusResponse(BaseModel):
    voice_provider_mode: str
    sarvam_configured: bool
    bhashini_configured: bool
    sarvam_stt_model: str
    sarvam_tts_model: str
    supported_indian_languages: list[str]


class VoiceSTTResponse(BaseModel):
    transcript: str
    detected_language: str
    provider: VoiceProviderUsed
    fallback_to_device: bool = False
    message: str = ""


class VoiceTTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2500)
    language: str = Field(default="hi", min_length=2, max_length=16)
    speaker: str | None = Field(default=None, max_length=80)
    gender: Literal["female", "male"] = "female"
    pace: float = Field(default=1.0, ge=0.5, le=2.0)
    output_format: Literal["wav", "mp3"] = "wav"
    provider: VoiceProviderChoice = "auto"


class VoiceTTSResponse(BaseModel):
    audio_base64: str | None = None
    content_type: str = "audio/wav"
    language: str
    provider: VoiceProviderUsed
    fallback_to_device: bool = False
    message: str = ""

