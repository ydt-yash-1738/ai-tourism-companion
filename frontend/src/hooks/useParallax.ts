import { useEffect, type RefObject } from 'react';

/**
 * Drives a layered parallax scene by writing CSS variables on the container:
 *   --scroll  : page scroll in px (clamped to the scene's height)
 *   --px/--py : pointer or device-tilt offset in [-1, 1]
 * Layers read these with their own --depth, so the browser composites
 * transforms on the GPU and React never re-renders while scrolling.
 */
export function useParallax(ref: RefObject<HTMLElement | null>, enableTilt = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let frame = 0;
    let scroll = 0;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      frame = 0;
      // Ease pointer/tilt so motion feels weighty rather than jittery
      px += (tx - px) * 0.12;
      py += (ty - py) * 0.12;
      el.style.setProperty('--scroll', `${scroll}`);
      el.style.setProperty('--px', px.toFixed(4));
      el.style.setProperty('--py', py.toFixed(4));
      if (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) schedule();
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      scroll = Math.max(0, Math.min(rect.height, -rect.top));
      schedule();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 25));
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      schedule();
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    if (enableTilt) window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, enableTilt]);
}
