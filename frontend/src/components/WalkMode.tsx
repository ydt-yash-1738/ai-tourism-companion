import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Footprints,
  Moon,
  Orbit,
  Pause,
  Play,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { Walk } from '../data/walks';
import { speakText, stopSpeaking, type AudioPlaybackState } from '../services/speech';
import { AvatarCaption } from './AvatarCaption';

type TimeOfDay = 'sunrise' | 'day' | 'sunset' | 'night';

interface WalkModeProps {
  walk: Walk;
  language: string;
  online: boolean;
  onClose: () => void;
}

const SPEEDS = [1, 1.25, 0.85];
const WALK_MS = 2200;
const MAPS_EMBED_KEY = (import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY || '').trim();

function streetViewUrl(lat: number, lng: number, heading: number, pitch = 0, panoId?: string): string {
  if (MAPS_EMBED_KEY) {
    const q = new URLSearchParams({ key: MAPS_EMBED_KEY, heading: String(heading), pitch: String(pitch), fov: '80' });
    if (panoId) q.set('pano', panoId);
    else q.set('location', `${lat},${lng}`);
    return `https://www.google.com/maps/embed/v1/streetview?${q.toString()}`;
  }
  const where = panoId ? `panoid=${encodeURIComponent(panoId)}` : `cbll=${lat},${lng}`;
  return `https://maps.google.com/maps?layer=c&${where}&cbp=12,${heading},0,0,${-pitch}&source=embed&output=svembed`;
}

// Camera moves per stop, alternated so consecutive shots feel like different takes
const MOVES = ['push-left', 'push-right', 'rise', 'push-center'];

/**
 * A narrated video-style tour built from real photographs: the camera pushes into
 * each stop while Raahi speaks, then "walks" forward into the next place. Street View
 * is one tap away at any stop for a free 360° look around.
 */
