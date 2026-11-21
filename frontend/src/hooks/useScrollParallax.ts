import { useEffect } from 'react';

/**
 * Page-wide scroll parallax. Any element with `data-parallax="<factor>"` drifts
 * against the scroll by `factor` of its distance from the viewport centre, so
 * photos appear to sit deeper than the cards around them. An optional
 * `data-parallax-scale` (default 1.18 for <img>, 1 otherwise) over-sizes the
 * element so no gap shows inside its clipped frame.
 * One passive listener, one requestAnimationFrame per frame; off for reduced motion.
 */
export function useScrollParallax() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let nodes: HTMLElement[] = [];
    let raf = 0;

    const collect = () => {
      nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
      schedule();
    };
    const render = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of nodes) {
        const host = el.parentElement ?? el;
        const rect = host.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) continue;
        const factor = parseFloat(el.dataset.parallax || '0.15');
        const scale = parseFloat(el.dataset.parallaxScale || (el.tagName === 'IMG' ? '1.18' : '1'));
        const offset = (rect.top + rect.height / 2 - vh / 2) * -factor;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(${scale})`;
      }
    };
    function schedule() {
      if (!raf) raf = window.requestAnimationFrame(render);
    }

    collect();
    const mo = new MutationObserver(() => collect());
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      mo.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
}
