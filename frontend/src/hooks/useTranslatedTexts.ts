import { useEffect, useMemo, useState } from 'react';
import { translateBatchCached } from '../services/translateCache';

// waits between attempts when the backend sends the English back untranslated
const RETRY_MS = [2000, 4000, 6000, 8000, 10000, 15000, 20000, 30000];
// after this many attempts the English is shown (so playback is not held up)
// while the remaining attempts carry on in the background
const SHOW_FALLBACK_AFTER = 2;

/**
 * English texts shown in another language through the backend translator
 * (services/translateCache, cached per language). English and Hindi pass
 * through: those have hand-written text. Until a translation arrives, the
 * English text is returned and `ready` is false; if the translator keeps
 * failing, the English is returned with `ready` true and the hook keeps trying,
 * switching to the translation once it arrives.
 */
export function useTranslatedTexts(texts: string[], language: string): { texts: string[]; ready: boolean } {
  const lang = language.toLowerCase().split('-')[0];
  const needed = lang !== 'en' && lang !== 'hi';
  const key = `${lang}::${texts.join('␞')}`;
  const [done, setDone] = useState<{ key: string; texts: string[] } | null>(null);

  useEffect(() => {
    if (!needed || texts.length === 0) return;
    let active = true;
    let timer = 0;
    const attempt = (n: number) => {
      // first try the whole batch; after that, one request per text (small
      // requests fail less, and each success is cached on its own)
      const request =
        n === 0 || texts.length === 1
          ? translateBatchCached(texts, lang)
          : Promise.all(texts.map((t) => translateBatchCached([t], lang).then((r) => r[0] ?? t, () => t)));
      request
        .catch(() => texts)
        .then((out) => {
          if (!active) return;
          const missing = out.filter((t, i) => t === texts[i] && /[a-z]/i.test(t)).length;
          if (missing < out.length) setDone({ key, texts: out });
          if (missing === 0) return;
          if (missing === out.length && n + 1 >= SHOW_FALLBACK_AFTER) setDone({ key, texts });
          if (n < RETRY_MS.length) timer = window.setTimeout(() => attempt(n + 1), RETRY_MS[n]);
        });
    };
    attempt(0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // `key` covers both the texts and the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needed]);

  return useMemo(() => {
    if (!needed) return { texts, ready: true };
    if (done && done.key === key) return { texts: done.texts, ready: true };
    return { texts, ready: false };
  }, [needed, done, key, texts]);
}
