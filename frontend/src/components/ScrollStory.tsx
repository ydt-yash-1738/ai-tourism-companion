import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scroll-driven landing story.
 * Opens on a full-screen photograph of the Taj Mahal. As the visitor scrolls,
 * the photo shrinks into a framed card, the background moves through the
 * colours of a day at the monument, and text panels arrive one after another.
 * All motion is written straight to the DOM in one requestAnimationFrame, so
 * React does not re-render while scrolling.
 */

export interface StoryPanel {
  kicker: string;
  title: string;
  body?: string;
}

export interface StorySlide {
  id: string;
  photo: string;
  alt: string;
  kicker: string;
  title: string;
}

interface ScrollStoryProps {
  slides: StorySlide[];
  active: number;
  onActiveChange: (index: number) => void;
  /** cycle through slides while the visitor is still at the top of the page */
  autoplay: boolean;
  introCue: string;
  panels: StoryPanel[];
  finalPanel: ReactNode;
  topbar: ReactNode;
  /** shown on the first screen under the place picker (e.g. a location button) */
  introAction?: ReactNode;
}

// Night navy -> Mughal sandstone -> dawn saffron -> garden emerald
const STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [7, 17, 31]],
  [0.3, [11, 27, 51]],
  [0.5, [110, 42, 29]],
  [0.7, [176, 80, 24]],
  [0.92, [12, 86, 54]],
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const rgb = (c: [number, number, number]) => `rgb(${c.join(',')})`;

