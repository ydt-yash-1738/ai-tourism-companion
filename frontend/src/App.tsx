import { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { CitySelectorView } from './components/CitySelectorView';
import { CompanionShell } from './components/CompanionShell';
import { isLiveDestinationSlug } from './data/upCities';
import { getMonuments, getOfflinePack } from './services/api';
import { getOrCreateSessionHash, loadOfflinePack, saveOfflinePack } from './services/offlineStore';
import type { Monument, OfflinePack, PersonaType } from './types/api';

type AppScreen = 'landing' | 'companion' | 'admin';

function parseHashState(): { screen: AppScreen; slug: string } {
  const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '').toLowerCase();
  if (hash === 'admin') {
    return { screen: 'admin', slug: 'agra' };
  }
  if (isLiveDestinationSlug(hash)) {
    return { screen: 'companion', slug: hash };
  }
  return { screen: 'landing', slug: 'agra' };
}

export default function App() {
  const initial = useMemo(() => parseHashState(), []);
  const [screen, setScreen] = useState<AppScreen>(initial.screen);
  const [selectedSlug, setSelectedSlug] = useState<string>(initial.slug);
  const [language, setLanguage] = useState<string>('en');
  const [persona, setPersona] = useState<PersonaType>('quick');
  const [a11yMode, setA11yMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [monuments, setMonuments] = useState<Monument[]>([]);
  const [monumentsRetry, setMonumentsRetry] = useState(0);
  const [monumentsSettledKey, setMonumentsSettledKey] = useState<string | null>(null);
  const [monumentsError, setMonumentsError] = useState<string | null>(null);

  const [offlinePack, setOfflinePack] = useState<OfflinePack | null>(() =>
    loadOfflinePack(initial.slug),
  );
  const [downloadingPack, setDownloadingPack] = useState(false);
  const [offlinePackError, setOfflinePackError] = useState<string | null>(null);

  const sessionHash = useMemo(() => getOrCreateSessionHash(), []);

  useEffect(() => {
    document.body.classList.toggle('a11y-mode', a11yMode);
  }, [a11yMode]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const monumentsReqKey =
    screen === 'companion' && isOnline ? `${selectedSlug}|companion|${monumentsRetry}` : null;
  const monumentsLoading = Boolean(monumentsReqKey && monumentsSettledKey !== monumentsReqKey);

  useEffect(() => {
    if (!monumentsReqKey) return;
    let active = true;
    getMonuments(selectedSlug)
      .then((list) => {
        if (!active) return;
        setMonuments(list);
        setMonumentsError(null);
        setMonumentsSettledKey(monumentsReqKey);
      })
      .catch((err) => {
        if (!active) return;
        setMonumentsError(err instanceof Error ? err.message : 'Unable to load monuments.');
        setMonumentsSettledKey(monumentsReqKey);
      });
    return () => {
      active = false;
    };
  }, [monumentsReqKey, selectedSlug]);

  const activeMonuments = monuments.length > 0 ? monuments : (offlinePack?.monuments ?? []);

  const handleSelectDestination = (slug: string, coords?: { lat: number; lng: number } | null) => {
    const targetSlug = isLiveDestinationSlug(slug) ? slug : 'agra';
    if (coords) setUserCoords(coords);
    if (targetSlug !== selectedSlug) {
      setSelectedSlug(targetSlug);
      setMonuments([]);
      setMonumentsError(null);
      setOfflinePackError(null);
      setOfflinePack(loadOfflinePack(targetSlug));
    }
    setScreen('companion');
    window.location.hash = targetSlug;
  };

  const handleDownloadOfflinePack = async () => {
    if (downloadingPack || !isOnline) return;
    const slugToFetch = selectedSlug;
    setDownloadingPack(true);
    setOfflinePackError(null);
    try {
      const pack = await getOfflinePack(slugToFetch);
      saveOfflinePack(slugToFetch, pack);
      if (slugToFetch === selectedSlug) {
        setOfflinePack(pack);
        setMonuments(pack.monuments);
        setMonumentsError(null);
      }
    } catch (err) {
      setOfflinePackError(
        err instanceof Error ? err.message : 'Could not download offline pack.',
      );
    } finally {
      setDownloadingPack(false);
    }
  };

  if (screen === 'admin') {
    return (
      <AdminDashboard
        initialDestinationSlug={selectedSlug}
        onBack={() => {
          setScreen('landing');
          window.location.hash = '';
        }}
      />
    );
  }

  if (screen === 'companion') {
    return (
      <CompanionShell
        key={selectedSlug}
        destinationSlug={selectedSlug}
        language={language}
        persona={persona}
        a11yMode={a11yMode}
        isOnline={isOnline}
        sessionHash={sessionHash}
        userCoords={userCoords}
        monuments={activeMonuments}
        monumentsLoading={monumentsLoading && activeMonuments.length === 0}
        monumentsError={monumentsError}
        onRetryMonuments={() => setMonumentsRetry((n) => n + 1)}
        offlinePack={offlinePack}
        downloadingPack={downloadingPack}
        offlinePackError={offlinePackError}
        onDismissOfflinePackError={() => setOfflinePackError(null)}
        onChangeLanguage={setLanguage}
        onChangePersona={setPersona}
        onToggleA11y={() => setA11yMode((v) => !v)}
        onDownloadOfflinePack={handleDownloadOfflinePack}
        onBackToCities={() => {
          setScreen('landing');
          window.location.hash = '';
        }}
        onOpenAdmin={() => {
          setScreen('admin');
          window.location.hash = 'admin';
        }}
      />
    );
  }

  return (
    <CitySelectorView
      language={language}
      a11yMode={a11yMode}
      userCoords={userCoords}
      onLocationDetected={(coords) => setUserCoords(coords)}
      onChangeLanguage={setLanguage}
      onToggleA11y={() => setA11yMode((v) => !v)}
      onSelectDestination={handleSelectDestination}
      onOpenAdmin={() => {
        setScreen('admin');
        window.location.hash = 'admin';
      }}
    />
  );
}
