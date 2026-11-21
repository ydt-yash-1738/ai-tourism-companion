// Visitor-chosen text size, applied app-wide through the root font size (every
// rem-based size follows) and the body text. Remembered on this device.

export const FONT_STEPS = [0.9, 1, 1.1, 1.2, 1.32] as const;
const KEY = 'up_companion_font_scale';
const DEFAULT_INDEX = 1;

function read(): number {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === null) return DEFAULT_INDEX; // nothing chosen yet: normal size
    const i = Number(saved);
    return Number.isInteger(i) && i >= 0 && i < FONT_STEPS.length ? i : DEFAULT_INDEX;
  } catch {
    return DEFAULT_INDEX;
  }
}

function apply(index: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--font-user', String(FONT_STEPS[index]));
}

let current = read();
apply(current);

export function getFontStep(): number {
  return current;
}

/** Move one step up (+1) or down (-1); returns the new step index. */
export function stepFont(delta: 1 | -1): number {
  current = Math.min(FONT_STEPS.length - 1, Math.max(0, current + delta));
  apply(current);
  try {
    localStorage.setItem(KEY, String(current));
  } catch {
    // storage unavailable: the size still applies for this visit
  }
  return current;
}
