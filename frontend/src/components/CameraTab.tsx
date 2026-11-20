import { useState } from 'react';
import {
  BookOpen,
  Camera,
  Loader2,
  MapPin,
  ShieldCheck,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
import { postVisionAsk } from '../services/api';
import { speakText, stopSpeaking } from '../services/speech';
import type { PersonaType, VisionResponse } from '../types/api';

interface CameraTabProps {
  language: string;
  persona: PersonaType;
  simpleLanguage: boolean;
  isOnline: boolean;
  sessionHash: string;
  userCoords: { lat: number; lng: number } | null;
}

export function CameraTab({
  language,
  persona,
  simpleLanguage,
  isOnline,
  sessionHash,
  userCoords,
}: CameraTabProps) {
  const ui = getUiText(language);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [useDemoGps, setUseDemoGps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VisionResponse | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const effectiveCoords = useDemoGps ? { lat: 27.1802, lng: 78.0226 } : userCoords;

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError('');
  };

  const handleIdentify = async () => {
    if (!imageFile || loading) return;
    if (!isOnline) {
      setError(ui.offlineCameraErr);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await postVisionAsk({
        imageFile,
        destinationSlug: 'agra',
        question: question.trim(),
        language,
        persona,
        simpleLanguage,
        lat: effectiveCoords?.lat ?? null,
        lng: effectiveCoords?.lng ?? null,
        sessionHash,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vision identification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakResult = async () => {
    if (!result) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await speakText(
      `${result.identified_name}. ${result.answer_summary}`,
      language,
      (on) => {
        if (!on) setSpeaking(false);
      },
      { autoTranslate: result.language !== language },
    );
  };

  return (
    <div className="tab-panel">
      <div className="section-card">
        <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
          {ui.cameraHeading}
        </h2>
        <p style={{ margin: '4px 0 12px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
          {ui.cameraSub}
        </p>

        <div className="camera-dropzone">
          {previewUrl ? (
            <img src={previewUrl} alt="Monument preview" className="camera-dropzone__preview" />
          ) : (
            <Camera size={40} color="var(--navy)" />
          )}

          <label className="pill-btn is-active" style={{ cursor: 'pointer' }}>
            <Upload size={16} />
            <span>{imageFile ? ui.chooseAnotherPhoto : ui.capturePhoto}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
          </label>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <input
            type="text"
            className="chat-composer__input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={ui.cameraPlaceholder}
          />

          <div className="filter-row" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`pill-btn ${useDemoGps ? 'is-emerald' : ''}`}
              onClick={() => setUseDemoGps((v) => !v)}
            >
              <MapPin size={15} />
              <span>
                {useDemoGps
                  ? ui.demoGpsOn
                  : userCoords
                    ? ui.usingLiveGps
                    : ui.demoGpsOff}
              </span>
            </button>

            <button
              type="button"
              className="pill-btn is-saffron"
              disabled={!imageFile || loading}
              onClick={handleIdentify}
            >
              {loading ? <Loader2 size={16} className="spin-icon" /> : <Camera size={16} />}
              <span>{loading ? ui.identifyingBtn : ui.identifyBtn}</span>
            </button>
          </div>

          {error && <div className="gap-notice">{error}</div>}
        </div>
      </div>

      {result && (
        <article className="section-card" style={{ animation: 'fadeSlideUp 0.25s ease' }}>
          <div className="chat-bubble__meta">
            <span>
              <strong>{result.mode === 'gemini' ? '✦ Gemini Vision' : 'GPS Fallback'}</strong> ·{' '}
              Confidence: {result.confidence.toUpperCase()}
            </span>
            <button
              type="button"
              className={`pill-btn ${speaking ? 'is-saffron' : ''}`}
              style={{ minHeight: 34, padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={handleSpeakResult}
            >
              {speaking ? <Square size={13} /> : <Volume2 size={14} />}
              <span>{speaking ? ui.stopAudio : ui.readAloud}</span>
            </button>
          </div>

          <h3 style={{ fontSize: 'calc(1.5rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
            {result.identified_name}
          </h3>

          {result.architectural_features.length > 0 && (
            <div className="cue-tags">
              {result.architectural_features.map((feat) => (
                <span key={feat}>{feat}</span>
              ))}
            </div>
          )}

          <p className="chat-bubble__summary">{result.answer_summary}</p>

          {(result.verified_history.length > 0 || result.folklore_legends.length > 0) && (
            <div className="split-grid">
              {result.verified_history.length > 0 && (
                <div className="fact-box">
                  <div className="fact-box__heading">
                    <ShieldCheck size={15} />
                    <span>{ui.recordedHistory}</span>
                  </div>
                  {result.verified_history.map((h, i) => (
                    <div key={i} className="fact-box__item">
                      <p>{h.text}</p>
                      <cite>{h.source}</cite>
                    </div>
                  ))}
                </div>
              )}
              {result.folklore_legends.length > 0 && (
                <div className="folklore-box">
                  <div className="folklore-box__heading">
                    <BookOpen size={15} />
                    <span>{ui.localFolklore}</span>
                  </div>
                  {result.folklore_legends.map((f, i) => (
                    <div key={i} className="folklore-box__item">
                      <p>{f.text}</p>
                      <cite>{f.attribution}</cite>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </article>
      )}
    </div>
  );
}