export function ScrollStory({
  slides,
  active,
  onActiveChange,
  autoplay,
  introCue,
  panels,
  finalPanel,
  topbar,
  introAction,
}: ScrollStoryProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [staticMode] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const allPanels = panels.length + 1;
  const atTopRef = useRef(true);
  const slide = slides[active] ?? slides[0];

  // Auto-advance the places only while the page sits at the top; once the visitor
  // scrolls into the story, the place they were looking at stays put.
  // The first place gets longer: its title is still animating in when the page opens.
  const [firstShown, setFirstShown] = useState(false);
  const dwellMs = firstShown ? 6500 : 9000;
  useEffect(() => {
    if (!autoplay || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      setFirstShown(true);
      if (atTopRef.current) onActiveChange((active + 1) % slides.length);
    }, dwellMs);
    return () => window.clearTimeout(timer);
  }, [autoplay, active, slides.length, onActiveChange, dwellMs]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || staticMode) return;
    const bgLayers = Array.from(root.querySelectorAll<HTMLElement>('.story__bg'));
    const frame = root.querySelector<HTMLElement>('.story__frame')!;
    const img = root.querySelector<HTMLElement>('.story__photos')!;
    const scrim = root.querySelector<HTMLElement>('.story__scrim')!;
    const intro = root.querySelector<HTMLElement>('.story__intro')!;
    const panelEls = Array.from(root.querySelectorAll<HTMLElement>('.story__panel'));
    const dots = Array.from(root.querySelectorAll<HTMLElement>('.story__dots span'));

    let raf = 0;
    let lastY = -1;
    let idleFrames = 0;
    // Runs every frame while the page is moving (including Android fling), then stops
    const tick = () => {
      const y = window.scrollY;
      if (y !== lastY) {
        lastY = y;
        idleFrames = 0;
        render();
      } else if (++idleFrames > 12) {
        raf = 0;
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    const render = () => {
      const rect = root.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = clamp(-rect.top / Math.max(1, travel));
      atTopRef.current = p < 0.02;
      const wide = window.innerWidth >= 900;

      // Photo: full-bleed -> framed card (right on desktop, top on phones)
      const t = smooth(0.04, 0.3, p);
      // Phones: give the final panel (with its buttons) more room by tucking the card higher
      const t2 = wide ? 0 : smooth(0.74, 0.86, p);
      const scale = wide ? lerp(1, 0.5, t) : lerp(lerp(1, 0.56, t), 0.44, t2);
      const tx = wide ? lerp(0, window.innerWidth * 0.225, t) : 0;
      const ty = wide ? 0 : lerp(lerp(0, -window.innerHeight * 0.12, t), -window.innerHeight * 0.21, t2);
      // Only transform and opacity change per frame, so the GPU moves pre-drawn layers
      frame.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      frame.classList.toggle('is-card', t > 0.01);
      img.style.transform = `scale(${lerp(1.12, 1, p)})`;
      scrim.style.opacity = `${lerp(1, 0.15, t)}`;
      intro.style.opacity = `${1 - smooth(0.02, 0.16, p)}`;
      intro.style.transform = `translate3d(0, ${-smooth(0.02, 0.16, p) * 40}px, 0)`;
      bgLayers.forEach((layer, k) => {
        if (k === 0) return;
        layer.style.opacity = `${smooth(STOPS[k - 1][0], STOPS[k][0], p)}`;
      });

      // Panels: each owns a window of the scroll; the last one stays
      const start = 0.28;
      const span = (1 - start) / allPanels;
      let active = -1;
      panelEls.forEach((el, i) => {
        const c = start + span * (i + 0.5);
        const enter = smooth(c - span * 0.75, c - span * 0.2, p);
        const leave = i === allPanels - 1 ? 0 : smooth(c + span * 0.2, c + span * 0.75, p);
        const o = enter * (1 - leave);
        el.style.opacity = `${o}`;
        el.style.transform = `translate3d(0, ${(1 - enter) * 60 - leave * 60}px, 0)`;
        el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
        if (o > 0.5) active = i;
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
    };
    const schedule = () => {
      if (!raf) {
        idleFrames = 0;
        raf = window.requestAnimationFrame(tick);
      }
    };
    render();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [staticMode, allPanels]);

  return (
    <section
      ref={rootRef}
      className={`story ${staticMode ? 'is-static' : ''}`}
      style={{ ['--panels' as string]: allPanels }}
    >
      <div className="story__stage">
        {STOPS.map(([, color], k) => (
          <div key={k} className="story__bg" style={{ backgroundColor: rgb(color), opacity: k === 0 ? 1 : 0 }} aria-hidden="true" />
        ))}
        <div className="story__topbar">{topbar}</div>

        <figure className="story__frame">
          <div className="story__photos">
            {slides.map((sl, i) => (
              <img
                key={sl.id}
                src={sl.photo}
                alt={i === active ? sl.alt : ''}
                aria-hidden={i !== active}
                className={i === active ? 'is-active' : ''}
                decoding="async"
                fetchPriority={i === 0 ? 'high' : 'auto'}
              />
            ))}
          </div>
          <div className="story__scrim" aria-hidden="true" />
        </figure>

        <div className="story__intro">
          <span key={`k-${slide.id}`} className="story__intro-kicker">
            {slide.kicker}
          </span>
          <h1 key={`t-${slide.id}`} className="story__intro-title">
            {slide.title}
          </h1>
          {slides.length > 1 && (
            <div className="story__picker" role="tablist" aria-label="Choose a place">
              {slides.map((sl, i) => (
                <button
                  key={sl.id}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  className={i === active ? 'is-active' : ''}
                  onClick={() => onActiveChange(i)}
                >
                  {sl.title}
                  {autoplay && i === active && (
                    <span className="story__picker-fill" style={{ animationDuration: `${dwellMs}ms` }} />
                  )}
                </button>
              ))}
            </div>
          )}
          {introAction && <div className="story__intro-action">{introAction}</div>}
          <span className="story__cue" aria-hidden="true">
            <span className="story__mouse" />
            {introCue}
          </span>
        </div>

        <div className="story__panels">
          {panels.map((panel, i) => (
            <article key={panel.title} className="story__panel" style={{ ['--i' as string]: i }}>
              <span className="story__panel-kicker">{panel.kicker}</span>
              <h2 className="story__panel-title">{panel.title}</h2>
              {panel.body && <p className="story__panel-body">{panel.body}</p>}
            </article>
          ))}
          <article className="story__panel story__panel--final">{finalPanel}</article>
        </div>

        <div className="story__dots" aria-hidden="true">
          {Array.from({ length: allPanels }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
