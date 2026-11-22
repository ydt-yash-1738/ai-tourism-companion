import { postTranslate } from './api';

const clientCache = new Map<string, string>();
const MAX_TRANSLATE_BATCH = 35;

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

  for (let start = 0; start < missingTexts.length; start += MAX_TRANSLATE_BATCH) {
    const chunkTexts = missingTexts.slice(start, start + MAX_TRANSLATE_BATCH);
    const chunkIndices = missingIdx.slice(start, start + MAX_TRANSLATE_BATCH);
    try {
      const res = await postTranslate(chunkTexts, lang);
      // translated === false: the backend fell back to the originals; show them,
      // but do not cache them, so a later request can still get the translation
      const cache = res.translated !== false;
      res.translations.forEach((translated, pos) => {
        const origIdx = chunkIndices[pos];
        const finalText = translated?.trim() || chunkTexts[pos];
        if (cache) clientCache.set(`${lang}::${chunkTexts[pos]}`, finalText);
        out[origIdx] = finalText;
      });
    } catch {
      // Keep original strings gracefully on network error
    }
  }

  return out;
}
