import logging
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

_LANG_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "bn": "Bengali",
    "mr": "Marathi",
    "te": "Telugu",
    "ur": "Urdu",
    "fr": "French",
    "ja": "Japanese",
    "es": "Spanish",
    "kn": "Kannada",
    "ml": "Malayalam",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "or": "Odia",
}

_translation_cache: dict[tuple[str, str], str] = {}


class _TranslationBatch(BaseModel):
    translations: list[str] = Field(default_factory=list)


def clear_translation_cache() -> None:
    """Clear in-memory translation cache (used in automated tests)."""
    _translation_cache.clear()


def _base_lang(code: str) -> str:
    clean = (code or "en").strip().lower()
    if clean in ("auto", "unknown", ""):
        return "en"
    iso = clean.split("-", 1)[0]
    return "or" if iso == "od" else iso


def translate_texts(texts: list[str], target_language: str) -> tuple[list[str], bool]:
    """Batch-translate a list of UI/content strings into target_language with caching."""
    iso = _base_lang(target_language)
    if iso == "en" or not texts or all(not t.strip() for t in texts):
        return texts, False

    results = list(texts)
    missing_indices: list[int] = []
    missing_texts: list[str] = []

    for idx, text in enumerate(texts):
        clean = text.strip()
        if not clean:
            continue
        cached = _translation_cache.get((iso, text))
        if cached is not None:
            results[idx] = cached
        else:
            missing_indices.append(idx)
            missing_texts.append(text)

    if not missing_indices:
        return results, True

    if not settings.has_gemini_key:
        return results, False

    lang_name = _LANG_NAMES.get(iso, iso)
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
        numbered = "\n".join(f"[{i}] {t}" for i, t in enumerate(missing_texts))
        prompt = (
            f"Translate each numbered string strictly into {lang_name} (ISO code '{iso}') "
            "for an Uttar Pradesh Heritage Tourism app.\n"
            "Rules:\n"
            f"1. Use ONLY natural {lang_name} grammar and vocabulary (never substitute Hindi when translating into Marathi or another language).\n"
            f"2. Write ALL words—including monument names like Taj Mahal—cleanly in the native script of {lang_name} so Text-to-Speech pronounces every word properly.\n"
            "3. Return `translations` as a JSON array with the EXACT SAME length and order as the input items.\n\n"
            f"INPUT STRINGS ({len(missing_texts)} items):\n{numbered}"
        )
        response = client.models.generate_content(
            model=settings.GEMINI_CHAT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_TranslationBatch,
                temperature=0.1,
            ),
        )
        parsed = _TranslationBatch.model_validate_json(response.text)
        if len(parsed.translations) != len(missing_texts):
            logger.warning(
                "Translation length mismatch: expected %d, got %d",
                len(missing_texts),
                len(parsed.translations),
            )
            return results, False

        for idx, orig, translated in zip(missing_indices, missing_texts, parsed.translations):
            final_str = translated.strip() or orig
            _translation_cache[(iso, orig)] = final_str
            results[idx] = final_str
        return results, True
    except Exception as exc:
        logger.warning("Gemini batch translation failed (%s): %s", iso, exc)
        return results, False


def translate_text(text: str, target_language: str) -> str:
    """Translate a single string into target_language, returning original on failure."""
    if not text.strip():
        return text
    translated_list, _ = translate_texts([text], target_language)
    return translated_list[0] if translated_list else text

