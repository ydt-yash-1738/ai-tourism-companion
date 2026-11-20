import base64
import json
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import voice_service

_REAL_HTTPX_CLIENT = httpx.Client


@pytest.fixture(autouse=True)
def _reset_voice_env(monkeypatch):
    voice_service.clear_bhashini_cache()
    monkeypatch.setattr(settings, "VOICE_PROVIDER", "auto")
    monkeypatch.setattr(settings, "SARVAM_API_KEY", "")
    monkeypatch.setattr(settings, "BHASHINI_USER_ID", "")
    monkeypatch.setattr(settings, "BHASHINI_ULCA_API_KEY", "")
    yield
    voice_service.clear_bhashini_cache()


def _install_mock_transport(monkeypatch, handler):
    monkeypatch.setattr(
        voice_service.httpx,
        "Client",
        lambda **kwargs: _REAL_HTTPX_CLIENT(transport=httpx.MockTransport(handler), **kwargs),
    )


def test_voice_status_and_device_fallback_when_unconfigured():
    with TestClient(app) as client:
        st = client.get("/api/voice/status")
        assert st.status_code == 200
        sdata = st.json()
        assert sdata["sarvam_configured"] is False
        assert sdata["bhashini_configured"] is False
        assert "hi" in sdata["supported_indian_languages"]

        stt = client.post(
            "/api/voice/stt",
            files={"audio": ("clip.wav", b"RIFF0000WAVEfmt ", "audio/wav")},
            data={"language": "hi"},
        )
        assert stt.status_code == 200
        assert stt.json()["provider"] == "device_fallback"
        assert stt.json()["fallback_to_device"] is True

        tts = client.post("/api/voice/tts", json={"text": "ताजमहल", "language": "hi"})
        assert tts.status_code == 200
        assert tts.json()["provider"] == "device_fallback"
        assert tts.json()["fallback_to_device"] is True
        assert tts.json()["audio_base64"] is None


def test_sarvam_stt_and_tts_contracts(monkeypatch):
    monkeypatch.setattr(settings, "SARVAM_API_KEY", "sarvam_test_key")
    seen_requests: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_requests.append((str(request.url), request.headers.get("api-subscription-key", "")))
        if request.url.path == "/speech-to-text":
            return httpx.Response(200, json={"transcript": "ताजमहल किसने बनवाया?", "language_code": "hi-IN"})
        if request.url.path == "/text-to-speech":
            body = json.loads(request.content.decode("utf-8"))
            assert body["target_language_code"] == "hi-IN"
            assert body["model"] == settings.SARVAM_TTS_MODEL
            fake_b64 = base64.b64encode(b"FAKEWAVDATA").decode("ascii")
            return httpx.Response(200, json={"audios": [fake_b64]})
        return httpx.Response(404)

    _install_mock_transport(monkeypatch, handler)

    with TestClient(app) as client:
        stt = client.post(
            "/api/voice/stt",
            files={"audio": ("q.wav", b"RIFF0000WAVEfmt ", "audio/wav")},
            data={"language": "hi"},
        )
        assert stt.status_code == 200
        assert stt.json()["provider"] == "sarvam"
        assert stt.json()["transcript"] == "ताजमहल किसने बनवाया?"

        tts = client.post("/api/voice/tts", json={"text": "ताजमहल शाहजहाँ ने बनवाया।", "language": "hi"})
        assert tts.status_code == 200
        tdata = tts.json()
        assert tdata["provider"] == "sarvam"
        assert tdata["fallback_to_device"] is False
        assert base64.b64decode(tdata["audio_base64"]) == b"FAKEWAVDATA"

    assert all(key == "sarvam_test_key" for _, key in seen_requests)


def test_bhashini_two_step_pipeline_and_failover(monkeypatch):
    monkeypatch.setattr(settings, "SARVAM_API_KEY", "sarvam_test_key")
    monkeypatch.setattr(settings, "BHASHINI_USER_ID", "bhashini_uid")
    monkeypatch.setattr(settings, "BHASHINI_ULCA_API_KEY", "bhashini_key")

    def handler(request: httpx.Request) -> httpx.Response:
        # Simulate Sarvam outage to verify automatic failover to Bhashini
        if request.url.host == "api.sarvam.ai":
            return httpx.Response(503, json={"error": "upstream unavailable"})

        if str(request.url) == voice_service.BHASHINI_CONFIG_URL:
            assert request.headers["userID"] == "bhashini_uid"
            assert request.headers["ulcaApiKey"] == "bhashini_key"
            req_body = json.loads(request.content.decode("utf-8"))
            task = req_body["pipelineTasks"][0]["taskType"]
            return httpx.Response(
                200,
                json={
                    "pipelineInferenceAPIEndPoint": {
                        "callbackUrl": "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
                        "inferenceApiKey": {"name": "Authorization", "value": "infer_token_123"},
                    },
                    "pipelineResponseConfig": [
                        {
                            "taskType": task,
                            "config": [
                                {
                                    "language": {"sourceLanguage": "hi"},
                                    "serviceId": f"ai4bharat/{task}-hi",
                                    "gender": "female",
                                }
                            ],
                        }
                    ],
                },
            )

        if str(request.url) == "https://dhruva-api.bhashini.gov.in/services/inference/pipeline":
            assert request.headers["Authorization"] == "infer_token_123"
            req_body = json.loads(request.content.decode("utf-8"))
            task = req_body["pipelineTasks"][0]["taskType"]
            if task == "asr":
                return httpx.Response(
                    200, json={"pipelineResponse": [{"output": [{"source": "नमस्ते आगरा"}]}]}
                )
            return httpx.Response(
                200,
                json={
                    "pipelineResponse": [
                        {"audio": [{"audioContent": base64.b64encode(b"BHASHINI_WAV").decode("ascii")}]}
                    ]
                },
            )
        return httpx.Response(404)

    _install_mock_transport(monkeypatch, handler)

    with TestClient(app) as client:
        stt = client.post(
            "/api/voice/stt",
            files={"audio": ("q.wav", b"RIFF0000WAVEfmt ", "audio/wav")},
            data={"language": "hi", "provider": "auto"},
        )
        assert stt.status_code == 200
        assert stt.json()["provider"] == "bhashini"
        assert stt.json()["transcript"] == "नमस्ते आगरा"

        tts = client.post(
            "/api/voice/tts",
            json={"text": "नमस्ते आगरा", "language": "hi", "provider": "bhashini"},
        )
        assert tts.status_code == 200
        assert tts.json()["provider"] == "bhashini"
        assert base64.b64decode(tts.json()["audio_base64"]) == b"BHASHINI_WAV"


def test_voice_input_validation():
    with TestClient(app) as client:
        bad_stt = client.post(
            "/api/voice/stt",
            files={"audio": ("empty.wav", b"", "audio/wav")},
            data={"language": "hi"},
        )
        assert bad_stt.status_code == 400

        bad_tts = client.post("/api/voice/tts", json={"text": "", "language": "hi"})
        assert bad_tts.status_code == 422

