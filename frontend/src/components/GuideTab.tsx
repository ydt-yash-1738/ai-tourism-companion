import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  BookOpen,
  ChevronRight,
  Clock,
  Landmark,
  Loader2,
  MapPin,
  Mic,
  Navigation,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  UtensilsCrossed,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { getDestinationConfig, getMonumentMedia } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { AvatarCaption } from './AvatarCaption';
import { GuideAvatar } from './GuideAvatar';
import { PERSONA_OPTIONS } from '../data/upCities';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { postChat } from '../services/api';
import { enrichChatResponseWithOfflinePack, offlineLocalChatSearch } from '../services/offlineStore';
import { speakText, stopSpeaking } from '../services/speech';
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
  /** set when a question is re-asked after the answer style changed */
  styleLabel?: string;
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
  // read synchronously (state is one render behind): is an answer on its way, and
  // was the answer style changed meanwhile (then re-ask in it once the answer lands)
  const loadingRef = useRef(false);
  // answer-style menu on the search bar
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!styleMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!styleMenuRef.current?.contains(e.target as Node)) setStyleMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStyleMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [styleMenuOpen]);
  const pendingStyleRef = useRef<PersonaType | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speakProgress, setSpeakProgress] = useState(0);
  const [speakPlaying, setSpeakPlaying] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translationSettledKey, setTranslationSettledKey] = useState<string | null>(null);

  const {
    recording,
    transcribing,
    voiceStatus,
    clearVoiceStatus,
    toggleMic: handleToggleMic,
  } = useVoiceInput({
    language,
    isOnline,
    value: input,
    onValueChange: setInput,
    onBeforeStart: () => {
      stopSpeaking();
      setSpeakingId(null);
    },
  });

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

  const visibleMonuments = selectedMonument
    ? spotlightMonuments.filter((item) => item.slug === selectedMonument)
    : spotlightMonuments;

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
    if (destinationSlug !== 'agra') {
      raw.push(...destConfig.copy.startersEn);
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

  const sendQuestion = async (
    rawQuestion: string,
    monumentOverride?: string,
    /** answer in this style instead of the current one (used right after a style change) */
    personaOverride?: PersonaType,
  ) => {
    const question = rawQuestion.trim();
    if (!question || loadingRef.current) return;
    loadingRef.current = true;
    const activePersona = personaOverride ?? persona;

    clearVoiceStatus();
    const userMsg: ChatTurn = {
      id: `u_${++msgSeqRef.current}`,
      role: 'user',
      text: question,
      styleLabel: personaOverride ? ui.personas[personaOverride] : undefined,
    };
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
            persona: activePersona,
            simple_language: simpleLanguage,
            monument_slug: (monumentOverride ?? selectedMonument) || null,
            session_hash: sessionHash,
            conversation_history: nextHistory,
          });
          res = enrichChatResponseWithOfflinePack(
            res,
            offlinePack,
            question,
            language,
            activePersona,
            simpleLanguage,
          );
        } catch {
          res = offlineLocalChatSearch(offlinePack, question, language, activePersona, simpleLanguage);
          fromDevice = true;
        }
      } else {
        res = offlineLocalChatSearch(offlinePack, question, language, activePersona, simpleLanguage);
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
      loadingRef.current = false;
      setLoading(false);
      const pendingStyle = pendingStyleRef.current;
      pendingStyleRef.current = null;
      if (pendingStyle && pendingStyle !== activePersona) void sendQuestion(question, monumentOverride, pendingStyle);
    }
  };

  const spokenTextFor = (turn: ChatTurn) => {
    const r = turn.response;
    const stopsPart = r?.itinerary_stops?.length
      ? r.itinerary_stops.map((s) => `${s.time_slot}: ${s.title}. ${s.notes}`).join(' ')
      : '';
    const placesPart =
      !stopsPart && r?.recommended_places?.length
        ? r.recommended_places.map((p) => `${p.name}. ${p.description}`).join(' ')
        : '';
    const historyPart = r?.verified_history.length
      ? `${ui.recordedHistory}: ${r.verified_history.map((h) => h.text).join(' ')}`
      : '';
    const folklorePart = r?.folklore_legends.length
      ? `${ui.localFolklore}: ${r.folklore_legends.map((f) => f.text).join(' ')}`
      : '';
    return [turn.text, stopsPart, placesPart, historyPart, folklorePart].filter(Boolean).join(' ');
  };

  const handleReadAloud = async (turn: ChatTurn) => {
    if (speakingId === turn.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    const r = turn.response;
    const needsAutoTranslate = Boolean(r && r.language !== language);
    setSpeakingId(turn.id);
    setSpeakProgress(0);
    setSpeakPlaying(false);
    await speakText(
      spokenTextFor(turn),
      language,
      (state) => {
        setSpeakPlaying(state === 'playing');
        if (state === 'idle') setSpeakingId(null);
      },
      { autoTranslate: needsAutoTranslate, onProgress: setSpeakProgress },
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
  const chatPlaceholderBase =
    destinationSlug === 'agra'
      ? ui.chatPlaceholder
      : tr(destConfig.copy.chatPlaceholderEn, destConfig.copy.chatPlaceholderHi);
  // the guide has a name: "Ask Raahi" in English and Hindi, the translated prompt otherwise
  const askPlaceholder =
    language === 'en' ? 'Ask Raahi anything…' : isHi ? 'राही से कुछ भी पूछें…' : chatPlaceholderBase;

  // What each answer style does, shown under the style tabs
  const personaHint = (id: PersonaType): string => {
    const hints: Record<PersonaType, [string, string]> = {
      quick: ['Short, crisp facts.', 'छोटे, सटीक तथ्य।'],
      kids: ['Told as a simple story for children.', 'बच्चों के लिए सरल कहानी के रूप में।'],
      scholar: ['In depth: history, architecture and sources.', 'विस्तार से: इतिहास, स्थापत्य और स्रोत।'],
      pilgrim: ['With the spiritual meaning and etiquette of the place.', 'स्थान के आध्यात्मिक महत्व और मर्यादा के साथ।'],
    };
    return isHi ? hints[id][1] : hints[id][0];
  };

  // A sample question per style about this place's main monument, asked in one tap
  const personaExample = (id: PersonaType): string => {
    const spot = destConfig.monumentSpotlights[0];
    const place = spot ? (isHi ? spot.nameHi : spot.name) : isHi ? destConfig.nameHi : destConfig.nameEn;
    const examples: Record<PersonaType, [string, string]> = {
      quick: [`Give me the key facts about the ${place}`, `${place} के मुख्य तथ्य बताइए`],
      kids: [`Tell me the story of the ${place} like a fairy tale`, `${place} की कहानी परी-कथा की तरह सुनाइए`],
      scholar: [`Explain the architecture and history of the ${place}`, `${place} का स्थापत्य और इतिहास समझाइए`],
      pilgrim: [`What is the spiritual meaning of the ${place}, and how should I visit?`, `${place} का आध्यात्मिक महत्व क्या है और वहाँ कैसे जाएँ?`],
    };
    return isHi ? examples[id][1] : examples[id][0];
  };

  // Changing the style re-asks the last question in it, so the change shows at once
  const handlePersonaChange = (next: PersonaType) => {
    if (next === persona) return;
    onChangePersona(next);
    if (loadingRef.current) {
      // an answer is on its way: re-ask in the new style as soon as it arrives
      pendingStyleRef.current = next;
      return;
    }
    const lastQuestion = [...messages].reverse().find((m) => m.role === 'user');
    if (lastQuestion) void sendQuestion(lastQuestion.text, undefined, next);
  };

  return (
    <div className="guide-layout">
      <div className="photo-banner">
        <img src={bannerSrc} alt="" aria-hidden="true" />
        <div className="guide-banner">
          <span className="guide-banner__eyebrow">
            <span className="dot-live" />
            {greetingSub}
          </span>
          <h2>{greeting}</h2>
        </div>
        <div className="guide-banner__raahi" aria-hidden="true">
          <GuideAvatar size={104} />
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
                {visibleMonuments.map((item) => {
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

            <div className="starter-chips" aria-label="Suggested questions">
              {(destinationSlug === 'agra'
                ? ui.starters
                : destConfig.copy.startersEn.map((q, idx) =>
                    tr(q, destConfig.copy.startersHi[idx] || ''),
                  )
              ).map((q) => (
                <button
                  key={q}
                  type="button"
                  className="chip-btn"
                  disabled={loading}
                  onClick={() => void sendQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="chat-stream" aria-live="polite" ref={streamRef}>
        {messages.map((turn) =>
          turn.role === 'user' ? (
            <div key={turn.id} className="chat-bubble is-user">
              {turn.styleLabel && <span className="chat-bubble__style">{turn.styleLabel}</span>}
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

              <AvatarCaption
                text={speakingId === turn.id ? spokenTextFor(turn) : turn.text}
                status={speakingId === turn.id ? (speakPlaying ? 'playing' : 'loading') : 'idle'}
                progress={speakingId === turn.id ? speakProgress : 0}
                fullTextLabel={ui.readFullText}
                size={78}
              />

              {turn.response?.itinerary_stops && turn.response.itinerary_stops.length > 0 && (
                <div className="plan-card">
                  <div className="plan-card__label">
                    <Clock size={15} />
                    {ui.itineraryHeading}
                  </div>
                  <div className="plan-timeline">
                    {turn.response.itinerary_stops.map((stop, idx) => (
                      <div key={`${stop.source_slug || stop.title}-${idx}`} className="plan-step">
                        <span className="plan-step__num">{idx + 1}</span>
                        <div className="plan-step__body">
                          <div className="plan-step__meta">
                            <span className="plan-step__time">{stop.time_slot}</span>
                            {stop.duration_min != null && (
                              <span className="plan-step__tag">{stop.duration_min} min</span>
                            )}
                            <span className={`plan-step__tag ${stop.category === 'craft' ? 'is-odop' : ''}`}>
                              {stop.category}
                            </span>
                          </div>
                          <h4>{stop.title}</h4>
                          {stop.notes && <p>{stop.notes}</p>}
                          {stop.accessibility_note && (
                            <div className="plan-step__a11y">
                              <Accessibility size={13} />
                              <span>{stop.accessibility_note}</span>
                            </div>
                          )}
                          {stop.lat != null && stop.lng != null && (
                            <a
                              className="plan-map-link"
                              href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Navigation size={13} />
                              <span>{ui.openInMaps}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {turn.response?.recommended_places && turn.response.recommended_places.length > 0 && (
                <div className="rec-section">
                  <div className="rec-section__label">
                    <UtensilsCrossed size={15} />
                    {ui.recommendedPlacesHeading}
                  </div>
                  <div className="rec-grid">
                    {turn.response.recommended_places.map((place, idx) => (
                      <div key={`${place.source_slug || place.name}-${idx}`} className="rec-card">
                        <div className="plan-step__meta">
                          <span className="plan-step__tag">{place.category}</span>
                          {place.is_odop && <span className="plan-step__tag is-odop">{ui.odopBadge}</span>}
                          {place.budget_tier && <span className="plan-step__tag">{place.budget_tier}</span>}
                          {place.is_accessible && (
                            <span className="plan-step__tag is-accessible">{ui.accessibleBadge}</span>
                          )}
                        </div>
                        <h4>{place.name}</h4>
                        {place.description && <p>{place.description}</p>}
                        <div className="rec-card__details">
                          {place.timings && (
                            <span>
                              <Clock size={12} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
                              {place.timings}
                            </span>
                          )}
                          {place.entry_fee_inr && <span>{place.entry_fee_inr}</span>}
                          {place.address && (
                            <span>
                              <MapPin size={12} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
                              {place.address}
                            </span>
                          )}
                        </div>
                        {place.lat != null && place.lng != null && (
                          <a
                            className="plan-map-link"
                            href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Navigation size={13} />
                            <span>{ui.openInMaps}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
        <div className="composer__style" ref={styleMenuRef}>
          <button
            type="button"
            className="composer__style-btn"
            aria-haspopup="true"
            aria-expanded={styleMenuOpen}
            onClick={() => setStyleMenuOpen((v) => !v)}
            title={isHi ? 'राही कैसे उत्तर दे?' : 'How should Raahi answer?'}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>{ui.personas[persona]}</span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {styleMenuOpen && (
            <div className="style-menu" role="radiogroup" aria-label={isHi ? 'राही कैसे उत्तर दे?' : 'How should Raahi answer?'}>
              <p className="style-menu__title">{isHi ? 'राही कैसे उत्तर दे?' : 'How should Raahi answer?'}</p>
              {PERSONA_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={persona === p.id}
                  className={`style-menu__item ${persona === p.id ? 'is-active' : ''}`}
                  onClick={() => {
                    handlePersonaChange(p.id);
                    setStyleMenuOpen(false);
                  }}
                >
                  <strong>{ui.personas[p.id]}</strong>
                  <span>{personaHint(p.id)}</span>
                </button>
              ))}
              {!loading && (
                <button
                  type="button"
                  className="persona-try"
                  onClick={() => {
                    setStyleMenuOpen(false);
                    void sendQuestion(personaExample(persona), undefined, persona);
                  }}
                >
                  {isHi ? 'आज़माएँ: ' : 'Try: '}“{personaExample(persona)}” →
                </button>
              )}
            </div>
          )}
        </div>
        <span className="composer__avatar" aria-hidden="true">
          <GuideAvatar variant="head" size={34} speaking={loading} />
        </span>
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
            if (voiceStatus && !recording && !transcribing) clearVoiceStatus();
          }}
          placeholder={askPlaceholder}
          aria-label={askPlaceholder}
        />
        <button type="submit" className="composer__send" disabled={!input.trim() || loading} aria-label="Send question">
          <Send size={19} />
        </button>
      </form>
    </div>
  );
}
