import { useState } from 'react';
import {
  Accessibility,
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  Compass,
  Download,
  Headphones,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
import { LANGUAGE_OPTIONS, PERSONA_OPTIONS } from '../data/upCities';
import type { Monument, OfflinePack, PersonaType } from '../types/api';
import { CameraTab } from './CameraTab';
import { EmergencyModal } from './EmergencyModal';
import { FacilitiesTab } from './FacilitiesTab';
import { GuideTab } from './GuideTab';
import { NearbyTab } from './NearbyTab';
import { TourTab } from './TourTab';

export type CompanionTabId = 'guide' | 'camera' | 'tour' | 'nearby' | 'facilities';

interface CompanionShellProps {
  language: string;
  persona: PersonaType;
  a11yMode: boolean;
  isOnline: boolean;
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

export function CompanionShell({
  language,
  persona,
  a11yMode,
  isOnline,
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
  const [activeTab, setActiveTab] = useState<CompanionTabId>('guide');
  const [sosOpen, setSosOpen] = useState(false);

  const tabs: Array<{
    id: CompanionTabId;
    label: string;
    icon: typeof MessageSquare;
  }> = [
    { id: 'guide', label: ui.tabs.guide, icon: MessageSquare },
    { id: 'camera', label: ui.tabs.camera, icon: Camera },
    { id: 'tour', label: ui.tabs.tour, icon: Headphones },
    { id: 'nearby', label: ui.tabs.nearby, icon: Compass },
    { id: 'facilities', label: ui.tabs.facilities, icon: MapPin },
  ];

  return (
    <div className="companion-shell">
      <div className="tricolour-bar" />

      <header className="companion-topbar">
        <div className="companion-topbar__row">
          <div className="companion-topbar__left">
            <button
              type="button"
              className="pill-btn"
              onClick={onBackToCities}
              aria-label="Back to UP Heritage Cities"
              style={{ padding: '8px 10px' }}
            >
              <ArrowLeft size={17} />
            </button>

            <div style={{ minWidth: 0 }}>
              <div className="companion-topbar__city">{ui.companionTitle}</div>
              <div className="companion-topbar__sub">
                <span className="compact-mobile-hide">{ui.upTourismLabel}</span>
                <span className={`status-pill ${isOnline ? 'is-online' : 'is-offline'}`}>
                  {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  <span>{isOnline ? ui.online : ui.offline}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="companion-topbar__controls">
            <button
              type="button"
              className={`pill-btn ${offlinePack ? 'is-emerald' : ''}`}
              onClick={onDownloadOfflinePack}
              disabled={downloadingPack}
              style={{ padding: '7px 11px', minHeight: 40 }}
            >
              {downloadingPack ? (
                <Loader2 size={15} className="spin-icon" />
              ) : offlinePack ? (
                <Check size={15} />
              ) : (
                <Download size={15} />
              )}
              <span className="compact-mobile-hide">
                {downloadingPack ? '...' : offlinePack ? ui.offlineReady : ui.offlinePack}
              </span>
            </button>

            <button
              type="button"
              className="pill-btn"
              onClick={onOpenAdmin}
              aria-label="Open Tourism Department Insights"
              style={{ padding: '7px 10px', minHeight: 40 }}
            >
              <BarChart3 size={16} />
            </button>

            <button type="button" className="sos-btn" onClick={() => setSosOpen(true)}>
              <ShieldAlert size={16} />
              <span>SOS</span>
            </button>
          </div>
        </div>
      </header>

      <div className="control-ribbon">
        <div className="control-ribbon__inner">
          <div className="control-ribbon__group">
            <span className="control-ribbon__label">{ui.langLabel}</span>
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
              style={{ minHeight: 36, padding: '4px 11px', fontSize: '0.8rem' }}
              onClick={onToggleA11y}
              aria-pressed={a11yMode}
            >
              <Accessibility size={15} />
              <span>{a11yMode ? ui.easyModeOn : ui.easyMode}</span>
            </button>
          </div>

          <div className="control-ribbon__group">
            <span className="control-ribbon__label">{ui.styleLabel}</span>
            {PERSONA_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`persona-chip ${persona === p.id ? 'is-active' : ''}`}
                onClick={() => onChangePersona(p.id)}
                title={p.hint}
              >
                {ui.personas[p.id]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <nav className="desktop-tabs" aria-label="Companion Sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`desktop-tabs__btn ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="companion-main">
        {!isOnline && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            <span>{ui.offlineBanner}</span>
          </div>
        )}

        {activeTab === 'guide' && (
          <GuideTab
            language={language}
            persona={persona}
            simpleLanguage={a11yMode}
            isOnline={isOnline}
            sessionHash={sessionHash}
            monuments={monuments}
            offlinePack={offlinePack}
          />
        )}

        {activeTab === 'camera' && (
          <CameraTab
            language={language}
            persona={persona}
            simpleLanguage={a11yMode}
            isOnline={isOnline}
            sessionHash={sessionHash}
            userCoords={userCoords}
          />
        )}

        {activeTab === 'tour' && (
          <TourTab
            language={language}
            persona={persona}
            isOnline={isOnline}
            sessionHash={sessionHash}
            userCoords={userCoords}
            monuments={monuments}
            offlinePack={offlinePack}
          />
        )}

        {activeTab === 'nearby' && (
          <NearbyTab
            language={language}
            isOnline={isOnline}
            userCoords={userCoords}
            offlinePack={offlinePack}
          />
        )}

        {activeTab === 'facilities' && (
          <FacilitiesTab
            language={language}
            isOnline={isOnline}
            sessionHash={sessionHash}
            userCoords={userCoords}
            offlinePack={offlinePack}
          />
        )}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`mobile-bottom-nav__btn ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={19} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <EmergencyModal
        open={sosOpen}
        onClose={() => setSosOpen(false)}
        language={language}
        userCoords={userCoords}
        offlinePack={offlinePack}
      />
    </div>
  );
}
