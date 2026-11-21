import { useEffect } from 'react';

/**
 * Page-wide scroll parallax. Any element with `data-parallax="<factor>"` drifts
 * against the scroll by `factor` of its distance from the viewport centre, so
 * photos appear to sit deeper than the cards around them. An optional
 * `data-parallax-scale` (default 1.18 for <img>, 1 otherwise) over-sizes the
 * element so no gap shows inside its clipped frame.
 *
 * Where the browser supports scroll-driven animations (Chrome / Android WebView
 * 115+), the drift is a CSS animation on a view timeline (see `.parallax-css` in
 * _media.scss): it runs on the compositor in step with the finger and this hook
 * only sets two CSS variables per element. Elsewhere it falls back to one
 * requestAnimationFrame per scrolled frame. Off for reduced motion.
 */
export function useScrollParallax() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const factorOf = (el: HTMLElement) => parseFloat(el.dataset.parallax || '0.15');
    const scaleOf = (el: HTMLElement) =>
      parseFloat(el.dataset.parallaxScale || (el.tagName === 'IMG' ? '1.18' : '1'));

    const cssDriven =
      typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()') && CSS.supports('animation-range: cover');

    if (cssDriven) {
      const prepare = (root: ParentNode) => {
        const els = [
          ...(root instanceof HTMLElement && root.matches('[data-parallax]') ? [root] : []),
          ...Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]')),
        ];
        for (const el of els) {
          if (el.classList.contains('parallax-css')) continue;
          el.style.setProperty('--pf', String(factorOf(el)));
          el.style.setProperty('--ps', String(scaleOf(el)));
          el.style.transform = '';
          el.classList.add('parallax-css');
        }
      };
      prepare(document);
      // only newly added nodes are looked at, so React re-renders cost nothing here
      const mo = new MutationObserver((records) => {
        for (const r of records) {
          r.addedNodes.forEach((n) => {
            if (n.nodeType === 1) prepare(n as HTMLElement);
          });
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

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
        const offset = (rect.top + rect.height / 2 - vh / 2) * -factorOf(el);
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(${scaleOf(el)})`;
      }
    };
    function schedule() {
      if (!raf) raf = window.requestAnimationFrame(render);
    }

    collect();
    const mo = new MutationObserver((records) => {
      if (records.some((r) => r.addedNodes.length || r.removedNodes.length)) collect();
    });
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
