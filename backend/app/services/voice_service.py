import base64
import logging
from typing import Literal
import httpx

from app.core.config import settings
from app.schemas.api import (
    VoiceProviderChoice,
    VoiceSTTResponse,
    VoiceStatusResponse,
    VoiceTTSRequest,
    VoiceTTSResponse,
)
from app.services.translate_service import translate_text

logger = logging.getLogger(__name__)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
BHASHINI_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"

SUPPORTED_INDIAN_LANGUAGES = [
    "hi", "en", "bn", "ta", "te", "kn", "ml", "mr", "gu", "pa", "or", "ur",
]

_SARVAM_BCP47_MAP: dict[str, str] = {
    "en": "en-IN",
    "hi": "hi-IN",
    "bn": "bn-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "or": "od-IN",
}

_bhashini_config_cache: dict[tuple[str, str, str], tuple[str, str, str]] = {}


def clear_bhashini_cache() -> None:
    """Reset cached Bhashini pipeline configs (used by automated tests)."""
    _bhashini_config_cache.clear()


def _normalize_language(language: str) -> tuple[str, str | None]:
    """Return (iso_2_letter, sarvam_bcp47_or_unknown)."""
    clean = (language or "hi").strip().lower()
    if clean in ("", "auto", "unknown"):
        return "auto", "unknown"
    iso = clean.split("-", 1)[0]
    if iso == "od":
        iso = "or"
    return iso, _SARVAM_BCP47_MAP.get(iso)


def _infer_audio_format(filename: str | None, content_type: str | None) -> str:
    name = (filename or "").lower()
    ctype = (content_type or "").lower()
    for ext in ("wav", "mp3", "webm", "ogg", "flac", "m4a"):
        if name.endswith(f".{ext}") or ext in ctype:
            return ext
    return "wav"


def _resolve_providers(requested: VoiceProviderChoice, iso_lang: str) -> list[str]:
    """Order configured voice providers based on request override, config, and language."""
    mode = requested if requested != "auto" else settings.VOICE_PROVIDER.strip().lower()
    configured = {
        "sarvam": settings.has_sarvam_key,
        "bhashini": settings.has_bhashini_keys,
    }
    if mode == "sarvam":
        candidates = ["sarvam"]
    elif mode == "bhashini":
        candidates = ["bhashini"]
    elif iso_lang == "ur":
        # Bhashini supports Urdu ASR/TTS while Sarvam Bulbul focuses on 11 Indic languages + en-IN
        candidates = ["bhashini", "sarvam"]
    else:
        candidates = ["sarvam", "bhashini"]
    return [p for p in candidates if configured.get(p)]


def get_voice_status() -> VoiceStatusResponse:
    """Return configured voice provider capabilities without exposing secrets."""
    return VoiceStatusResponse(
        voice_provider_mode=settings.VOICE_PROVIDER,
        sarvam_configured=settings.has_sarvam_key,
        bhashini_configured=settings.has_bhashini_keys,
        sarvam_stt_model=settings.SARVAM_STT_MODEL,
        sarvam_tts_model=settings.SARVAM_TTS_MODEL,
        supported_indian_languages=SUPPORTED_INDIAN_LANGUAGES,
    )


def _sarvam_stt(
    audio_bytes: bytes,
    filename: str,
    content_type: str,
    language: str,
) -> VoiceSTTResponse:
    iso_lang, bcp47 = _normalize_language(language)
    sarvam_lang = bcp47 or "unknown"
    clean_ctype = (content_type or "audio/wav").split(";", 1)[0].strip().lower() or "audio/wav"
    headers = {"api-subscription-key": settings.SARVAM_API_KEY.strip()}
    files = {"file": (filename or "recording.wav", audio_bytes, clean_ctype)}
    data = {"model": settings.SARVAM_STT_MODEL, "language_code": sarvam_lang}

    with httpx.Client(timeout=25.0) as client:
        resp = client.post(SARVAM_STT_URL, headers=headers, files=files, data=data)
        resp.raise_for_status()
        payload = resp.json()

    transcript = (payload.get("transcript") or "").strip()
    detected = payload.get("language_code") or (sarvam_lang if sarvam_lang != "unknown" else iso_lang)
    return VoiceSTTResponse(
        transcript=transcript,
        detected_language=str(detected),
        provider="sarvam",
        fallback_to_device=False,
        message="Transcribed via Sarvam AI.",
    )


