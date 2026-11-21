import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Compass } from 'lucide-react';

/**
 * Single-viewport parallax hero slideshow.
 * Auto-cycles through Uttar Pradesh heritage destination photographs while
 * docking compact controls to the bottom so the monument photo stays clear.
 */

export interface StorySlide {
  id: string;
  photo: string;
  alt: string;
  objectPosition?: string;
  cityName: string;
  monument: string;
  live: boolean;
  badge: string;
}

interface ScrollStoryProps {
  slides: StorySlide[];
  active: number;
  onActiveChange: (index: number) => void;
  autoplay?: boolean;
  heroTitle: string;
  primaryCtaLabel: string;
  onPrimaryCta: () => void;
  locationBanner?: ReactNode;
  topbar: ReactNode;
}

const AUTOPLAY_MS = 5200;

export function ScrollStory({
  slides,
  active,
  onActiveChange,
  autoplay = true,
  heroTitle,
  primaryCtaLabel,
  onPrimaryCta,
  locationBanner,
  topbar,
}: ScrollStoryProps) {
  const rootRef = useRef<HTMLElement>(null);
  const touchX = useRef<number | null>(null);
  const [staticMode] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const count = slides.length;
  const safeIndex = count > 0 ? ((active % count) + count) % count : 0;
  const activeSlide = slides[safeIndex];
  const onActiveChangeRef = useRef(onActiveChange);
  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  }, [onActiveChange]);

  const go = (delta: number) => {
    if (count < 2) return;
    onActiveChangeRef.current((safeIndex + delta + count) % count);
  };

  useEffect(() => {
    if (!autoplay || staticMode || count < 2) return;
    const timer = window.setTimeout(() => {
      onActiveChangeRef.current((safeIndex + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, staticMode, count, safeIndex]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || staticMode) return;
    const photosEl = root.querySelector<HTMLElement>('.story__photos');
    const bottomEl = root.querySelector<HTMLElement>('.story__bottom');
    if (!photosEl || !bottomEl) return;

    let raf = 0;

    const render = () => {
      raf = 0;
      const rect = root.getBoundingClientRect();
      if (rect.bottom < -80) return;
      const scrolled = Math.max(0, -rect.top);
      const progress = Math.min(1, scrolled / Math.max(1, rect.height));
      photosEl.style.transform = `translate3d(0, ${(scrolled * 0.28).toFixed(1)}px, 0) scale(${(1.06 + progress * 0.06).toFixed(4)})`;
      bottomEl.style.transform = `translate3d(0, ${(scrolled * 0.12).toFixed(1)}px, 0)`;
      bottomEl.style.opacity = `${Math.max(0.18, 1 - progress * 0.95).toFixed(3)}`;
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
  }, [staticMode]);

  return (
    <section
      ref={rootRef}
      className={`story ${staticMode ? 'is-static' : ''}`}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="story__photos" aria-hidden="true">
        {slides.map((sl, i) => (
          <img
            key={sl.id}
            src={sl.photo}
            alt={i === safeIndex ? sl.alt : ''}
            style={{ objectPosition: sl.objectPosition || '50% 50%' }}
            className={i === safeIndex ? 'is-active' : ''}
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'auto'}
          />
        ))}
      </div>
      <div className="story__scrim" aria-hidden="true" />

      <div className="story__stage">
        <div className="story__topbar">{topbar}</div>

        <div className="story__bottom">
          {activeSlide && (
            <div className="story__slide-pill" aria-live="polite">
              <span className={`story__slide-badge ${activeSlide.live ? 'is-live' : ''}`}>
                {activeSlide.live && <span className="dot-live" />}
                {activeSlide.badge}
              </span>
              <span className="story__slide-label">
                {activeSlide.cityName} — {activeSlide.monument}
              </span>
            </div>
          )}

          <h1 className="story__title">{heroTitle}</h1>

          {locationBanner && <div className="story__location">{locationBanner}</div>}

          <div className="story__actions">
            <button type="button" className="btn-primary story__cta" onClick={onPrimaryCta}>
              <Compass size={18} />
              <span>{primaryCtaLabel}</span>
              <ArrowRight size={17} />
            </button>
          </div>

          {count > 1 && (
            <div className="story__dots-bar" role="tablist" aria-label="Heritage slideshow">
              {slides.map((sl, i) => (
                <button
                  key={sl.id}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={sl.cityName}
                  className={`story__dot-btn ${i === safeIndex ? 'is-active' : ''}`}
                  onClick={() => onActiveChangeRef.current(i)}
                >
                  {i === safeIndex && autoplay && !staticMode && (
                    <span key={`${sl.id}-${safeIndex}`} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
