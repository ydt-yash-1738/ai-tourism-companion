import { useEffect, useMemo, useState } from 'react';
import { Award, Clock, IndianRupee, Loader2, MapPin, Navigation, Square, Volume2 } from 'lucide-react';
import { getNearbyMedia } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { getNearbyPlaces } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import { speakText, stopSpeaking } from '../services/speech';
import { translateBatchCached } from '../services/translateCache';
import type { NearbyPlace, OfflinePack } from '../types/api';
import {
  EmptyStateCard,
  ErrorStateCard,
  FallbackNoticeBanner,
  LoadingStateCard,
  SkeletonCards,
} from './ApiStateCard';

interface NearbyTabProps {
  destinationSlug: string;
  language: string;
  isOnline: boolean;
  userCoords: { lat: number; lng: number } | null;
  offlinePack: OfflinePack | null;
}

const INTEREST_KEYS: Array<'heritage' | 'crafts' | 'food' | 'shopping'> = [
  'heritage',
  'crafts',
  'food',
  'shopping',
];

const GROUP_KEYS = ['', 'family', 'kids', 'elderly', 'solo'];

export function NearbyTab({
  destinationSlug,
  language,
  isOnline,
  userCoords,
  offlinePack,
}: NearbyTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];
  const needsDynamicTranslate = baseLang !== 'en' && baseLang !== 'hi';

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [group, setGroup] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [odopOnly, setOdopOnly] = useState(false);
  const [livePlaces, setLivePlaces] = useState<NearbyPlace[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translationSettledKey, setTranslationSettledKey] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [audioState, setAudioState] = useState<{
    slug: string;
    status: 'loading' | 'playing';
  } | null>(null);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const interestsParam = selectedInterests.length ? selectedInterests.join(',') : undefined;

  const offlinePlaces = useMemo(() => {
    return (offlinePack?.nearby_places || [])
      .filter((p) => {
        if (odopOnly && !p.is_odop) return false;
        if (group && !p.suitable_for.includes(group)) return false;
        if (budget === 'free' && p.budget_tier !== 'free') return false;
        if (budget === 'low' && !['free', 'low'].includes(p.budget_tier)) return false;
        if (
          selectedInterests.length &&
          !selectedInterests.some((i) => p.interests.includes(i) || p.category === i)
        ) {
          return false;
        }
        return true;
      })
      .map((p) => ({
        ...p,
        distance_meters: userCoords
          ? haversineMeters(userCoords.lat, userCoords.lng, p.lat, p.lng)
          : null,
      }));
  }, [offlinePack, odopOnly, group, budget, selectedInterests, userCoords]);

  const reqKey = isOnline
    ? `${destinationSlug}|${interestsParam ?? ''}|${budget}|${group}|${odopOnly}|${userCoords?.lat ?? 'x'}|${userCoords?.lng ?? 'x'}|${retryCount}`
    : null;
  const loading = Boolean(reqKey && settledKey !== reqKey);

  useEffect(() => {
    if (!reqKey) return;
    let active = true;
    getNearbyPlaces(destinationSlug, {
      interests: interestsParam,
      budget: budget || undefined,
      group: group || undefined,
      odopOnly,
      lat: userCoords?.lat,
      lng: userCoords?.lng,
    })
      .then((res) => {
        if (!active) return;
        setLivePlaces(res);
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
  }, [reqKey, destinationSlug, interestsParam, budget, group, odopOnly, userCoords, ui.serverErrorDesc]);

  const places = isOnline && !apiError ? livePlaces : offlinePlaces;

  const translationReqKey = useMemo(() => {
    if (!needsDynamicTranslate || places.length === 0) return null;
    return `${baseLang}|${places.map((p) => p.slug).join(',')}`;
  }, [needsDynamicTranslate, baseLang, places]);

  const translating = Boolean(
    translationReqKey && translationSettledKey !== translationReqKey,
  );

  useEffect(() => {
    if (!translationReqKey) return;

    let active = true;
    const raw = places.flatMap((p) => [p.name, p.description, p.how_to_reach]);
    const unique = Array.from(new Set(raw.filter(Boolean))).slice(0, 30);
    if (!unique.length) return;

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
  }, [translationReqKey, baseLang, places]);

  const tr = (enText: string, hiText = ''): string => {
    if (isHi && hiText) return hiText;
    if (needsDynamicTranslate) {
      return translatedMap[`${baseLang}::${enText}`] || enText;
    }
    return enText;
  };

  const handleReadAloud = async (place: NearbyPlace, title: string, desc: string) => {
    if (audioState?.slug === place.slug) {
      stopSpeaking();
      setAudioState(null);
      return;
    }
    await speakText(
      `${title}. ${desc}`,
      language,
      (state) => {
        setAudioState(state === 'idle' ? null : { slug: place.slug, status: state });
      },
      { autoTranslate: needsDynamicTranslate && title === place.name },
    );
  };

  const markImageLoaded = (slug: string) => {
    setLoadedImages((prev) => (prev[slug] ? prev : { ...prev, [slug]: true }));
  };

  const hasActiveFilters = Boolean(selectedInterests.length || group || budget || odopOnly);

  const resetFilters = () => {
    setSelectedInterests([]);
    setGroup('');
    setBudget('');
    setOdopOnly(false);
  };

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
              {ui.nearbyHeading}
            </h2>
            <p style={{ margin: '4px 0 12px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              {ui.nearbySub}
            </p>
          </div>
          {translating && (
            <span className="translating-pill" role="status">
              <Loader2 size={13} className="spin-icon" />
              <span>{ui.translating}</span>
            </span>
          )}
        </div>

        <div className="filter-row">
          {INTEREST_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`pill-btn ${selectedInterests.includes(key) ? 'is-active' : ''}`}
              onClick={() => toggleInterest(key)}
            >
              {ui.interests[key]}
            </button>
          ))}

          <button
            type="button"
            className={`pill-btn ${odopOnly ? 'is-emerald' : ''}`}
            onClick={() => setOdopOnly((v) => !v)}
          >
            <Award size={15} />
            <span>{ui.odopOnly}</span>
          </button>
        </div>

        <div className="filter-row" style={{ marginBottom: 0 }}>
          <select
            className="lang-select"
            style={{ flex: '1 1 145px', minWidth: 0 }}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-label="Who are you travelling with"
          >
            {GROUP_KEYS.map((key) => (
              <option key={key || 'all'} value={key}>
                {ui.groups[key] || key}
              </option>
            ))}
          </select>

          <select
            className="lang-select"
            style={{ flex: '1 1 145px', minWidth: 0 }}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            aria-label="Budget preference"
          >
            <option value="">{ui.budgetAny}</option>
            <option value="free">{ui.budgetFree}</option>
            <option value="low">{ui.budgetLow}</option>
            <option value="medium">{ui.budgetMed}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <LoadingStateCard message={ui.loadingNearby} compact />
          <SkeletonCards count={4} variant="card" />
        </div>
      ) : apiError && offlinePlaces.length === 0 ? (
        <ErrorStateCard
          title={ui.serverErrorTitle}
          message={ui.serverErrorDesc}
          detail={apiError}
          retryLabel={ui.retry}
          onRetry={() => setRetryCount((n) => n + 1)}
        />
      ) : (
        <>
          {apiError && offlinePlaces.length > 0 && (
            <FallbackNoticeBanner
              message={ui.offlineFallbackNotice}
              retryLabel={ui.retry}
              onRetry={() => setRetryCount((n) => n + 1)}
              variant="warning"
            />
          )}

          {places.length === 0 ? (
            <EmptyStateCard
              message={ui.noNearbyMatched}
              actionLabel={hasActiveFilters ? ui.resetFilters : undefined}
              onAction={hasActiveFilters ? resetFilters : undefined}
            />
          ) : (
            <div className="cards-grid">
              {places.map((place) => {
                const title = tr(place.name, place.name_hi);
                const desc = tr(place.description, place.description_hi);
                const reach = tr(place.how_to_reach);
                const media = getNearbyMedia(place.slug, destinationSlug);
                const isLoaded = Boolean(loadedImages[place.slug]);
                const cardAudioStatus = audioState?.slug === place.slug ? audioState.status : 'idle';

                return (
                  <article key={place.slug} className="info-card has-media">
                    <div className="info-card__media">
                      <img
                        className={`info-card__img ${isLoaded ? 'is-loaded' : ''}`}
                        src={media.image}
                        alt={media.alt}
                        style={{ objectPosition: media.objectPosition }}
                        loading="lazy"
                        onLoad={() => markImageLoaded(place.slug)}
                        onError={() => markImageLoaded(place.slug)}
                      />
                      <div className="info-card__media-scrim" aria-hidden="true" />
                      <div className="info-card__media-top">
                        <div className="info-card__media-badges">
                          <span className="info-card__tag is-saffron">
                            {place.category.toUpperCase()}
                          </span>
                          {place.is_odop && (
                            <span className="info-card__tag is-odop">
                              <Award size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                              {place.odop_product || 'UP ODOP Craft'}
                            </span>
                          )}
                        </div>
                        {place.distance_meters != null && (
                          <span className="info-card__tag is-glass">
                            {(place.distance_meters / 1000).toFixed(1)} km
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="info-card__body">
                      <h3 style={{ fontSize: 'calc(1.22rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
                        {title}
                      </h3>

                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        {desc}
                      </p>

                      <div className="info-card__meta-list">
                        <span>
                          <Clock size={13} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                          <strong>{ui.timingsLabel}</strong> {place.timings} (~{place.estimated_time_min}{' '}
                          min)
                        </span>
                        <span>
                          <IndianRupee size={13} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                          <strong>{ui.feeLabel}</strong> {place.entry_fee_inr}
                        </span>
                        <span>
                          <MapPin size={13} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                          <strong>{ui.reachLabel}</strong> {reach}
                        </span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--navy)' }}>
                          {ui.sourceLabel}
                          {place.official_source}
                        </span>
                      </div>

                      <div className="info-card__actions">
                        <button
                          type="button"
                          className={`pill-btn ${
                            cardAudioStatus === 'playing'
                              ? 'is-saffron'
                              : cardAudioStatus === 'loading'
                                ? 'is-audio-loading'
                                : ''
                          }`}
                          style={{ minHeight: 38, padding: '6px 12px', fontSize: '0.82rem' }}
                          onClick={() => handleReadAloud(place, title, desc)}
                        >
                          {cardAudioStatus === 'loading' ? (
                            <Loader2 size={14} className="spin-icon" />
                          ) : cardAudioStatus === 'playing' ? (
                            <Square size={13} />
                          ) : (
                            <Volume2 size={14} />
                          )}
                          <span>
                            {cardAudioStatus === 'loading'
                              ? ui.loadingAudio
                              : cardAudioStatus === 'playing'
                                ? ui.stopAudio
                                : ui.readAloud}
                          </span>
                        </button>

                        <a
                          className="pill-btn is-active"
                          style={{
                            minHeight: 38,
                            padding: '6px 12px',
                            fontSize: '0.82rem',
                            textDecoration: 'none',
                          }}
                          href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Navigation size={14} />
                          <span>{ui.directions}</span>
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
