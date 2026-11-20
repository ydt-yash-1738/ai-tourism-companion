import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  MapPin,
  Play,
  Square,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
import { getTours, postAnalyticsEvent } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import { speakText, stopSpeaking } from '../services/speech';
import { translateBatchCached } from '../services/translateCache';
import type { Monument, OfflinePack, PersonaType, TourRoute } from '../types/api';
import { LeafletMap, type MapPinItem } from './LeafletMap';

interface TourTabProps {
  language: string;
  persona: PersonaType;
  isOnline: boolean;
  sessionHash: string;
  userCoords: { lat: number; lng: number } | null;
  monuments: Monument[];
  offlinePack: OfflinePack | null;
}

export function TourTab({
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

  const [maxMinutes, setMaxMinutes] = useState<number | undefined>(undefined);
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [routes, setRoutes] = useState<TourRoute[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [activeStopIdx, setActiveStopIdx] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const filterLocally = () => {
      const list = (offlinePack?.tour_routes || []).filter((r) => {
        if (maxMinutes && r.duration_minutes > maxMinutes) return false;
        if (stepFreeOnly && !r.step_free) return false;
        return true;
      });
      setRoutes(list);
    };

    if (!isOnline) {
      filterLocally();
      return;
    }

    getTours('agra', { maxMinutes, stepFreeOnly })
      .then((res) => setRoutes(res))
      .catch(() => filterLocally());
  }, [maxMinutes, stepFreeOnly, isOnline, offlinePack]);

  const activeRoute = useMemo(() => {
    if (!routes.length) return null;
    return routes.find((r) => r.slug === selectedSlug) || routes[0];
  }, [routes, selectedSlug]);

  const stops = useMemo(() => activeRoute?.stops ?? [], [activeRoute]);
  const currentStop = stops[activeStopIdx] || stops[0] || null;

  // Batch-translate route titles, stop names, tips, and audio scripts for non-EN/HI languages
  useEffect(() => {
    if (!needsDynamicTranslate || routes.length === 0) return;

    let active = true;
    const rawStrings: string[] = [];
    routes.forEach((r) => rawStrings.push(r.title));
    stops.forEach((s) => {
      rawStrings.push(s.monument_name, s.audio_script_en);
      if (s.accessibility_tip) rawStrings.push(s.accessibility_tip);
    });

    const unique = Array.from(new Set(rawStrings.filter(Boolean))).slice(0, 40);
    if (!unique.length) return;

    translateBatchCached(unique, baseLang).then((translated) => {
      if (!active) return;
      const next: Record<string, string> = {};
      unique.forEach((orig, idx) => {
        next[`${baseLang}::${orig}`] = translated[idx] || orig;
      });
      setTranslatedMap((prev) => ({ ...prev, ...next }));
    });

    return () => {
      active = false;
    };
  }, [needsDynamicTranslate, baseLang, routes, stops]);

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
    setPlaying(false);
    setSelectedSlug(route.slug);
    setActiveStopIdx(0);
    if (isOnline) {
      postAnalyticsEvent({
        destination_slug: 'agra',
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
    setPlaying(false);
    setActiveStopIdx(idx);
    const stop = stops[idx];
    if (stop && isOnline) {
      postAnalyticsEvent({
        destination_slug: 'agra',
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
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    const localizedScript = tr(currentStop.audio_script_en, currentStop.audio_script_hi);
    const notTranslatedYet =
      needsDynamicTranslate && localizedScript === currentStop.audio_script_en;

    setPlaying(true);
    await speakText(
      localizedScript,
      language,
      (active) => {
        if (!active) setPlaying(false);
      },
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

  return (
    <div className="tab-panel">
      <div className="section-card">
        <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
          {ui.tourHeading}
        </h2>
        <p style={{ margin: '4px 0 12px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
          {ui.tourSub}
        </p>

        <div className="filter-row">
          {[
            { label: ui.anyTime, mins: undefined },
            { label: '≤ 30 min', mins: 30 },
            { label: '≤ 1 hr', mins: 60 },
            { label: '3 hr', mins: 180 },
          ].map((opt) => (
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
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }
                  : { whiteSpace: 'nowrap', flexShrink: 0 }
              }
              onClick={() => handleSelectRoute(route)}
            >
              {tr(route.title, route.title_hi)}
            </button>
          ))}
        </div>
      </div>

      {activeRoute ? (
        <>
          <LeafletMap
            center={[27.1751, 78.0421]}
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
                {playing && (
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

                <button type="button" className="pill-btn is-saffron" onClick={handlePlayStop}>
                  {playing ? <Square size={15} /> : <Play size={15} />}
                  <span>{playing ? ui.stopAudio : ui.playAudioStory}</span>
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
        <div className="section-card">{ui.noToursMatched}</div>
      )}
    </div>
  );
}
