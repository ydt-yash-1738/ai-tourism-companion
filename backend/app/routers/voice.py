from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.schemas.api import (
    VoiceProviderChoice,
    VoiceSTTResponse,
    VoiceStatusResponse,
    VoiceTTSRequest,
    VoiceTTSResponse,
    VoiceTranslateRequest,
    VoiceTranslateResponse,
)
from app.services.translate_service import translate_texts
from app.services.voice_service import get_voice_status, synthesize_speech, transcribe_audio

MAX_AUDIO_BYTES = 10 * 1024 * 1024

router = APIRouter(prefix="/api/voice", tags=["Indian-Language Voice (Sarvam AI & Bhashini)"])


@router.get("/status", response_model=VoiceStatusResponse)
def voice_status():
    """Report which Indian-language voice providers are configured."""
    return get_voice_status()


@router.post("/stt", response_model=VoiceSTTResponse)
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    provider: VoiceProviderChoice = Form("auto"),
):
    """Transcribe visitor speech (Sarvam AI -> Bhashini -> on-device Capacitor fallback)."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded audio is empty.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio exceeds 10 MB limit.",
        )
    return await run_in_threadpool(
        transcribe_audio,
        audio_bytes=audio_bytes,
        filename=audio.filename or "recording.wav",
        content_type=audio.content_type or "audio/wav",
        language=language,
        provider=provider,
    )


@router.post("/tts", response_model=VoiceTTSResponse)
def text_to_speech(req: VoiceTTSRequest):
    """Convert answer/tour text into natural Indian-language speech audio (base64)."""
    return synthesize_speech(req)


@router.post("/translate", response_model=VoiceTranslateResponse)
def translate_batch(req: VoiceTranslateRequest):
    """Batch-translate UI or heritage card text into the visitor's selected language."""
    translations, translated = translate_texts(req.texts, req.target_language)
    return VoiceTranslateResponse(
        translations=translations,
        target_language=req.target_language,
        translated=translated,
    )

