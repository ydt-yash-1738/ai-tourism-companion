import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Loader2,
  MapPin,
  Play,
  Square,
} from 'lucide-react';
import { getDestinationConfig } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { getTours, postAnalyticsEvent } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import { speakText, stopSpeaking, type AudioPlaybackState } from '../services/speech';
import { translateBatchCached } from '../services/translateCache';
import type { Monument, OfflinePack, PersonaType, TourRoute } from '../types/api';
import {
  EmptyStateCard,
  ErrorStateCard,
  FallbackNoticeBanner,
  LoadingStateCard,
  SkeletonCards,
} from './ApiStateCard';
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
}

export function TourTab({
  destinationSlug,
  language,
  persona,
  isOnline,
  sessionHash,
  userCoords,
  monuments,
  offlinePack,
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
    stopSpeaking();
    setAudioStatus('idle');
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

  const handlePlayStop = async () => {
    if (!currentStop) return;
    if (audioStatus !== 'idle') {
      stopSpeaking();
      setAudioStatus('idle');
      return;
    }
    const localizedScript = tr(currentStop.audio_script_en, currentStop.audio_script_hi);
    const notTranslatedYet =
      needsDynamicTranslate && localizedScript === currentStop.audio_script_en;

    await speakText(
      localizedScript,
      language,
      (state) => setAudioStatus(state),
      { autoTranslate: notTranslatedYet },
    );
  };

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

                  <p style={{ margin: '8px 0 12px', lineHeight: 1.62 }}>
                    {tr(currentStop.audio_script_en, currentStop.audio_script_hi)}
                  </p>

                  <div className="filter-row" style={{ marginBottom: 0 }}>
                    <button
                      type="button"
                      className="pill-btn"
                      disabled={activeStopIdx <= 0}
                      onClick={() => handleSelectStop(activeStopIdx - 1)}
                    >
                      <ChevronLeft size={16} />
                      <span>{ui.prevStop}</span>
                    </button>

                    <button
                      type="button"
                      className={`pill-btn ${
                        audioStatus === 'loading' ? 'is-audio-loading' : 'is-saffron'
                      }`}
                      onClick={handlePlayStop}
                    >
                      {audioStatus === 'loading' ? (
                        <Loader2 size={15} className="spin-icon" />
                      ) : audioStatus === 'playing' ? (
                        <Square size={15} />
                      ) : (
                        <Play size={15} />
                      )}
                      <span>
                        {audioStatus === 'loading'
                          ? ui.loadingAudio
                          : audioStatus === 'playing'
                            ? ui.stopAudio
                            : ui.playAudioStory}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="pill-btn"
                      disabled={activeStopIdx >= stops.length - 1}
                      onClick={() => handleSelectStop(activeStopIdx + 1)}
                    >
                      <span>{ui.nextStop}</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
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
