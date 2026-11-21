import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
import { LANGUAGE_OPTIONS, UP_HERITAGE_CITIES, type UpHeritageCity } from '../data/upCities';
import {
  isGeolocationAlreadyGranted,
  requestBrowserLocation,
  type GeoCoords,
} from '../services/geolocation';
import { haversineMeters } from '../services/offlineStore';
import { translateBatchCached } from '../services/translateCache';
import { UpHeritageCrest } from './HeritageSketchIcons';

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
  const translationKey = baseLang !== 'en' && baseLang !== 'hi' ? baseLang : null;

  const [locating, setLocating] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [customNotice, setCustomNotice] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [settledTranslationKey, setSettledTranslationKey] = useState<string | null>(null);
  const [translatedCities, setTranslatedCities] = useState<
    Record<string, { name: string; monument: string; tagline: string }>
  >({});

  const translating = Boolean(translationKey && settledTranslationKey !== translationKey);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % UP_HERITAGE_CITIES.length);
    }, 5500);
    return () => {
      window.clearInterval(timer);
    };
  }, [paused]);

  useEffect(() => {
    if (!translationKey) return;

    let active = true;
    const flat = UP_HERITAGE_CITIES.flatMap((c) => [c.name, c.monumentLabel, c.tagline]);
    translateBatchCached(flat, translationKey)
      .then((res) => {
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
        setSettledTranslationKey(translationKey);
      })
      .catch(() => {
        if (active) setSettledTranslationKey(translationKey);
      });
    return () => {
      active = false;
    };
  }, [translationKey]);

  // If browser permission is already granted, silently fetch coordinates without hijacking navigation
  useEffect(() => {
    if (userCoords) return;
    let active = true;
    isGeolocationAlreadyGranted()
      .then((granted) => {
        if (!granted || !active) return null;
        setLocationGranted(true);
        return requestBrowserLocation();
      })
      .then((res) => {
        if (active && res?.coords) {
          onLocationDetected(res.coords);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userCoords, onLocationDetected]);

  const findNearestLiveCity = (coords: GeoCoords) => {
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
    return { city: bestCity, distMeters: bestDist };
  };

  const activeLocationNotice = useMemo(() => {
    if (!userCoords) return null;
    const { city, distMeters } = findNearestLiveCity(userCoords);
    const km = Math.round(distMeters / 1000);
    const cityLabel = isHi ? city.nameHi : city.name;
    if (distMeters <= 40_000) {
      return isHi
        ? `स्थान सक्रिय — आप ${cityLabel} विरासत क्षेत्र में हैं! नीचे ${cityLabel} पर टैप करें।`
        : `Location active — you are inside the ${cityLabel} Heritage Zone! Tap ${cityLabel} below to begin.`;
    }
    return isHi
      ? `स्थान सक्रिय (${userCoords.lat.toFixed(2)}°N, ${userCoords.lng.toFixed(2)}°E · ${cityLabel} से ~${km} किमी दूर) — नीचे आगरा या सारनाथ चुनें।`
      : `Location active (${userCoords.lat.toFixed(2)}°N, ${userCoords.lng.toFixed(2)}°E · ~${km} km from ${cityLabel}) — Agra & Sarnath are live below.`;
  }, [userCoords, isHi]);

  const handleDetectLocation = async () => {
    setLocating(true);
    setCustomNotice(null);

    const res = await requestBrowserLocation();
    setLocating(false);

    if (res.coords) {
      setLocationGranted(true);
      onLocationDetected(res.coords);
      const { city, distMeters } = findNearestLiveCity(res.coords);
      if (distMeters <= 40_000) {
        onSelectDestination(city.slug, res.coords);
      }
      return;
    }

    if (res.status === 'denied') {
      setCustomNotice(
        isHi
          ? 'ब्राउज़र या डिवाइस सेटिंग में लोकेशन अनुमति बंद है। अनुमति दें या नीचे आगरा/सारनाथ चुनें।'
          : 'Location permission is blocked in browser/device settings. Enable Location or tap Agra or Sarnath below.',
      );
    } else if (res.status === 'unavailable') {
      setCustomNotice(
        isHi
          ? 'लोकेशन अनुमति मिल गई है, पर डिवाइस की Location Service अभी सटीक स्थिति नहीं दे पाई। नीचे आगरा या सारनाथ चुनें।'
          : 'Location permission is allowed, but your device/Windows Location Service could not get a fix. Check OS Location settings or tap Agra or Sarnath below.',
      );
    } else if (res.status === 'timeout') {
      setCustomNotice(
        isHi
          ? 'लोकेशन प्राप्त करने में समय अधिक लगा। पुनः प्रयास करें या नीचे आगरा/सारनाथ चुनें।'
          : 'Location lookup timed out indoors. Tap Detect My Location to retry or choose Agra or Sarnath below.',
      );
    } else {
      setCustomNotice('GPS is not supported in this browser. Select Agra or Sarnath below to explore.');
    }
  };

  const getCityCopy = (city: UpHeritageCity) => {
    const tr = translationKey ? translatedCities[city.slug] : null;
    return {
      name: isHi ? city.nameHi : tr?.name || city.name,
      monument: isHi ? city.monumentLabelHi : tr?.monument || city.monumentLabel,
      tagline: isHi ? city.taglineHi : tr?.tagline || city.tagline,
    };
  };

  const markImageLoaded = (slug: string) => {
    setLoadedImages((prev) => (prev[slug] ? prev : { ...prev, [slug]: true }));
  };

  const stepSlide = (delta: number) => {
    setActiveSlide(
      (prev) => (prev + delta + UP_HERITAGE_CITIES.length) % UP_HERITAGE_CITIES.length,
    );
  };

  return (
    <div className="landing-shell">
      <div className="tricolour-bar" />

      <header className="gov-masthead">
        <div className="gov-masthead__inner">
          <div className="gov-masthead__brand">
            <div className="gov-masthead__crest">
              <UpHeritageCrest />
            </div>
            <div>
              <div className="gov-masthead__gov-tag">{ui.govTag}</div>
              <h1 className="gov-masthead__title">{ui.appTitle}</h1>
            </div>
          </div>

          <div className="gov-masthead__actions">
            <select
              className="lang-select"
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

            <button
              type="button"
              className={`pill-btn ${a11yMode ? 'is-emerald' : ''}`}
              onClick={onToggleA11y}
              aria-pressed={a11yMode}
            >
              <Accessibility size={16} />
              <span>{a11yMode ? ui.easyModeOn : ui.easyMode}</span>
            </button>

            <button type="button" className="pill-btn" onClick={onOpenAdmin}>
              <BarChart3 size={16} />
              <span>{ui.deptInsights}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div
          className="landing-hero__panel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="landing-hero__slideshow" aria-hidden="true">
            {UP_HERITAGE_CITIES.map((city, idx) => (
              <div
                key={city.slug}
                className={`landing-hero__slide ${idx === activeSlide ? 'is-active' : ''}`}
              >
                <img
                  src={city.image}
                  alt=""
                  style={{ objectPosition: city.objectPosition }}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  fetchPriority={idx === 0 ? 'high' : 'auto'}
                />
              </div>
            ))}
          </div>

          <div className="landing-hero__scrim" aria-hidden="true" />

          <div className="landing-hero__content">
            <h2 className="landing-hero__headline">{ui.heroHeadline}</h2>

            <div className="landing-hero__bottom-bar">
              <div className="landing-hero__cta-row">
                <button
                  type="button"
                  className="pill-btn is-saffron"
                  onClick={() => onSelectDestination('agra', userCoords)}
                >
                  <Compass size={17} />
                  <span>{ui.launchAgra}</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  className="pill-btn is-active"
                  onClick={() => onSelectDestination('sarnath', userCoords)}
                >
                  <Compass size={17} />
                  <span>{ui.launchSarnath}</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  className={`pill-btn is-hero-glass ${userCoords || locationGranted ? 'is-detected' : ''}`}
                  onClick={handleDetectLocation}
                  disabled={locating}
                  title={
                    userCoords || locationGranted
                      ? isHi
                        ? 'वर्तमान स्थान रीफ़्रेश करें'
                        : 'Tap to refresh your GPS location'
                      : undefined
                  }
                >
                  {locating ? (
                    <Loader2 size={16} className="spin-icon" />
                  ) : userCoords ? (
                    <CheckCircle2 size={16} />
                  ) : locationGranted ? (
                    <RefreshCw size={15} />
                  ) : (
                    <MapPin size={16} />
                  )}
                  <span>
                    {locating
                      ? ui.detectingGps
                      : userCoords
                        ? ui.locationActive
                        : locationGranted
                          ? ui.refreshLocation
                          : ui.detectGps}
                  </span>
                  {!locating && userCoords && <RefreshCw size={13} style={{ opacity: 0.85 }} />}
                </button>
              </div>

              <div className="landing-hero__slide-controls">
                <button
                  type="button"
                  className="landing-hero__slide-nav"
                  onClick={() => stepSlide(-1)}
                  aria-label="Previous heritage highlight"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="landing-hero__dots" role="tablist" aria-label="Heritage slideshow">
                  {UP_HERITAGE_CITIES.map((city, idx) => (
                    <button
                      key={city.slug}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeSlide}
                      aria-label={`Show ${city.name}`}
                      className={`landing-hero__dot ${idx === activeSlide ? 'is-active' : ''}`}
                      onClick={() => setActiveSlide(idx)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="landing-hero__slide-nav"
                  onClick={() => stepSlide(1)}
                  aria-label="Next heritage highlight"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`landing-hero__loc-banner ${
            customNotice ? 'is-notice' : userCoords ? 'is-active' : ''
          }`}
          role="status"
        >
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{customNotice || activeLocationNotice || ui.locDefaultNotice}</span>
        </div>
      </section>

      <main className="city-section">
        <div className="city-section__header">
          <div>
            <h2>{ui.citiesHeading}</h2>
            <p>{ui.citiesSub}</p>
          </div>
          <div className="city-section__legend">
            {translating && (
              <span className="translating-pill" role="status">
                <Loader2 size={13} className="spin-icon" />
                <span>{ui.translating}</span>
              </span>
            )}
            <span className="badge-live">● {ui.liveBadge}</span>
          </div>
        </div>

        <div className="city-grid">
          {UP_HERITAGE_CITIES.map((city) => {
            const copy = getCityCopy(city);
            const isLoaded = Boolean(loadedImages[city.slug]);

            const cardInner = (
              <>
                <div className="city-card__media">
                  <img
                    className={`city-card__img ${isLoaded ? 'is-loaded' : ''}`}
                    src={city.image}
                    alt={city.imageAlt}
                    style={{ objectPosition: city.objectPosition }}
                    loading="lazy"
                    onLoad={() => markImageLoaded(city.slug)}
                    onError={() => markImageLoaded(city.slug)}
                  />
                </div>
                <div className="city-card__scrim" aria-hidden="true" />

                <div className="city-card__content">
                  <div className="city-card__top">
                    <span className="city-card__status">
                      {city.clickable && <span className="status-dot" aria-hidden="true" />}
                      <span>{city.clickable ? ui.liveNow : ui.comingSoon}</span>
                    </span>
                  </div>

                  <div className="city-card__body">
                    <div className="city-card__monument">{copy.monument}</div>
                    <div className="city-card__name">{copy.name}</div>
                    <p className="city-card__desc">{copy.tagline}</p>

                    <div className="city-card__footer">
                      <span>{city.clickable ? ui.exploreFeatures : ui.packPlanned}</span>
                      {city.clickable && <ArrowRight size={16} />}
                    </div>
                  </div>
                </div>
              </>
            );

            return city.clickable ? (
              <button
                key={city.slug}
                type="button"
                className="city-card is-active"
                onClick={() => onSelectDestination(city.slug, userCoords)}
              >
                {cardInner}
              </button>
            ) : (
              <div
                key={city.slug}
                className="city-card is-placeholder"
                role="region"
                aria-disabled="true"
                aria-label={`${city.name} — ${ui.comingSoon}`}
              >
                {cardInner}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="gov-footer">{ui.footerText}</footer>
    </div>
  );
}
