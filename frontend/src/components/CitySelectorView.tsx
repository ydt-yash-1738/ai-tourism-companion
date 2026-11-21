import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  Clock,
  Compass,
  Languages,
  Loader2,
  MapPin,
  MapPinOff,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
import { LANGUAGE_OPTIONS, UP_HERITAGE_CITIES } from '../data/upCities';
import {
  requestBrowserLocation,
  type GeoCoords,
  type GeoResult,
} from '../services/geolocation';
import { haversineMeters } from '../services/offlineStore';
import { translateBatchCached } from '../services/translateCache';
import { useReveal } from '../hooks/useReveal';
import { UpHeritageCrest } from './HeritageSketchIcons';
import { PHOTO_CREDITS } from '../data/photoCredits';
import { ScrollStory } from './ScrollStory';

interface CitySelectorViewProps {
  language: string;
  a11yMode: boolean;
  userCoords: GeoCoords | null;
  onLocationDetected: (coords: GeoCoords) => void;
  onChangeLanguage: (lang: string) => void;
  onToggleA11y: () => void;
  onSelectDestination: (slug: string, coords?: GeoCoords | null) => void;
  onOpenAdmin: () => void;
}

type DestinationFilter = 'all' | 'live' | 'soon';

function findNearestLiveCity(coords: GeoCoords) {
  const liveCities = UP_HERITAGE_CITIES.filter((c) => c.clickable);
  let bestCity = liveCities[0];
  let bestDist = Infinity;
  for (const city of liveCities) {
    const d = haversineMeters(coords.lat, coords.lng, city.lat, city.lng);
    if (d < bestDist) {
      bestDist = d;
      bestCity = city;
    }
  }
  return {
    city: bestCity,
    distMeters: bestDist,
    km: Math.max(1, Math.round(bestDist / 1000)),
  };
}

