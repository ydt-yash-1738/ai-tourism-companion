import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

export interface CarouselSlide {
  id: string;
  image: string;
  imageAlt: string;
  objectPosition: string;
  title: string;
  subtitle: string;
  body: string;
  badge: string;
  live: boolean;
  ctaLabel?: string;
}

interface HeritageCarouselProps {
  slides: CarouselSlide[];
  ctaLabel: string;
  onSelectLive: (slideId: string) => void;
  label: string;
}

const AUTOPLAY_MS = 5500;

/**
 * Full-bleed destination carousel: cross-fading photographs with a slow zoom,
 * swipe and keyboard support, and autoplay that pauses on hover, focus or touch.
 */
export function HeritageCarousel({ slides, ctaLabel, onSelectLive, label }: HeritageCarouselProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const reduce =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const count = slides.length;
  const go = (delta: number) => setActive((i) => (i + delta + count) % count);

  useEffect(() => {
    if (paused || reduce || count < 2) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduce, count]);

  return (
    <section
      className="carousel"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="carousel__viewport" data-parallax="0.18">
        {slides.map((slide, i) => (
          <figure
            key={slide.id}
            className={`carousel__slide ${i === active ? 'is-active' : ''}`}
            aria-hidden={i !== active}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}: ${slide.title}`}
          >
            <img
              src={slide.image}
              alt={slide.imageAlt}
              style={{ objectPosition: slide.objectPosition }}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </figure>
        ))}
      </div>
      <div className="carousel__scrim" aria-hidden="true" />

      <div className="carousel__caption" aria-live="polite">
        {slides.map((slide, i) =>
          i === active ? (
            <div key={slide.id} className="carousel__text">
              <span className={`carousel__badge ${slide.live ? 'is-live' : ''}`}>
                {slide.live && <span className="dot-live" />}
                {slide.badge}
              </span>
              <h3>{slide.title}</h3>
              <span className="carousel__subtitle">{slide.subtitle}</span>
              <p>{slide.body}</p>
              {slide.live && (
                <button
                  type="button"
                  className="btn-primary btn-primary--compact"
                  onClick={() => onSelectLive(slide.id)}
                >
                  <span>{slide.ctaLabel || ctaLabel}</span>
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          ) : null,
        )}
      </div>

      <div className="carousel__controls">
        <button type="button" className="carousel__nav" onClick={() => go(-1)} aria-label="Previous destination">
          <ChevronLeft size={20} />
        </button>
        <div className="carousel__dots" role="tablist">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={slide.title}
              className={`carousel__dot ${i === active ? 'is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              <span style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
            </button>
          ))}
        </div>
        <button type="button" className="carousel__nav" onClick={() => go(1)} aria-label="Next destination">
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
