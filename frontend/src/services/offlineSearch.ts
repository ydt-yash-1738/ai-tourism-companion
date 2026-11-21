import type { KnowledgeChunk, Monument } from '../types/api';

// Mirrors backend/app/services/ai_service.py keyword ranking so offline answers match online ones.

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'did', 'do', 'does', 'for', 'from', 'had',
  'has', 'have', 'here', 'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'tell',
  'that', 'the', 'their', 'them', 'there', 'these', 'this', 'to', 'was', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your', 'about', 'explain', 'please', 'give',
  'more', 'know', 'mean', 'means', 'meaning', 'happen', 'happened', 'real', 'true', 'actually',
  'really', 'story', 'stories', 'see', 'visit', 'like', 'any', 'some', 'so', 'very', 'also', 'called',
  'name', 'named', 'find', 'get', 'go', 'should', 'could', 'would', 'much', 'many', 'kind', 'type',
  'ka', 'ke', 'ki', 'ko', 'kya', 'kaise', 'kyon', 'hai', 'hain',
  'था', 'थी', 'थे', 'है', 'हैं', 'क्या', 'क्यों', 'कैसे', 'के', 'की', 'को', 'में', 'से', 'और', 'का',
  'पर', 'यह', 'वह', 'किसने', 'कौन', 'कब', 'कहाँ', 'कहां', 'गया', 'गई', 'गए', 'बताइए', 'बताओ', 'बारे',
  'verified', 'makes', 'special', 'including', 'features', 'feature', 'inside', 'vs', 'versus', 'tell',
  'describe', 'show', 'important', 'famous', 'about',
  'बताएं', 'बताएँ', 'बताइये', 'प्रमाणित', 'विशेषता', 'विशेषताएँ', 'कारण', 'तथा', 'रहने', 'लिए', 'या',
  'दें', 'दीजिए', 'सच', 'जानकारी', 'कहानी',
]);

const GENERIC_NAME_WORDS = new Set([
  'main', 'the', 'of', 'and', 'gate', 'pavilion', 'tower', 'octagonal', 'great',
  'मुख्य', 'एवं', 'द्वार', 'शाही', 'प्रवेश', 'भवन', 'मीनार', 'अष्टकोणीय',
]);

const TOKEN_RE = /[\p{L}\p{M}\p{N}]+/gu;
const PROPER_PHRASE_RE = /\b([A-Z][a-z]+(?:[ -][A-Z][a-z]+)+)\b/g;

export const GAP_THRESHOLD = 0.42;

