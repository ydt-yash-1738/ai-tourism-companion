import { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { CitySelectorView } from './components/CitySelectorView';
import { CompanionShell } from './components/CompanionShell';
import { SERVER_STATUS_EVENT, getMonuments, getOfflinePack, pingServer } from './services/api';
import { getOrCreateSessionHash, loadOfflinePack, saveOfflinePack } from './services/offlineStore';
import type { Monument, OfflinePack, PersonaType } from './types/api';

type AppScreen = 'landing' | 'companion' | 'admin';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(() =>
    window.location.hash === '#admin' ? 'admin' : 'landing',
  );
  const [language, setLanguage] = useState<string>('en');
  const [persona, setPersona] = useState<PersonaType>('quick');
  const [a11yMode, setA11yMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [serverReachable, setServerReachable] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [monuments, setMonuments] = useState<Monument[]>([]);
  const [monumentsRetry, setMonumentsRetry] = useState(0);
  const [monumentsSettledKey, setMonumentsSettledKey] = useState<string | null>(null);
  const [monumentsError, setMonumentsError] = useState<string | null>(null);

  const [offlinePack, setOfflinePack] = useState<OfflinePack | null>(() => loadOfflinePack('agra'));
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
    screen === 'companion' && isOnline ? `companion|${monumentsRetry}` : null;
  const monumentsLoading = Boolean(monumentsReqKey && monumentsSettledKey !== monumentsReqKey);

  // First launch: load the content pack bundled inside the app so everything
  // works with no network and no backend. A later online download refreshes it.
  useEffect(() => {
    if (offlinePack) return;
    let active = true;
    fetch(`${import.meta.env.BASE_URL}packs/agra.json`)
      .then((res) => (res.ok ? (res.json() as Promise<OfflinePack>) : null))
      .then((pack) => {
        if (!active || !pack) return;
        saveOfflinePack('agra', pack);
        setOfflinePack(pack);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [offlinePack]);

  // Track whether the API is actually reachable, not just whether the phone has a network
  useEffect(() => {
    const onStatus = (e: Event) => setServerReachable((e as CustomEvent<boolean>).detail);
    window.addEventListener(SERVER_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(SERVER_STATUS_EVENT, onStatus);
  }, []);

  useEffect(() => {
    if (!isOnline || serverReachable) return;
    const timer = window.setInterval(() => {
      void pingServer();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [isOnline, serverReachable]);

  useEffect(() => {
    if (!monumentsReqKey) return;
    let active = true;
    getMonuments('agra')
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
  }, [monumentsReqKey]);

  const activeMonuments = monuments.length > 0 ? monuments : (offlinePack?.monuments ?? []);

  const handleSelectAgra = (coords?: { lat: number; lng: number } | null) => {
    if (coords) setUserCoords(coords);
    setScreen('companion');
    window.location.hash = 'agra';
  };

  const handleDownloadOfflinePack = async () => {
    if (downloadingPack || !isOnline) return;
    setDownloadingPack(true);
    setOfflinePackError(null);
    try {
      const pack = await getOfflinePack('agra');
      saveOfflinePack('agra', pack);
      setOfflinePack(pack);
      setMonuments(pack.monuments);
      setMonumentsError(null);
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
        language={language}
        persona={persona}
        a11yMode={a11yMode}
        isOnline={isOnline}
        serverReachable={serverReachable}
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
      onSelectAgra={handleSelectAgra}
      onOpenAdmin={() => {
        setScreen('admin');
        window.location.hash = 'admin';
      }}
    />
  );
}
