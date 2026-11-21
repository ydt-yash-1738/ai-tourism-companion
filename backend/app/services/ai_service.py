from io import BytesIO
import logging
import math
import re
import time
from typing import Any, Literal
from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Destination, Facility, KnowledgeChunk, Monument, NearbyPlace, TourRoute
from app.schemas.api import (
    ChatRequest,
    ChatResponse,
    FolkloreItem,
    HistoryFactItem,
    ItineraryStopItem,
    PersonaType,
    RecommendedPlaceItem,
    VisionResponse,
)
from app.services.geo import haversine_meters

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 768
GAP_THRESHOLD = 0.42

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "did", "do", "does",
    "for", "from", "had", "has", "have", "here", "how", "i", "in", "is", "it",
    "its", "me", "my", "of", "on", "or", "tell", "that", "the", "their", "them",
    "there", "these", "this", "to", "was", "were", "what", "when", "where",
    "which", "who", "why", "will", "with", "you", "your", "about", "explain",
    "please", "give", "more", "know", "mean", "means", "meaning", "happen", "happened",
    "real", "true", "actually", "really", "story", "stories", "see", "visit", "like", "any",
    "some", "so", "very", "also", "called", "name", "named", "find", "get", "go", "should",
    "could", "would", "much", "many", "here", "there", "kind", "type", "is", "was", "ka", "ke", "ki", "ko", "kya", "kaise",
    "verified", "makes", "special", "including", "features", "feature", "inside", "vs", "versus", "tell", "describe", "show", "important", "famous", "about",
    "बताइए", "बताएं", "बताएँ", "बताइये", "प्रमाणित", "विशेषता", "विशेषताएँ", "कारण", "तथा", "रहने", "लिए", "या", "दें", "दीजिए", "सच", "जानकारी", "कहानी",
    "kyon", "hai", "hain", "था", "थी", "थे", "है", "हैं", "क्या", "क्यों",
    "कैसे", "के", "की", "को", "में", "से", "और", "का", "पर", "यह", "वह",
    "किसने", "कौन", "कब", "कहाँ", "कहां", "गया", "गई", "गए", "बताइए", "बताओ", "बारे",
}

_PERSONA_INSTRUCTIONS: dict[PersonaType, str] = {
    "kids": (
        "Adopt a warm, vivid storytelling voice suitable for children aged 8-12. "
        "Keep sentences short, spark curiosity, and avoid dry academic jargon."
    ),
    "quick": (
        "Adopt a crisp, scannable style for visitors in a hurry. "
        "Summarize key points in 2-3 tight sentences."
    ),
    "scholar": (
        "Adopt an authoritative architectural and historical tone with dates, "
        "materials, stylistic lineages, and primary chronicle context."
    ),
    "pilgrim": (
        "Highlight spiritual, devotional, and cultural traditions with deep respect, "
        "while keeping historical facts clearly separated from sacred lore."
    ),
}


class _GeminiChatPayload(BaseModel):
    answer_summary: str
    verified_history: list[HistoryFactItem] = Field(default_factory=list)
    folklore_legends: list[FolkloreItem] = Field(default_factory=list)
    itinerary_stops: list[ItineraryStopItem] = Field(default_factory=list)
    recommended_places: list[RecommendedPlaceItem] = Field(default_factory=list)
    follow_up_suggestions: list[str] = Field(default_factory=list)
    is_knowledge_gap: bool = False
    matched_monument_slug: str | None = None


class _GeminiVisionPayload(BaseModel):
    identified_name: str
    confidence: Literal["high", "medium", "low"]
    architectural_features: list[str] = Field(default_factory=list)
    answer_summary: str
    verified_history: list[HistoryFactItem] = Field(default_factory=list)
    folklore_legends: list[FolkloreItem] = Field(default_factory=list)
    matched_monument_slug: str | None = None
    is_knowledge_gap: bool = False


def _get_genai_client() -> genai.Client | None:
    if not settings.has_gemini_key:
        return None
    return genai.Client(api_key=settings.GEMINI_API_KEY.strip())


def _normalize_vector(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in values))
    if norm == 0.0:
        return values
    return [v / norm for v in values]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def embed_text(text: str) -> list[float] | None:
    """Compute a normalized 768-dim embedding using Gemini if an API key is configured."""
    client = _get_genai_client()
    if client is None or not text.strip():
        return None
    try:
        response = client.models.embed_content(
            model=settings.GEMINI_EMBED_MODEL,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
        )
        if not response.embeddings:
            return None
        return _normalize_vector(list(response.embeddings[0].values))
    except Exception:
        return None


# Devanagari letters and vowel signs (excluding the danda marks U+0964/U+0965) and Urdu script
_TOKEN_RE = re.compile(r"[\w\u0900-\u0963\u0966-\u097F\u0600-\u06FF]+", flags=re.UNICODE)


def _tokenize(text: str) -> list[str]:
    """Split text into lowercase word tokens, keeping Devanagari/Urdu vowel signs inside words."""
    tokens = _TOKEN_RE.findall(text.lower())
    return [t for t in tokens if len(t) >= 2 and t not in _STOPWORDS and not t.isdigit()]


def _prefix_match(a: str, b: str) -> bool:
    """Loose stem match: 'built'~'build', 'carvings'~'carving', 'बनवाया'~'बनवाना'."""
    if len(a) < 4 or len(b) < 4:
        return False
    common = 0
    for x, y in zip(a, b):
        if x != y:
            break
        common += 1
    return common >= 4 and common >= 0.66 * min(len(a), len(b))


def _match_strength(tok: str, strong: set[str], weak: set[str]) -> float:
    if tok in strong:
        return 1.0
    if tok in weak:
        return 0.85
    if any(_prefix_match(tok, ct) for ct in strong):
        return 0.7
    if any(_prefix_match(tok, ct) for ct in weak):
        return 0.6
    return 0.0


_GENERIC_NAME_WORDS = {
    "main", "the", "of", "and", "gate", "pavilion", "tower", "octagonal", "great", "mukhya",
    "stupa", "ruins", "shrine", "sarnath",
    "मुख्य", "एवं", "द्वार", "शाही", "प्रवेश", "भवन", "मीनार", "अष्टकोणीय",
    "स्तूप", "अवशेष", "सारनाथ",
}
_PROPER_PHRASE_RE = re.compile(r"\b([A-Z][a-z]+(?:[ -][A-Z][a-z]+)+)\b")


def _entity_tokens(monuments: list[Monument]) -> dict[str, set[int]]:
    """Map each distinctive monument-name word (EN + HI) to the monuments it names."""
    entities: dict[str, set[int]] = {}
    for m in monuments:
        for tok in _tokenize(f"{m.name} {m.name_hi}"):
            if tok not in _GENERIC_NAME_WORDS:
                entities.setdefault(tok, set()).add(m.id)
    return entities


def _unknown_proper_phrase(query: str, corpus_lower: str) -> bool:
    """True if the question names a place/person (e.g. 'Red Fort') that our content never mentions."""
    for phrase in _PROPER_PHRASE_RE.findall(query):
        words = phrase.split()
        # Ignore a capitalised first word that only starts the sentence ("Why Shah" -> check "Shah")
        if query.strip().startswith(words[0]) and len(words) > 2:
            phrase = " ".join(words[1:])
        elif query.strip().startswith(words[0]) and len(words) == 2:
            continue
        if phrase.lower() not in corpus_lower:
            return True
    return False


