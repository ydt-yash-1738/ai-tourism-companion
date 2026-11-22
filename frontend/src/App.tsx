import { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { useScrollParallax } from './hooks/useScrollParallax';
import { CitySelectorView } from './components/CitySelectorView';
import { CompanionShell } from './components/CompanionShell';
import { isLiveDestinationSlug } from './data/upCities';
import { SERVER_STATUS_EVENT, getMonuments, getOfflinePack, getServedDestinationSlugs, pingServer } from './services/api';
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
  useScrollParallax();
  const initial = useMemo(() => parseHashState(), []);
  const [screen, setScreen] = useState<AppScreen>(initial.screen);
  const [selectedSlug, setSelectedSlug] = useState<string>(initial.slug);
  const [language, setLanguage] = useState<string>('en');
  const [persona, setPersona] = useState<PersonaType>('quick');
  const [a11yMode, setA11yMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [serverReachable, setServerReachable] = useState<boolean>(true);
  // destinations the backend has content for (null until known); others run on the bundled pack
  const [servedSlugs, setServedSlugs] = useState<string[] | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [monuments, setMonuments] = useState<Monument[]>([]);
  const [offlinePack, setOfflinePack] = useState<OfflinePack | null>(() =>
    loadOfflinePack(initial.slug),
  );
  const [downloadingPack, setDownloadingPack] = useState(false);

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

  // First launch or destination switch: load the content pack bundled inside the app
  // so everything works with no network and no backend. A later online download refreshes it.
  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}packs/${selectedSlug}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<OfflinePack>) : null))
      .then((pack) => {
        if (!active || !pack) return;
        saveOfflinePack(selectedSlug, pack);
        setOfflinePack(pack);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedSlug]);

  // Track whether the API is actually reachable, not just whether the phone has a network
  useEffect(() => {
    const onStatus = (e: Event) => {
      const reachable = (e as CustomEvent<boolean>).detail;
      setServerReachable(reachable);
      if (!reachable) {
        setServedSlugs(null);
      }
    };
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
    if (screen !== 'companion' || !isOnline || !serverReachable) return;
    let active = true;
    getMonuments(selectedSlug)
      .then((list) => {
        if (active) setMonuments(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [screen, isOnline, serverReachable, selectedSlug]);

  useEffect(() => {
    if (!isOnline || !serverReachable || servedSlugs) return;
    let active = true;
    getServedDestinationSlugs()
      .then((slugs) => {
        if (active) setServedSlugs(slugs);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isOnline, serverReachable, servedSlugs]);

  const activeMonuments = monuments.length > 0 ? monuments : (offlinePack?.monuments ?? []);

  const handleSelectDestination = (slug: string, coords?: { lat: number; lng: number } | null) => {
    const targetSlug = isLiveDestinationSlug(slug) ? slug : 'agra';
    if (coords) setUserCoords(coords);
    if (targetSlug !== selectedSlug) {
      setSelectedSlug(targetSlug);
      setMonuments([]);
      setOfflinePack(loadOfflinePack(targetSlug));
    }
    setScreen('companion');
    window.location.hash = targetSlug;
  };

  const handleDownloadOfflinePack = async () => {
    if (downloadingPack || !isOnline) return;
    const slugToFetch = selectedSlug;
    setDownloadingPack(true);
    try {
      const pack = await getOfflinePack(slugToFetch);
      saveOfflinePack(slugToFetch, pack);
      if (slugToFetch === selectedSlug) {
        setOfflinePack(pack);
        setMonuments(pack.monuments);
      }
    } catch {
      // Offline pack download failed; keep existing cached/bundled pack intact
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
        serverReachable={serverReachable}
        serverHasDestination={!servedSlugs || servedSlugs.includes(selectedSlug)}
        sessionHash={sessionHash}
        userCoords={userCoords}
        monuments={activeMonuments}
        offlinePack={offlinePack}
        downloadingPack={downloadingPack}
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
