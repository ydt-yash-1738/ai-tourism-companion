import type {
  ChatResponse,
  FolkloreItem,
  HelplineItem,
  HistoryFactItem,
  OfflinePack,
  PersonaType,
} from '../types/api';

const PACK_KEY_PREFIX = 'up_tourism_offline_pack_v1_';
const SESSION_KEY = 'up_tourism_anon_session';

export const DEFAULT_AGRA_HELPLINES: HelplineItem[] = [
  { label: 'National Emergency (Police / Fire / Medical)', label_hi: 'राष्ट्रीय आपातकाल', number: '112', category: 'emergency' },
  { label: 'Medical Ambulance', label_hi: 'एम्बुलेंस सेवा', number: '108', category: 'medical' },
  { label: 'Women Power Line (UP)', label_hi: 'महिला पावर लाइन (उ.प्र.)', number: '1090', category: 'police' },
  { label: 'UP / Incredible India Tourist Helpline', label_hi: 'पर्यटन हेल्पलाइन', number: '1363', category: 'help_desk' },
  { label: 'Agra Tourist Police Station', label_hi: 'आगरा पर्यटन पुलिस', number: '+91-562-2226431', category: 'police' },
  { label: 'S.N. Medical College Hospital', label_hi: 'एस.एन. मेडिकल कॉलेज अस्पताल', number: '+91-562-2260353', category: 'medical' },
];

export const DEFAULT_SARNATH_HELPLINES: HelplineItem[] = [
  { label: 'National Emergency (Police / Fire / Medical)', label_hi: 'राष्ट्रीय आपातकाल', number: '112', category: 'emergency' },
  { label: 'Medical Ambulance', label_hi: 'एम्बुलेंस सेवा', number: '108', category: 'medical' },
  { label: 'Women Power Line (UP)', label_hi: 'महिला पावर लाइन (उ.प्र.)', number: '1090', category: 'police' },
  { label: 'UP / Incredible India Tourist Helpline', label_hi: 'पर्यटन हेल्पलाइन', number: '1363', category: 'help_desk' },
  { label: 'Sarnath Police Station (Varanasi)', label_hi: 'सारनाथ पुलिस थाना (वाराणसी)', number: '+91-542-2595406', category: 'police' },
  { label: 'Pt. Deen Dayal Upadhyaya District Hospital', label_hi: 'पं. दीनदयाल उपाध्याय जिला अस्पताल', number: '+91-542-2508017', category: 'medical' },
];

export function getDefaultHelplines(slug: string): HelplineItem[] {
  return slug === 'sarnath' ? DEFAULT_SARNATH_HELPLINES : DEFAULT_AGRA_HELPLINES;
}

export function getOrCreateSessionHash(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const token = `s_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, token);
    return token;
  } catch {
    return 's_anon';
  }
}

export function saveOfflinePack(slug: string, pack: OfflinePack): void {
  localStorage.setItem(`${PACK_KEY_PREFIX}${slug}`, JSON.stringify(pack));
}

export function loadOfflinePack(slug: string): OfflinePack | null {
  try {
    const raw = localStorage.getItem(`${PACK_KEY_PREFIX}${slug}`);
    if (!raw) return null;
    return JSON.parse(raw) as OfflinePack;
  } catch {
    return null;
  }
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getOfflineGapSuggestions(slug: string, isHi: boolean): string[] {
  if (slug === 'sarnath') {
    return isHi
      ? ['बुद्ध ने पहला उपदेश कहाँ दिया था?', 'अशोक स्तंभ और सारनाथ संग्रहालय कब बंद रहता है?']
      : ['Where did Gautama Buddha deliver his first sermon?', 'Tell me the Golden Deer Jataka story of Sarnath'];
  }
  return isHi
    ? ['ताजमहल क्यों बनाया गया?', 'काले ताजमहल की कहानी सच है या लोककथा?']
    : ['Why was the Taj Mahal built?', 'Is the Black Taj Mahal myth true?'];
}

export function offlineLocalChatSearch(
  pack: OfflinePack | null,
  question: string,
  language: string,
  persona: PersonaType,
  simpleLanguage: boolean,
): ChatResponse {
  const isHi = language.toLowerCase().startsWith('hi');
  if (!pack || !pack.knowledge_chunks.length) {
    return {
      answer_summary: isHi
        ? 'ऑफ़लाइन पैक अभी डाउनलोड नहीं हुआ है। कम नेटवर्क पर उपयोग के लिए कृपया ऊपर "Offline Pack" बटन दबाएँ।'
        : 'Offline pack is not downloaded yet. Tap "Offline Pack" while online to enable local answers without internet.',
      verified_history: [],
      folklore_legends: [],
      follow_up_suggestions: [],
      is_knowledge_gap: true,
      matched_monument_slug: null,
      language,
      persona,
      simple_language: simpleLanguage,
      mode: 'local_fallback',
    };
  }

  const tokens = question
    .toLowerCase()
    .split(/[\s,?.!।]+/)
    .filter((t) => t.length >= 2);

  const scored = pack.knowledge_chunks
    .map((chunk) => {
      const hay = `${chunk.title} ${chunk.title_hi} ${chunk.content} ${chunk.content_hi} ${chunk.tags.join(' ')}`.toLowerCase();
      const score = tokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!scored.length) {
    return {
      answer_summary: isHi
        ? 'ऑफ़लाइन कैश में इस विषय पर सत्यापित जानकारी नहीं मिली। नेटवर्क आने पर पुनः पूछें।'
        : 'No matching verified info found in your downloaded offline pack for that query.',
      verified_history: [],
      folklore_legends: [],
      follow_up_suggestions: getOfflineGapSuggestions(pack.destination.slug, isHi),
      is_knowledge_gap: true,
      matched_monument_slug: null,
      language,
      persona,
      simple_language: simpleLanguage,
      mode: 'local_fallback',
    };
  }

  const verified: HistoryFactItem[] = [];
  const folklore: FolkloreItem[] = [];
  for (const { chunk } of scored) {
    const text = isHi && chunk.content_hi ? chunk.content_hi : chunk.content;
    if (chunk.content_type === 'RECORDED_HISTORY') {
      verified.push({ text, source: chunk.source_name });
    } else {
      folklore.push({ text, attribution: chunk.source_name });
    }
  }

  const lead = scored[0].chunk;
  const leadText = isHi && lead.content_hi ? lead.content_hi : lead.content;

  return {
    answer_summary: leadText,
    verified_history: verified,
    folklore_legends: folklore,
    follow_up_suggestions: [],
    is_knowledge_gap: false,
    matched_monument_slug: null,
    language,
    persona,
    simple_language: simpleLanguage,
    mode: 'local_fallback',
  };
}