def _keyword_rank_chunks(
    chunks: list[KnowledgeChunk],
    query: str,
    monument_id: int | None = None,
    top_k: int = 5,
    monuments: list[Monument] | None = None,
) -> tuple[list[KnowledgeChunk], float]:
    """Rank chunks by IDF-weighted query coverage.

    Returns the ranked chunks and a coverage score in [0, 1]: the share of the question's
    informative words that the best chunk explains. Rare words (e.g. 'delhi', 'fee') weigh
    more than words found everywhere (e.g. 'taj'), so off-topic questions score low and are
    reported as knowledge gaps instead of being answered with unrelated content.
    """
    query_tokens = list(dict.fromkeys(_tokenize(query)))
    if not query_tokens or not chunks:
        return [], 0.0

    indexed: list[tuple[KnowledgeChunk, set[str], set[str]]] = []
    for chunk in chunks:
        strong = set(_tokenize(f"{chunk.title} {chunk.title_hi} {' '.join(chunk.tags or [])}"))
        weak = set(_tokenize(f"{chunk.content} {chunk.content_hi}")) - strong
        indexed.append((chunk, strong, weak))

    corpus_lower = " ".join(
        [f"{c.title} {c.content} {' '.join(c.tags or [])}" for c in chunks]
        + [m.name for m in (monuments or [])]
    ).lower()
    if _unknown_proper_phrase(query, corpus_lower):
        return [], 0.0

    entities = _entity_tokens(monuments or [])
    named_monuments: set[int] = set()
    for tok in query_tokens:
        named_monuments |= entities.get(tok, set())

    n = len(indexed)
    strengths = {
        tok: [_match_strength(tok, strong, weak) for _, strong, weak in indexed]
        for tok in query_tokens
    }
    idf = {
        tok: math.log((n + 1) / (sum(1 for s in strengths[tok] if s > 0) + 0.5))
        for tok in query_tokens
    }
    # A word found nowhere in the content still signals "off-topic", but cap its pull
    # so one stray word cannot sink an otherwise well-covered question.
    known = [idf[t] for t in query_tokens if any(strengths[t])]
    unknown_cap = max(known) if known else None
    if unknown_cap is not None:
        for tok in query_tokens:
            if not any(strengths[tok]):
                idf[tok] = min(idf[tok], max(1.2, unknown_cap))
    if named_monuments:
        # The monument the visitor names is the subject of the question: weigh it like the rarest word
        top_idf = max(idf.values())
        for tok in query_tokens:
            if tok in entities:
                idf[tok] = max(idf[tok], top_idf)
    total_weight = sum(idf.values()) or 1.0
    q_lower = query.lower()

    scored: list[tuple[float, float, KnowledgeChunk]] = []
    for i, (chunk, _, _) in enumerate(indexed):
        coverage = sum(idf[tok] * strengths[tok][i] for tok in query_tokens) / total_weight
        if coverage <= 0.0:
            continue
        rank = coverage
        if named_monuments and chunk.monument_id is not None and chunk.monument_id not in named_monuments:
            rank *= 0.6  # content about a different monument than the one asked about
        if monument_id is not None and chunk.monument_id == monument_id:
            rank += 0.1
        for tag in chunk.tags or []:
            if " " in tag and tag.lower() in q_lower:
                rank += 0.15
        if chunk.content_type == "RECORDED_HISTORY":
            rank += 0.01  # tie-break: recorded history leads over folklore
        scored.append((rank, coverage, chunk))

    if not scored:
        return [], 0.0
    scored.sort(key=lambda item: item[0], reverse=True)
    best_rank = scored[0][0]
    # Keep only chunks reasonably close to the best one so unrelated text is not mixed in
    kept = [item for item in scored if item[0] >= 0.5 * best_rank][:top_k]
    # Multi-part questions are answered by several chunks together: measure how much
    # of the question the top three chunks cover between them.
    top_idx = [next(i for i, (c, _, _) in enumerate(indexed) if c is chunk) for _, _, chunk in kept[:3]]
    union = sum(idf[tok] * max(strengths[tok][i] for i in top_idx) for tok in query_tokens) / total_weight
    best_coverage = max(max(item[1] for item in kept), union)
    return [c for _, _, c in kept], round(min(1.0, best_coverage), 4)


def retrieve_chunks(
    db: Session,
    destination_id: int,
    query: str,
    monument_id: int | None = None,
    top_k: int = 5,
) -> tuple[list[KnowledgeChunk], float]:
    """Retrieve relevant knowledge chunks via pgvector cosine search or keyword fallback."""
    base_query = db.query(KnowledgeChunk).filter(KnowledgeChunk.destination_id == destination_id)
    all_chunks = base_query.all()
    if not all_chunks:
        return [], 0.0

    has_embeddings = any(c.embedding is not None for c in all_chunks)
    if settings.has_gemini_key and has_embeddings:
        q_vec = embed_text(query)
        if q_vec is not None:
            dialect = db.bind.dialect.name if db.bind is not None else "sqlite"
            if dialect == "postgresql":
                dist_expr = KnowledgeChunk.embedding.cosine_distance(q_vec).label("dist")
                rows = (
                    db.query(KnowledgeChunk, dist_expr)
                    .filter(
                        KnowledgeChunk.destination_id == destination_id,
                        KnowledgeChunk.embedding.is_not(None),
                    )
                    .order_by(dist_expr)
                    .limit(top_k)
                    .all()
                )
                if rows:
                    chunks = [row[0] for row in rows]
                    best_sim = max(0.0, 1.0 - float(rows[0][1]))
                    if best_sim >= 0.42:
                        return chunks, round(best_sim, 4)
            else:
                scored_vec = [
                    (_cosine_similarity(q_vec, c.embedding), c)
                    for c in all_chunks
                    if c.embedding is not None
                ]
                scored_vec.sort(key=lambda item: item[0], reverse=True)
                if scored_vec and scored_vec[0][0] >= 0.42:
                    return [c for _, c in scored_vec[:top_k]], round(scored_vec[0][0], 4)

    monuments = db.query(Monument).filter(Monument.destination_id == destination_id).all()
    return _keyword_rank_chunks(
        all_chunks, query, monument_id=monument_id, top_k=top_k, monuments=monuments
    )


def _format_context_block(chunks: list[KnowledgeChunk], monument_map: dict[int, Monument]) -> str:
    lines: list[str] = []
    for chunk in chunks:
        m_slug = monument_map[chunk.monument_id].slug if chunk.monument_id in monument_map else "general"
        lines.append(
            f"- [{chunk.content_type}] (monument={m_slug}, source={chunk.source_name}) "
            f"{chunk.title}: {chunk.content}"
        )
    return "\n".join(lines)


