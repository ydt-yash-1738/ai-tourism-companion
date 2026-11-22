import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { getDestinationConfig } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { getTours, postAnalyticsEvent } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import {
  getPlaybackInfo,
  pauseSpeaking,
  resumeSpeaking,
  seekSpeaking,
  setSpeakingRate,
  speakText,
  stopSpeaking,
  type AudioPlaybackState,
} from '../services/speech';
import { stopExtras, styledStopScript } from '../data/tourStyles';
import { StyleTabs } from './StyleTabs';
import { useTranslatedTexts } from '../hooks/useTranslatedTexts';
import { translateBatchCached } from '../services/translateCache';
import type { Monument, OfflinePack, PersonaType, TourRoute } from '../types/api';
import {
  EmptyStateCard,
  ErrorStateCard,
  FallbackNoticeBanner,
  LoadingStateCard,
  SkeletonCards,
} from './ApiStateCard';
import { AvatarCaption } from './AvatarCaption';
import { LeafletMap, type MapPinItem } from './LeafletMap';

interface TourTabProps {
  destinationSlug: string;
  language: string;
  persona: PersonaType;
  isOnline: boolean;
  sessionHash: string;
  userCoords: { lat: number; lng: number } | null;
  monuments: Monument[];
  offlinePack: OfflinePack | null;
  onChangePersona: (p: PersonaType) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];
