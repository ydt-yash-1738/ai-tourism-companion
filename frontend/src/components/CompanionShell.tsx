import { useEffect, useState } from 'react';
import {
  Accessibility,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  Compass,
  Download,
  Headphones,
  Languages,
  Loader2,
  MapPin,
  MessageSquare,
  ServerCrash,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { getDestinationConfig } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { LANGUAGE_OPTIONS, PERSONA_OPTIONS } from '../data/upCities';
import { translateBatchCached } from '../services/translateCache';
import type { Monument, OfflinePack, PersonaType } from '../types/api';
import { CameraTab } from './CameraTab';
import { EmergencyModal } from './EmergencyModal';
import { FacilitiesTab } from './FacilitiesTab';
import { GuideTab } from './GuideTab';
import { PhotoHero } from './PhotoHero';
import { NearbyTab } from './NearbyTab';
import { TourTab } from './TourTab';

export type CompanionTabId = 'guide' | 'camera' | 'tour' | 'nearby' | 'facilities';

interface CompanionShellProps {
  destinationSlug: string;
  language: string;
  persona: PersonaType;
  a11yMode: boolean;
  isOnline: boolean;
  serverReachable: boolean;
  sessionHash: string;
  userCoords: { lat: number; lng: number } | null;
  monuments: Monument[];
  offlinePack: OfflinePack | null;
  downloadingPack: boolean;
  onChangeLanguage: (lang: string) => void;
  onChangePersona: (p: PersonaType) => void;
  onToggleA11y: () => void;
  onDownloadOfflinePack: () => void;
  onBackToCities: () => void;
  onOpenAdmin: () => void;
}

const ONBOARDING_KEY = 'up_companion_onboarded_v1';

function readOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOnboarded() {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // storage unavailable (private mode): onboarding simply shows again next time
  }
}

