from io import BytesIO
import logging
import math
import re
from typing import Literal
from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Destination, KnowledgeChunk, Monument
from app.schemas.api import (
    ChatRequest,
    ChatResponse,
    FolkloreItem,
    HistoryFactItem,
    PersonaType,
    VisionResponse,
)
from app.services.geo import haversine_meters

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 768
GAP_THRESHOLD = 0.25

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "did", "do", "does",
    "for", "from", "had", "has", "have", "here", "how", "i", "in", "is", "it",
    "its", "me", "my", "of", "on", "or", "tell", "that", "the", "their", "them",
    "there", "these", "this", "to", "was", "were", "what", "when", "where",
    "which", "who", "why", "will", "with", "you", "your", "about", "explain",
    "please", "give", "more", "know", "ka", "ke", "ki", "ko", "kya", "kaise",
    "kyon", "hai", "hain", "था", "थी", "थे", "है", "हैं", "क्या", "क्यों",
    "कैसे", "के", "की", "को", "में", "से", "और", "का", "पर", "यह", "वह",
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


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[^\W_]+", text.lower(), flags=re.UNICODE)
    return [t for t in tokens if len(t) >= 2 and t not in _STOPWORDS]


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


def _keyword_rank_chunks(
    chunks: list[KnowledgeChunk],
    query: str,
    monument_id: int | None = None,
    top_k: int = 5,
) -> tuple[list[KnowledgeChunk], float]:
    query_tokens = _tokenize(query)
    if not query_tokens or not chunks:
        return [], 0.0

    scored: list[tuple[float, KnowledgeChunk]] = []
    q_lower = query.lower()

    for chunk in chunks:
        title_text = f"{chunk.title} {chunk.title_hi}".lower()
        tags_text = " ".join(chunk.tags or []).lower()
        body_text = f"{chunk.content} {chunk.content_hi}".lower()

        title_tokens = set(_tokenize(title_text))
        tag_tokens = set(_tokenize(tags_text))
        body_tokens = set(_tokenize(body_text))
        all_chunk_tokens = title_tokens | tag_tokens | body_tokens

        hits = 0.0
        for tok in query_tokens:
            if tok in title_tokens or tok in tag_tokens:
                hits += 1.4
            elif tok in body_tokens:
                hits += 1.0
            elif any(tok in ct or ct in tok for ct in all_chunk_tokens if len(ct) >= 4):
                hits += 0.75

        if hits == 0.0:
            continue

        # Normalize relative to query length so short focused queries still score cleanly
        score = min(1.0, hits / max(2.0, len(query_tokens) * 0.9))

        # Slight boost when visitor is standing at / querying a specific monument
        if monument_id is not None and chunk.monument_id == monument_id:
            score = min(1.0, score + 0.12)

        # Phrase match boost for multi-word tags
        for tag in chunk.tags or []:
            if " " in tag and tag.lower() in q_lower:
                score = min(1.0, score + 0.2)

        scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored:
        return [], 0.0
    top_chunks = [c for _, c in scored[:top_k]]
    return top_chunks, round(scored[0][0], 4)


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

    return _keyword_rank_chunks(all_chunks, query, monument_id=monument_id, top_k=top_k)


def _format_context_block(chunks: list[KnowledgeChunk], monument_map: dict[int, Monument]) -> str:
    lines: list[str] = []
    for chunk in chunks:
        m_slug = monument_map[chunk.monument_id].slug if chunk.monument_id in monument_map else "general"
        lines.append(
            f"- [{chunk.content_type}] (monument={m_slug}, source={chunk.source_name}) "
            f"{chunk.title}: {chunk.content}"
        )
    return "\n".join(lines)