const STYLE_ORDER: PersonaType[] = ['quick', 'kids', 'scholar', 'pilgrim'];
const SPEED_KEY = 'up_tour_speed';
const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function TourTab({
  destinationSlug,
  language,
  persona,
  isOnline,
  sessionHash,
  userCoords,
  monuments,
  offlinePack,
  onChangePersona,
}: TourTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];
  const needsDynamicTranslate = baseLang !== 'en' && baseLang !== 'hi';
  const destConfig = getDestinationConfig(destinationSlug);

  const [maxMinutes, setMaxMinutes] = useState<number | undefined>(undefined);
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [liveRoutes, setLiveRoutes] = useState<TourRoute[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [activeStopIdx, setActiveStopIdx] = useState<number>(0);
  const [audioStatus, setAudioStatus] = useState<AudioPlaybackState>('idle');
  const [audioProgress, setAudioProgress] = useState(0);
  // music-app style player: pause, speed, clock (cloud audio is seekable)
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(SPEED_KEY));
      return SPEEDS.includes(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  const [clock, setClock] = useState<{ cur: number; dur: number; kind: 'cloud' | 'device' | 'none' }>({
    cur: 0,
    dur: 0,
    kind: 'none',
  });
  const playTokenRef = useRef(0);
  // where in the text the current narration started (0..1), when resumed part-way
  const [startOffset, setStartOffset] = useState(0);
  // while the progress bar is being dragged: the position under the finger (seek on release)
  const [dragAt, setDragAt] = useState<number | null>(null);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translationSettledKey, setTranslationSettledKey] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const offlineRoutes = useMemo(() => {
    return (offlinePack?.tour_routes || []).filter((r) => {
      if (maxMinutes && r.duration_minutes > maxMinutes) return false;
      if (stepFreeOnly && !r.step_free) return false;
      return true;
    });
  }, [offlinePack, maxMinutes, stepFreeOnly]);

  const reqKey = isOnline ? `${destinationSlug}|${maxMinutes ?? 'all'}|${stepFreeOnly}|${retryCount}` : null;
  const loading = Boolean(reqKey && settledKey !== reqKey);

  useEffect(() => {
    if (!reqKey) return;
    let active = true;
    getTours(destinationSlug, { maxMinutes, stepFreeOnly })
      .then((res) => {
        if (!active) return;
        setLiveRoutes(res);
        setApiError(null);
        setSettledKey(reqKey);
      })
      .catch((err) => {
        if (!active) return;
        setApiError(err instanceof Error ? err.message : ui.serverErrorDesc);
        setSettledKey(reqKey);
      });
    return () => {
      active = false;
    };
  }, [reqKey, destinationSlug, maxMinutes, stepFreeOnly, ui.serverErrorDesc]);

  const routes = isOnline && !apiError ? liveRoutes : offlineRoutes;

  const activeRoute = useMemo(() => {
    if (!routes.length) return null;
    return routes.find((r) => r.slug === selectedSlug) || routes[0];
  }, [routes, selectedSlug]);

  const stops = useMemo(() => activeRoute?.stops ?? [], [activeRoute]);
  const currentStop = stops[activeStopIdx] || stops[0] || null;

  const translationReqKey = useMemo(() => {
    if (!needsDynamicTranslate || routes.length === 0) return null;
    return `${baseLang}|${routes.map((r) => r.slug).join(',')}|${activeRoute?.slug ?? ''}`;
  }, [needsDynamicTranslate, baseLang, routes, activeRoute]);

  const translating = Boolean(
    translationReqKey && translationSettledKey !== translationReqKey,
  );

  // Batch-translate route titles, stop names, tips, and audio scripts for non-EN/HI languages
  useEffect(() => {
    if (!translationReqKey) return;

    let active = true;
    const rawStrings: string[] = [];
    routes.forEach((r) => rawStrings.push(r.title));
    stops.forEach((s) => {
      rawStrings.push(s.monument_name, s.audio_script_en);
      if (s.accessibility_tip) rawStrings.push(s.accessibility_tip);
    });

    const unique = Array.from(new Set(rawStrings.filter(Boolean))).slice(0, 40);
    if (!unique.length) return;

    translateBatchCached(unique, baseLang)
      .then((translated) => {
        if (!active) return;
        const next: Record<string, string> = {};
        unique.forEach((orig, idx) => {
          next[`${baseLang}::${orig}`] = translated[idx] || orig;
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
  }, [translationReqKey, baseLang, routes, stops]);

  const tr = (enText: string, hiText = ''): string => {
    if (isHi && hiText) return hiText;
    if (needsDynamicTranslate) {
      return translatedMap[`${baseLang}::${enText}`] || enText;
    }
    return enText;
  };

  const monumentBySlug = useMemo(
    () => new Map(monuments.map((m) => [m.slug, m])),
    [monuments],
  );

  const mapPins: MapPinItem[] = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s, idx) => ({
      id: String(idx),
      label: String(s.order),
      title: tr(s.monument_name, s.monument_name_hi),
      subtitle: `${s.duration_min} min${s.step_free ? ' · Step-free' : ''}`,
      lat: s.lat!,
      lng: s.lng!,
      variant: idx === activeStopIdx ? 'active' : s.step_free ? 'accessible' : 'default',
    }));

  const polyline = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s): [number, number] => [s.lat!, s.lng!]);

  const handleSelectRoute = (route: TourRoute) => {
    stopSpeaking();
    setAudioStatus('idle');
    setSelectedSlug(route.slug);
    setActiveStopIdx(0);
    if (isOnline) {
      postAnalyticsEvent({
        destination_slug: destinationSlug,
        event_type: 'tour_start',
        session_hash: sessionHash,
        language,
        persona,
        query_topic: route.slug,
      }).catch(() => undefined);
    }
  };

  const handleSelectStop = (idx: number) => {
    playTokenRef.current += 1;
    stopSpeaking();
    setAudioStatus('idle');
    setPaused(false);
    setAudioProgress(0);
    setClock({ cur: 0, dur: 0, kind: 'none' });
    setActiveStopIdx(idx);
    const stop = stops[idx];
    if (stop && isOnline) {
      postAnalyticsEvent({
        destination_slug: destinationSlug,
        event_type: 'spot_visit',
        session_hash: sessionHash,
        language,
        persona,
        monument_slug: stop.monument_slug,
        query_topic: 'Audio tour stop visited',
      }).catch(() => undefined);
    }
  };

  // What Raahi reads here, in the chosen style (static texts for the tour)
  // Other languages: all four style versions of this stop translated in one go
  // by the backend translator, so switching style stays in the visitor's language.
  // the monument's history, legends and etiquette from the destination's content pack
  const extras = useMemo(
    () => stopExtras(offlinePack, currentStop?.monument_slug ?? ''),
    [offlinePack, currentStop],
  );
  const englishVariants = useMemo(
    () =>
      currentStop
        ? STYLE_ORDER.map((st) =>
            styledStopScript(
              {
                monumentSlug: currentStop.monument_slug,
                scriptEn: currentStop.audio_script_en,
                scriptHi: currentStop.audio_script_hi,
              },
              st,
              false,
              extras,
            ),
          )
        : [],
    [currentStop, extras],
  );
  const translatedVariants = useTranslatedTexts(englishVariants, language);

  const scriptFor = (style: PersonaType): { text: string; english: boolean } => {
    if (!currentStop) return { text: '', english: true };
    if (needsDynamicTranslate) {
      const text = translatedVariants.texts[STYLE_ORDER.indexOf(style)] ?? '';
      // if the translation is not in yet, the voice translates as it speaks
      return { text, english: !translatedVariants.ready };
    }
    const stop = {
      monumentSlug: currentStop.monument_slug,
      scriptEn: currentStop.audio_script_en,
      scriptHi: currentStop.audio_script_hi,
    };
    return { text: styledStopScript(stop, style, isHi, extras), english: !isHi };
  };
  const currentScript = scriptFor(persona);
  // rough length when the voice gives no timing (built-in speech): ~14 characters a second
  const estimatedSeconds = currentScript.text.length / 14 / speed;

  /** Narrate this stop in a style, optionally starting part-way (0..1) through the text. */
  const playStop = async (style: PersonaType = persona, from = 0) => {
    if (!currentStop) return;
    const { text, english } = scriptFor(style);
    // start at a word boundary at or after the requested point
    let cut = 0;
    if (from > 0.01) {
      const at = Math.floor(Math.min(0.98, from) * text.length);
      const space = text.indexOf(' ', at);
      cut = space > 0 ? space + 1 : at;
    }
    const offset = text.length ? cut / text.length : 0;
    const token = ++playTokenRef.current;
    stopSpeaking();
    setPaused(false);
    setStartOffset(offset);
    setAudioProgress(offset);
    setClock({ cur: 0, dur: 0, kind: 'none' });
    await speakText(text.slice(cut), language, (state) => {
      if (token === playTokenRef.current) setAudioStatus(state);
    }, {
      autoTranslate: needsDynamicTranslate && english,
      onProgress: (p) => {
        if (token === playTokenRef.current) setAudioProgress(offset + p * (1 - offset));
      },
      rate: speed,
    });
  };

  const handlePlayPause = () => {
    if (audioStatus === 'idle') {
      void playStop();
      return;
    }
    if (audioStatus === 'loading') return;
    if (paused) {
      resumeSpeaking();
      setPaused(false);
    } else if (pauseSpeaking()) {
      setPaused(true);
    } else {
      // this voice cannot pause: stop instead
      playTokenRef.current += 1;
      stopSpeaking();
      setAudioStatus('idle');
    }
  };

  // overall position through this stop's text, 0..1
  const overallFraction = (): number => {
    const info = getPlaybackInfo();
    if (info.kind === 'cloud' && info.duration > 0) {
      return startOffset + (info.current / info.duration) * (1 - startOffset);
    }
    return audioStatus === 'idle' ? 0 : audioProgress;
  };

  const handleSeek = (fraction: number) => {
    const info = getPlaybackInfo();
    // within the clip that is playing: jump in the audio itself
    if (info.kind === 'cloud' && info.duration > 0 && fraction >= startOffset) {
      seekSpeaking(((fraction - startOffset) / (1 - startOffset || 1)) * info.duration);
      return;
    }
    // otherwise (built-in voice, or before this clip's start): restart from that point
    void playStop(persona, fraction);
  };

  const handleSkip = (seconds: number) => {
    const total = clock.kind === 'cloud' && clock.dur > 0 ? clock.dur / (1 - startOffset || 1) : estimatedSeconds;
    const next = Math.min(0.99, Math.max(0, overallFraction() + seconds / Math.max(1, total)));
    handleSeek(next);
  };

  const handleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    try {
      localStorage.setItem(SPEED_KEY, String(next));
    } catch {
      // not remembered on this device; still applies now
    }
    if (audioStatus === 'playing' && !setSpeakingRate(next)) {
      // built-in voices cannot change speed mid-sentence: restart this stop at the new speed
      void (async () => {
        await Promise.resolve();
        void playStop();
      })();
    }
  };

  // Changing the style while Raahi is reading restarts this stop in the new style
  const handleStyle = (next: PersonaType) => {
    onChangePersona(next);
    if (audioStatus !== 'idle') void playStop(next);
  };

  // keep the clock moving while audio plays
  useEffect(() => {
    if (audioStatus !== 'playing') return;
    const id = window.setInterval(() => {
      const info = getPlaybackInfo();
      setClock({ cur: info.current, dur: info.duration, kind: info.kind });
    }, 250);
    return () => window.clearInterval(id);
  }, [audioStatus]);

  const nearbyStopMatch = useMemo(() => {
    if (!userCoords) return null;
    const idx = stops.findIndex(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        haversineMeters(userCoords.lat, userCoords.lng, s.lat, s.lng) <=
          Math.max(45, s.geofence_radius_m),
    );
    return idx >= 0 ? idx : null;
  }, [userCoords, stops]);

  const hasActiveFilters = maxMinutes !== undefined || stepFreeOnly;

  const durationOptions = [
    { label: ui.anyTime, value: '', mins: undefined as number | undefined },
    { label: '≤ 30 min', value: '30', mins: 30 as number | undefined },
    { label: '≤ 1 hr', value: '60', mins: 60 as number | undefined },
    { label: '3 hr', value: '180', mins: 180 as number | undefined },
  ];

  return (
    <div className="tab-panel">
      <div className="section-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
              {ui.tourHeading}
            </h2>
            <p style={{ margin: '4px 0 12px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              {ui.tourSub}
            </p>
          </div>
          {translating && (
            <span className="translating-pill" role="status">
              <Loader2 size={13} className="spin-icon" />
              <span>{ui.translating}</span>
            </span>
          )}
        </div>

        <div className="mobile-only-controls mobile-filter-stack">
          <div className="mobile-filter-row">
            <select
              className="lang-select"
              style={{ flex: '1 1 130px' }}
              value={maxMinutes ? String(maxMinutes) : ''}
              onChange={(e) => {
                const val = e.target.value;
                setMaxMinutes(val ? Number(val) : undefined);
                setActiveStopIdx(0);
              }}
              aria-label="Filter tour duration"
            >
              {durationOptions.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`pill-btn ${stepFreeOnly ? 'is-emerald' : ''}`}
              onClick={() => {
                setStepFreeOnly((v) => !v);
                setActiveStopIdx(0);
              }}
            >
              <Accessibility size={15} />
              <span>{ui.stepFreeOnly}</span>
            </button>
          </div>

          {!loading && routes.length > 0 && (
            <select
              className="lang-select is-full-width"
              value={activeRoute?.slug || ''}
              onChange={(e) => {
                const chosen = routes.find((r) => r.slug === e.target.value);
                if (chosen) handleSelectRoute(chosen);
              }}
              aria-label="Choose walking tour route"
            >
              {routes.map((route) => (
                <option key={route.slug} value={route.slug}>
                  {tr(route.title, route.title_hi)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="desktop-only-controls">
          <div className="filter-row" style={{ marginBottom: !loading && routes.length > 0 ? 12 : 0 }}>
            {durationOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`pill-btn ${maxMinutes === opt.mins ? 'is-active' : ''}`}
                onClick={() => {
                  setMaxMinutes(opt.mins);
                  setActiveStopIdx(0);
                }}
              >
                <Clock size={14} />
                <span>{opt.label}</span>
              </button>
            ))}

            <button
              type="button"
              className={`pill-btn ${stepFreeOnly ? 'is-emerald' : ''}`}
              onClick={() => {
                setStepFreeOnly((v) => !v);
                setActiveStopIdx(0);
              }}
            >
              <Accessibility size={15} />
              <span>{ui.stepFreeOnly}</span>
            </button>
          </div>

          {!loading && routes.length > 0 && (
            <div className="filter-row" style={{ marginBottom: 0 }}>
              {routes.map((route) => (
                <button
                  key={route.slug}
                  type="button"
                  className={`chip-btn ${activeRoute?.slug === route.slug ? 'is-active' : ''}`}
                  style={
                    activeRoute?.slug === route.slug
                      ? {
                          background: 'var(--saffron)',
                          color: '#fff',
                          borderColor: 'var(--saffron)',
                        }
                      : undefined
                  }
                  onClick={() => handleSelectRoute(route)}
                >
                  {tr(route.title, route.title_hi)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <LoadingStateCard message={ui.loadingTours} compact />
          <SkeletonCards variant="tour" />
        </div>
      ) : apiError && offlineRoutes.length === 0 ? (
        <ErrorStateCard
          title={ui.serverErrorTitle}
          message={ui.serverErrorDesc}
          detail={apiError}
          retryLabel={ui.retry}
          onRetry={() => setRetryCount((n) => n + 1)}
        />
      ) : (
        <>
          {apiError && offlineRoutes.length > 0 && (
            <FallbackNoticeBanner
              message={ui.offlineFallbackNotice}
              retryLabel={ui.retry}
              onRetry={() => setRetryCount((n) => n + 1)}
              variant="warning"
            />
          )}

          {activeRoute ? (
            <>
              <LeafletMap
                center={destConfig.center}
                pins={mapPins}
                polyline={polyline}
                userCoords={userCoords}
                onSelectPin={(id) => handleSelectStop(Number(id))}
              />

              {nearbyStopMatch !== null && nearbyStopMatch !== activeStopIdx && (
                <div
                  className="section-card"
                  style={{ background: 'var(--emerald-tint)', borderColor: 'var(--emerald)' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      <MapPin size={15} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                      <strong>
                        {ui.nearStopPrefix}
                        {stops[nearbyStopMatch].order} (
                        {tr(
                          stops[nearbyStopMatch].monument_name,
                          stops[nearbyStopMatch].monument_name_hi,
                        )}
                        )
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="pill-btn is-emerald"
                      onClick={() => handleSelectStop(nearbyStopMatch)}
                    >
                      {ui.jumpToStop}
                    </button>
                  </div>
                </div>
              )}

              {currentStop && (
                <div
                  className="section-card"
                  style={{ borderLeft: '5px solid var(--saffron)', background: '#fffcf7' }}
                >
                  <div className="chat-bubble__meta">
                    <span>
                      <Headphones size={14} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
                      <strong>
                        {ui.stopLabel} {currentStop.order} / {stops.length}
                      </strong>{' '}
                      · {currentStop.duration_min} min
                    </span>
                    {audioStatus === 'loading' && (
                      <span className="translating-pill" role="status">
                        <Loader2 size={13} className="spin-icon" />
                        <span>{ui.loadingAudio}</span>
                      </span>
                    )}
                    {audioStatus === 'playing' && (
                      <span className="audio-eq" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: 'calc(1.32rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
                    {tr(currentStop.monument_name, currentStop.monument_name_hi)}
                  </h3>

                  <StyleTabs value={persona} onChange={handleStyle} language={language} />

                  <div style={{ margin: '4px 0 12px' }}>
                    <AvatarCaption
                      text={currentScript.text}
                      status={audioStatus}
                      progress={audioProgress}
                      idleHint={ui.avatarIdleHint}
                      fullTextLabel={ui.readFullText}
                    />
                  </div>

                  {(() => {
                    const cloud = clock.kind === 'cloud' && clock.dur > 0;
                    // whole-stop length: a clip that started part-way covers only the rest
                    const total = cloud ? clock.dur / (1 - startOffset || 1) : estimatedSeconds;
                    const fraction = cloud
                      ? startOffset + (clock.cur / clock.dur) * (1 - startOffset)
                      : audioStatus === 'idle'
                        ? 0
                        : audioProgress;
                    const shown = dragAt ?? fraction;
                    const elapsed = shown * total;
                    const commitDrag = () => {
                      if (dragAt === null) return;
                      handleSeek(dragAt);
                      setDragAt(null);
                    };
                    const busy = audioStatus === 'loading';
                    const isPlaying = audioStatus === 'playing' && !paused;
                    return (
                      <div className="tour-player">
                        <div className="tour-player__bar">
                          <span className="tour-player__time">{fmtTime(elapsed)}</span>
                          <input
                            type="range"
                            min={0}
                            max={1000}
                            value={Math.round(Math.min(1, Math.max(0, shown)) * 1000)}
                            onChange={(e) => setDragAt(Number(e.target.value) / 1000)}
                            onPointerUp={commitDrag}
                            onTouchEnd={commitDrag}
                            onKeyUp={commitDrag}
                            onBlur={commitDrag}
                            disabled={!currentScript.text || busy}
                            style={{ ['--fill' as string]: `${Math.min(100, shown * 100)}%` }}
                            aria-label={isHi ? 'ऑडियो में आगे-पीछे जाएँ' : 'Seek in narration'}
                          />
                          <span className="tour-player__time">
                            {cloud ? '' : '~'}
                            {fmtTime(total)}
                          </span>
                        </div>
                        <div className="tour-player__controls">
                          <button
                            type="button"
                            className="tour-player__btn"
                            disabled={activeStopIdx <= 0}
                            onClick={() => handleSelectStop(activeStopIdx - 1)}
                            aria-label={ui.prevStop}
                            title={ui.prevStop}
                          >
                            <SkipBack size={18} />
                          </button>
                          <button
                            type="button"
                            className="tour-player__btn"
                            disabled={busy || audioStatus === 'idle'}
                            onClick={() => handleSkip(-10)}
                            aria-label={isHi ? '10 सेकंड पीछे' : 'Back 10 seconds'}
                            title={isHi ? '10 सेकंड पीछे' : 'Back 10 seconds'}
                          >
                            <RotateCcw size={18} />
                            <small>10</small>
                          </button>
                          <button
                            type="button"
                            className={`tour-player__play ${busy ? 'is-loading' : ''}`}
                            onClick={handlePlayPause}
                            aria-label={busy ? ui.loadingAudio : isPlaying ? (isHi ? 'रोकें' : 'Pause') : ui.playAudioStory}
                          >
                            {busy ? <Loader2 size={24} className="spin-icon" /> : isPlaying ? <Pause size={24} /> : <Play size={24} />}
                          </button>
                          <button
                            type="button"
                            className="tour-player__btn"
                            disabled={busy || audioStatus === 'idle'}
                            onClick={() => handleSkip(10)}
                            aria-label={isHi ? '10 सेकंड आगे' : 'Forward 10 seconds'}
                            title={isHi ? '10 सेकंड आगे' : 'Forward 10 seconds'}
                          >
                            <RotateCw size={18} />
                            <small>10</small>
                          </button>
                          <button
                            type="button"
                            className="tour-player__btn"
                            disabled={activeStopIdx >= stops.length - 1}
                            onClick={() => handleSelectStop(activeStopIdx + 1)}
                            aria-label={ui.nextStop}
                            title={ui.nextStop}
                          >
                            <SkipForward size={18} />
                          </button>
                          <button
                            type="button"
                            className="tour-player__speed"
                            onClick={handleSpeed}
                            aria-label={isHi ? `गति ${speed}x, बदलें` : `Speed ${speed}x, change`}
                            title={isHi ? 'आवाज़ की गति' : 'Playback speed'}
                          >
                            {speed}×
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="tour-stop-list">
                {stops.map((stop, idx) => {
                  const monument = monumentBySlug.get(stop.monument_slug);
                  return (
                    <div
                      key={`${stop.order}-${stop.monument_slug}`}
                      className={`tour-stop ${idx === activeStopIdx ? 'is-current' : ''}`}
                    >
                      <div className="tour-stop__head">
                        <div>
                          <strong>
                            {stop.order}. {tr(stop.monument_name, stop.monument_name_hi)}
                          </strong>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {stop.duration_min} min · {stop.step_free ? 'Step-Free' : 'Includes Stairs'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pill-btn ${idx === activeStopIdx ? 'is-active' : ''}`}
                          style={{ minHeight: 36, padding: '5px 12px' }}
                          onClick={() => handleSelectStop(idx)}
                        >
                          {idx === activeStopIdx ? <CheckCircle2 size={15} /> : null}
                          <span>{idx === activeStopIdx ? 'Active' : 'Select'}</span>
                        </button>
                      </div>

                      {stop.accessibility_tip && (
                        <div className="tour-stop__a11y">
                          <Accessibility size={14} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
                          {tr(stop.accessibility_tip)}
                          {monument?.rest_points.length
                            ? ` · Rest point: ${monument.rest_points[0]}`
                            : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyStateCard
              message={ui.noToursMatched}
              actionLabel={hasActiveFilters ? ui.resetFilters : undefined}
              onAction={
                hasActiveFilters
                  ? () => {
                      setMaxMinutes(undefined);
                      setStepFreeOnly(false);
                      setActiveStopIdx(0);
                    }
                  : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}