export function CompanionShell({
  destinationSlug,
  language,
  persona,
  a11yMode,
  isOnline,
  serverReachable,
  sessionHash,
  userCoords,
  monuments,
  offlinePack,
  downloadingPack,
  onChangeLanguage,
  onChangePersona,
  onToggleA11y,
  onDownloadOfflinePack,
  onBackToCities,
  onOpenAdmin,
}: CompanionShellProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];
  const destConfig = getDestinationConfig(destinationSlug);
  const [activeTab, setActiveTab] = useState<CompanionTabId>('guide');
  const [sosOpen, setSosOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardStep, setOnboardStep] = useState<number | null>(() => (readOnboarded() ? null : 0));
  const [scrolled, setScrolled] = useState(false);
  const [translatedStrings, setTranslatedStrings] = useState<Record<string, string>>({});

  const liveOk = isOnline && serverReachable;

  useEffect(() => {
    if (!liveOk || destinationSlug === 'agra' || baseLang === 'en' || baseLang === 'hi') {
      return;
    }
    let active = true;
    const raw = [destConfig.copy.companionTitleEn];
    Object.values(destConfig.tabHeroes).forEach((hero) => {
      if (hero.eyebrowEn) raw.push(hero.eyebrowEn);
      if (hero.titleEn) raw.push(hero.titleEn);
    });
    const unique = Array.from(new Set(raw.filter(Boolean)));
    translateBatchCached(unique, baseLang)
      .then((res) => {
        if (!active) return;
        const next: Record<string, string> = {};
        unique.forEach((orig, idx) => {
          if (res[idx]) next[`${baseLang}::${orig}`] = res[idx];
        });
        setTranslatedStrings((prev) => ({ ...prev, ...next }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [liveOk, destinationSlug, baseLang, destConfig]);

  const trShell = (enText: string, hiText = ''): string => {
    if (isHi && hiText) return hiText;
    if (baseLang !== 'en' && baseLang !== 'hi') {
      return translatedStrings[`${baseLang}::${enText}`] || enText;
    }
    return enText;
  };

  const companionTitle =
    destinationSlug === 'agra'
      ? ui.companionTitle
      : trShell(destConfig.copy.companionTitleEn, destConfig.copy.companionTitleHi);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeTab]);

  const connection: 'online' | 'offline' | 'unreachable' = !isOnline
    ? 'offline'
    : serverReachable
      ? 'online'
      : 'unreachable';
  const ConnIcon = connection === 'online' ? Wifi : connection === 'offline' ? WifiOff : ServerCrash;
  const connLabel =
    connection === 'online' ? ui.online : connection === 'offline' ? ui.offline : ui.serverUnreachable;
  const workingOffline = connection !== 'online';

  const tabs: Array<{ id: CompanionTabId; label: string; icon: typeof MessageSquare }> = [
    { id: 'guide', label: ui.tabs.guide, icon: MessageSquare },
    { id: 'tour', label: ui.tabs.tour, icon: Headphones },
    { id: 'camera', label: ui.tabs.camera, icon: Camera },
    { id: 'nearby', label: ui.tabs.nearby, icon: Compass },
    { id: 'facilities', label: ui.tabs.facilities, icon: MapPin },
  ];

  const finishOnboarding = () => {
    writeOnboarded();
    setOnboardStep(null);
  };

  const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === language);

  return (
    <div className="companion-shell">
      <header className={`app-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="app-header__row">
          <button type="button" className="icon-btn" onClick={onBackToCities} aria-label="Back to destinations">
            <ArrowLeft size={20} />
          </button>

          <div className="app-header__title">
            <span className="app-header__city">{companionTitle}</span>
            <span className={`conn-badge is-${connection}`} role="status">
              <ConnIcon size={12} />
              {connLabel}
            </span>
          </div>

          <div className="app-header__actions">
            <button
              type="button"
              className={`icon-btn ${offlinePack ? 'is-ready' : ''}`}
              onClick={onDownloadOfflinePack}
              disabled={downloadingPack || workingOffline}
              aria-label={offlinePack ? ui.offlineReady : ui.offlinePack}
              title={offlinePack ? ui.offlineReady : ui.offlinePack}
            >
              {downloadingPack ? (
                <Loader2 size={19} className="spin-icon" />
              ) : offlinePack ? (
                <Check size={19} />
              ) : (
                <Download size={19} />
              )}
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--lang"
              onClick={() => setSettingsOpen(true)}
              aria-label={ui.settingsTitle}
            >
              <Languages size={18} />
              <span>{(langMeta?.code ?? language).slice(0, 2).toUpperCase()}</span>
            </button>
            <button type="button" className="sos-btn" onClick={() => setSosOpen(true)}>
              <ShieldAlert size={17} />
              <span>SOS</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="desktop-tabs" aria-label="Companion sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`desktop-tabs__btn ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="companion-main">
        {workingOffline && (
          <div className="offline-banner" role="status">
            <ConnIcon size={16} />
            <span>{offlinePack ? ui.offlineBanner : ui.gapNoticeOffline}</span>
          </div>
        )}

        <div key={activeTab} className="tab-stage">
          {activeTab !== 'guide' && (() => {
            const heroCfg = destConfig.tabHeroes[activeTab];
            const heroEyebrow = heroCfg.eyebrowEn
              ? trShell(heroCfg.eyebrowEn, heroCfg.eyebrowHi)
              : ui.tabHeroes[activeTab].eyebrow;
            const heroTitle = heroCfg.titleEn
              ? trShell(heroCfg.titleEn, heroCfg.titleHi)
              : ui.tabHeroes[activeTab].title;
            return (
              <PhotoHero
                image={heroCfg.image}
                objectPosition={heroCfg.position}
                eyebrow={heroEyebrow}
                title={heroTitle}
              />
            );
          })()}

          {activeTab === 'guide' && (
            <GuideTab
              destinationSlug={destinationSlug}
              language={language}
              persona={persona}
              simpleLanguage={a11yMode}
              isOnline={liveOk}
              sessionHash={sessionHash}
              monuments={monuments}
              offlinePack={offlinePack}
              onChangePersona={onChangePersona}
            />
          )}

          {activeTab === 'camera' && (
            <CameraTab
              destinationSlug={destinationSlug}
              language={language}
              persona={persona}
              simpleLanguage={a11yMode}
              isOnline={liveOk}
              sessionHash={sessionHash}
              userCoords={userCoords}
              offlinePack={offlinePack}
            />
          )}

          {activeTab === 'tour' && (
            <TourTab
              destinationSlug={destinationSlug}
              language={language}
              persona={persona}
              isOnline={liveOk}
              sessionHash={sessionHash}
              userCoords={userCoords}
              monuments={monuments}
              offlinePack={offlinePack}
            />
          )}

          {activeTab === 'nearby' && (
            <NearbyTab
              destinationSlug={destinationSlug}
              language={language}
              isOnline={liveOk}
              userCoords={userCoords}
              offlinePack={offlinePack}
            />
          )}

          {activeTab === 'facilities' && (
            <FacilitiesTab
              destinationSlug={destinationSlug}
              language={language}
              isOnline={liveOk}
              sessionHash={sessionHash}
              userCoords={userCoords}
              offlinePack={offlinePack}
            />
          )}
        </div>
      </main>

      <nav className="dock" aria-label="Companion sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isCamera = tab.id === 'camera';
          return (
            <button
              key={tab.id}
              type="button"
              className={`dock__btn ${isCamera ? 'dock__btn--fab' : ''} ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className="dock__icon">
                <Icon size={isCamera ? 24 : 20} />
              </span>
              <span className="dock__label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {settingsOpen && (
        <div className="sheet-backdrop" onClick={() => setSettingsOpen(false)} role="presentation">
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={ui.settingsTitle}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="sheet__grip" aria-hidden="true" />
            <header className="sheet__head">
              <h2>{ui.settingsTitle}</h2>
              <button type="button" className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="Close">
                <X size={20} />
              </button>
            </header>

            <h3 className="sheet__label">{ui.languageLabel}</h3>
            <div className="lang-grid">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  className={`lang-grid__btn ${language === opt.code ? 'is-active' : ''}`}
                  onClick={() => onChangeLanguage(opt.code)}
                  aria-pressed={language === opt.code}
                >
                  {opt.nativeLabel}
                </button>
              ))}
            </div>

            <h3 className="sheet__label">{ui.styleLabel}</h3>
            <div className="segmented" role="radiogroup" aria-label={ui.styleLabel}>
              {PERSONA_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={persona === p.id}
                  className={persona === p.id ? 'is-active' : ''}
                  onClick={() => onChangePersona(p.id)}
                >
                  {ui.personas[p.id]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`toggle-row ${a11yMode ? 'is-on' : ''}`}
              onClick={onToggleA11y}
              aria-pressed={a11yMode}
            >
              <Accessibility size={20} />
              <span>{a11yMode ? ui.easyModeOn : ui.easyMode}</span>
              <span className="toggle-row__switch" aria-hidden="true" />
            </button>

            <button type="button" className="toggle-row" onClick={onOpenAdmin}>
              <BarChart3 size={20} />
              <span>{ui.deptInsights}</span>
            </button>
          </section>
        </div>
      )}

      {onboardStep !== null && (
        <div className="onboard" role="dialog" aria-modal="true" aria-label={ui.onboarding[onboardStep].title}>
          <div className="onboard__card">
            <div className={`onboard__art step-${onboardStep}`} aria-hidden="true">
              {onboardStep === 0 && <Languages size={44} />}
              {onboardStep === 1 && (
                <div className="onboard__labels">
                  <span className="is-history">
                    <ShieldCheck size={16} /> {ui.recordedHistory}
                  </span>
                  <span className="is-folklore">
                    <BookOpen size={16} /> {ui.localFolklore}
                  </span>
                </div>
              )}
              {onboardStep === 2 && <WifiOff size={44} />}
            </div>
            <h2>{ui.onboarding[onboardStep].title}</h2>
            <p>{ui.onboarding[onboardStep].body}</p>
            <div className="onboard__dots" aria-hidden="true">
              {ui.onboarding.map((_, i) => (
                <span key={i} className={i === onboardStep ? 'is-active' : ''} />
              ))}
            </div>
            <div className="onboard__actions">
              <button type="button" className="text-btn" onClick={finishOnboarding}>
                {ui.onboardingSkip}
              </button>
              <button
                type="button"
                className="btn-primary btn-primary--compact"
                onClick={() =>
                  onboardStep < ui.onboarding.length - 1 ? setOnboardStep(onboardStep + 1) : finishOnboarding()
                }
              >
                {onboardStep < ui.onboarding.length - 1 ? ui.onboardingNext : ui.onboardingStart}
              </button>
            </div>
          </div>
        </div>
      )}

      <EmergencyModal
        destinationSlug={destinationSlug}
        open={sosOpen}
        onClose={() => setSosOpen(false)}
        language={language}
        userCoords={userCoords}
        offlinePack={offlinePack}
      />
    </div>
  );
}
