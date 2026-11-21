import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  Headphones,
  Languages,
  LifeBuoy,
  Loader2,
  MapPin,
  MessageCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store,
  WifiOff,
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
import { useReveal } from '../hooks/useReveal';
import { CityHeritageSketch, UpHeritageCrest } from './HeritageSketchIcons';
import { ParallaxScene } from './ParallaxScene';

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
  useReveal([language]);
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

  const features = [MessageCircle, ScanLine, ShieldCheck, Headphones, Store, LifeBuoy, WifiOff, Accessibility];

  return (
    <div className="landing">
      <ParallaxScene variant="hero">
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

        <div className="hero-copy">
          <span className="hero-copy__kicker">
            <span className="dot-live" />
            {ui.heroKicker}
          </span>
          <h1 className="hero-copy__title">
            {ui.heroTitleA} <em>{ui.heroTitleB}</em>
          </h1>
          <p className="hero-copy__lead">{ui.heroLead}</p>
        </div>

        <div className="hero-actions">
          <div className="hero-actions__row">
            <button type="button" className="btn-primary" onClick={() => onSelectAgra(userCoords)}>
              <Compass size={19} />
              <span>{ui.ctaBegin}</span>
              <ArrowRight size={18} />
            </button>
            <button type="button" className="btn-glass" onClick={handleDetectLocation} disabled={locating}>
              {locating ? <Loader2 size={17} className="spin-icon" /> : <MapPin size={17} />}
              <span>{locating ? ui.detectingGps : ui.detectGps}</span>
            </button>
          </div>
          <p className="hero-actions__notice" role="status">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>{customNotice || activeLocationNotice || ui.locDefaultNotice}</span>
          </p>
          <span className="hero-actions__cue" aria-hidden="true">
            <ChevronDown size={18} />
            {ui.scrollCue}
          </span>
        </div>
      </ParallaxScene>

      <section className="stat-strip" aria-label="Highlights">
        {ui.stats.map((stat, i) => (
          <div key={stat.label} className="stat-strip__item" data-reveal style={{ ['--i' as string]: i }}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="landing-section">
        <header className="section-head" data-reveal>
          <h2>{ui.featuresHeading}</h2>
          <p>{ui.featuresSub}</p>
        </header>
        <div className="feature-grid">
          {ui.features.map((f, i) => {
            const Icon = features[i] ?? Sparkles;
            return (
              <article key={f.title} className="feature-card" data-reveal style={{ ['--i' as string]: i % 4 }}>
                <span className={`feature-card__icon tone-${i % 4}`}>
                  <Icon size={22} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="trust-section">
        <div className="trust-section__inner">
          <div className="trust-section__copy" data-reveal>
            <span className="section-kicker">{ui.trustKicker}</span>
            <h2>{ui.trustHeading}</h2>
            <p>{ui.trustSub}</p>
            <ul className="trust-points">
              {ui.trustPoints.map((pt) => (
                <li key={pt}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="trust-demo" data-reveal aria-label="Example answer">
            <div className="trust-demo__q">{ui.trustSampleQ}</div>
            <div className="evidence evidence--history">
              <div className="evidence__label">
                <ShieldCheck size={15} />
                {ui.recordedHistory}
              </div>
              <p>{ui.trustHistoryText}</p>
              <cite>{ui.trustHistorySource}</cite>
            </div>
            <div className="evidence evidence--folklore">
              <div className="evidence__label">
                <BookOpen size={15} />
                {ui.localFolklore}
              </div>
              <p>{ui.trustFolkText}</p>
              <cite>{ui.trustFolkSource}</cite>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <header className="section-head" data-reveal>
          <h2>{ui.destHeading}</h2>
          <p>{ui.destSub}</p>
        </header>
        <div className="dest-rail" role="list">
          {UP_HERITAGE_CITIES.map((city) => {
            const baseLang = language.toLowerCase().split('-')[0];
            const tr = baseLang !== 'en' && baseLang !== 'hi' ? translatedCities[city.slug] : null;
            const cityName = isHi ? city.nameHi : tr?.name || city.name;
            const monumentLabel = isHi ? city.monumentLabelHi : tr?.monument || city.monumentLabel;
            const tagline = isHi ? city.taglineHi : tr?.tagline || city.tagline;
            const body = (
              <>
                <div className="dest-card__art">
                  <CityHeritageSketch city={city.slug} />
                  <span className={`dest-card__badge ${city.clickable ? 'is-live' : ''}`}>
                    {city.clickable ? ui.liveNow : ui.comingSoon}
                  </span>
                </div>
                <div className="dest-card__body">
                  <h3>{cityName}</h3>
                  <span className="dest-card__monument">{monumentLabel}</span>
                  <p>{tagline}</p>
                  {city.clickable && (
                    <span className="dest-card__go">
                      {ui.exploreFeatures}
                      <ArrowRight size={15} />
                    </span>
                  )}
                </div>
              </>
            );
            return city.clickable ? (
              <button
                key={city.slug}
                type="button"
                role="listitem"
                className="dest-card is-live"
                onClick={() => onSelectAgra(userCoords)}
              >
                {body}
              </button>
            ) : (
              <div key={city.slug} role="listitem" className="dest-card" aria-label={`${city.name}, ${ui.comingSoon}`}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <section className="dept-section" data-reveal>
        <div className="dept-section__art" aria-hidden="true">
          {[62, 88, 45, 74, 96, 58, 80].map((h, i) => (
            <span key={i} style={{ height: `${h}%`, ['--i' as string]: i }} />
          ))}
        </div>
        <div className="dept-section__copy">
          <h2>{ui.deptHeading}</h2>
          <p>{ui.deptSub}</p>
          <button type="button" className="btn-light" onClick={onOpenAdmin}>
            <BarChart3 size={18} />
            <span>{ui.deptCta}</span>
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="tricolour-bar" />
        <p>{ui.footerSources}</p>
        <p className="landing-footer__fine">{ui.footerText}</p>
      </footer>
    </div>
  );
}
