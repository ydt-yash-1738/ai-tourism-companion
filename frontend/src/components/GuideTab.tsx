import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Compass,
  Landmark,
  Loader2,
  Mic,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { getDestinationConfig, getMonumentMedia } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { PERSONA_OPTIONS } from '../data/upCities';
import { postChat, postVoiceSTT } from '../services/api';
import { convertBlobToWav16k } from '../services/audioRecorder';
import { offlineLocalChatSearch } from '../services/offlineStore';
import { speakText, startBrowserSpeechFallback, stopSpeaking } from '../services/speech';
import { translateBatchCached } from '../services/translateCache';
import type { ChatResponse, Monument, OfflinePack, PersonaType } from '../types/api';

interface GuideTabProps {
  destinationSlug: string;
  language: string;
  persona: PersonaType;
  simpleLanguage: boolean;
  isOnline: boolean;
  sessionHash: string;
  monuments: Monument[];
  offlinePack: OfflinePack | null;
  onChangePersona: (p: PersonaType) => void;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: ChatResponse;
  /** True when the answer came from the on-device offline pack, not the server */
  fromDevice?: boolean;
}

export function GuideTab({
  destinationSlug,
  language,
  persona,
  simpleLanguage,
  isOnline,
  sessionHash,
  monuments,
  offlinePack,
  onChangePersona,
}: GuideTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];
  const needsDynamicTranslate = baseLang !== 'en' && baseLang !== 'hi';
  const destConfig = getDestinationConfig(destinationSlug);

  const [selectedMonument, setSelectedMonument] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translationSettledKey, setTranslationSettledKey] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const browserSpeechRef = useRef<{ stop: () => void } | null>(null);
  const msgSeqRef = useRef(0);
  const streamRef = useRef<HTMLDivElement>(null);

  // Bring the newest question or answer into view, below the sticky header
  useEffect(() => {
    const last = streamRef.current?.lastElementChild as HTMLElement | null;
    if (!last) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const top = last.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }, [messages.length, loading]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      browserSpeechRef.current?.stop();
    };
  }, []);

  const spotlightMonuments = useMemo(() => {
    const liveBySlug = new Map(monuments.map((m) => [m.slug, m]));
    const merged = destConfig.monumentSpotlights.map((spot) => {
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
  }, [monuments, destConfig.monumentSpotlights]);

  const translationReqKey = useMemo(() => {
    if (!needsDynamicTranslate || !isOnline) return null;
    return `${destinationSlug}|${baseLang}|${spotlightMonuments.map((m) => m.slug).join(',')}`;
  }, [needsDynamicTranslate, isOnline, destinationSlug, baseLang, spotlightMonuments]);

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
    destConfig.topicCards.forEach((t) => {
      raw.push(t.badgeEn, t.titleEn, t.descEn, t.questionEn);
    });
    destConfig.visitorSnapshot.forEach((s) => {
      raw.push(s.titleEn, s.bodyEn);
    });
    if (destinationSlug !== 'agra') {
      raw.push(
        destConfig.guideBanner.greetingEn,
        destConfig.guideBanner.greetingSubEn,
        destConfig.copy.guideHeadingEn,
        destConfig.copy.allMonumentsEn,
        destConfig.copy.exploreMonumentsHeadingEn,
        destConfig.copy.chatPlaceholderEn,
      );
    }

    const unique = Array.from(new Set(raw.filter(Boolean)));
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
  }, [translationReqKey, baseLang, destinationSlug, spotlightMonuments, destConfig]);

  const tr = (enText: string, hiText = ''): string => {
    if (isHi && hiText) return hiText;
    if (needsDynamicTranslate) {
      return translatedMap[`${baseLang}::${enText}`] || enText;
    }
    return enText;
  };

  const sendQuestion = async (rawQuestion: string, monumentOverride?: string) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    setVoiceStatus('');
    const userMsg: ChatTurn = { id: `u_${++msgSeqRef.current}`, role: 'user', text: question };
    const nextHistory = [...messages, userMsg].slice(-6).map((m) => ({
      role: m.role,
      content: m.role === 'assistant' && m.response ? m.response.answer_summary : m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let res: ChatResponse;
      let fromDevice = false;
      if (isOnline) {
        try {
          res = await postChat({
            destination_slug: destinationSlug,
            question,
            language,
            persona,
            simple_language: simpleLanguage,
            monument_slug: (monumentOverride ?? selectedMonument) || null,
            session_hash: sessionHash,
            conversation_history: nextHistory,
          });
        } catch {
          res = offlineLocalChatSearch(offlinePack, question, language, persona, simpleLanguage);
          fromDevice = true;
        }
      } else {
        res = offlineLocalChatSearch(offlinePack, question, language, persona, simpleLanguage);
        fromDevice = true;
      }

      const botMsg: ChatTurn = {
        id: `a_${++msgSeqRef.current}`,
        role: 'assistant',
        text: res.answer_summary,
        response: res,
        fromDevice,
      };
      setMessages((prev) => [...prev, botMsg]);
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
            if (stt.fallback_to_device) {
              // Server has no cloud speech service: listen again with the device recogniser
              const device = startBrowserSpeechFallback(
                language,
                (transcript) => {
                  setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
                  setVoiceStatus('');
                },
                () => setRecording(false),
              );
              if (device) {
                browserSpeechRef.current = device;
                setRecording(true);
                setVoiceStatus(isHi ? 'कृपया दोबारा बोलें...' : 'Please say that once more...');
                return;
              }
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
    if (speakingId === turn.id) {
      stopSpeaking();
      setSpeakingId(null);
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
    setSpeakingId(turn.id);
    await speakText(
      fullText,
      language,
      (state) => {
        if (state === 'idle') setSpeakingId(null);
      },
      { autoTranslate: needsAutoTranslate },
    );
  };

  const handleResetChat = () => {
    stopSpeaking();
    setSpeakingId(null);
    setMessages([]);
  };

  const monumentName = (slug: string | null | undefined) => {
    const m = monuments.find((x) => x.slug === slug);
    if (!m) return null;
    return isHi && m.name_hi ? m.name_hi : m.name;
  };

  const bannerSrc = `${import.meta.env.BASE_URL}${destConfig.guideBanner.image.replace(/^\//, '')}`;
  const greetingSub =
    destinationSlug === 'agra'
      ? ui.greetingSub
      : tr(destConfig.guideBanner.greetingSubEn, destConfig.guideBanner.greetingSubHi);
  const greeting =
    destinationSlug === 'agra'
      ? ui.greeting
      : tr(destConfig.guideBanner.greetingEn, destConfig.guideBanner.greetingHi);
  const guideHeading =
    destinationSlug === 'agra'
      ? ui.guideHeading
      : tr(destConfig.copy.guideHeadingEn, destConfig.copy.guideHeadingHi);
  const allMonumentsLabel =
    destinationSlug === 'agra'
      ? ui.allMonuments
      : tr(destConfig.copy.allMonumentsEn, destConfig.copy.allMonumentsHi);
  const exploreHeading =
    destinationSlug === 'agra'
      ? ui.exploreMonumentsHeading
      : tr(destConfig.copy.exploreMonumentsHeadingEn, destConfig.copy.exploreMonumentsHeadingHi);
  const chatPlaceholder =
    destinationSlug === 'agra'
      ? ui.chatPlaceholder
      : tr(destConfig.copy.chatPlaceholderEn, destConfig.copy.chatPlaceholderHi);

  return (
    <div className="guide-layout">
      <div className="photo-banner">
        <img src={bannerSrc} alt="" aria-hidden="true" data-parallax="0.2" />
        <div className="guide-banner">
          <span className="guide-banner__eyebrow">
            <span className="dot-live" />
            {greetingSub}
          </span>
          <h2>{greeting}</h2>
        </div>
      </div>

      <section className="guide-intro">
        <div
          className="guide-intro__head"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}
        >
          <div>
            <h3>{guideHeading}</h3>
            <p>{ui.guideSub}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {translating && (
              <span className="translating-pill" role="status">
                <Loader2 size={13} className="spin-icon" />
                <span>{ui.translating}</span>
              </span>
            )}
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

        <div className="segmented segmented--scroll" role="radiogroup" aria-label={ui.styleLabel}>
          {PERSONA_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={persona === p.id}
              className={persona === p.id ? 'is-active' : ''}
              onClick={() => onChangePersona(p.id)}
            >
              {ui.personas[p.id]}
            </button>
          ))}
        </div>

        <div className="chip-rail" role="radiogroup" aria-label="Filter by monument">
          <button
            type="button"
            role="radio"
            aria-checked={selectedMonument === ''}
            className={`place-chip ${selectedMonument === '' ? 'is-active' : ''}`}
            onClick={() => setSelectedMonument('')}
          >
            <Landmark size={15} />
            {allMonumentsLabel}
          </button>
          {monuments.map((m) => (
            <button
              key={m.slug}
              type="button"
              role="radio"
              aria-checked={selectedMonument === m.slug}
              className={`place-chip ${selectedMonument === m.slug ? 'is-active' : ''}`}
              onClick={() => setSelectedMonument(m.slug)}
            >
              {isHi && m.name_hi ? m.name_hi : m.name}
            </button>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="guide-discovery">
            <section>
              <div className="guide-section-head">
                <div>
                  <h3>{exploreHeading}</h3>
                  <p>{ui.exploreMonumentsSub}</p>
                </div>
              </div>
              <div className="guide-monument-grid">
                {spotlightMonuments.map((item) => {
                  const media = getMonumentMedia(item.slug, destinationSlug);
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      className={`guide-monument-card ${selectedMonument === item.slug ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSelectedMonument(item.slug);
                        void sendQuestion(tr(item.promptEn, item.promptHi), item.slug);
                      }}
                    >
                      <div className="guide-monument-card__media">
                        <img
                          data-parallax="0.1"
                          className="guide-monument-card__img is-loaded"
                          src={media.image}
                          alt={media.alt}
                          style={{ objectPosition: media.objectPosition }}
                          loading="lazy"
                        />
                        <div className="guide-monument-card__scrim" aria-hidden="true" />
                        <div className="guide-monument-card__top">
                          <span className="guide-monument-card__pill">
                            <Clock size={11} />
                            <span>~{item.visitDurationMin} min</span>
                          </span>
                          <span className={`guide-monument-card__pill ${item.stepFree ? 'is-step-free' : 'is-stairs'}`}>
                            <Accessibility size={11} />
                            <span>{item.stepFree ? ui.stepFreeBadge : ui.stairsBadge}</span>
                          </span>
                        </div>
                      </div>
                      <div className="guide-monument-card__body">
                        <h4>{tr(item.name, item.nameHi)}</h4>
                        <p>{tr(item.shortSummary, item.shortSummaryHi)}</p>
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
                {destConfig.topicCards.map((topic) => {
                  const focusSlug = topic.focusMonumentSlug || '';
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={`guide-topic-card is-${topic.accent}`}
                      disabled={loading}
                      onClick={() => {
                        setSelectedMonument(focusSlug);
                        void sendQuestion(tr(topic.questionEn, topic.questionHi), focusSlug);
                      }}
                    >
                      <span className="guide-topic-card__badge">{tr(topic.badgeEn, topic.badgeHi)}</span>
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

            <section className="guide-snapshot-grid" aria-label={`${destConfig.nameEn} visitor quick facts`}>
              {destConfig.visitorSnapshot.map((tile, idx) => {
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
      </section>

      <div className="chat-stream" aria-live="polite" ref={streamRef}>
        {messages.map((turn) =>
          turn.role === 'user' ? (
            <div key={turn.id} className="chat-bubble is-user">
              {turn.text}
            </div>
          ) : (
            <article key={turn.id} className="answer-card">
              <header className="answer-card__meta">
                <span className={`answer-card__source ${turn.fromDevice ? 'is-device' : ''}`}>
                  {turn.fromDevice ? <WifiOff size={13} /> : <ShieldCheck size={13} />}
                  {turn.fromDevice
                    ? ui.answeredOnDevice
                    : turn.response?.mode === 'gemini'
                      ? ui.sourceAi
                      : ui.sourceVerified}
                </span>
                {monumentName(turn.response?.matched_monument_slug) && (
                  <span className="answer-card__place">
                    <Landmark size={13} />
                    {monumentName(turn.response?.matched_monument_slug)}
                  </span>
                )}
              </header>

              <p className="answer-card__summary">{turn.text}</p>

              {turn.response && turn.response.verified_history.length > 0 && (
                <div className="evidence evidence--history">
                  <div className="evidence__label">
                    <ShieldCheck size={15} />
                    {ui.recordedHistory}
                  </div>
                  {turn.response.verified_history.map((item, idx) => (
                    <div key={idx} className="evidence__item">
                      <p>{item.text}</p>
                      <cite>{item.source}</cite>
                    </div>
                  ))}
                </div>
              )}

              {turn.response && turn.response.folklore_legends.length > 0 && (
                <div className="evidence evidence--folklore">
                  <div className="evidence__label">
                    <BookOpen size={15} />
                    {ui.localFolklore}
                  </div>
                  {turn.response.folklore_legends.map((item, idx) => (
                    <div key={idx} className="evidence__item">
                      <p>{item.text}</p>
                      <cite>{item.attribution}</cite>
                    </div>
                  ))}
                </div>
              )}

              {turn.response?.is_knowledge_gap && (
                <div className="gap-notice">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{turn.fromDevice ? ui.gapNoticeOffline : ui.gapNotice}</span>
                </div>
              )}

              <footer className="answer-card__actions">
                <button
                  type="button"
                  className={`soft-btn ${speakingId === turn.id ? 'is-playing' : ''}`}
                  onClick={() => handleReadAloud(turn)}
                >
                  {speakingId === turn.id ? (
                    <>
                      <span className="audio-eq" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      {ui.stopAudio}
                    </>
                  ) : (
                    <>
                      <Volume2 size={16} />
                      {ui.readAloud}
                    </>
                  )}
                </button>
              </footer>

              {turn.response && turn.response.follow_up_suggestions.length > 0 && (
                <div className="followups">
                  {turn.response.follow_up_suggestions.map((sug) => (
                    <button key={sug} type="button" className="followup-chip" onClick={() => sendQuestion(sug)}>
                      {sug}
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </article>
          ),
        )}

        {loading && (
          <div className="answer-card answer-card--loading" role="status">
            <span className="typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>{ui.searchingRecords}</span>
          </div>
        )}
      </div>

      {voiceStatus && (
        <div className={`voice-status ${recording || transcribing ? 'is-live' : 'is-warn'}`} role="status">
          {voiceStatus}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
      >
        <button
          type="button"
          className={`composer__mic ${recording ? 'is-recording' : ''}`}
          disabled={transcribing}
          onClick={handleToggleMic}
          aria-label={recording ? 'Stop voice recording' : 'Speak your question'}
        >
          {transcribing ? <Loader2 size={20} className="spin-icon" /> : recording ? <Square size={18} /> : <Mic size={20} />}
        </button>
        <input
          type="text"
          className="composer__input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (voiceStatus && !recording && !transcribing) setVoiceStatus('');
          }}
          placeholder={chatPlaceholder}
          aria-label={chatPlaceholder}
        />
        <button type="submit" className="composer__send" disabled={!input.trim() || loading} aria-label="Send question">
          <Send size={19} />
        </button>
      </form>
    </div>
  );
}