def _sarvam_tts(req: VoiceTTSRequest) -> VoiceTTSResponse:
    _, bcp47 = _normalize_language(req.language)
    if not bcp47 or bcp47 == "unknown":
        raise ValueError(f"Language '{req.language}' is not supported by Sarvam AI TTS.")

    headers = {
        "api-subscription-key": settings.SARVAM_API_KEY.strip(),
        "Content-Type": "application/json",
    }
    body = {
        "text": req.text,
        "target_language_code": bcp47,
        "model": settings.SARVAM_TTS_MODEL,
        "speaker": req.speaker or settings.SARVAM_TTS_SPEAKER,
        "pace": req.pace,
        "speech_sample_rate": 22050,
        "output_audio_codec": req.output_format,
    }
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(SARVAM_TTS_URL, headers=headers, json=body)
        resp.raise_for_status()
        payload = resp.json()

    audios = payload.get("audios") or []
    if not audios:
        raise ValueError("Sarvam AI returned no audio output.")
    mime = "audio/mpeg" if req.output_format == "mp3" else "audio/wav"
    return VoiceTTSResponse(
        audio_base64=audios[0],
        content_type=mime,
        language=bcp47,
        provider="sarvam",
        fallback_to_device=False,
        message="Synthesized via Sarvam AI.",
    )


def _get_bhashini_pipeline(
    task_type: Literal["asr", "tts"],
    iso_lang: str,
    gender: str = "female",
) -> tuple[str, str, str]:
    cache_key = (task_type, iso_lang, gender if task_type == "tts" else "")
    if cache_key in _bhashini_config_cache:
        return _bhashini_config_cache[cache_key]

    headers = {
        "userID": settings.BHASHINI_USER_ID.strip(),
        "ulcaApiKey": settings.BHASHINI_ULCA_API_KEY.strip(),
        "Content-Type": "application/json",
    }
    payload = {
        "pipelineTasks": [{"taskType": task_type}],
        "pipelineRequestConfig": {"pipelineId": settings.BHASHINI_PIPELINE_ID.strip()},
    }
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(BHASHINI_CONFIG_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    endpoint = data["pipelineInferenceAPIEndPoint"]
    callback_url = endpoint["callbackUrl"]
    auth_token = endpoint["inferenceApiKey"]["value"]

    service_id: str | None = None
    fallback_service_id: str | None = None
    for task_cfg in data.get("pipelineResponseConfig", []):
        if task_cfg.get("taskType") != task_type:
            continue
        for conf in task_cfg.get("config", []):
            src_lang = conf.get("language", {}).get("sourceLanguage")
            if src_lang != iso_lang:
                continue
            if fallback_service_id is None:
                fallback_service_id = conf.get("serviceId")
            if task_type == "asr" or conf.get("gender", "").lower() == gender.lower():
                service_id = conf.get("serviceId")
                break

    chosen = service_id or fallback_service_id
    if not chosen:
        raise ValueError(f"Bhashini pipeline has no {task_type} serviceId for language '{iso_lang}'.")

    result = (callback_url, auth_token, chosen)
    _bhashini_config_cache[cache_key] = result
    return result


def _bhashini_headers(auth_token: str) -> dict[str, str]:
    return {
        "userID": settings.BHASHINI_USER_ID.strip(),
        "ulcaApiKey": settings.BHASHINI_ULCA_API_KEY.strip(),
        "Authorization": auth_token,
        "Content-Type": "application/json",
    }


def _bhashini_stt(audio_bytes: bytes, filename: str, content_type: str, language: str) -> VoiceSTTResponse:
    iso_lang, _ = _normalize_language(language)
    src_lang = "hi" if iso_lang == "auto" else iso_lang
    callback_url, auth_token, service_id = _get_bhashini_pipeline("asr", src_lang)

    compute_payload = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {"sourceLanguage": src_lang},
                    "serviceId": service_id,
                    "audioFormat": _infer_audio_format(filename, content_type),
                    "samplingRate": 16000,
                },
            }
        ],
        "inputData": {"audio": [{"audioContent": base64.b64encode(audio_bytes).decode("ascii")}]},
    }
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(callback_url, headers=_bhashini_headers(auth_token), json=compute_payload)
        resp.raise_for_status()
        data = resp.json()

    transcript = (
        data.get("pipelineResponse", [{}])[0]
        .get("output", [{}])[0]
        .get("source", "")
        .strip()
    )
    return VoiceSTTResponse(
        transcript=transcript,
        detected_language=src_lang,
        provider="bhashini",
        fallback_to_device=False,
        message="Transcribed via Bhashini ULCA.",
    )


