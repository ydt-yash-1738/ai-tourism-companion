import { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { CitySelectorView } from './components/CitySelectorView';
import { CompanionShell } from './components/CompanionShell';
import { getMonuments, getOfflinePack } from './services/api';
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
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [monuments, setMonuments] = useState<Monument[]>([]);
  const [offlinePack, setOfflinePack] = useState<OfflinePack | null>(() => loadOfflinePack('agra'));
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

  useEffect(() => {
    if (screen !== 'companion' || !isOnline) return;
    let active = true;
    getMonuments('agra')
      .then((list) => {
        if (active) setMonuments(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [screen, isOnline]);

  const activeMonuments = monuments.length > 0 ? monuments : (offlinePack?.monuments ?? []);

  const handleSelectAgra = (coords?: { lat: number; lng: number } | null) => {
    if (coords) setUserCoords(coords);
    setScreen('companion');
    window.location.hash = 'agra';
  };

  const handleDownloadOfflinePack = async () => {
    if (downloadingPack || !isOnline) return;
    setDownloadingPack(true);
    try {
      const pack = await getOfflinePack('agra');
      saveOfflinePack('agra', pack);
      setOfflinePack(pack);
      setMonuments(pack.monuments);
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
      onSelectAgra={handleSelectAgra}
      onOpenAdmin={() => {
        setScreen('admin');
        window.location.hash = 'admin';
      }}
    />
  );
}
