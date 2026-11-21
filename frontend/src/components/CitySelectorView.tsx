import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
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
import { HERO_DESTINATIONS, getDestinationConfig } from '../data/destinationMedia';
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
import { UpHeritageCrest } from './HeritageSketchIcons';
import { PHOTO_CREDITS } from '../data/photoCredits';
import { HeritageCarousel } from './HeritageCarousel';
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

  const [slideIdx, setSlideIdx] = useState(0);
  const [startedNearest, setStartedNearest] = useState<string | null>(null);
  const nearestHero = useMemo(() => {
    if (!userCoords) return null;
    const { city, distMeters } = findNearestLiveCity(userCoords);
    return distMeters <= 60_000 && (HERO_DESTINATIONS as readonly string[]).includes(city.slug)
      ? { slug: city.slug, km: Math.max(1, Math.round(distMeters / 1000)) }
      : null;
    // findNearestLiveCity only reads the static city list
  }, [userCoords]);
  // start the slideshow on the place nearest the visitor (once per detected place)
  if (nearestHero && startedNearest !== nearestHero.slug) {
    setStartedNearest(nearestHero.slug);
    setSlideIdx(HERO_DESTINATIONS.indexOf(nearestHero.slug as (typeof HERO_DESTINATIONS)[number]));
  }
  const heroConfigs = HERO_DESTINATIONS.map((slug) => getDestinationConfig(slug));
  const activeHero = heroConfigs[slideIdx] ?? heroConfigs[0];
  const storySlides = heroConfigs.map((cfg) => ({
    id: cfg.slug,
    photo: `${import.meta.env.BASE_URL}${cfg.hero.photo.replace(/^\//, '')}`,
    alt: cfg.hero.alt,
    kicker:
      nearestHero?.slug === cfg.slug
        ? `${isHi ? 'आपके सबसे निकट' : 'Nearest to you'} · ~${nearestHero.km} km`
        : isHi
          ? cfg.hero.kickerHi
          : cfg.hero.kickerEn,
    title: isHi ? cfg.hero.titleHi : cfg.hero.titleEn,
  }));
  const beginLabel = (isHi ? ui.ctaBeginAtHi : ui.ctaBeginAt).replace(
    '{place}',
    isHi ? activeHero.hero.titleHi : activeHero.hero.titleEn,
  );

  const activeLocationNotice = useMemo(() => {
    if (!userCoords) return null;
    const { city, distMeters } = findNearestLiveCity(userCoords);
    const km = Math.round(distMeters / 1000);
    const cityLabel = isHi ? city.nameHi : city.name;
    if (distMeters <= 40_000) {
      return isHi
        ? `स्थान सक्रिय — आप ${cityLabel} विरासत क्षेत्र में हैं! नीचे ${cityLabel} चुनें।`
        : `Location active — you are inside the ${cityLabel} Heritage Zone! Tap ${cityLabel} below to begin.`;
    }
    return isHi
      ? `स्थान सक्रिय (${userCoords.lat.toFixed(2)}°N, ${userCoords.lng.toFixed(2)}°E · ${cityLabel} से ~${km} किमी दूर) — आगरा, लखनऊ या सारनाथ चुनें।`
      : `Location active (${userCoords.lat.toFixed(2)}°N, ${userCoords.lng.toFixed(2)}°E · ~${km} km from ${cityLabel}) — Agra, Lucknow & Sarnath are live below.`;
  }, [userCoords, isHi]);

  const handleDetectLocation = async () => {
    setLocating(true);
    setCustomNotice(null);

    const res = await requestBrowserLocation();
    setLocating(false);

    if (res.coords) {
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
          ? 'ब्राउज़र या डिवाइस सेटिंग में लोकेशन अनुमति बंद है। अनुमति दें या नीचे कोई स्थान चुनें।'
          : 'Location permission is blocked in browser/device settings. Enable Location or pick a place below.',
      );
    } else if (res.status === 'unavailable') {
      setCustomNotice(
        isHi
          ? 'लोकेशन अनुमति मिल गई है, पर डिवाइस की Location Service अभी सटीक स्थिति नहीं दे पाई। नीचे कोई स्थान चुनें।'
          : 'Location permission is allowed, but your device/Windows Location Service could not get a fix. Check OS Location settings or pick a place below.',
      );
    } else if (res.status === 'timeout') {
      setCustomNotice(
        isHi
          ? 'लोकेशन प्राप्त करने में समय अधिक लगा। पुनः प्रयास करें या नीचे कोई स्थान चुनें।'
          : 'Location lookup timed out indoors. Tap Detect My Location to retry or pick a place below.',
      );
    } else {
      setCustomNotice('GPS is not supported in this browser. Pick a place below to explore.');
    }
  };

  const features = [MessageCircle, ScanLine, ShieldCheck, Headphones, Store, LifeBuoy, WifiOff, Accessibility];

  return (
    <div className="landing">
      <ScrollStory
        slides={storySlides}
        active={slideIdx}
        onActiveChange={setSlideIdx}
        autoplay
        introCue={ui.introCue}
        introAction={
          <>
            <button type="button" className="btn-glass" onClick={handleDetectLocation} disabled={locating}>
              {locating ? <Loader2 size={17} className="spin-icon" /> : <MapPin size={17} />}
              <span>{locating ? ui.detectingGps : ui.detectGps}</span>
            </button>
            {(customNotice || activeLocationNotice) && (
              <p className="story__intro-note" role="status">
                {customNotice || activeLocationNotice}
              </p>
            )}
          </>
        }
        panels={ui.storyPanels}
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
        finalPanel={
          <>
            <span className="story__panel-kicker">
              <span className="dot-live" />
              {ui.finalKicker}
            </span>
            <h2 className="story__panel-title">{ui.finalTitle}</h2>
            <div className="hero-actions__row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => onSelectDestination(activeHero.slug, userCoords)}
              >
                <Compass size={19} />
                <span>{beginLabel}</span>
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
          </>
        }
      />

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
        <div data-reveal>
          <HeritageCarousel
            label={ui.destHeading}
            ctaLabel={ui.ctaBegin}
            onSelectLive={(slug) => onSelectDestination(slug, userCoords)}
            slides={UP_HERITAGE_CITIES.map((city) => {
              const baseLang = language.toLowerCase().split('-')[0];
              const tr = baseLang !== 'en' && baseLang !== 'hi' ? translatedCities[city.slug] : null;
              return {
                id: city.slug,
                image: city.image,
                imageAlt: city.imageAlt,
                objectPosition: city.objectPosition,
                title: isHi ? city.nameHi : tr?.name || city.name,
                subtitle: isHi ? city.monumentLabelHi : tr?.monument || city.monumentLabel,
                body: isHi ? city.taglineHi : tr?.tagline || city.tagline,
                badge: city.clickable ? ui.liveNow : ui.comingSoon,
                live: city.clickable,
                ctaLabel:
                  city.slug === 'sarnath'
                    ? ui.launchSarnath
                    : city.slug === 'agra'
                      ? ui.launchAgra
                      : (isHi ? ui.ctaBeginAtHi : ui.ctaBeginAt).replace('{place}', isHi ? city.nameHi : city.name),
              };
            })}
          />
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