_ITINERARY_RE = re.compile(
    r"\b(?:itinerary|travel plan|trip plan|day plan|schedule|plan a|plan my|plan an|plan for|"
    r"create a .*plan|make a .*plan|build a .*plan|half[- ]day|full[- ]day)\b|"
    r"(?:यात्रा योजना|यात्रा प्लान|ट्रिप प्लान|घूमने का प्लान|यात्रा कार्यक्रम|योजना बना|प्लान बना)",
    flags=re.IGNORECASE,
)
_FOOD_RE = re.compile(
    r"\b(?:street food|food|chaat|petha|bedai|jalebi|kebab|kebabs|biryani|kulfi|kachori|lassi|"
    r"momos|thukpa|snack|snacks|eat|eating|dining|restaurant|restaurants|cafe|cafes|cuisine|"
    r"dishes|sweets|breakfast|lunch|dinner|makhan malai|basket chaat)\b|"
    r"(?:स्ट्रीट फ़ूड|स्ट्रीट फूड|भोजन|खाना|खाने|चाट|पेठा|बेड़ई|जलेबी|कबाब|कुल्फी|कचौड़ी|लस्सी|मोमोज़|थुकपा|व्यंजन|नाश्ता|मिठाई)",
    flags=re.IGNORECASE,
)
_NEARBY_RE = re.compile(
    r"\b(?:nearby|places to visit|things to do|market|markets|bazaar|shopping|souvenir|souvenirs|"
    r"where to buy|where to shop|where to eat)\b|"
    r"(?:आस-पास|आसपास|बाज़ार|बाजार|खरीदारी|कहाँ खरीदें)",
    flags=re.IGNORECASE,
)
_FACILITY_RE = re.compile(
    r"\b(?:toilet|toilets|restroom|restrooms|washroom|drinking water|parking|first aid|"
    r"hospital|police|wheelchair|cloakroom|locker|facilit(?:y|ies))\b|"
    r"(?:शौचालय|पेयजल|पार्किंग|प्राथमिक उपचार|अस्पताल|पुलिस|व्हीलचेयर|सुविधा)",
    flags=re.IGNORECASE,
)


def _detect_chat_intents(query: str) -> set[str]:
    """Detect structured planning, street-food, nearby, or facility intents."""
    intents: set[str] = set()
    if _ITINERARY_RE.search(query):
        intents.add("itinerary")
    if _FOOD_RE.search(query):
        intents.add("food")
    if _NEARBY_RE.search(query):
        intents.add("nearby")
    if _FACILITY_RE.search(query):
        intents.add("facility")
    return intents


def _extract_plan_constraints(
    query: str,
    persona: PersonaType,
    simple_language: bool,
) -> dict[str, Any]:
    """Parse time budget, step-free, group, budget tier, and craft/food filters."""
    q = query.lower()
    max_minutes = 180
    hr_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|\s)?\s*(?:hr|hrs|hour|hours|घंटे|घंटा)", q)
    min_match = re.search(r"(\d+)\s*(?:-|\s)?\s*(?:min|mins|minute|minutes|मिनट)", q)
    if hr_match:
        max_minutes = max(30, min(600, int(round(float(hr_match.group(1)) * 60))))
    elif min_match:
        max_minutes = max(20, min(600, int(min_match.group(1))))
    elif any(k in q for k in ("half-day", "half day", "अर्ध-दिवस", "आधा दिन")):
        max_minutes = 240
    elif any(k in q for k in ("full-day", "full day", "पूरा दिन")):
        max_minutes = 420

    step_free_only = any(
        k in q
        for k in (
            "wheelchair",
            "step-free",
            "step free",
            "no stairs",
            "ramp",
            "elderly",
            "senior",
            "व्हीलचेयर",
            "सीढ़ी-रहित",
            "रैंप",
            "दिव्यांग",
            "बुजुर्ग",
            "वरिष्ठ",
        )
    )

    budget: str | None = None
    if re.search(r"\bfree\b|निःशुल्क|मुफ़्त", q):
        budget = "free"
    elif any(k in q for k in ("low budget", "low-budget", "budget", "cheap", "affordable", "किफायती", "कम बजट", "सस्ता")):
        budget = "low"
    elif any(k in q for k in ("medium", "moderate", "मध्यम")):
        budget = "medium"

    group: str | None = None
    if any(k in q for k in ("kid", "kids", "child", "children", "बच्च", "बाल")):
        group = "kids"
    elif any(k in q for k in ("elderly", "senior", "wheelchair", "बुजुर्ग", "वरिष्ठ")):
        group = "elderly"
    elif any(k in q for k in ("family", "परिवार", "पारिवारिक")):
        group = "family"
    elif any(k in q for k in ("solo", "अकेले")):
        group = "solo"
    elif persona == "kids":
        group = "kids"

    wants_food = bool(_FOOD_RE.search(query))
    wants_crafts = any(
        k in q
        for k in (
            "craft",
            "crafts",
            "odop",
            "parchinkari",
            "leather",
            "chikankari",
            "zardozi",
            "silk",
            "toys",
            "market",
            "bazaar",
            "shopping",
            "शिल्प",
            "ओडीओपी",
            "चिकनकारी",
            "रेशम",
            "बाज़ार",
            "बाजार",
            "खरीद",
        )
    )

    day_mentioned: str | None = None
    if "friday" in q or "शुक्रवार" in q:
        day_mentioned = "friday"
    elif "monday" in q or "सोमवार" in q:
        day_mentioned = "monday"

    return {
        "max_minutes": max_minutes,
        "step_free_only": step_free_only,
        "budget": budget,
        "group": group,
        "wants_food": wants_food,
        "wants_crafts": wants_crafts,
        "day_mentioned": day_mentioned,
        "simple_language": simple_language,
    }


def _format_structured_catalog(
    destination: Destination,
    monuments: list[Monument],
    tour_routes: list[TourRoute],
    nearby_places: list[NearbyPlace],
    facilities: list[Facility],
) -> str:
    """Serialize all verified DB tables for grounded culinary, nearby, and itinerary reasoning."""
    meta = destination.metadata_json or {}
    lines = [
        f"DESTINATION: slug={destination.slug} | name={destination.name} | "
        f"odop={', '.join(meta.get('odop_products', []))} | "
        f"best_season={meta.get('best_season', '')} | "
        f"weekly_closure={meta.get('weekly_closure', '')}",
        "",
        "MONUMENTS:",
    ]
    for m in monuments:
        lines.append(
            f"- source_slug={m.slug} | name={m.name} ({m.name_hi}) | duration={m.visit_duration_min}min | "
            f"step_free={m.step_free} | wheelchair={m.wheelchair_accessible} | "
            f"stairs_warning={m.stairs_warning} | accessibility={m.accessibility_notes}"
        )

    lines.append("")
    lines.append("CURATED_TOURS:")
    for t in tour_routes:
        stop_slugs = [s.get("monument_slug", "") for s in (t.stops or []) if s.get("monument_slug")]
        lines.append(
            f"- slug={t.slug} | title={t.title} | duration={t.duration_minutes}min | "
            f"step_free={t.step_free} | stops={', '.join(stop_slugs)}"
        )

    lines.append("")
    lines.append("NEARBY_PLACES_AND_FOOD:")
    for n in nearby_places:
        lines.append(
            f"- source_slug={n.slug} | name={n.name} ({n.name_hi}) | category={n.category} | "
            f"is_odop={n.is_odop} | odop_product={n.odop_product or 'none'} | budget={n.budget_tier} | "
            f"suitable_for={','.join(n.suitable_for or [])} | interests={','.join(n.interests or [])} | "
            f"time={n.estimated_time_min}min | timings={n.timings} | fee={n.entry_fee_inr} | "
            f"reach={n.how_to_reach} | address={n.address} | desc={n.description}"
        )

    lines.append("")
    lines.append("FACILITIES:")
    for f in facilities:
        lines.append(
            f"- source_slug={f.slug} | name={f.name} ({f.name_hi}) | type={f.facility_type} | "
            f"accessible={f.is_accessible} | timings={f.timings} | address={f.address} | notes={f.notes}"
        )
    return "\n".join(lines)


