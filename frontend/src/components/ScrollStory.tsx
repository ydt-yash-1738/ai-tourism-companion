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

interface ScrollStoryProps {
  photoSrc: string;
  photoAlt: string;
  introKicker: string;
  introTitle: string;
  introCue: string;
  panels: StoryPanel[];
  finalPanel: ReactNode;
  topbar: ReactNode;
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

function colorAt(p: number): string {
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i];
    const [p0, c0] = STOPS[i - 1];
    if (p <= p1) {
      const t = smooth(p0, p1, p);
      return `rgb(${c0.map((c, k) => Math.round(lerp(c, c1[k], t))).join(',')})`;
    }
  }
  const last = STOPS[STOPS.length - 1][1];
  return `rgb(${last.join(',')})`;
}

export function ScrollStory({
  photoSrc,
  photoAlt,
  introKicker,
  introTitle,
  introCue,
  panels,
  finalPanel,
  topbar,
}: ScrollStoryProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [staticMode] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const allPanels = panels.length + 1;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || staticMode) return;
    const stage = root.querySelector<HTMLElement>('.story__stage')!;
    const frame = root.querySelector<HTMLElement>('.story__frame')!;
    const img = root.querySelector<HTMLElement>('.story__frame img')!;
    const scrim = root.querySelector<HTMLElement>('.story__scrim')!;
    const intro = root.querySelector<HTMLElement>('.story__intro')!;
    const panelEls = Array.from(root.querySelectorAll<HTMLElement>('.story__panel'));
    const dots = Array.from(root.querySelectorAll<HTMLElement>('.story__dots span'));

    let raf = 0;
    const render = () => {
      raf = 0;
      const rect = root.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = clamp(-rect.top / Math.max(1, travel));
      const wide = window.innerWidth >= 900;

      // Photo: full-bleed -> framed card (right on desktop, top on phones)
      const t = smooth(0.04, 0.3, p);
      // Phones: give the final panel (with its buttons) more room by tucking the card higher
      const t2 = wide ? 0 : smooth(0.74, 0.86, p);
      const scale = wide ? lerp(1, 0.5, t) : lerp(lerp(1, 0.56, t), 0.44, t2);
      const tx = wide ? lerp(0, window.innerWidth * 0.225, t) : 0;
      const ty = wide ? 0 : lerp(lerp(0, -window.innerHeight * 0.12, t), -window.innerHeight * 0.21, t2);
      frame.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      frame.style.borderRadius = `${lerp(0, 34, t) / scale}px`;
      frame.style.boxShadow = `0 ${lerp(0, 40, t)}px ${lerp(0, 90, t)}px rgba(0,0,0,${lerp(0, 0.45, t)})`;
      img.style.transform = `scale(${lerp(1.12, 1, p)})`;
      scrim.style.opacity = `${lerp(1, 0.15, t)}`;
      intro.style.opacity = `${1 - smooth(0.02, 0.16, p)}`;
      intro.style.transform = `translate3d(0, ${-smooth(0.02, 0.16, p) * 40}px, 0)`;
      stage.style.backgroundColor = colorAt(p);

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
      if (!raf) raf = window.requestAnimationFrame(render);
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
        <div className="story__topbar">{topbar}</div>

        <figure className="story__frame">
          <img src={photoSrc} alt={photoAlt} decoding="async" fetchPriority="high" />
          <div className="story__scrim" aria-hidden="true" />
        </figure>

        <div className="story__intro">
          <span className="story__intro-kicker">{introKicker}</span>
          <h1 className="story__intro-title">{introTitle}</h1>
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
