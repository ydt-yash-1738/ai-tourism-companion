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


def test_translate_endpoint_and_auto_translate_tts(monkeypatch):
    from app.services import translate_service

    translate_service.clear_translation_cache()
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "fake_gemini_key")
    monkeypatch.setattr(settings, "SARVAM_API_KEY", "sarvam_test_key")

    call_count = 0

    class _FakeResp:
        def __init__(self, text: str):
            self.text = text

    class _FakeModels:
        def generate_content(self, **_kwargs):
            nonlocal call_count
            call_count += 1
            return _FakeResp(
                json.dumps({"translations": ["ताजमहाल शाहजहान यांनी बांधला."]})
            )

    class _FakeClient:
        def __init__(self, **_kwargs):
            self.models = _FakeModels()

    monkeypatch.setattr(translate_service.genai, "Client", _FakeClient)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/text-to-speech":
            body = json.loads(request.content.decode("utf-8"))
            assert body["target_language_code"] == "mr-IN"
            assert body["text"] == "ताजमहाल शाहजहान यांनी बांधला."
            return httpx.Response(
                200,
                json={"audios": [base64.b64encode(b"MR_WAV").decode("ascii")]},
            )
        return httpx.Response(404)

    _install_mock_transport(monkeypatch, handler)

    with TestClient(app) as client:
        # English passthrough
        en_res = client.post(
            "/api/voice/translate",
            json={"texts": ["Welcome to Agra"], "target_language": "en"},
        )
        assert en_res.status_code == 200
        assert en_res.json()["translations"] == ["Welcome to Agra"]
        assert en_res.json()["translated"] is False

        # Marathi batch translation (calls Gemini once, then hits cache)
        mr_res = client.post(
            "/api/voice/translate",
            json={"texts": ["Shah Jahan built the Taj Mahal."], "target_language": "mr"},
        )
        assert mr_res.status_code == 200
        assert mr_res.json()["translations"] == ["ताजमहाल शाहजहान यांनी बांधला."]
        assert mr_res.json()["translated"] is True

        # TTS with auto_translate=True reuses cached Marathi text and speaks mr-IN
        tts = client.post(
            "/api/voice/tts",
            json={
                "text": "Shah Jahan built the Taj Mahal.",
                "language": "mr",
                "auto_translate": True,
            },
        )
        assert tts.status_code == 200
        tdata = tts.json()
        assert tdata["provider"] == "sarvam"
        assert tdata["spoken_text"] == "ताजमहाल शाहजहान यांनी बांधला."
        assert base64.b64decode(tdata["audio_base64"]) == b"MR_WAV"

    assert call_count == 1
    translate_service.clear_translation_cache()


def test_sarvam_stt_strips_codec_mime_parameters(monkeypatch):
    monkeypatch.setattr(settings, "SARVAM_API_KEY", "sarvam_test_key")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/speech-to-text":
            body_bytes = request.content
            assert b"audio/webm;codecs=opus" not in body_bytes
            assert b"audio/webm" in body_bytes
            return httpx.Response(200, json={"transcript": "Where is Taj Mahal?", "language_code": "en-IN"})
        return httpx.Response(404)

    _install_mock_transport(monkeypatch, handler)

    with TestClient(app) as client:
        res = client.post(
            "/api/voice/stt",
            files={"audio": ("voice_query.webm", b"WEBM_BYTES", "audio/webm;codecs=opus")},
            data={"language": "en"},
        )
        assert res.status_code == 200
        assert res.json()["provider"] == "sarvam"
        assert res.json()["transcript"] == "Where is Taj Mahal?"