def _hydrate_structured_items(
    itinerary_stops: list[ItineraryStopItem],
    recommended_places: list[RecommendedPlaceItem],
    monuments: list[Monument],
    nearby_places: list[NearbyPlace],
    facilities: list[Facility],
) -> tuple[list[ItineraryStopItem], list[RecommendedPlaceItem]]:
    """Verify every item against DB rows and overwrite coordinates/details from Neon DB."""
    by_slug: dict[str, tuple[str, Any]] = {}
    by_name: dict[str, tuple[str, Any]] = {}
    for kind, items in (("monument", monuments), ("nearby", nearby_places), ("facility", facilities)):
        for obj in items:
            by_slug[obj.slug.strip().lower()] = (kind, obj)
            for candidate in (obj.name, getattr(obj, "name_hi", "")):
                key = (candidate or "").strip().lower()
                if key:
                    by_name[key] = (kind, obj)

    def _resolve(slug: str | None, label: str) -> tuple[str, Any] | None:
        if slug:
            hit = by_slug.get(slug.strip().lower())
            if hit:
                return hit
        lbl = (label or "").strip().lower()
        if lbl in by_name:
            return by_name[lbl]
        for k, pair in by_name.items():
            if lbl and (lbl in k or k in lbl):
                return pair
        return None

    clean_stops: list[ItineraryStopItem] = []
    for stop in itinerary_stops:
        resolved = _resolve(stop.source_slug, stop.title)
        if not resolved:
            continue
        kind, obj = resolved
        duration = stop.duration_min
        if duration is None:
            duration = (
                obj.visit_duration_min
                if kind == "monument"
                else getattr(obj, "estimated_time_min", 20)
            )
        a11y = stop.accessibility_note
        if not a11y and kind == "monument":
            a11y = obj.accessibility_notes
        clean_stops.append(
            ItineraryStopItem(
                time_slot=stop.time_slot,
                title=stop.title,
                category=stop.category,
                duration_min=duration,
                notes=stop.notes,
                accessibility_note=a11y,
                lat=obj.lat,
                lng=obj.lng,
                source_slug=obj.slug,
            )
        )

    clean_places: list[RecommendedPlaceItem] = []
    seen_slugs: set[str] = set()
    for place in recommended_places:
        resolved = _resolve(place.source_slug, place.name)
        if not resolved:
            continue
        kind, obj = resolved
        if obj.slug in seen_slugs:
            continue
        seen_slugs.add(obj.slug)
        if kind == "nearby":
            clean_places.append(
                RecommendedPlaceItem(
                    name=place.name or obj.name,
                    category=obj.category,
                    description=place.description or obj.description,
                    timings=obj.timings,
                    budget_tier=obj.budget_tier,
                    entry_fee_inr=obj.entry_fee_inr,
                    is_odop=obj.is_odop,
                    is_accessible="elderly" in {s.lower() for s in (obj.suitable_for or [])},
                    lat=obj.lat,
                    lng=obj.lng,
                    address=obj.address,
                    source_slug=obj.slug,
                )
            )
        elif kind == "facility":
            clean_places.append(
                RecommendedPlaceItem(
                    name=place.name or obj.name,
                    category=obj.facility_type,
                    description=place.description or obj.notes,
                    timings=obj.timings,
                    budget_tier="free",
                    entry_fee_inr="Free",
                    is_odop=False,
                    is_accessible=obj.is_accessible,
                    lat=obj.lat,
                    lng=obj.lng,
                    address=obj.address,
                    source_slug=obj.slug,
                )
            )
        else:
            clean_places.append(
                RecommendedPlaceItem(
                    name=place.name or obj.name,
                    category="monument",
                    description=place.description or obj.short_summary,
                    timings="",
                    budget_tier="",
                    entry_fee_inr="",
                    is_odop=False,
                    is_accessible=obj.step_free,
                    lat=obj.lat,
                    lng=obj.lng,
                    address=obj.name,
                    source_slug=obj.slug,
                )
            )

    return clean_stops, clean_places


