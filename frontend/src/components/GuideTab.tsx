import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock,
  Compass,
  Loader2,
  Mic,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import {
  AGRA_VISITOR_SNAPSHOT,
  GUIDE_MONUMENT_SPOTLIGHTS,
  GUIDE_TOPIC_CARDS,
  getMonumentMedia,
} from '../data/agraMedia';
import { getUiText } from '../data/i18n';
import { postChat, postVoiceSTT } from '../services/api';
import { convertBlobToWav16k } from '../services/audioRecorder';
import { offlineLocalChatSearch } from '../services/offlineStore';
import { speakText, startBrowserSpeechFallback, stopSpeaking } from '../services/speech';
import { translateBatchCached } from '../services/translateCache';
import type { ChatResponse, Monument, OfflinePack, PersonaType } from '../types/api';
import { ErrorStateCard, FallbackNoticeBanner } from './ApiStateCard';

interface GuideTabProps {
  language: string;
  persona: PersonaType;
  simpleLanguage: boolean;
  isOnline: boolean;
  sessionHash: string;
  monuments: Monument[];
  monumentsLoading?: boolean;
  offlinePack: OfflinePack | null;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: ChatResponse;
  isError?: boolean;
  apiFallback?: boolean;
  retryQuestion?: string;
}

export function GuideTab({
  language,
  persona,
  simpleLanguage,
  isOnline,
  sessionHash,
  monuments,
  monumentsLoading = false,
  offlinePack,
}: GuideTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];
  const needsDynamicTranslate = baseLang !== 'en' && baseLang !== 'hi';

  const [selectedMonument, setSelectedMonument] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [audioState, setAudioState] = useState<{
    id: string;
    status: 'loading' | 'playing';
  } | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translationSettledKey, setTranslationSettledKey] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const browserSpeechRef = useRef<{ stop: () => void } | null>(null);
  const msgSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      browserSpeechRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const spotlightMonuments = useMemo(() => {
    const liveBySlug = new Map(monuments.map((m) => [m.slug, m]));
    const merged = GUIDE_MONUMENT_SPOTLIGHTS.map((spot) => {
      const live = liveBySlug.get(spot.slug);
      return {
        slug: spot.slug,
        name: live?.name || spot.name,
        nameHi: live?.name_hi || spot.nameHi,
        shortSummary: live?.short_summary || spot.shortSummary,
        shortSummaryHi: live?.short_summary_hi || spot.shortSummaryHi,
        visitDurationMin: live?.visit_duration_min ?? spot.visitDurationMin,
        stepFree: live?.step_free ?? spot.stepFree,
        promptEn: spot.promptEn,
        promptHi: spot.promptHi,
      };
    });

    monuments.forEach((m) => {
      if (!merged.some((item) => item.slug === m.slug)) {
        merged.push({
          slug: m.slug,
          name: m.name,
          nameHi: m.name_hi,
          shortSummary: m.short_summary,
          shortSummaryHi: m.short_summary_hi,
          visitDurationMin: m.visit_duration_min,
          stepFree: m.step_free,
          promptEn: `Tell me the verified history and local folklore of ${m.name}.`,
          promptHi: `${m.name_hi || m.name} का प्रमाणित इतिहास और लोककथा बताइए।`,
        });
      }
    });

    return merged;
  }, [monuments]);

  const translationReqKey = useMemo(() => {
    if (!needsDynamicTranslate) return null;
    return `${baseLang}|${spotlightMonuments.map((m) => m.slug).join(',')}`;
  }, [needsDynamicTranslate, baseLang, spotlightMonuments]);

  const translating = Boolean(
    translationReqKey && translationSettledKey !== translationReqKey,
  );

  useEffect(() => {
    if (!translationReqKey) return;
    let active = true;
    const raw: string[] = [];
    spotlightMonuments.forEach((m) => {
      raw.push(m.name, m.shortSummary, m.promptEn);
    });
    GUIDE_TOPIC_CARDS.forEach((t) => {
      raw.push(t.badgeEn, t.titleEn, t.descEn, t.questionEn);
    });
    AGRA_VISITOR_SNAPSHOT.forEach((s) => {
      raw.push(s.titleEn, s.bodyEn);
    });

    const unique = Array.from(new Set(raw.filter(Boolean))).slice(0, 50);
    translateBatchCached(unique, baseLang)
      .then((res) => {
        if (!active) return;
        const next: Record<string, string> = {};
        unique.forEach((orig, idx) => {
          next[`${baseLang}::${orig}`] = res[idx] || orig;
        });
        setTranslatedMap((prev) => ({ ...prev, ...next }));
        setTranslationSettledKey(translationReqKey);
      })
      .catch(() => {
        if (active) setTranslationSettledKey(translationReqKey);
      });

    return () => {
      active = false;
    };
  }, [translationReqKey, baseLang, spotlightMonuments]);

  const tr = (enText: string, hiText = ''): string => {
    if (isHi && hiText) return hiText;
    if (needsDynamicTranslate) {
      return translatedMap[`${baseLang}::${enText}`] || enText;
    }
    return enText;
  };

  const markImageLoaded = (slug: string) => {
    setLoadedImages((prev) => (prev[slug] ? prev : { ...prev, [slug]: true }));
  };

  const sendQuestion = async (rawQuestion: string, monumentSlugOverride?: string) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    const effectiveMonumentSlug =
      monumentSlugOverride !== undefined ? monumentSlugOverride : selectedMonument;

    setVoiceStatus('');
    const userMsg: ChatTurn = { id: `u_${++msgSeqRef.current}`, role: 'user', text: question };
    const nextHistory = [...messages, userMsg]
      .filter((m) => !m.isError)
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.response ? m.response.answer_summary : m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let res: ChatResponse | null = null;
      let usedOfflineFallback = false;
      let liveApiError: string | null = null;

      if (isOnline) {
        try {
          res = await postChat({
            destination_slug: 'agra',
            question,
            language,
            persona,
            simple_language: simpleLanguage,
            monument_slug: effectiveMonumentSlug || null,
            session_hash: sessionHash,
            conversation_history: nextHistory,
          });
        } catch (err) {
          if (offlinePack && offlinePack.knowledge_chunks.length > 0) {
            res = offlineLocalChatSearch(offlinePack, question, language, persona, simpleLanguage);
            usedOfflineFallback = true;
          } else {
            liveApiError = err instanceof Error ? err.message : ui.serverErrorDesc;
          }
        }
      } else {
        res = offlineLocalChatSearch(offlinePack, question, language, persona, simpleLanguage);
      }

      if (liveApiError) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${++msgSeqRef.current}`,
            role: 'assistant',
            text: liveApiError,
            isError: true,
            retryQuestion: question,
          },
        ]);
      } else if (res) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${++msgSeqRef.current}`,
            role: 'assistant',
            text: res.answer_summary,
            response: res,
            apiFallback: usedOfflineFallback,
            retryQuestion: usedOfflineFallback ? question : undefined,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMic = async () => {
    if (transcribing) return;

    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      browserSpeechRef.current?.stop();
      setRecording(false);
      return;
    }

    setVoiceStatus('');

    if (isOnline && 'MediaRecorder' in window && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
          setRecording(false);

          const rawBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (rawBlob.size === 0) {
            setVoiceStatus(
              isHi
                ? 'कोई आवाज़ रिकॉर्ड नहीं हुई। कृपया माइक के पास बोलें।'
                : 'No audio captured. Please speak closer to the microphone.',
            );
            return;
          }

          setTranscribing(true);
          setVoiceStatus(isHi ? 'आपकी आवाज़ समझी जा रही है...' : 'Transcribing speech...');
          try {
            const wavBlob = await convertBlobToWav16k(rawBlob);
            const stt = await postVoiceSTT(wavBlob, language);
            if (!stt.fallback_to_device && stt.transcript.trim()) {
              const spoken = stt.transcript.trim();
              setInput((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
              setVoiceStatus('');
              return;
            }
            setVoiceStatus(
              stt.transcript.trim() === '' && !stt.fallback_to_device
                ? isHi
                  ? 'आवाज़ स्पष्ट नहीं थी, कृपया पुनः प्रयास करें।'
                  : 'No clear speech detected — please try again or type your question.'
                : stt.message || 'Voice transcription unavailable — please type your question.',
            );
          } catch {
            setVoiceStatus(
              isHi
                ? 'वॉइस सेवा से संपर्क नहीं हो सका। कृपया टाइप करें या दोबारा बोलें।'
                : 'Could not reach voice transcription service — please try again or type.',
            );
          } finally {
            setTranscribing(false);
          }
        };

        recorder.start(250);
        setRecording(true);
        setVoiceStatus(
          isHi ? 'सुन रहे हैं... बोलने के बाद लाल बटन दबाएँ' : 'Listening... tap stop when done',
        );
        return;
      } catch {
        // Microphone denied or unsupported -> try browser Web Speech fallback
      }
    }

    const fallback = startBrowserSpeechFallback(
      language,
      (transcript) => {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
        setVoiceStatus('');
      },
      () => setRecording(false),
    );
    if (fallback) {
      browserSpeechRef.current = fallback;
      setRecording(true);
      setVoiceStatus(
        isHi ? 'सुन रहे हैं... बोलने के बाद लाल बटन दबाएँ' : 'Listening... tap stop when done',
      );
    } else {
      setVoiceStatus(
        isHi
          ? 'माइक्रोफ़ोन उपलब्ध नहीं है। कृपया नीचे अपना प्रश्न टाइप करें।'
          : 'Microphone permission unavailable in this browser — please type your question.',
      );
    }
  };

  const handleReadAloud = async (turn: ChatTurn) => {
    if (audioState?.id === turn.id) {
      stopSpeaking();
      setAudioState(null);
      return;
    }

    const r = turn.response;
    const historyPart = r?.verified_history.length
      ? `${ui.recordedHistory}: ${r.verified_history.map((h) => h.text).join(' ')}`
      : '';
    const folklorePart = r?.folklore_legends.length
      ? `${ui.localFolklore}: ${r.folklore_legends.map((f) => f.text).join(' ')}`
      : '';
    const fullText = [turn.text, historyPart, folklorePart].filter(Boolean).join(' ');

    const needsAutoTranslate = Boolean(r && r.language !== language);
    await speakText(
      fullText,
      language,
      (state) => {
        setAudioState(state === 'idle' ? null : { id: turn.id, status: state });
      },
      { autoTranslate: needsAutoTranslate },
    );
  };

  const handleResetChat = () => {
    stopSpeaking();
    setAudioState(null);
    setMessages([]);
  };

  return (
    <div className="tab-panel guide-layout">
      <div className="section-card guide-hero-card">
        <div className="guide-eyebrow-row">
          <span className="guide-eyebrow-row__badge">
            <Sparkles size={13} />
            <span>{ui.guideWelcomeBadge}</span>
          </span>
          <span className="guide-eyebrow-row__persona">{ui.personas[persona]}</span>
          {translating && (
            <span className="translating-pill" role="status">
              <Loader2 size={13} className="spin-icon" />
              <span>{ui.translating}</span>
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
              {ui.guideHeading}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              {ui.guideSub}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {monumentsLoading && monuments.length === 0 && (
              <span className="translating-pill" role="status">
                <Loader2 size={13} className="spin-icon" />
                <span>{ui.loadingMonuments}</span>
              </span>
            )}
            <select
              className="lang-select"
              value={selectedMonument}
              onChange={(e) => setSelectedMonument(e.target.value)}
              aria-label="Filter by specific monument"
            >
              <option value="">{ui.allMonuments}</option>
              {monuments.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {isHi && m.name_hi ? m.name_hi : m.name}
                </option>
              ))}
            </select>
            {messages.length > 0 && (
              <button
                type="button"
                className="pill-btn"
                style={{ minHeight: 38, padding: '6px 12px', fontSize: '0.82rem' }}
                onClick={handleResetChat}
              >
                <RotateCcw size={14} />
                <span>{ui.newChat}</span>
              </button>
            )}
          </div>
        </div>

        <div className="starter-chips">
          {ui.starters.map((q) => (
            <button
              key={q}
              type="button"
              className="chip-btn"
              disabled={loading}
              onClick={() => sendQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {messages.length === 0 && !loading && (
        <div className="guide-discovery">
          <section>
            <div className="guide-section-head">
              <div>
                <h3>{ui.exploreMonumentsHeading}</h3>
                <p>{ui.exploreMonumentsSub}</p>
              </div>
            </div>

            <div className="guide-monument-grid">
              {spotlightMonuments.map((item) => {
                const media = getMonumentMedia(item.slug);
                const isLoaded = Boolean(loadedImages[item.slug]);
                const localizedName = tr(item.name, item.nameHi);
                const localizedSummary = tr(item.shortSummary, item.shortSummaryHi);
                const localizedPrompt = tr(item.promptEn, item.promptHi);

                return (
                  <button
                    key={item.slug}
                    type="button"
                    className={`guide-monument-card ${
                      selectedMonument === item.slug ? 'is-selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedMonument(item.slug);
                      sendQuestion(localizedPrompt, item.slug);
                    }}
                  >
                    <div className="guide-monument-card__media">
                      <img
                        className={`guide-monument-card__img ${isLoaded ? 'is-loaded' : ''}`}
                        src={media.image}
                        alt={media.alt}
                        style={{ objectPosition: media.objectPosition }}
                        loading="lazy"
                        onLoad={() => markImageLoaded(item.slug)}
                        onError={() => markImageLoaded(item.slug)}
                      />
                      <div className="guide-monument-card__scrim" aria-hidden="true" />
                      <div className="guide-monument-card__top">
                        <span className="guide-monument-card__pill">
                          <Clock size={11} />
                          <span>~{item.visitDurationMin} min</span>
                        </span>
                        <span
                          className={`guide-monument-card__pill ${
                            item.stepFree ? 'is-step-free' : 'is-stairs'
                          }`}
                        >
                          <Accessibility size={11} />
                          <span>{item.stepFree ? ui.stepFreeBadge : ui.stairsBadge}</span>
                        </span>
                      </div>
                    </div>

                    <div className="guide-monument-card__body">
                      <h4>{localizedName}</h4>
                      <p>{localizedSummary}</p>
                      <div className="guide-monument-card__cta">
                        <span>{ui.askAboutMonument}</span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="guide-section-head">
              <div>
                <h3>{ui.curatedTopicsHeading}</h3>
                <p>{ui.curatedTopicsSub}</p>
              </div>
            </div>

            <div className="guide-topic-grid">
              {GUIDE_TOPIC_CARDS.map((topic) => {
                const topicQuestion = tr(topic.questionEn, topic.questionHi);
                const focusSlug = topic.id === 'musamman-burj-story' ? 'musamman-burj' : '';
                return (
                  <button
                    key={topic.id}
                    type="button"
                    className={`guide-topic-card is-${topic.accent}`}
                    disabled={loading}
                    onClick={() => {
                      setSelectedMonument(focusSlug);
                      sendQuestion(topicQuestion, focusSlug);
                    }}
                  >
                    <span className="guide-topic-card__badge">
                      {tr(topic.badgeEn, topic.badgeHi)}
                    </span>
                    <h4>{tr(topic.titleEn, topic.titleHi)}</h4>
                    <p>{tr(topic.descEn, topic.descHi)}</p>
                    <span className="guide-topic-card__ask">
                      <span>{ui.askAboutMonument}</span>
                      <ArrowRight size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="guide-snapshot-grid" aria-label="Agra visitor quick facts">
            {AGRA_VISITOR_SNAPSHOT.map((tile, idx) => {
              const Icon = idx === 0 ? Clock : idx === 1 ? Compass : ShieldCheck;
              return (
                <div key={tile.id} className="guide-snapshot-tile">
                  <div className="guide-snapshot-tile__head">
                    <Icon size={15} color="var(--saffron-deep)" />
                    <span>{tr(tile.titleEn, tile.titleHi)}</span>
                  </div>
                  <p>{tr(tile.bodyEn, tile.bodyHi)}</p>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {(messages.length > 0 || loading) && (
        <div className="chat-stream">
          {messages.map((turn) => {
            if (turn.role === 'user') {
              return (
                <div key={turn.id} className="chat-bubble is-user">
                  {turn.text}
                </div>
              );
            }

            if (turn.isError) {
              return (
                <ErrorStateCard
                  key={turn.id}
                  title={ui.serverErrorTitle}
                  message={ui.serverErrorDesc}
                  detail={turn.text}
                  retryLabel={ui.retry}
                  onRetry={turn.retryQuestion ? () => sendQuestion(turn.retryQuestion!) : undefined}
                />
              );
            }

            const turnAudioStatus = audioState?.id === turn.id ? audioState.status : 'idle';

            return (
              <article key={turn.id} className="chat-bubble is-assistant">
                {turn.apiFallback && (
                  <FallbackNoticeBanner
                    message={ui.offlineFallbackNotice}
                    retryLabel={ui.retry}
                    onRetry={
                      isOnline && turn.retryQuestion
                        ? () => sendQuestion(turn.retryQuestion!)
                        : undefined
                    }
                    variant="warning"
                  />
                )}

                <div className="chat-bubble__meta">
                  <span>
                    {turn.response?.mode === 'gemini'
                      ? '✦ Grounded Gemini + Neon pgvector'
                      : 'Offline / Local Knowledge Cache'}
                    {turn.response?.matched_monument_slug
                      ? ` · ${turn.response.matched_monument_slug}`
                      : ''}
                  </span>
                  <button
                    type="button"
                    className={`pill-btn ${
                      turnAudioStatus === 'playing'
                        ? 'is-saffron'
                        : turnAudioStatus === 'loading'
                          ? 'is-audio-loading'
                          : ''
                    }`}
                    style={{ minHeight: 34, padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleReadAloud(turn)}
                  >
                    {turnAudioStatus === 'loading' ? (
                      <Loader2 size={14} className="spin-icon" />
                    ) : turnAudioStatus === 'playing' ? (
                      <Square size={13} />
                    ) : (
                      <Volume2 size={14} />
                    )}
                    {turnAudioStatus === 'playing' && (
                      <span className="audio-eq" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                    <span>
                      {turnAudioStatus === 'loading'
                        ? ui.loadingAudio
                        : turnAudioStatus === 'playing'
                          ? ui.stopAudio
                          : ui.readAloud}
                    </span>
                  </button>
                </div>

                <p className="chat-bubble__summary">{turn.text}</p>

                {turn.response &&
                  (turn.response.verified_history.length > 0 ||
                    turn.response.folklore_legends.length > 0) && (
                    <div className="split-grid">
                      {turn.response.verified_history.length > 0 && (
                        <div className="fact-box">
                          <div className="fact-box__heading">
                            <ShieldCheck size={15} />
                            <span>{ui.recordedHistory}</span>
                          </div>
                          {turn.response.verified_history.map((item, idx) => (
                            <div key={idx} className="fact-box__item">
                              <p>{item.text}</p>
                              <cite>
                                {ui.sourceLabel}
                                {item.source}
                              </cite>
                            </div>
                          ))}
                        </div>
                      )}

                      {turn.response.folklore_legends.length > 0 && (
                        <div className="folklore-box">
                          <div className="folklore-box__heading">
                            <BookOpen size={15} />
                            <span>{ui.localFolklore}</span>
                          </div>
                          {turn.response.folklore_legends.map((item, idx) => (
                            <div key={idx} className="folklore-box__item">
                              <p>{item.text}</p>
                              <cite>
                                {ui.attributionLabel}
                                {item.attribution}
                              </cite>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                {turn.response?.is_knowledge_gap && (
                  <div className="gap-notice">
                    <AlertTriangle size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                    {ui.gapNotice}
                  </div>
                )}

                {turn.response && turn.response.follow_up_suggestions.length > 0 && (
                  <div className="starter-chips">
                    {turn.response.follow_up_suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        className="chip-btn"
                        disabled={loading}
                        onClick={() => sendQuestion(sug)}
                      >
                        <Sparkles size={13} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}

          {loading && (
            <div className="chat-bubble is-assistant" role="status" aria-live="polite">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Loader2 size={18} className="spin-icon" color="var(--saffron)" />
                <strong style={{ color: 'var(--navy-deep)' }}>{ui.searchingRecords}</strong>
              </div>
              <div style={{ display: 'grid', gap: 8 }} aria-hidden="true">
                <div className="skeleton-line is-title" />
                <div className="skeleton-line" />
                <div className="skeleton-line is-med" />
              </div>
            </div>
          )}
        </div>
      )}

      {voiceStatus && (
        <div
          role="status"
          style={{
            padding: '7px 12px',
            borderRadius: 12,
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: recording || transcribing ? 'var(--navy-tint)' : 'var(--terracotta-tint)',
            color: recording || transcribing ? 'var(--navy)' : 'var(--terracotta)',
          }}
        >
          {transcribing && <Loader2 size={15} className="spin-icon" />}
          <span>{voiceStatus}</span>
        </div>
      )}

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
      >
        <button
          type="button"
          className={`pill-btn ${recording ? 'mic-recording' : ''}`}
          disabled={transcribing}
          onClick={handleToggleMic}
          aria-label={recording ? 'Stop voice recording' : 'Speak your question'}
          title={recording ? 'Stop recording' : 'Speak (Sarvam AI / Device Mic)'}
        >
          {transcribing ? (
            <Loader2 size={17} className="spin-icon" />
          ) : recording ? (
            <Square size={17} />
          ) : (
            <Mic size={17} />
          )}
        </button>

        <input
          type="text"
          className="chat-composer__input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (voiceStatus && !recording && !transcribing) setVoiceStatus('');
          }}
          placeholder={ui.chatPlaceholder}
        />

        <button
          type="submit"
          className="pill-btn is-saffron"
          disabled={!input.trim() || loading}
          aria-label="Send question"
        >
          {loading ? <Loader2 size={17} className="spin-icon" /> : <Send size={17} />}
        </button>
      </form>
    </div>
  );
}