export function CitySelectorView({
  language,
  a11yMode,
  userCoords,
  onLocationDetected,
  onChangeLanguage,
  onToggleA11y,
  onSelectDestination,
  onOpenAdmin,
}: CitySelectorViewProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];

  const [filter, setFilter] = useState<DestinationFilter>('all');
  const [slideIdx, setSlideIdx] = useState(0);
  const [locState, setLocState] = useState<'requesting' | 'granted' | 'denied'>(() =>
    userCoords ? 'granted' : 'requesting',
  );
  const locPromiseRef = useRef<Promise<GeoResult> | null>(null);
  const jumpedNearestRef = useRef(Boolean(userCoords));
  const onLocationDetectedRef = useRef(onLocationDetected);
  useEffect(() => {
    onLocationDetectedRef.current = onLocationDetected;
  }, [onLocationDetected]);

  const applyGeoResult = useCallback((res: GeoResult) => {
    if (!res.coords) {
      setLocState('denied');
      return;
    }
    onLocationDetectedRef.current(res.coords);
    setLocState('granted');
    if (!jumpedNearestRef.current) {
      jumpedNearestRef.current = true;
      const nearest = findNearestLiveCity(res.coords);
      if (nearest.distMeters <= 60_000) {
        const idx = UP_HERITAGE_CITIES.findIndex((c) => c.slug === nearest.city.slug);
        if (idx >= 0) setSlideIdx(idx);
      }
    }
  }, []);

  const [translatedCities, setTranslatedCities] = useState<
    Record<string, { name: string; monument: string; tagline: string }>
  >({});

  useReveal([language, filter]);

  // Translate destination labels for non-EN/HI languages
  useEffect(() => {
    if (baseLang === 'en' || baseLang === 'hi') return;

    let active = true;
    const flat = UP_HERITAGE_CITIES.flatMap((c) => [c.name, c.monumentLabel, c.tagline]);
    translateBatchCached(flat, baseLang).then((res) => {
      if (!active) return;
      const next: Record<string, { name: string; monument: string; tagline: string }> = {};
      UP_HERITAGE_CITIES.forEach((city, idx) => {
        const offset = idx * 3;
        next[city.slug] = {
          name: res[offset] || city.name,
          monument: res[offset + 1] || city.monumentLabel,
          tagline: res[offset + 2] || city.tagline,
        };
      });
      setTranslatedCities(next);
    });
    return () => {
      active = false;
    };
  }, [baseLang]);

  // Automatically request location when the user lands on the app (shared across StrictMode remounts)
  useEffect(() => {
    if (userCoords) return;
    let active = true;
    if (!locPromiseRef.current) {
      locPromiseRef.current = requestBrowserLocation();
    }
    locPromiseRef.current
      .then((res) => {
        if (active) applyGeoResult(res);
      })
      .catch(() => {
        if (active) setLocState('denied');
      });
    return () => {
      active = false;
    };
  }, [userCoords, applyGeoResult]);

  const handleGrantLocation = async () => {
    setLocState('requesting');
    const pending = requestBrowserLocation();
    locPromiseRef.current = pending;
    try {
      applyGeoResult(await pending);
    } catch {
      setLocState('denied');
    }
  };

  const effectiveLocState = userCoords ? 'granted' : locState;

  const nearestInfo = useMemo(() => {
    if (!userCoords) return null;
    return findNearestLiveCity(userCoords);
  }, [userCoords]);

  const getCityLabels = (city: (typeof UP_HERITAGE_CITIES)[number]) => {
    const tr = baseLang !== 'en' && baseLang !== 'hi' ? translatedCities[city.slug] : null;
    return {
      name: isHi ? city.nameHi : tr?.name || city.name,
      monument: isHi ? city.monumentLabelHi : tr?.monument || city.monumentLabel,
      tagline: isHi ? city.taglineHi : tr?.tagline || city.tagline,
    };
  };

  const handleSlideChange = (idx: number) => {
    jumpedNearestRef.current = true;
    setSlideIdx(idx);
  };

  const storySlides = UP_HERITAGE_CITIES.map((city) => {
    const labels = getCityLabels(city);
    return {
      id: city.slug,
      photo: `${import.meta.env.BASE_URL}${city.image.replace(/^\//, '')}`,
      alt: city.imageAlt,
      objectPosition: city.objectPosition,
      cityName: labels.name,
      monument: labels.monument,
      live: city.clickable,
      badge: city.clickable ? ui.liveNow : ui.comingSoon,
    };
  });

  const activeHeroCity = UP_HERITAGE_CITIES[slideIdx] ?? UP_HERITAGE_CITIES[0];
  const targetLiveCity = activeHeroCity.clickable
    ? activeHeroCity
    : nearestInfo?.city ?? UP_HERITAGE_CITIES[0];
  const targetLiveLabels = getCityLabels(targetLiveCity);

  const liveCount = UP_HERITAGE_CITIES.filter((c) => c.clickable).length;
  const soonCount = UP_HERITAGE_CITIES.length - liveCount;
  const visibleCities = UP_HERITAGE_CITIES.filter((c) =>
    filter === 'all' ? true : filter === 'live' ? c.clickable : !c.clickable,
  );

  const locationBanner =
    effectiveLocState === 'requesting' ? (
      <div className="loc-pill is-checking" role="status">
        <Loader2 size={15} className="spin-icon" aria-hidden="true" />
        <span>{ui.detectingGps}</span>
      </div>
    ) : effectiveLocState === 'granted' && nearestInfo ? (
      <div className="loc-pill is-granted" role="status">
        <MapPin size={15} aria-hidden="true" />
        <span>
          {ui.locationActive} · {getCityLabels(nearestInfo.city).name} (~{nearestInfo.km} km)
        </span>
      </div>
    ) : (
      <div className="loc-pill is-denied" role="status">
        <MapPinOff size={15} aria-hidden="true" />
        <span>{ui.locNotProvided}</span>
        <button type="button" className="btn-grant-loc" onClick={handleGrantLocation}>
          <MapPin size={14} aria-hidden="true" />
          <span>{ui.grantLocation}</span>
        </button>
      </div>
    );

  return (
    <div className="landing">
      <ScrollStory
        slides={storySlides}
        active={slideIdx}
        onActiveChange={handleSlideChange}
        autoplay
        heroTitle={ui.heroMainTitle}
        primaryCtaLabel={`${ui.enterTourGuide} · ${targetLiveLabels.name}`}
        onPrimaryCta={() => onSelectDestination(targetLiveCity.slug, userCoords)}
        locationBanner={locationBanner}
        topbar={
          <header className="landing-topbar">
            <div className="landing-topbar__brand">
              <div className="landing-topbar__crest">
                <UpHeritageCrest />
              </div>
              <div className="landing-topbar__titles">
                <span className="landing-topbar__tag">{ui.govTag}</span>
                <span className="landing-topbar__title">{ui.appTitle}</span>
              </div>
            </div>
            <div className="landing-topbar__actions">
              <button
                type="button"
                className="topbar-insights-btn"
                onClick={onOpenAdmin}
                aria-label={ui.deptInsights}
                title={ui.deptInsights}
              >
                <BarChart3 size={16} aria-hidden="true" />
                <span className="topbar-insights-btn__label">{ui.deptInsights}</span>
              </button>
              <label className="glass-select">
                <Languages size={16} aria-hidden="true" />
                <select
                  value={language}
                  onChange={(e) => onChangeLanguage(e.target.value)}
                  aria-label="Choose language"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.nativeLabel}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`glass-icon-btn ${a11yMode ? 'is-on' : ''}`}
                onClick={onToggleA11y}
                aria-pressed={a11yMode}
                aria-label={a11yMode ? ui.easyModeOn : ui.easyMode}
                title={a11yMode ? ui.easyModeOn : ui.easyMode}
              >
                <Accessibility size={18} />
              </button>
            </div>
          </header>
        }
      />

      <section id="destinations" className="landing-section">
        <div className="dest-head" data-reveal>
          <header className="section-head">
            <h2>{ui.citiesHeading}</h2>
            <p>{ui.citiesSub}</p>
          </header>

          <div className="dest-filter-bar" role="tablist" aria-label="Filter destinations">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`dest-filter-btn ${filter === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              {ui.allLocations} ({UP_HERITAGE_CITIES.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'live'}
              className={`dest-filter-btn ${filter === 'live' ? 'is-active' : ''}`}
              onClick={() => setFilter('live')}
            >
              <span className="dot-live" aria-hidden="true" />
              {ui.liveNow} ({liveCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'soon'}
              className={`dest-filter-btn ${filter === 'soon' ? 'is-active' : ''}`}
              onClick={() => setFilter('soon')}
            >
              {ui.comingSoon} ({soonCount})
            </button>
          </div>
        </div>

        <div className="dest-photo-grid">
          {visibleCities.map((city, idx) => {
            const labels = getCityLabels(city);
            const imgSrc = `${import.meta.env.BASE_URL}${city.image.replace(/^\//, '')}`;
            const isNearest = nearestInfo?.city.slug === city.slug;

            if (city.clickable) {
              return (
                <button
                  key={city.slug}
                  type="button"
                  className="dest-photo-card is-live"
                  data-reveal
                  style={{ ['--i' as string]: idx % 3 }}
                  onClick={() => onSelectDestination(city.slug, userCoords)}
                >
                  <div className="dest-photo-card__media">
                    <img
                      src={imgSrc}
                      alt={city.imageAlt}
                      style={{ objectPosition: city.objectPosition }}
                      data-parallax="0.1"
                      loading="lazy"
                    />
                    <div className="dest-photo-card__scrim" aria-hidden="true" />
                    <div className="dest-photo-card__badges">
                      <span className="dest-photo-card__badge is-live">
                        <span className="dot-live" />
                        {ui.liveNow}
                      </span>
                      {isNearest && (
                        <span className="dest-photo-card__nearest">
                          <MapPin size={11} aria-hidden="true" />~{nearestInfo.km} km
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="dest-photo-card__body">
                    <h3>{labels.name}</h3>
                    <span className="dest-photo-card__monument">{labels.monument}</span>
                    <p>{labels.tagline}</p>
                    <div className="dest-photo-card__cta">
                      <Compass size={16} aria-hidden="true" />
                      <span>{ui.enterTourGuide}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </div>
                  </div>
                </button>
              );
            }

            return (
              <article
                key={city.slug}
                className="dest-photo-card is-soon"
                data-reveal
                style={{ ['--i' as string]: idx % 3 }}
              >
                <div className="dest-photo-card__media">
                  <img
                    src={imgSrc}
                    alt={city.imageAlt}
                    style={{ objectPosition: city.objectPosition }}
                    data-parallax="0.1"
                    loading="lazy"
                  />
                  <div className="dest-photo-card__scrim" aria-hidden="true" />
                  <div className="dest-photo-card__badges">
                    <span className="dest-photo-card__badge is-soon">{ui.comingSoon}</span>
                  </div>
                </div>
                <div className="dest-photo-card__body">
                  <h3>{labels.name}</h3>
                  <span className="dest-photo-card__monument">{labels.monument}</span>
                  <p>{labels.tagline}</p>
                  <div className="dest-photo-card__soon-foot">
                    <Clock size={14} aria-hidden="true" />
                    <span>{ui.comingSoon}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="tricolour-bar" />
        <p>{ui.footerSources}</p>
        <p className="landing-footer__fine">{ui.footerText}</p>
        <details className="credits">
          <summary>
            {ui.photoCreditsLabel} ({PHOTO_CREDITS.length})
          </summary>
          <ul>
            {PHOTO_CREDITS.map((c) => (
              <li key={c.source}>
                <strong>{c.subject}</strong>: {c.author},{' '}
                <a href={c.source} target="_blank" rel="noreferrer">
                  Wikimedia Commons
                </a>
                , {c.license}
              </li>
            ))}
          </ul>
        </details>
      </footer>
    </div>
  );
}