export function tokenize(text: string): string[] {
  const tokens = (text || '').toLowerCase().match(TOKEN_RE) ?? [];
  return tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function prefixMatch(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common += 1;
  return common >= 4 && common >= 0.66 * Math.min(a.length, b.length);
}

function matchStrength(tok: string, strong: Set<string>, weak: Set<string>): number {
  if (strong.has(tok)) return 1;
  if (weak.has(tok)) return 0.85;
  for (const ct of strong) if (prefixMatch(tok, ct)) return 0.7;
  for (const ct of weak) if (prefixMatch(tok, ct)) return 0.6;
  return 0;
}

function unknownProperPhrase(query: string, corpusLower: string): boolean {
  const trimmed = query.trim();
  for (const match of query.matchAll(PROPER_PHRASE_RE)) {
    let phrase = match[1];
    const words = phrase.split(/\s+/);
    if (trimmed.startsWith(words[0])) {
      if (words.length === 2) continue;
      phrase = words.slice(1).join(' ');
    }
    if (!corpusLower.includes(phrase.toLowerCase())) return true;
  }
  return false;
}

export interface RankedChunks {
  chunks: KnowledgeChunk[];
  coverage: number;
}

export function rankChunks(
  chunks: KnowledgeChunk[],
  monuments: Monument[],
  query: string,
  monumentId: number | null = null,
  topK = 5,
): RankedChunks {
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length || !chunks.length) return { chunks: [], coverage: 0 };

  const corpusLower = [
    ...chunks.map((c) => `${c.title} ${c.content} ${c.tags.join(' ')}`),
    ...monuments.map((m) => m.name),
  ]
    .join(' ')
    .toLowerCase();
  if (unknownProperPhrase(query, corpusLower)) return { chunks: [], coverage: 0 };

  const entities = new Map<string, Set<number>>();
  for (const m of monuments) {
    for (const tok of tokenize(`${m.name} ${m.name_hi}`)) {
      if (GENERIC_NAME_WORDS.has(tok)) continue;
      if (!entities.has(tok)) entities.set(tok, new Set());
      entities.get(tok)!.add(m.id);
    }
  }
  const named = new Set<number>();
  for (const tok of queryTokens) entities.get(tok)?.forEach((id) => named.add(id));

  const indexed = chunks.map((chunk) => {
    const strong = new Set(tokenize(`${chunk.title} ${chunk.title_hi} ${chunk.tags.join(' ')}`));
    const weak = new Set(tokenize(`${chunk.content} ${chunk.content_hi}`).filter((t) => !strong.has(t)));
    return { chunk, strong, weak };
  });

  const n = indexed.length;
  const strengths = new Map<string, number[]>();
  const idf = new Map<string, number>();
  for (const tok of queryTokens) {
    const s = indexed.map(({ strong, weak }) => matchStrength(tok, strong, weak));
    strengths.set(tok, s);
    idf.set(tok, Math.log((n + 1) / (s.filter((v) => v > 0).length + 0.5)));
  }
  // Cap the pull of words found nowhere in the content (see backend for rationale)
  const known = queryTokens.filter((t) => strengths.get(t)!.some((v) => v > 0)).map((t) => idf.get(t)!);
  if (known.length) {
    const cap = Math.max(1.2, Math.max(...known));
    for (const tok of queryTokens) {
      if (!strengths.get(tok)!.some((v) => v > 0)) idf.set(tok, Math.min(idf.get(tok)!, cap));
    }
  }
  if (named.size) {
    const top = Math.max(...idf.values());
    for (const tok of queryTokens) if (entities.has(tok)) idf.set(tok, Math.max(idf.get(tok)!, top));
  }
  const totalWeight = [...idf.values()].reduce((a, b) => a + b, 0) || 1;
  const qLower = query.toLowerCase();

  const scored: Array<{ rank: number; coverage: number; chunk: KnowledgeChunk }> = [];
  indexed.forEach(({ chunk }, i) => {
    const coverage =
      queryTokens.reduce((acc, tok) => acc + idf.get(tok)! * strengths.get(tok)![i], 0) / totalWeight;
    if (coverage <= 0) return;
    let rank = coverage;
    if (named.size && chunk.monument_id !== null && !named.has(chunk.monument_id)) rank *= 0.6;
    if (monumentId !== null && chunk.monument_id === monumentId) rank += 0.1;
    for (const tag of chunk.tags) if (tag.includes(' ') && qLower.includes(tag.toLowerCase())) rank += 0.15;
    if (chunk.content_type === 'RECORDED_HISTORY') rank += 0.01;
    scored.push({ rank, coverage, chunk });
  });

  if (!scored.length) return { chunks: [], coverage: 0 };
  scored.sort((a, b) => b.rank - a.rank);
  const kept = scored.filter((s) => s.rank >= 0.5 * scored[0].rank).slice(0, topK);
  // Multi-part questions: coverage of the top three chunks together
  const topIdx = kept.slice(0, 3).map((k) => indexed.findIndex((x) => x.chunk === k.chunk));
  const union =
    queryTokens.reduce((acc, tok) => acc + idf.get(tok)! * Math.max(...topIdx.map((i) => strengths.get(tok)![i])), 0) /
    totalWeight;
  return {
    chunks: kept.map((s) => s.chunk),
    coverage: Math.min(1, Math.max(union, ...kept.map((s) => s.coverage))),
  };
}
