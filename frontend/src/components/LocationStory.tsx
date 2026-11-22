import { useEffect, useRef, useState } from 'react';
import { LOCATION_STORY, LOCATION_STORY_INTRO } from '../data/locationStory';
import { UP_HERITAGE_CITIES } from '../data/upCities';
import { landingSrcSet } from '../data/responsiveImage';

/**
 * Scroll story under the hero: one panel per live destination.
 * It opens on a full-screen photograph; as the visitor scrolls, the photo
 * settles into a framed card, the background moves through each place's
 * colour and short panels arrive one after another, with the card's photo
 * changing to the place being described. Read-only: no buttons.
 *
 * Motion is scroll-driven CSS where supported (Chrome / Android WebView 115+),
 * so the compositor runs it in step with the finger with no JavaScript per
 * frame; elsewhere the same frames come from one requestAnimationFrame loop.
 * Reduced-motion visitors get a plain list.
 */

// Night navy -> Agra dusk blue -> Lucknow sandstone -> Sarnath deer-park green
const WASH: Array<[number, number, number]> = [
  [7, 17, 31],
  [16, 36, 66],
  [110, 42, 29],
  [12, 86, 54],
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface LocationStoryProps {
  language: string;
}

export function LocationStory({ language }: LocationStoryProps) {
  const isHi = language.startsWith('hi');
  const rootRef = useRef<HTMLElement>(null);
  const [staticMode] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const panels = LOCATION_STORY.map((panel) => {
    const city = UP_HERITAGE_CITIES.find((c) => c.slug === panel.slug);
    return {
      ...panel,
      photo: city ? `${import.meta.env.BASE_URL}${city.image.replace(/^\//, '')}` : '',
      srcSet: city ? landingSrcSet(city.image) : undefined,
      alt: city?.imageAlt ?? '',
      position: city?.objectPosition ?? 'center',
    };
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || staticMode) return;
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    const frame = q('.loc-story__frame');
    const photos = q('.loc-story__photos');
    const scrim = q('.loc-story__scrim');
    const intro = q('.loc-story__intro');
    const washEls = Array.from(root.querySelectorAll<HTMLElement>('.loc-story__wash'));
    const photoEls = Array.from(root.querySelectorAll<HTMLElement>('.loc-story__photos img'));
    const panelEls = Array.from(root.querySelectorAll<HTMLElement>('.loc-story__panel'));
    const n = panelEls.length;

    /** Everything the story shows at scroll progress p (0..1): transforms and opacities only. */
    const computeFrame = (p: number, vw: number, vh: number) => {
      const wide = vw >= 900;
      const t = smooth(0.06, 0.28, p); // full-bleed photo -> framed card
      const scale = wide ? lerp(1, 0.52, t) : lerp(1, 0.54, t);
      const tx = wide ? lerp(0, vw * 0.22, t) : 0;
      const ty = wide ? 0 : lerp(0, -vh * 0.13, t);
      const start = 0.26;
      const span = (1 - start) / n;
      const enters = panelEls.map((_, i) => {
        const c = start + span * (i + 0.5);
        return smooth(c - span * 0.7, c - span * 0.15, p);
      });
      const introOut = smooth(0.03, 0.14, p);
      return {
        card: t,
        frame: `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${scale.toFixed(4)})`,
        photos: `scale(${lerp(1.12, 1, p).toFixed(4)})`,
        scrim: lerp(1, 0.2, t),
        introOpacity: 1 - introOut,
        intro: `translate3d(0,${(-introOut * 40).toFixed(1)}px,0)`,
        // wash: dusk blue as the card forms, then each later place's colour as its panel arrives
        wash: washEls.map((_, k) => (k === 0 ? 1 : k === 1 ? smooth(0.1, 0.3, p) : enters[k - 1] ?? 0)),
        // photos: each later place fades in over the one before as its panel arrives
        photoOpacity: photoEls.map((_, i) => (i === 0 ? 1 : enters[i])),
        panels: panelEls.map((_, i) => {
          const c = start + span * (i + 0.5);
          const leave = i === n - 1 ? 0 : smooth(c + span * 0.2, c + span * 0.7, p);
          return { opacity: enters[i] * (1 - leave), y: (1 - enters[i]) * 48 - leave * 48 };
        }),
      };
    };

    let origin = 0;
    let travel = 1;
    const measure = () => {
      origin = root.getBoundingClientRect().top + window.scrollY;
      travel = Math.max(1, root.offsetHeight - window.innerHeight);
    };
    measure();
    const progress = () => clamp((window.scrollY - origin) / travel);

    let lastCard = -1;
    const applyState = (card: number) => {
      const isCard = card > 0.01 ? 1 : 0;
      if (isCard === lastCard) return;
      lastCard = isCard;
      frame.classList.toggle('is-card', Boolean(isCard));
    };

    const cssScroll =
      typeof CSS !== 'undefined' &&
      CSS.supports?.('animation-timeline: scroll()') &&
      CSS.supports('animation-range: 0px 100px');

    if (cssScroll) {
      const styleEl = document.createElement('style');
      document.head.appendChild(styleEl);
      const build = () => {
        measure();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const STEPS = 48;
        const kf: Record<string, string[]> = {};
        const add = (name: string, pct: string, body: string) => (kf[name] ||= []).push(`${pct}{${body}}`);
        for (let s = 0; s <= STEPS; s++) {
          const f = computeFrame(s / STEPS, vw, vh);
          const pct = `${((s / STEPS) * 100).toFixed(2)}%`;
          add('frame', pct, `transform:${f.frame}`);
          add('photos', pct, `transform:${f.photos}`);
          add('scrim', pct, `opacity:${f.scrim.toFixed(3)}`);
          add('intro', pct, `opacity:${f.introOpacity.toFixed(3)};transform:${f.intro}`);
          f.wash.forEach((o, k) => k > 0 && add(`wash${k}`, pct, `opacity:${o.toFixed(3)}`));
          f.photoOpacity.forEach((o, i) => i > 0 && add(`photo${i}`, pct, `opacity:${o.toFixed(3)}`));
          f.panels.forEach((pn, i) =>
            add(`panel${i}`, pct, `opacity:${pn.opacity.toFixed(3)};transform:translate3d(0,${pn.y.toFixed(1)}px,0)`),
          );
        }
        const range = `animation-timeline:scroll(root block);animation-range:${Math.round(origin)}px ${Math.round(origin + travel)}px`;
        const rule = (name: string, sel: string) =>
          `@keyframes locstory-${name}{${kf[name].join('')}}.loc-story ${sel}{animation:locstory-${name} linear both;${range}}`;
        styleEl.textContent = [
          rule('frame', '.loc-story__frame'),
          rule('photos', '.loc-story__photos'),
          rule('scrim', '.loc-story__scrim'),
          rule('intro', '.loc-story__intro'),
          ...washEls.slice(1).map((_, i) => rule(`wash${i + 1}`, `.loc-story__wash:nth-of-type(${i + 2})`)),
          ...photoEls.slice(1).map((_, i) => rule(`photo${i + 1}`, `.loc-story__photos img:nth-of-type(${i + 2})`)),
          ...panelEls.map((_, i) => rule(`panel${i}`, `.loc-story__panel:nth-of-type(${i + 1})`)),
        ].join('\n');
      };
      let raf = 0;
      const onScroll = () => {
        if (raf) return;
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          applyState(smooth(0.06, 0.28, progress()));
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
      // the page above may change height (images, fonts): re-measure when it does
      const ro = new ResizeObserver(onResize);
      ro.observe(document.body);
      build();
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      return () => {
        ro.disconnect();
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        window.clearTimeout(resizeTimer);
        if (raf) window.cancelAnimationFrame(raf);
        styleEl.remove();
      };
    }

    // Fallback: the same frames from one requestAnimationFrame loop while the page moves
    const render = () => {
      const f = computeFrame(progress(), window.innerWidth, window.innerHeight);
      frame.style.transform = f.frame;
      photos.style.transform = f.photos;
      scrim.style.opacity = `${f.scrim}`;
      intro.style.opacity = `${f.introOpacity}`;
      intro.style.transform = f.intro;
      washEls.forEach((el, k) => {
        if (k > 0) el.style.opacity = `${f.wash[k]}`;
      });
      photoEls.forEach((el, i) => {
        if (i > 0) el.style.opacity = `${f.photoOpacity[i]}`;
      });
      f.panels.forEach((pn, i) => {
        panelEls[i].style.opacity = `${pn.opacity}`;
        panelEls[i].style.transform = `translate3d(0,${pn.y}px,0)`;
      });
      applyState(f.card);
    };
    let raf = 0;
    let lastY = -1;
    let idle = 0;
    const loop = () => {
      const y = window.scrollY;
      if (y !== lastY) {
        lastY = y;
        idle = 0;
        render();
      } else if (++idle > 12) {
        raf = 0;
        return;
      }
      raf = window.requestAnimationFrame(loop);
    };
    const schedule = () => {
      if (!raf) {
        idle = 0;
        raf = window.requestAnimationFrame(loop);
      }
    };
    const onResize = () => {
      measure();
      schedule();
    };
    render();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [staticMode]);

  const intro = isHi ? LOCATION_STORY_INTRO.titleHi : LOCATION_STORY_INTRO.title;
  const introKicker = isHi ? LOCATION_STORY_INTRO.kickerHi : LOCATION_STORY_INTRO.kicker;

  if (staticMode) {
    return (
      <section className="loc-story-list" aria-label={intro}>
        <span className="loc-story__kicker">{introKicker}</span>
        <h2 className="loc-story-list__title">{intro}</h2>
        {panels.map((panel) => (
          <article key={panel.slug} className="loc-story-list__item">
            <img src={panel.photo} alt={panel.alt} style={{ objectPosition: panel.position }} loading="lazy" />
            <div>
              <span className="loc-story__kicker">{isHi ? panel.kickerHi : panel.kicker}</span>
              <h3>{isHi ? panel.titleHi : panel.title}</h3>
              <p>{isHi ? panel.bodyHi : panel.body}</p>
            </div>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section ref={rootRef} className="loc-story" aria-label={intro}>
      <div className="loc-story__pin">
        {WASH.map((c, k) => (
          <div
            key={k}
            className="loc-story__wash"
            style={{ backgroundColor: `rgb(${c.join(',')})`, opacity: k === 0 ? 1 : 0 }}
            aria-hidden="true"
          />
        ))}

        <div className="loc-story__frame">
          <div className="loc-story__photos">
            {panels.map((panel, i) => (
              <img
                key={panel.slug}
                src={panel.photo}
                srcSet={panel.srcSet}
                sizes="100vw"
                alt={panel.alt}
                style={{ objectPosition: panel.position, opacity: i === 0 ? 1 : 0 }}
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
          <div className="loc-story__scrim" aria-hidden="true" />
        </div>

        <div className="loc-story__intro">
          <span className="loc-story__kicker">{introKicker}</span>
          <h2 className="loc-story__intro-title">{intro}</h2>
        </div>

        <div className="loc-story__panels">
          {panels.map((panel) => (
            <article key={panel.slug} className="loc-story__panel">
              <span className="loc-story__kicker">{isHi ? panel.kickerHi : panel.kicker}</span>
              <h3 className="loc-story__title">{isHi ? panel.titleHi : panel.title}</h3>
              <p className="loc-story__body">{isHi ? panel.bodyHi : panel.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
