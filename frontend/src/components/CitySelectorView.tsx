import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  Compass,
  Loader2,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
import { LANGUAGE_OPTIONS, UP_HERITAGE_CITIES } from '../data/upCities';
import {
  isGeolocationAlreadyGranted,
  requestBrowserLocation,
  type GeoCoords,
} from '../services/geolocation';
import { haversineMeters } from '../services/offlineStore';
import { translateBatchCached } from '../services/translateCache';
import {
  CityHeritageSketch,
  HeritageJaliBackdrop,
  UpHeritageCrest,
} from './HeritageSketchIcons';

interface CitySelectorViewProps {
  language: string;
  a11yMode: boolean;
  userCoords: GeoCoords | null;
  onLocationDetected: (coords: GeoCoords) => void;
  onChangeLanguage: (lang: string) => void;
  onToggleA11y: () => void;
  onSelectAgra: (coords?: GeoCoords | null) => void;
  onOpenAdmin: () => void;
}

export function CitySelectorView({
  language,
  a11yMode,
  userCoords,
  onLocationDetected,
  onChangeLanguage,
  onToggleA11y,
  onSelectAgra,
  onOpenAdmin,
}: CitySelectorViewProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const [locating, setLocating] = useState(false);
  const [customNotice, setCustomNotice] = useState<string | null>(null);
  const [translatedCities, setTranslatedCities] = useState<
    Record<string, { name: string; monument: string; tagline: string }>
  >({});

  useEffect(() => {
    const baseLang = language.toLowerCase().split('-')[0];
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
  }, [language]);

  // If browser permission is already granted, silently fetch coordinates without hijacking navigation
  useEffect(() => {
    if (userCoords) return;
    let active = true;
    isGeolocationAlreadyGranted()
      .then((granted) => {
        if (!granted || !active) return null;
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

  const activeLocationNotice = useMemo(() => {
    if (!userCoords) return null;
    const agra = UP_HERITAGE_CITIES.find((c) => c.slug === 'agra')!;
    const distMeters = haversineMeters(userCoords.lat, userCoords.lng, agra.lat, agra.lng);
    const km = Math.round(distMeters / 1000);
    if (distMeters <= 40_000) {
      return isHi
        ? 'स्थान सक्रिय — आप आगरा विरासत क्षेत्र में हैं! ऊपर "आगरा विरासत साथी खोलें" दबाएँ।'
        : 'Location active — you are inside the Agra Heritage Zone! Tap Agra below to begin.';
    }
    return isHi
      ? `स्थान सक्रिय (${userCoords.lat.toFixed(2)}°N, ${userCoords.lng.toFixed(2)}°E · आगरा से ~${km} किमी दूर) — नीचे आगरा चुनें।`
      : `Location active (${userCoords.lat.toFixed(2)}°N, ${userCoords.lng.toFixed(2)}°E · ~${km} km from Agra) — Agra is live below.`;
  }, [userCoords, isHi]);

  const handleDetectLocation = async () => {
    setLocating(true);
    setCustomNotice(null);

    const res = await requestBrowserLocation();
    setLocating(false);

    if (res.coords) {
      onLocationDetected(res.coords);
      const agra = UP_HERITAGE_CITIES.find((c) => c.slug === 'agra')!;
      const distMeters = haversineMeters(res.coords.lat, res.coords.lng, agra.lat, agra.lng);
      if (distMeters <= 40_000) {
        onSelectAgra(res.coords);
      }
      return;
    }

    if (res.status === 'denied') {
      setCustomNotice(
        isHi
          ? 'ब्राउज़र या डिवाइस सेटिंग में लोकेशन अनुमति बंद है। अनुमति दें या नीचे आगरा चुनें।'
          : 'Location permission is blocked in browser/device settings. Enable Location or tap Agra below.',
      );
    } else if (res.status === 'unavailable') {
      setCustomNotice(
        isHi
          ? 'लोकेशन अनुमति मिल गई है, पर डिवाइस की Location Service अभी सटीक स्थिति नहीं दे पाई। Windows/फोन Location सेटिंग जाँचें या नीचे आगरा चुनें।'
          : 'Location permission is allowed, but your device/Windows Location Service could not get a fix. Check OS Location settings or tap Agra below.',
      );
    } else if (res.status === 'timeout') {
      setCustomNotice(
        isHi
          ? 'लोकेशन प्राप्त करने में समय अधिक लगा। पुनः प्रयास करें या नीचे आगरा चुनें।'
          : 'Location lookup timed out indoors. Tap Detect My Location to retry or choose Agra below.',
      );
    } else {
      setCustomNotice('GPS is not supported in this browser. Select Agra below to explore.');
    }
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
        <div className="landing-hero__panel">
          <HeritageJaliBackdrop className="landing-hero__jali" />

          <div className="landing-hero__eyebrow">
            <span className="dot-live" />
            <span>{ui.eyebrow}</span>
          </div>

          <h2 className="landing-hero__headline">{ui.heroHeadline}</h2>
          <p className="landing-hero__sub">{ui.heroSub}</p>

          <div className="landing-hero__cta-row">
            <button
              type="button"
              className="pill-btn is-saffron"
              onClick={() => onSelectAgra(userCoords)}
            >
              <Compass size={17} />
              <span>{ui.launchAgra}</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="pill-btn"
              onClick={handleDetectLocation}
              disabled={locating}
            >
              {locating ? <Loader2 size={16} className="spin-icon" /> : <MapPin size={16} />}
              <span>{locating ? ui.detectingGps : ui.detectGps}</span>
            </button>
          </div>

          <div className="landing-hero__loc-banner" role="status">
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{customNotice || activeLocationNotice || ui.locDefaultNotice}</span>
          </div>
        </div>
      </section>

      <main className="city-section">
        <div className="city-section__header">
          <div>
            <h2>{ui.citiesHeading}</h2>
            <p>{ui.citiesSub}</p>
          </div>
          <div className="city-section__legend">
            <span className="badge-live">● {ui.liveBadge}</span>
          </div>
        </div>

        <div className="city-grid">
          {UP_HERITAGE_CITIES.map((city) => {
            const baseLang = language.toLowerCase().split('-')[0];
            const tr = baseLang !== 'en' && baseLang !== 'hi' ? translatedCities[city.slug] : null;
            const cityName = isHi ? city.nameHi : tr?.name || city.name;
            const monumentLabel = isHi ? city.monumentLabelHi : tr?.monument || city.monumentLabel;
            const tagline = isHi ? city.taglineHi : tr?.tagline || city.tagline;

            return city.clickable ? (
              <button
                key={city.slug}
                type="button"
                className="city-card is-active"
                onClick={() => onSelectAgra(userCoords)}
              >
                <div className="city-card__top">
                  <div className="city-card__sketch-box">
                    <CityHeritageSketch city={city.slug} />
                  </div>
                  <span className="city-card__status">{ui.liveNow}</span>
                </div>

                <div>
                  <div className="city-card__name">{cityName}</div>
                  <div className="city-card__monument">{monumentLabel}</div>
                </div>

                <p className="city-card__desc">{tagline}</p>

                <div className="city-card__footer">
                  <span>{ui.exploreFeatures}</span>
                  <ArrowRight size={16} />
                </div>
              </button>
            ) : (
              <div
                key={city.slug}
                className="city-card is-placeholder"
                role="region"
                aria-disabled="true"
                aria-label={`${city.name} — ${ui.comingSoon}`}
              >
                <div className="city-card__top">
                  <div className="city-card__sketch-box">
                    <CityHeritageSketch city={city.slug} />
                  </div>
                  <span className="city-card__status">{ui.comingSoon}</span>
                </div>

                <div>
                  <div className="city-card__name">{cityName}</div>
                  <div className="city-card__monument">{monumentLabel}</div>
                </div>

                <p className="city-card__desc">{tagline}</p>

                <div className="city-card__footer">
                  <span>{ui.packPlanned}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="gov-footer">{ui.footerText}</footer>
    </div>
  );
}