def _gap_follow_ups(destination_slug: str, is_hi: bool) -> list[str]:
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
) -> ChatResponse:
    is_hi = req.language.lower().startswith("hi")
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

    verified: list[HistoryFactItem] = []
    folklore: list[FolkloreItem] = []
    matched_slug: str | None = req.monument_slug

    for chunk in chunks:
        if matched_slug is None and chunk.monument_id in monument_map:
            matched_slug = monument_map[chunk.monument_id].slug
        text = chunk.content_hi if (is_hi and chunk.content_hi) else chunk.content
        if req.simple_language or req.persona in ("kids", "quick"):
            # Keep local fallback concise for quick/kids/accessibility modes
            sentences = [s.strip() for s in re.split(r"(?<=[.।])\s+", text) if s.strip()]
            text = " ".join(sentences[:2]) if sentences else text

        if chunk.content_type == "RECORDED_HISTORY":
            verified.append(HistoryFactItem(text=text, source=chunk.source_name))
        else:
            folklore.append(FolkloreItem(text=text, attribution=chunk.source_name))

    lead_chunk = chunks[0]
    lead_text = lead_chunk.content_hi if (is_hi and lead_chunk.content_hi) else lead_chunk.content
    lead_sentences = [s.strip() for s in re.split(r"(?<=[.।])\s+", lead_text) if s.strip()]
    summary = " ".join(lead_sentences[:2]) if lead_sentences else lead_text

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
    """Answer a visitor question using grounded RAG with strict Fact vs Folklore separation."""
    monuments = db.query(Monument).filter(Monument.destination_id == destination.id).all()
    monument_map = {m.id: m for m in monuments}

    chunks, best_score = retrieve_chunks(
        db=db,
        destination_id=destination.id,
        query=req.question,
        monument_id=monument.id if monument else None,
        top_k=5,
    )

    if not chunks or best_score < GAP_THRESHOLD or not settings.has_gemini_key:
        return _build_local_fallback_chat(req, destination, chunks, best_score, monument_map)

    client = _get_genai_client()
    if client is None:
        return _build_local_fallback_chat(req, destination, chunks, best_score, monument_map)

    simple_rule = (
        "Use very simple, short everyday words suitable for low-literacy or screen-reader users. "
        if req.simple_language
        else ""
    )
    context_block = _format_context_block(chunks, monument_map)
    system_instruction = (
        f"You are an expert, respectful AI Tourism Companion for {destination.name}, Uttar Pradesh.\n"
        f"Respond strictly in language code '{req.language}'.\n"
        f"Style guidance: {_PERSONA_INSTRUCTIONS[req.persona]} {simple_rule}\n"
        "STRICT RULES:\n"
        "1. Answer ONLY using facts from the PROVIDED CONTEXT below. Never invent dates, builders, fees, or facts.\n"
        "2. Separate RECORDED_HISTORY items into `verified_history` (citing their `source`) and "
        "FOLKLORE_TRADITION items into `folklore_legends` (citing their `attribution`).\n"
        "3. Respect religious and cultural sentiments attached to every site.\n"
        "4. If the context does not answer the question, set `is_knowledge_gap=true` and clearly state that "
        "verified info is unavailable.\n"
        "5. Provide 2-3 helpful short `follow_up_suggestions` in the user's language.\n\n"
        f"PROVIDED CONTEXT:\n{context_block}"
    )

    history_snippet = "\n".join(
        f"{m.role.upper()}: {m.content}" for m in req.conversation_history[-4:]
    )
    prompt = f"{history_snippet}\nVISITOR QUESTION: {req.question}".strip()

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
        return ChatResponse(
            answer_summary=parsed.answer_summary,
            verified_history=parsed.verified_history,
            folklore_legends=parsed.folklore_legends,
            follow_up_suggestions=parsed.follow_up_suggestions[:3],
            is_knowledge_gap=parsed.is_knowledge_gap,
            matched_monument_slug=parsed.matched_monument_slug or req.monument_slug,
            language=req.language,
            persona=req.persona,
            simple_language=req.simple_language,
            mode="gemini",
        )
    except Exception as exc:
        logger.warning("Gemini chat call failed; falling back: %s", exc)
        return _build_local_fallback_chat(req, destination, chunks, best_score, monument_map)


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

