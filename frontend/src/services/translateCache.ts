import { postTranslate } from './api';

const clientCache = new Map<string, string>();

export async function translateBatchCached(
  texts: string[],
  targetLanguage: string,
): Promise<string[]> {
  const lang = (targetLanguage || 'en').toLowerCase().split('-')[0];
  if (lang === 'en' || texts.length === 0) {
    return texts;
  }

  const out = [...texts];
  const missingIdx: number[] = [];
  const missingTexts: string[] = [];

  for (let i = 0; i < texts.length; i += 1) {
    const t = texts[i];
    if (!t.trim()) continue;
    const hit = clientCache.get(`${lang}::${t}`);
    if (hit !== undefined) {
      out[i] = hit;
    } else {
      missingIdx.push(i);
      missingTexts.push(t);
    }
  }

  if (missingTexts.length === 0 || !navigator.onLine) {
    return out;
  }

  try {
    const res = await postTranslate(missingTexts, lang);
    res.translations.forEach((translated, pos) => {
      const origIdx = missingIdx[pos];
      const finalText = translated?.trim() || missingTexts[pos];
      clientCache.set(`${lang}::${missingTexts[pos]}`, finalText);
      out[origIdx] = finalText;
    });
  } catch {
    // Keep original strings gracefully on network error
  }

  return out;
}

