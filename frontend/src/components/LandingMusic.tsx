import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Music, VolumeX } from 'lucide-react';

// Raga Kiravani on the veena, L. Ramakrishnan (CC0, Wikimedia Commons); a calm
// 3-minute excerpt with fades so it loops smoothly. See public/images/CREDITS.md.
const TRACK = `${import.meta.env.BASE_URL}audio/landing-veena-kiravani.mp3`;
const VOLUME = 0.4;
const OFF_KEY = 'up_lp_music_off';

interface LandingMusicProps {
  language: string;
}

/**
 * Soft classical music on the landing page only, on by default. The Android app
 * starts it straight away (MainActivity lets its WebView autoplay); web browsers
 * allow sound only after the visitor interacts, so there it starts on the first
 * tap or key press. Turning it off lasts for the visit. The button is rendered on
 * <body> so it stays fixed in the corner while the page scrolls. Leaving the landing page unmounts this and
 * stops the music; it also pauses while the tab or app is in the background.
 */
export function LandingMusic({ language }: LandingMusicProps) {
  const isHi = language.startsWith('hi');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef(0);
  const [wantOn, setWantOn] = useState(() => {
    try {
      return sessionStorage.getItem(OFF_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [playing, setPlaying] = useState(false);

  const fadeTo = (target: number, ms: number, done?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    window.clearInterval(fadeRef.current);
    const start = audio.volume;
    const t0 = performance.now();
    fadeRef.current = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      audio.volume = start + (target - start) * k;
      if (k >= 1) {
        window.clearInterval(fadeRef.current);
        done?.();
      }
    }, 50);
  };

  const start = () => {
    const audio = audioRef.current;
    if (!audio || !audio.paused) return;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        setPlaying(true);
        fadeTo(VOLUME, 1500);
      })
      .catch(() => undefined); // still blocked: the next interaction tries again
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    fadeTo(0, 400, () => {
      audio.pause();
      setPlaying(false);
    });
  };

  // create the player once; release it when leaving the landing page
  useEffect(() => {
    const audio = new Audio(TRACK);
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => {
      window.clearInterval(fadeRef.current);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // start on the first interaction (and try right away, for app WebViews that allow it)
  useEffect(() => {
    if (!wantOn) return;
    start();
    const onFirst = (e: Event) => {
      // taps on the music button are handled by the button itself
      if ((e.target as Element | null)?.closest?.('.landing-music')) return;
      start();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', onFirst, opts);
    window.addEventListener('keydown', onFirst, opts);
    window.addEventListener('touchstart', onFirst, opts);
    return () => {
      window.removeEventListener('pointerdown', onFirst, opts);
      window.removeEventListener('keydown', onFirst, opts);
      window.removeEventListener('touchstart', onFirst, opts);
    };
    // start() only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantOn]);

  // quiet while the page is in the background
  useEffect(() => {
    const onVisibility = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) audio.pause();
      else if (wantOn && playing) void audio.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [wantOn, playing]);

  const toggle = () => {
    const audio = audioRef.current;
    const next = !(audio && !audio.paused);
    setWantOn(next);
    try {
      sessionStorage.setItem(OFF_KEY, next ? '0' : '1');
    } catch {
      // the choice applies for this visit
    }
    if (next) start();
    else stop();
  };

  const label = playing
    ? isHi
      ? 'संगीत बंद करें'
      : 'Turn music off'
    : isHi
      ? 'संगीत चालू करें'
      : 'Turn music on';

  return createPortal(
    <button
      type="button"
      className={`landing-music ${playing ? 'is-playing' : ''}`}
      onClick={toggle}
      aria-pressed={playing}
      aria-label={label}
      title={label}
    >
      {playing ? (
        <span className="landing-music__bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : wantOn ? (
        <Music size={18} aria-hidden="true" />
      ) : (
        <VolumeX size={18} aria-hidden="true" />
      )}
    </button>,
    document.body,
  );
}