def _bhashini_tts(req: VoiceTTSRequest) -> VoiceTTSResponse:
    iso_lang, _ = _normalize_language(req.language)
    src_lang = "hi" if iso_lang == "auto" else iso_lang
    callback_url, auth_token, service_id = _get_bhashini_pipeline("tts", src_lang, req.gender)

    compute_payload = {
        "pipelineTasks": [
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": src_lang},
                    "serviceId": service_id,
                    "gender": req.gender,
                },
            }
        ],
        "inputData": {"input": [{"source": req.text}]},
    }
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(callback_url, headers=_bhashini_headers(auth_token), json=compute_payload)
        resp.raise_for_status()
        data = resp.json()

    audio_b64 = (
        data.get("pipelineResponse", [{}])[0]
        .get("audio", [{}])[0]
        .get("audioContent")
    )
    if not audio_b64:
        raise ValueError("Bhashini returned no audio output.")
    return VoiceTTSResponse(
        audio_base64=audio_b64,
        content_type="audio/wav",
        language=src_lang,
        provider="bhashini",
        fallback_to_device=False,
        message="Synthesized via Bhashini ULCA.",
    )


def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "recording.wav",
    content_type: str = "audio/wav",
    language: str = "auto",
    provider: VoiceProviderChoice = "auto",
) -> VoiceSTTResponse:
    """Transcribe speech via Sarvam AI or Bhashini, signaling device fallback if unavailable."""
    iso_lang, _ = _normalize_language(language)
    providers = _resolve_providers(provider, iso_lang)
    errors: list[str] = []

    for prov in providers:
        try:
            if prov == "sarvam":
                return _sarvam_stt(audio_bytes, filename, content_type, language)
            return _bhashini_stt(audio_bytes, filename, content_type, language)
        except Exception as exc:
            logger.warning("STT provider '%s' failed: %s", prov, exc)
            errors.append(f"{prov}: {type(exc).__name__}")

    reason = (
        f"Cloud STT unavailable ({'; '.join(errors)}). Use on-device Capacitor speech recognition."
        if errors
        else "No cloud voice provider key configured. Use on-device Capacitor speech recognition."
    )
    return VoiceSTTResponse(
        transcript="",
        detected_language=iso_lang,
        provider="device_fallback",
        fallback_to_device=True,
        message=reason,
    )


def synthesize_speech(req: VoiceTTSRequest) -> VoiceTTSResponse:
    """Synthesize speech via Sarvam AI or Bhashini, signaling device TTS fallback if unavailable."""
    iso_lang, _ = _normalize_language(req.language)
    spoken = req.text
    if req.auto_translate and iso_lang not in ("en", "auto"):
        spoken = translate_text(req.text, iso_lang)
    effective_req = req if spoken == req.text else req.model_copy(update={"text": spoken})

    providers = _resolve_providers(effective_req.provider, iso_lang)
    errors: list[str] = []

    for prov in providers:
        try:
            res = (
                _sarvam_tts(effective_req)
                if prov == "sarvam"
                else _bhashini_tts(effective_req)
            )
            res.spoken_text = spoken
            return res
        except Exception as exc:
            logger.warning("TTS provider '%s' failed: %s", prov, exc)
            errors.append(f"{prov}: {type(exc).__name__}")

    reason = (
        f"Cloud TTS unavailable ({'; '.join(errors)}). Use on-device Capacitor text-to-speech."
        if errors
        else "No cloud voice provider key configured. Use on-device Capacitor text-to-speech."
    )
    return VoiceTTSResponse(
        audio_base64=None,
        content_type="audio/wav",
        language=req.language,
        provider="device_fallback",
        fallback_to_device=True,
        message=reason,
        spoken_text=spoken,
    )

