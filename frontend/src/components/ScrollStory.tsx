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

    /** Everything the story shows at scroll progress p (0..1): only transforms and opacities. */
    const computeFrame = (p: number, vw: number, vh: number) => {
      const wide = vw >= 900;
      // Photo: full-bleed -> framed card (right on desktop, top on phones)
      const t = smooth(0.04, 0.3, p);
      // Phones: give the final panel (with its buttons) more room by tucking the card higher
      const t2 = wide ? 0 : smooth(0.74, 0.86, p);
      const scale = wide ? lerp(1, 0.5, t) : lerp(lerp(1, 0.56, t), 0.44, t2);
      const tx = wide ? lerp(0, vw * 0.225, t) : 0;
      const ty = wide ? 0 : lerp(lerp(0, -vh * 0.12, t), -vh * 0.21, t2);
      const introFade = smooth(0.02, 0.16, p);
      const start = 0.28;
      const span = (1 - start) / allPanels;
      const panels = panelEls.map((_, i) => {
        const c = start + span * (i + 0.5);
        const enter = smooth(c - span * 0.75, c - span * 0.2, p);
        const leave = i === allPanels - 1 ? 0 : smooth(c + span * 0.2, c + span * 0.75, p);
        return { opacity: enter * (1 - leave), y: (1 - enter) * 60 - leave * 60 };
      });
      return {
        card: t,
        frame: `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`,
        img: `scale(${lerp(1.12, 1, p).toFixed(4)})`,
        scrim: lerp(1, 0.15, t),
        introOpacity: 1 - introFade,
        intro: `translate3d(0, ${(-introFade * 40).toFixed(1)}px, 0)`,
        bg: bgLayers.map((_, k) => (k === 0 ? 1 : smooth(STOPS[k - 1][0], STOPS[k][0], p))),
        panels,
      };
    };

    // where the story sits on the page, measured on mount and on resize (never per frame)
    let origin = 0;
    let span = 1;
    const measure = () => {
      origin = root.getBoundingClientRect().top + window.scrollY;
      span = Math.max(1, root.offsetHeight - window.innerHeight);
    };
    measure();
    const progress = () => clamp((window.scrollY - origin) / span);

    // Low-frequency state (classes, pointer events, dots) that CSS cannot drive.
    // Written only when it changes, so scrolling does not restyle the page.
    let lastState = '';
    const applyState = (f: ReturnType<typeof computeFrame>, p: number) => {
      atTopRef.current = p < 0.02;
      const isCard = f.card > 0.01;
      const live = f.panels.map((pn) => pn.opacity > 0.6);
      let active = -1;
      f.panels.forEach((pn, i) => {
        if (pn.opacity > 0.5) active = i;
      });
      const key = `${isCard}|${live.join(',')}|${active}`;
      if (key === lastState) return;
      lastState = key;
      frame.classList.toggle('is-card', isCard);
      live.forEach((on, i) => {
        panelEls[i].style.pointerEvents = on ? 'auto' : 'none';
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
    };

    // Preferred: scroll-driven CSS animations. The browser runs them on the
    // compositor, in step with the finger, with no JavaScript per frame.
    const cssScroll =
      typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: scroll()') && CSS.supports('animation-range: 0px 100px');

    if (cssScroll) {
      const styleEl = document.createElement('style');
      document.head.appendChild(styleEl);
      const animated: HTMLElement[] = [frame, img, scrim, intro, ...bgLayers.slice(1), ...panelEls];
      const build = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        measure();
        const from = Math.round(origin);
        const to = Math.round(origin + span);
        const STEPS = 48;
        const kf: Record<string, string[]> = {};
        const add = (name: string, pct: string, body: string) => (kf[name] ||= []).push(`${pct}{${body}}`);
        for (let s = 0; s <= STEPS; s++) {
          const p = s / STEPS;
          const pct = `${((s / STEPS) * 100).toFixed(2)}%`;
          const f = computeFrame(p, vw, vh);
          add('frame', pct, `transform:${f.frame}`);
          add('img', pct, `transform:${f.img}`);
          add('scrim', pct, `opacity:${f.scrim.toFixed(3)}`);
          add('intro', pct, `opacity:${f.introOpacity.toFixed(3)};transform:${f.intro}`);
          f.bg.forEach((o, k) => k > 0 && add(`bg${k}`, pct, `opacity:${o.toFixed(3)}`));
          f.panels.forEach((pn, i) =>
            add(`panel${i}`, pct, `opacity:${pn.opacity.toFixed(3)};transform:translate3d(0,${pn.y.toFixed(1)}px,0)`),
          );
        }
        const rule = (name: string, sel: string) =>
          `@keyframes story-${name}{${kf[name].join('')}}${sel}{animation:story-${name} linear both;animation-timeline:scroll(root block);animation-range:${from}px ${to}px}`;
        styleEl.textContent = [
          rule('frame', '.story .story__frame'),
          rule('img', '.story .story__photos'),
          rule('scrim', '.story .story__scrim'),
          rule('intro', '.story .story__intro'),
          ...bgLayers.slice(1).map((_, i) => rule(`bg${i + 1}`, `.story .story__bg:nth-of-type(${i + 2})`)),
          ...panelEls.map((_, i) => rule(`panel${i}`, `.story .story__panel:nth-of-type(${i + 1})`)),
        ].join('\n');
        // inline styles from an earlier frame would fight the animations
        animated.forEach((el) => {
          el.style.transform = '';
          el.style.opacity = '';
        });
      };
      let stateRaf = 0;
      const onScroll = () => {
        if (stateRaf) return;
        stateRaf = window.requestAnimationFrame(() => {
          stateRaf = 0;
          const p = progress();
          applyState(computeFrame(p, window.innerWidth, window.innerHeight), p);
        });
      };
      let resizeTimer = 0;
      const onResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          build();
          onScroll();
        }, 150);
      };
      build();
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        window.clearTimeout(resizeTimer);
        if (stateRaf) window.cancelAnimationFrame(stateRaf);
        styleEl.remove();
      };
    }

    // Fallback (older WebViews): drive the same frames from JavaScript.
    let raf = 0;
    let lastY = -1;
    let idleFrames = 0;
    const render = () => {
      const p = progress();
      const f = computeFrame(p, window.innerWidth, window.innerHeight);
      frame.style.transform = f.frame;
      img.style.transform = f.img;
      scrim.style.opacity = `${f.scrim}`;
      intro.style.opacity = `${f.introOpacity}`;
      intro.style.transform = f.intro;
      bgLayers.forEach((layer, k) => {
        if (k > 0) layer.style.opacity = `${f.bg[k]}`;
      });
      f.panels.forEach((pn, i) => {
        panelEls[i].style.opacity = `${pn.opacity}`;
        panelEls[i].style.transform = `translate3d(0, ${pn.y}px, 0)`;
      });
      applyState(f, p);
    };
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
    const schedule = () => {
      if (!raf) {
        idleFrames = 0;
        raf = window.requestAnimationFrame(tick);
      }
    };
    const onResizeFallback = () => {
      measure();
      schedule();
    };
    render();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResizeFallback);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResizeFallback);
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