def _format_time_of_day(total_minutes: int) -> str:
    h = (total_minutes // 60) % 24
    m = total_minutes % 60
    suffix = "AM" if h < 12 else "PM"
    h12 = h if 1 <= h <= 12 else (12 if h % 12 == 0 else h % 12)
    return f"{h12:02d}:{m:02d} {suffix}"


_ALLOWED_BUDGETS: dict[str, set[str]] = {
    "free": {"free"},
    "low": {"free", "low"},
    "medium": {"free", "low", "medium"},
    "high": {"free", "low", "medium", "high"},
}


def _select_nearby_places(
    nearby_places: list[NearbyPlace],
    query: str,
    constraints: dict[str, Any],
    intents: set[str],
    limit: int = 4,
) -> list[NearbyPlace]:
    q_tokens = set(_tokenize(query))
    q_lower = query.lower()
    allowed_budgets = _ALLOWED_BUDGETS.get(constraints["budget"]) if constraints["budget"] else None
    group = constraints["group"]
    step_free = constraints["step_free_only"]

    candidates: list[tuple[tuple[int, int, int], NearbyPlace]] = []
    for p in nearby_places:
        suitable = {s.lower() for s in (p.suitable_for or [])}
        if group and group not in suitable:
            continue
        if step_free and "elderly" not in suitable:
            continue

        cat = p.category.lower()
        interests = {i.lower() for i in (p.interests or [])}
        wants_food = "food" in intents or constraints["wants_food"]
        wants_crafts = constraints["wants_crafts"]

        if "food" in intents and "itinerary" not in intents and "nearby" not in intents and not wants_crafts:
            if cat != "food" and "food" not in interests:
                continue

        budget_ok = not allowed_budgets or p.budget_tier.lower() in allowed_budgets
        haystack = f"{p.name} {p.name_hi} {p.description} {p.description_hi} {' '.join(interests)}".lower()
        token_hits = sum(1 for tok in q_tokens if tok in haystack)
        cat_match = 0
        if wants_food and (cat == "food" or "food" in interests):
            cat_match += 3
        if wants_crafts and (p.is_odop or cat == "crafts" or "crafts" in interests):
            cat_match += 3
        if any(w in q_lower for w in ("chaat", "petha", "bedai", "kebab", "kulfi", "kachori", "lassi", "momos", "thali")) and any(
            w in haystack for w in ("chaat", "petha", "bedai", "kebab", "kulfi", "kachori", "lassi", "momos", "thali") if w in q_lower
        ):
            cat_match += 4

        score = (
            0 if budget_ok else 1,
            -(cat_match + token_hits),
            0 if p.is_odop else 1,
        )
        candidates.append((score, p))

    candidates.sort(key=lambda item: item[0])
    return [p for _, p in candidates[:limit]]


def _select_facilities(
    facilities: list[Facility],
    query: str,
    step_free_only: bool,
    limit: int = 4,
) -> list[Facility]:
    q = query.lower()
    type_hints: set[str] = set()
    if any(k in q for k in ("toilet", "restroom", "washroom", "शौचालय")):
        type_hints.add("toilet")
    if any(k in q for k in ("water", "पेयजल")):
        type_hints.add("drinking_water")
    if any(k in q for k in ("parking", "पार्किंग")):
        type_hints.add("parking")
    if any(k in q for k in ("medical", "first aid", "hospital", "अस्पताल", "चिकित्सा")):
        type_hints.add("medical")
    if any(k in q for k in ("police", "पुलिस")):
        type_hints.add("police")
    if any(k in q for k in ("food", "eat", "snack", "भोजन", "खाना")):
        type_hints.add("food")
    if any(k in q for k in ("help", "wheelchair", "desk", "व्हीलचेयर", "सहायता")):
        type_hints.add("help_desk")

    matched = [
        f
        for f in facilities
        if (not type_hints or f.facility_type in type_hints)
        and (not step_free_only or f.is_accessible)
    ]
    if not matched:
        matched = [f for f in facilities if not step_free_only or f.is_accessible]
    return matched[:limit]


def _to_recommended_from_nearby(p: NearbyPlace, is_hi: bool) -> RecommendedPlaceItem:
    return RecommendedPlaceItem(
        name=p.name_hi if (is_hi and p.name_hi) else p.name,
        category=p.category,
        description=p.description_hi if (is_hi and p.description_hi) else p.description,
        timings=p.timings,
        budget_tier=p.budget_tier,
        entry_fee_inr=p.entry_fee_inr,
        is_odop=p.is_odop,
        is_accessible="elderly" in {s.lower() for s in (p.suitable_for or [])},
        lat=p.lat,
        lng=p.lng,
        address=p.address,
        source_slug=p.slug,
    )


def _to_recommended_from_facility(f: Facility, is_hi: bool) -> RecommendedPlaceItem:
    return RecommendedPlaceItem(
        name=f.name_hi if (is_hi and f.name_hi) else f.name,
        category=f.facility_type,
        description=f.notes_hi if (is_hi and f.notes_hi) else f.notes,
        timings=f.timings,
        budget_tier="free",
        entry_fee_inr="Free",
        is_odop=False,
        is_accessible=f.is_accessible,
        lat=f.lat,
        lng=f.lng,
        address=f.address,
        source_slug=f.slug,
    )


def _build_local_itinerary(
    destination: Destination,
    monuments: list[Monument],
    tour_routes: list[TourRoute],
    nearby_places: list[NearbyPlace],
    facilities: list[Facility],
    query: str,
    constraints: dict[str, Any],
    is_hi: bool,
) -> tuple[list[ItineraryStopItem], list[RecommendedPlaceItem], str]:
    max_minutes: int = constraints["max_minutes"]
    step_free_only: bool = constraints["step_free_only"]
    wants_food: bool = constraints["wants_food"]
    wants_crafts: bool = constraints["wants_crafts"]

    monument_by_slug = {m.slug: m for m in monuments}
    ordered_monuments: list[Monument] = []
    sorted_routes = sorted(tour_routes, key=lambda r: (0 if (not step_free_only or r.step_free) else 1, -r.duration_minutes))
    for route in sorted_routes:
        if step_free_only and not route.step_free:
            continue
        for st in route.stops or []:
            m = monument_by_slug.get(st.get("monument_slug", ""))
            if m and m not in ordered_monuments:
                ordered_monuments.append(m)
    for m in monuments:
        if m not in ordered_monuments:
            ordered_monuments.append(m)

    eligible_monuments = [
        m
        for m in ordered_monuments
        if not step_free_only or (m.step_free and m.wheelchair_accessible)
    ]
    if not eligible_monuments:
        eligible_monuments = ordered_monuments[:2]

    extra_places: list[NearbyPlace] = []
    if wants_crafts:
        craft_pool = [p for p in nearby_places if p.category.lower() == "crafts"]
        if not craft_pool:
            craft_pool = [p for p in nearby_places if p.is_odop or p.category.lower() in ("crafts", "market")]
        craft_constraints = {**constraints, "wants_food": False}
        craft_picks = _select_nearby_places(
            craft_pool,
            query,
            craft_constraints,
            {"nearby"},
            limit=1,
        )
        extra_places.extend(craft_picks)
    if wants_food:
        food_constraints = {**constraints, "wants_crafts": False}
        food_picks = _select_nearby_places(
            [p for p in nearby_places if p.category.lower() == "food"],
            query,
            food_constraints,
            {"food"},
            limit=1,
        )
        extra_places.extend(food_picks)

    reserved_extra_min = sum(min(35, p.estimated_time_min) for p in extra_places)
    available_monument_min = max(30, max_minutes - reserved_extra_min)

    chosen_monuments: list[tuple[Monument, int]] = []
    used_mon_min = 0
    for m in eligible_monuments:
        dur = min(m.visit_duration_min, 30 if max_minutes <= 180 else m.visit_duration_min)
        if used_mon_min + dur <= available_monument_min or not chosen_monuments:
            chosen_monuments.append((m, dur))
            used_mon_min += dur
        if len(chosen_monuments) >= 4:
            break

    cursor_min = 9 * 60  # 09:00 AM start
    stops: list[ItineraryStopItem] = []
    for m, dur in chosen_monuments:
        start_str = _format_time_of_day(cursor_min)
        end_str = _format_time_of_day(cursor_min + dur)
        stops.append(
            ItineraryStopItem(
                time_slot=f"{start_str} – {end_str}",
                title=m.name_hi if (is_hi and m.name_hi) else m.name,
                category="monument",
                duration_min=dur,
                notes=m.short_summary_hi if (is_hi and m.short_summary_hi) else m.short_summary,
                accessibility_note=m.accessibility_notes_hi if (is_hi and m.accessibility_notes_hi) else m.accessibility_notes,
                lat=m.lat,
                lng=m.lng,
                source_slug=m.slug,
            )
        )
        cursor_min += dur + 10

    rec_places: list[RecommendedPlaceItem] = []
    for p in extra_places:
        dur = min(35, p.estimated_time_min)
        start_str = _format_time_of_day(cursor_min)
        end_str = _format_time_of_day(cursor_min + dur)
        cat = "craft" if p.category.lower() == "crafts" else ("food" if p.category.lower() == "food" else "market")
        stops.append(
            ItineraryStopItem(
                time_slot=f"{start_str} – {end_str}",
                title=p.name_hi if (is_hi and p.name_hi) else p.name,
                category=cat,  # type: ignore[arg-type]
                duration_min=dur,
                notes=p.description_hi if (is_hi and p.description_hi) else p.description,
                accessibility_note=p.timings,
                lat=p.lat,
                lng=p.lng,
                source_slug=p.slug,
            )
        )
        rec_places.append(_to_recommended_from_nearby(p, is_hi))
        cursor_min += dur + 10

    closure = (destination.metadata_json or {}).get("weekly_closure", "")
    step_label_en = "wheelchair-accessible, step-free" if step_free_only else "curated"
    step_label_hi = "व्हीलचेयर-सुगम व सीढ़ी-रहित" if step_free_only else "चयनित"
    summary = (
        f"आपकी आवश्यकताओं के अनुसार {destination.name_hi or destination.name} के लिए {max_minutes} मिनट की {step_label_hi} यात्रा योजना ({len(stops)} पड़ाव) तैयार है। {closure}".strip()
        if is_hi
        else f"Here is a {step_label_en} {max_minutes}-minute itinerary for {destination.name} with {len(stops)} verified stops. Note: {closure}".strip()
    )
    return stops, rec_places, summary


def _gap_follow_ups(destination_slug: str, is_hi: bool) -> list[str]:
    if destination_slug == "lucknow":
        return (
            [
                "बड़ा इमामबाड़ा किसने बनवाया?",
                "भूलभुलैया क्या है?",
                "लखनऊ का ODOP शिल्प चिकनकारी क्या है?",
            ]
            if is_hi
            else [
                "Who built the Bara Imambara?",
                "What is the Bhool Bhulaiya?",
                "What is Chikankari, Lucknow's ODOP craft?",
            ]
        )
    if destination_slug == "sarnath":
        return (
            [
                "बुद्ध ने सारनाथ में पहला उपदेश कहाँ दिया था?",
                "अशोक का सिंह स्तंभ और सारनाथ संग्रहालय कब खुलता है?",
                "धमेख स्तूप के पास शौचालय और पेयजल कहाँ है?",
            ]
            if is_hi
            else [
                "Where did Gautama Buddha deliver his first sermon?",
                "How did the Sarnath Lion Capital become India's National Emblem?",
                "Tell me the Golden Deer Jataka story of Sarnath",
            ]
        )
    if destination_slug == "agra":
        return (
            ["ताजमहल क्यों बनाया गया?", "काले ताजमहल की कहानी सच है या लोककथा?", "पास का शौचालय कहाँ है?"]
            if is_hi
            else [
                "Why was the Taj Mahal built?",
                "Is the Black Taj Mahal story history or folklore?",
                "What does Pietra Dura stone inlay mean?",
            ]
        )
    return (
        ["इस स्थान का प्रमुख इतिहास बताइए", "यहाँ की प्रसिद्ध लोककथाएँ क्या हैं?", "पास की सुविधाएँ कहाँ हैं?"]
        if is_hi
        else [
            "What is the verified history of this heritage site?",
            "What local folklore or traditions are linked here?",
            "What accessible routes and facilities are nearby?",
        ]
    )


def _build_local_fallback_chat(
    req: ChatRequest,
    destination: Destination,
    chunks: list[KnowledgeChunk],
    best_score: float,
    monument_map: dict[int, Monument],
    intents: set[str] | None = None,
    constraints: dict[str, Any] | None = None,
    monuments: list[Monument] | None = None,
    tour_routes: list[TourRoute] | None = None,
    nearby_places: list[NearbyPlace] | None = None,
    facilities: list[Facility] | None = None,
) -> ChatResponse:
    is_hi = req.language.lower().startswith("hi")
    active_intents = intents or set()
    active_constraints = constraints or _extract_plan_constraints(req.question, req.persona, req.simple_language)
    all_monuments = monuments if monuments is not None else list(monument_map.values())
    all_routes = tour_routes or []
    all_nearby = nearby_places or []
    all_facilities = facilities or []

    verified: list[HistoryFactItem] = []
    folklore: list[FolkloreItem] = []
    matched_slug: str | None = req.monument_slug
    if best_score >= GAP_THRESHOLD:
        for chunk in chunks:
            if matched_slug is None and chunk.monument_id in monument_map:
                matched_slug = monument_map[chunk.monument_id].slug
            text = chunk.content_hi if (is_hi and chunk.content_hi) else chunk.content
            if req.simple_language or req.persona in ("kids", "quick"):
                sentences = [s.strip() for s in re.split(r"(?<=[.।])\s+", text) if s.strip()]
                text = " ".join(sentences[:2]) if sentences else text
            if chunk.content_type == "RECORDED_HISTORY":
                verified.append(HistoryFactItem(text=text, source=chunk.source_name))
            else:
                folklore.append(FolkloreItem(text=text, attribution=chunk.source_name))

    if "itinerary" in active_intents and (all_monuments or all_nearby):
        stops, rec_places, plan_summary = _build_local_itinerary(
            destination=destination,
            monuments=all_monuments,
            tour_routes=all_routes,
            nearby_places=all_nearby,
            facilities=all_facilities,
            query=req.question,
            constraints=active_constraints,
            is_hi=is_hi,
        )
        follow_ups = _gap_follow_ups(destination.slug, is_hi)
        return ChatResponse(
            answer_summary=plan_summary,
            verified_history=verified[:2],
            folklore_legends=folklore[:1],
            itinerary_stops=stops,
            recommended_places=rec_places,
            follow_up_suggestions=follow_ups,
            is_knowledge_gap=False,
            matched_monument_slug=matched_slug or (stops[0].source_slug if stops and stops[0].category == "monument" else None),
            language=req.language,
            persona=req.persona,
            simple_language=req.simple_language,
            mode="local_fallback",
        )

    if active_intents & {"food", "nearby", "facility"}:
        rec_places: list[RecommendedPlaceItem] = []
        seen_slugs: set[str] = set()
        if active_intents & {"food", "nearby"}:
            for p in _select_nearby_places(all_nearby, req.question, active_constraints, active_intents, limit=4):
                if p.slug not in seen_slugs:
                    seen_slugs.add(p.slug)
                    rec_places.append(_to_recommended_from_nearby(p, is_hi))
        if "facility" in active_intents or ("food" in active_intents and len(rec_places) < 4):
            fac_query = req.question if "facility" in active_intents else f"{req.question} food"
            for f in _select_facilities(all_facilities, fac_query, active_constraints["step_free_only"], limit=4 - len(rec_places)):
                if f.slug not in seen_slugs:
                    seen_slugs.add(f.slug)
                    rec_places.append(_to_recommended_from_facility(f, is_hi))

        if rec_places:
            names = ", ".join(p.name for p in rec_places[:3])
            summary = (
                f"{destination.name_hi or destination.name} में आपकी पसंद के अनुसार सत्यापित स्थान: {names}।"
                if is_hi
                else f"Here are verified spots in {destination.name} matching your request: {names}."
            )
            return ChatResponse(
                answer_summary=summary,
                verified_history=verified,
                folklore_legends=folklore,
                itinerary_stops=[],
                recommended_places=rec_places,
                follow_up_suggestions=_gap_follow_ups(destination.slug, is_hi),
                is_knowledge_gap=False,
                matched_monument_slug=matched_slug,
                language=req.language,
                persona=req.persona,
                simple_language=req.simple_language,
                mode="local_fallback",
            )

    is_gap = len(chunks) == 0 or best_score < GAP_THRESHOLD

    if is_gap:
        gap_msg = (
            "क्षमा करें, इस विषय पर हमारे सत्यापित ऐतिहासिक डेटाबेस में पर्याप्त जानकारी उपलब्ध नहीं है। "
            "आपकी जिज्ञासा पर्यटन विभाग की सामग्री टीम के लिए दर्ज कर ली गई है।"
            if is_hi
            else (
                "I do not have verified information on that topic in my curated destination knowledge base yet. "
                "I have flagged this question for the Tourism Department so official details can be added."
            )
        )
        follow_ups = _gap_follow_ups(destination.slug, is_hi)
        return ChatResponse(
            answer_summary=gap_msg,
            verified_history=[],
            folklore_legends=[],
            follow_up_suggestions=follow_ups,
            is_knowledge_gap=True,
            matched_monument_slug=req.monument_slug,
            language=req.language,
            persona=req.persona,
            simple_language=req.simple_language,
            mode="local_fallback",
        )

    # Recorded history wins ties in ranking; a folklore headline is always labelled as tradition.
    lead_chunk = chunks[0]
    lead_text = lead_chunk.content_hi if (is_hi and lead_chunk.content_hi) else lead_chunk.content
    lead_sentences = [s.strip() for s in re.split(r"(?<=[.।])\s+", lead_text) if s.strip()]
    # One-sentence headline; the full sourced text follows in the evidence lists
    summary = lead_sentences[0] if lead_sentences else lead_text
    if lead_chunk.content_type != "RECORDED_HISTORY":
        summary = (
            f"स्थानीय परंपरा के अनुसार (यह दर्ज इतिहास नहीं है): {summary}"
            if is_hi
            else f"According to local tradition (this is not recorded history): {summary}"
        )

    if req.persona == "kids" and not is_hi:
        summary = f"Here is the story! {summary}"
    elif req.persona == "pilgrim" and not is_hi:
        summary = f"Cultural & heritage context: {summary}"

    follow_ups = (
        ["इस स्थान की स्थापत्य कला के बारे में और जानें", "यहाँ से जुड़ी लोककथाएँ सुनें"]
        if is_hi
        else [
            "Tell me about the architecture and carvings here",
            "Are there any local legends about this monument?",
            "What accessible routes or facilities are nearby?",
        ]
    )

    return ChatResponse(
        answer_summary=summary,
        verified_history=verified,
        folklore_legends=folklore,
        follow_up_suggestions=follow_ups,
        is_knowledge_gap=False,
        matched_monument_slug=matched_slug,
        language=req.language,
        persona=req.persona,
        simple_language=req.simple_language,
        mode="local_fallback",
    )


def generate_chat_response(
    db: Session,
    destination: Destination,
    req: ChatRequest,
    monument: Monument | None = None,
) -> ChatResponse:
    """Answer a visitor question using grounded multi-table RAG with Fact vs Folklore separation."""
    monuments = db.query(Monument).filter(Monument.destination_id == destination.id).all()
    monument_map = {m.id: m for m in monuments}
    tour_routes = db.query(TourRoute).filter(TourRoute.destination_id == destination.id).all()
    nearby_places = db.query(NearbyPlace).filter(NearbyPlace.destination_id == destination.id).all()
    facilities = db.query(Facility).filter(Facility.destination_id == destination.id).all()

    intents = _detect_chat_intents(req.question)
    constraints = _extract_plan_constraints(req.question, req.persona, req.simple_language)

    chunks, best_score = retrieve_chunks(
        db=db,
        destination_id=destination.id,
        query=req.question,
        monument_id=monument.id if monument else None,
        top_k=5,
    )

    has_catalog_match = bool(intents and (monuments or nearby_places or facilities))
    if (not has_catalog_match and (not chunks or best_score < GAP_THRESHOLD)) or not settings.has_gemini_key:
        return _build_local_fallback_chat(
            req,
            destination,
            chunks,
            best_score,
            monument_map,
            intents=intents,
            constraints=constraints,
            monuments=monuments,
            tour_routes=tour_routes,
            nearby_places=nearby_places,
            facilities=facilities,
        )

    client = _get_genai_client()
    if client is None:
        return _build_local_fallback_chat(
            req,
            destination,
            chunks,
            best_score,
            monument_map,
            intents=intents,
            constraints=constraints,
            monuments=monuments,
            tour_routes=tour_routes,
            nearby_places=nearby_places,
            facilities=facilities,
        )

    simple_rule = (
        "Use very simple, short everyday words suitable for low-literacy or screen-reader users. "
        if req.simple_language
        else ""
    )
    context_block = _format_context_block(chunks, monument_map)
    catalog_section = ""
    extra_rules = ""
    if intents:
        catalog_block = _format_structured_catalog(
            destination=destination,
            monuments=monuments,
            tour_routes=tour_routes,
            nearby_places=nearby_places,
            facilities=facilities,
        )
        catalog_section = f"\n\nVERIFIED DESTINATION CATALOG (Monuments, Tour Routes, Nearby & Food, Facilities):\n{catalog_block}"
        extra_rules = (
            "7. For street food, crafts/ODOP, nearby places, or facility questions, populate `recommended_places` ONLY from "
            "NEARBY_PLACES_AND_FOOD or FACILITIES in the catalog below, copying the exact `source_slug`. Never invent restaurants, "
            "addresses, timings, or fees.\n"
            "8. For itinerary or travel plan requests, populate `itinerary_stops` as an ordered schedule strictly from MONUMENTS, "
            "NEARBY_PLACES_AND_FOOD, and FACILITIES using exact `source_slug`s. Respect the visitor's time budget "
            f"(~{constraints['max_minutes']} min), wheelchair/step-free constraints (step_free_only={constraints['step_free_only']}), "
            f"budget={constraints['budget'] or 'any'}, group={constraints['group'] or 'any'}, and mention weekly closure rules.\n"
            "9. For ordinary heritage history/folklore questions, leave `itinerary_stops` and `recommended_places` empty.\n"
        )

    system_instruction = (
        f"You are an expert, respectful AI Tourism Companion for {destination.name}, Uttar Pradesh.\n"
        f"Respond strictly in language code '{req.language}'.\n"
        f"Style guidance: {_PERSONA_INSTRUCTIONS[req.persona]} {simple_rule}\n"
        "STRICT RULES:\n"
        "1. Answer ONLY using facts from the PROVIDED CONTEXT and VERIFIED DESTINATION CATALOG below. Never invent dates, builders, fees, or facts.\n"
        "2. Separate RECORDED_HISTORY items into `verified_history` (citing their `source`) and "
        "FOLKLORE_TRADITION items into `folklore_legends` (citing their `attribution`).\n"
        "3. Respect religious and cultural sentiments attached to every site.\n"
        "4. `answer_summary` must be built from RECORDED_HISTORY or verified catalog entries. Never state folklore as fact; if you "
        "mention a legend in the summary, explicitly introduce it as a legend or local tradition. If only "
        "folklore is available, begin the summary by saying so.\n"
        "5. If neither the context nor the catalog answers the question, set `is_knowledge_gap=true` and clearly state that "
        "verified info is unavailable.\n"
        "6. Provide 2-3 helpful short `follow_up_suggestions` in the user's language.\n"
        f"{extra_rules}\n"
        f"PROVIDED CONTEXT:\n{context_block}{catalog_section}"
    )

    history_snippet = "\n".join(
        f"{m.role.upper()}: {m.content}" for m in req.conversation_history[-4:]
    )
    prompt = f"{history_snippet}\nVISITOR QUESTION: {req.question}".strip()

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_CHAT_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=_GeminiChatPayload,
                    temperature=0.2,
                ),
            )
            parsed = _GeminiChatPayload.model_validate_json(response.text)
            clean_stops, clean_places = _hydrate_structured_items(
                parsed.itinerary_stops,
                parsed.recommended_places,
                monuments,
                nearby_places,
                facilities,
            )

            is_hi = req.language.lower().startswith("hi")
            if "itinerary" in intents and not parsed.is_knowledge_gap and not clean_stops:
                clean_stops, fallback_recs, _ = _build_local_itinerary(
                    destination, monuments, tour_routes, nearby_places, facilities, req.question, constraints, is_hi
                )
                if not clean_places:
                    clean_places = fallback_recs
            elif (intents & {"food", "nearby", "facility"}) and "itinerary" not in intents and not parsed.is_knowledge_gap and not clean_places:
                if intents & {"food", "nearby"}:
                    clean_places = [
                        _to_recommended_from_nearby(p, is_hi)
                        for p in _select_nearby_places(nearby_places, req.question, constraints, intents, limit=4)
                    ]
                if "facility" in intents and len(clean_places) < 4:
                    clean_places.extend(
                        _to_recommended_from_facility(f, is_hi)
                        for f in _select_facilities(facilities, req.question, constraints["step_free_only"], limit=4 - len(clean_places))
                    )

            return ChatResponse(
                answer_summary=parsed.answer_summary,
                verified_history=parsed.verified_history,
                folklore_legends=parsed.folklore_legends,
                itinerary_stops=clean_stops,
                recommended_places=clean_places,
                follow_up_suggestions=parsed.follow_up_suggestions[:3],
                is_knowledge_gap=parsed.is_knowledge_gap,
                matched_monument_slug=parsed.matched_monument_slug or req.monument_slug,
                language=req.language,
                persona=req.persona,
                simple_language=req.simple_language,
                mode="gemini",
            )
        except Exception as exc:
            last_exc = exc
            err_msg = str(exc)
            if attempt < 2 and any(tok in err_msg for tok in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED")):
                time.sleep(1.5 * (attempt + 1))
                continue
            break

    logger.warning("Gemini chat call failed; falling back: %s", last_exc)
    return _build_local_fallback_chat(
        req,
        destination,
        chunks,
        best_score,
        monument_map,
        intents=intents,
        constraints=constraints,
        monuments=monuments,
        tour_routes=tour_routes,
        nearby_places=nearby_places,
        facilities=facilities,
    )


def _prepare_jpeg_bytes(image_bytes: bytes) -> bytes:
    """Validate and resize uploaded camera images for low-bandwidth Vision inference."""
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            rgb = img.convert("RGB")
            rgb.thumbnail((1024, 1024))
            out = BytesIO()
            rgb.save(out, format="JPEG", quality=82, optimize=True)
            return out.getvalue()
    except UnidentifiedImageError as exc:
        raise ValueError("Uploaded file is not a valid image.") from exc


def identify_vision(
    db: Session,
    destination: Destination,
    image_bytes: bytes,
    question: str = "",
    language: str = "en",
    persona: PersonaType = "quick",
    simple_language: bool = False,
    lat: float | None = None,
    lng: float | None = None,
) -> VisionResponse:
    """Identify a monument/carving from a photo using GPS hints + Gemini Vision (with offline fallback)."""
    jpeg_bytes = _prepare_jpeg_bytes(image_bytes)
    monuments = db.query(Monument).filter(Monument.destination_id == destination.id).all()
    if lat is not None and lng is not None:
        monuments.sort(key=lambda m: haversine_meters(lat, lng, m.lat, m.lng))

    candidate_names = [m.name for m in monuments[:3]]
    nearest = monuments[0] if monuments else None
    monument_map = {m.id: m for m in monuments}

    # Gather ground-truth chunks; keep full destination context when compact or narrow via GPS when large
    all_dest_chunks = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.destination_id == destination.id)
        .all()
    )
    if lat is not None and lng is not None and len(all_dest_chunks) > 25:
        near_ids = {m.id for m in monuments[:5]}
        candidate_chunks = [
            c for c in all_dest_chunks if c.monument_id is None or c.monument_id in near_ids
        ][:25]
    else:
        candidate_chunks = all_dest_chunks[:25]

    if settings.has_gemini_key:
        client = _get_genai_client()
        if client is not None:
            monuments_prompt = "\n".join(
                f"- slug={m.slug} | name={m.name} | visual_cues={', '.join(m.visual_cues)}"
                for m in monuments
            )
            context_block = _format_context_block(candidate_chunks, monument_map)
            simple_rule = (
                "Use short simple sentences suitable for accessibility mode. "
                if simple_language
                else ""
            )
            prompt = (
                f"Identify the heritage building, gateway, carving, or inscription shown in the photo "
                f"for {destination.name}.\n"
                f"Visitor language: '{language}'. Style: {_PERSONA_INSTRUCTIONS[persona]} {simple_rule}\n"
                f"Visitor GPS hint: lat={lat}, lng={lng}\n"
                f"Visitor extra question: {question or 'Explain what this is and its architectural features.'}\n\n"
                "STRICT GROUNDING RULES:\n"
                "1. Pick the matching `matched_monument_slug` from CANDIDATE MONUMENTS if visible.\n"
                "2. Ground `verified_history` and `folklore_legends` strictly in the VERIFIED KNOWLEDGE CONTEXT "
                "for the identified monument, keeping recorded history separate from folklore.\n\n"
                f"CANDIDATE MONUMENTS (nearest first):\n{monuments_prompt}\n\n"
                f"VERIFIED KNOWLEDGE CONTEXT (keep history separate from folklore):\n{context_block}"
            )
            try:
                response = client.models.generate_content(
                    model=settings.GEMINI_CHAT_MODEL,
                    contents=[
                        types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
                        prompt,
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=_GeminiVisionPayload,
                        temperature=0.2,
                    ),
                )
                parsed = _GeminiVisionPayload.model_validate_json(response.text)
                monument_by_slug = {m.slug: m for m in monuments}
                ordered_candidates = list(candidate_names)
                if parsed.matched_monument_slug in monument_by_slug:
                    matched_name = monument_by_slug[parsed.matched_monument_slug].name
                    ordered_candidates = [
                        matched_name,
                        *[n for n in ordered_candidates if n != matched_name],
                    ][:3]
                return VisionResponse(
                    identified_name=parsed.identified_name,
                    confidence=parsed.confidence,
                    architectural_features=parsed.architectural_features,
                    answer_summary=parsed.answer_summary,
                    verified_history=parsed.verified_history,
                    folklore_legends=parsed.folklore_legends,
                    matched_monument_slug=parsed.matched_monument_slug,
                    candidate_monuments=ordered_candidates,
                    is_knowledge_gap=parsed.is_knowledge_gap,
                    language=language,
                    persona=persona,
                    mode="gemini",
                )
            except Exception as exc:
                logger.warning("Gemini vision call failed; falling back: %s", exc)

    # Deterministic GPS-assisted fallback when GEMINI_API_KEY is not configured
    is_hi = language.lower().startswith("hi")
    verified: list[HistoryFactItem] = []
    folklore: list[FolkloreItem] = []
    if nearest is not None:
        nearest_chunks = [c for c in candidate_chunks if c.monument_id == nearest.id][:3]
        for chunk in nearest_chunks:
            text = chunk.content_hi if (is_hi and chunk.content_hi) else chunk.content
            if chunk.content_type == "RECORDED_HISTORY":
                verified.append(HistoryFactItem(text=text, source=chunk.source_name))
            else:
                folklore.append(FolkloreItem(text=text, attribution=chunk.source_name))

        summary = (
            f"जीपीएस स्थान के आधार पर निकटतम संभावित स्मारक '{nearest.name_hi or nearest.name}' है। "
            "लाइव कैमरा छवि पहचान के लिए GEMINI_API_KEY कॉन्फ़िगर करें।"
            if is_hi
            else (
                f"Image received ({len(jpeg_bytes)} bytes compressed). Based on GPS proximity, the nearest "
                f"matching landmark is {nearest.name}. Configure GEMINI_API_KEY to enable live AI visual recognition."
            )
        )
        return VisionResponse(
            identified_name=nearest.name_hi if (is_hi and nearest.name_hi) else nearest.name,
            confidence="medium" if (lat is not None and lng is not None) else "low",
            architectural_features=list(nearest.visual_cues[:4]),
            answer_summary=summary,
            verified_history=verified,
            folklore_legends=folklore,
            matched_monument_slug=nearest.slug,
            candidate_monuments=candidate_names,
            is_knowledge_gap=False,
            language=language,
            persona=persona,
            mode="local_fallback",
        )

    return VisionResponse(
        identified_name="Unidentified Monument",
        confidence="low",
        architectural_features=[],
        answer_summary="No monuments found for this destination.",
        verified_history=[],
        folklore_legends=[],
        matched_monument_slug=None,
        candidate_monuments=[],
        is_knowledge_gap=True,
        language=language,
        persona=persona,
        mode="local_fallback",
    )