export function WalkMode({ walk, language, online, onClose }: WalkModeProps) {
  const isHi = language.startsWith('hi');
  const stops = walk.stops;
  const [idx, setIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [time, setTime] = useState<TimeOfDay>('day');
  const [audio, setAudio] = useState<AudioPlaybackState>('idle');
  const [progress, setProgress] = useState(0);
  const [walking, setWalking] = useState(false);
  // 360° Street View is the main stage when online; photos are the fallback
  const [view, setView] = useState<'360' | 'photo'>(online ? '360' : 'photo');
  const show360 = online && view === '360';
  const runRef = useRef(0);

  const stop = stops[idx];
  const narration = isHi ? stop.narrationHi : stop.narration;
  const title = isHi ? stop.titleHi : stop.title;
  const speed = SPEEDS[speedIdx];
  // seconds the camera move should last, roughly the narration length
  const shotSeconds = Math.max(8, narration.length / 14 / speed + 2);

  const goTo = useCallback(
    (next: number) => {
      runRef.current += 1;
      stopSpeaking();
      setAudio('idle');
      setProgress(0);
      setPrevIdx(idx);
      setWalking(true);
      setIdx(next);
      window.setTimeout(() => {
        setWalking(false);
        setPrevIdx(null);
      }, WALK_MS);
    },
    [idx],
  );

  // Play: narrate the current stop, then walk on to the next one
  useEffect(() => {
    if (!playing) return;
    const run = ++runRef.current;
    let cancelled = false;
    const next = () => {
      if (cancelled || run !== runRef.current) return;
      if (idx < stops.length - 1) goTo(idx + 1);
      else setPlaying(false);
    };
    const timer = window.setTimeout(async () => {
      if (cancelled || run !== runRef.current) return;
      if (voiceOn) {
        setProgress(0);
        await speakText(narration, language, (s) => setAudio(s), { onProgress: setProgress, rate: speed });
        window.setTimeout(next, 700);
      } else {
        const ms = Math.max(4000, (narration.length / 15 / speed) * 1000);
        const started = performance.now();
        setAudio('playing');
        const tick = window.setInterval(() => {
          if (cancelled || run !== runRef.current) return window.clearInterval(tick);
          const f = (performance.now() - started) / ms;
          setProgress(Math.min(1, f));
          if (f >= 1) {
            window.clearInterval(tick);
            setAudio('idle');
            window.setTimeout(next, 500);
          }
        }, 200);
      }
    }, walking ? WALK_MS : 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [playing, idx, voiceOn, speed, narration, language, stops.length, goTo, walking]);

  useEffect(() => () => stopSpeaking(), []);

  const togglePlay = () => {
    if (playing) {
      runRef.current += 1;
      stopSpeaking();
      setAudio('idle');
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  // Route schematic: stop positions normalised into a small box
  const route = useMemo(() => {
    const lats = stops.map((s) => s.lat);
    const lngs = stops.map((s) => s.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const span = Math.max(maxLat - minLat, maxLng - minLng) || 1;
    return stops.map((s) => ({
      x: 10 + ((s.lng - minLng) / span) * 60 + (60 - ((maxLng - minLng) / span) * 60) / 2,
      y: 70 - ((s.lat - minLat) / span) * 60 - (60 - ((maxLat - minLat) / span) * 60) / 2,
    }));
  }, [stops]);

  const overall = (idx + (walking ? 0 : progress)) / stops.length;
  const timeIcons: Array<[TimeOfDay, typeof Sun]> = [
    ['sunrise', Sunrise],
    ['day', Sun],
    ['sunset', Sunset],
    ['night', Moon],
  ];

  const shot = (i: number, role: 'now' | 'prev') => {
    const s = stops[i];
    const style = { ['--shot' as string]: `${shotSeconds}s` } as CSSProperties;
    return (
      <div key={`${s.id}-${role}`} className={`cine__shot is-${role} move-${MOVES[i % MOVES.length]} ${playing && role === 'now' ? 'is-rolling' : ''}`} style={style}>
        <img src={s.photo} alt={role === 'now' ? (isHi ? s.titleHi : s.title) : ''} draggable={false} />
      </div>
    );
  };

  return (
    <div className={`walk is-${time}`} role="dialog" aria-modal="true" aria-label={isHi ? walk.titleHi : walk.title}>
      <header className="walk__top">
        <span className="walk__title">
          <Footprints size={18} />
          {isHi ? walk.titleHi : walk.title}
        </span>
        <div className="walk__times" role="radiogroup" aria-label="Time of day">
          {timeIcons.map(([key, Icon]) => (
            <button key={key} type="button" role="radio" aria-checked={time === key} aria-label={key} className={time === key ? 'is-active' : ''} onClick={() => setTime(key)}>
              <Icon size={16} />
            </button>
          ))}
        </div>
        <button type="button" className="walk__close" onClick={onClose} aria-label="Close tour">
          <X size={20} />
        </button>
      </header>

      <div className="walk__timeline" aria-hidden="true">
        {stops.map((s, i) => (
          <span key={s.id}>
            <i style={{ transform: `scaleX(${i < idx ? 1 : i > idx ? 0 : walking ? 0 : progress})` }} />
          </span>
        ))}
      </div>

      <div className="walk__view">
        {show360 ? (
          <div className="walk__sv">
            {/* current stop's panorama, plus the next one loading out of sight */}
            {[idx, idx + 1]
              .filter((i) => i < stops.length)
              .map((i) => (
                <iframe
                  key={`sv-${stops[i].id}`}
                  className={`walk__frame ${i === idx ? 'is-current' : 'is-preload'}`}
                  title={`360° view: ${stops[i].title}`}
                  src={streetViewUrl(stops[i].lat, stops[i].lng, stops[i].heading, stops[i].pitch, stops[i].panoId)}
                  allow="accelerometer; gyroscope; fullscreen"
                  referrerPolicy="no-referrer-when-downgrade"
                  tabIndex={i === idx ? 0 : -1}
                  aria-hidden={i !== idx}
                />
              ))}
          </div>
        ) : (
          <div className="cine" onClick={togglePlay} role="button" aria-label={playing ? 'Pause tour' : 'Play tour'}>
            {prevIdx !== null && shot(prevIdx, 'prev')}
            {shot(idx, 'now')}
            <div className="cine__vignette" aria-hidden="true" />
          </div>
        )}
        <div className="walk__tint" aria-hidden="true" />

        <span className="walk__label">
          <b>{idx + 1}</b>
          {title}
        </span>

        <div className={`walk__walking ${walking ? 'is-on' : ''}`} aria-live="polite">
          <span>{isHi ? 'अगले पड़ाव की ओर' : 'Walking to'}</span>
          <strong>
            {idx + 1}. {title}
          </strong>
          <Footprints size={22} />
        </div>

        {!playing && (
          <button type="button" className="cine__big-play" onClick={togglePlay} aria-label="Play tour">
            <Play size={34} />
          </button>
        )}

        <svg className="walk__route" viewBox="0 0 80 80" aria-hidden="true">
          <polyline points={route.map((p) => `${p.x},${p.y}`).join(' ')} />
          {route.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === idx ? 0 : 3} className={i < idx ? 'is-done' : ''} />
          ))}
          <circle className="walk__route-me" cx={route[idx].x} cy={route[idx].y} r={4.5} />
        </svg>

        {online && (
          <div className="walk__mode" role="radiogroup" aria-label="View">
            <button type="button" role="radio" aria-checked={view === '360'} className={view === '360' ? 'is-active' : ''} onClick={() => setView('360')}>
              <Orbit size={14} /> 360°
            </button>
            <button type="button" role="radio" aria-checked={view === 'photo'} className={view === 'photo' ? 'is-active' : ''} onClick={() => setView('photo')}>
              {isHi ? 'फ़ोटो' : 'Photo'}
            </button>
          </div>
        )}
        {show360 && <span className="walk__hint">{isHi ? 'चारों ओर देखने के लिए खींचें' : 'Drag to look around'}</span>}
      </div>

      <section className="walk__panel">
        <div className="walk__status">
          {isHi ? 'पड़ाव' : 'Stop'} {idx + 1}/{stops.length} · {Math.round(overall * 100)}%
        </div>
        <AvatarCaption
          text={narration}
          status={audio}
          progress={progress}
          size={70}
          tone="dark"
          idleHint={isHi ? 'टूर शुरू करने के लिए प्ले दबाएँ' : 'Press play to start the tour'}
          fullTextLabel={isHi ? 'पूरा पाठ' : 'Full text'}
        />
        <div className="walk__steps" role="tablist" aria-label="Stops">
          {stops.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={i === idx} aria-label={isHi ? s.titleHi : s.title} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''} onClick={() => i !== idx && goTo(i)}>
              {i + 1}
            </button>
          ))}
        </div>
        <div className="walk__controls">
          <button type="button" onClick={() => idx > 0 && goTo(idx - 1)} disabled={idx === 0} aria-label="Previous stop">
            <ChevronLeft size={22} />
          </button>
          <button type="button" className="walk__play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={26} /> : <Play size={26} />}
          </button>
          <button type="button" onClick={() => idx < stops.length - 1 && goTo(idx + 1)} disabled={idx === stops.length - 1} aria-label="Next stop">
            <ChevronRight size={22} />
          </button>
          <button type="button" className="walk__speed" onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)} aria-label="Voice speed">
            {speed}×
          </button>
          <button type="button" onClick={() => setVoiceOn((v) => !v)} aria-label={voiceOn ? 'Mute voice' : 'Turn voice on'} className={voiceOn ? 'is-on' : ''}>
            {voiceOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </section>
    </div>
  );
}
