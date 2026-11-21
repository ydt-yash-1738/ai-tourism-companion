import type {
  ChatResponse,
  FolkloreItem,
  HelplineItem,
  HistoryFactItem,
  OfflinePack,
  PersonaType,
  VisionResponse,
} from '../types/api';
import { GAP_THRESHOLD, rankChunks } from './offlineSearch';

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
  try {
    localStorage.setItem(`${PACK_KEY_PREFIX}${slug}`, JSON.stringify(pack));
  } catch {
    // Storage full or unavailable: the pack still works for this session from memory
  }
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
        : 'Offline pack is not downloaded yet. Tap "Download Offline Pack" while online to enable local answers without internet.',
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

  const ranked = rankChunks(pack.knowledge_chunks, pack.monuments ?? [], question);
  const scored = ranked.coverage >= GAP_THRESHOLD ? ranked.chunks.map((chunk) => ({ chunk })) : [];

  if (!scored.length) {
    return {
      answer_summary: isHi
        ? 'ऑफ़लाइन कैश में इस विषय पर सत्यापित जानकारी नहीं मिली। नेटवर्क आने पर पुनः पूछें।'
        : 'No matching verified info found in your downloaded offline pack for that query.',
      verified_history: [],
      folklore_legends: [],
      follow_up_suggestions: ['Why was the Taj Mahal built?', 'Is the Black Taj Mahal myth true?'],
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
  // UC-7 / UC-8: shorter text for Quick, Kids and simple-language modes; full text for scholars
  const brief = simpleLanguage || persona === 'quick' || persona === 'kids';
  const trim = (t: string) => (brief ? t.split(/(?<=[.।])\s+/).slice(0, 2).join(' ') : t);
  for (const { chunk } of scored) {
    const text = trim(isHi && chunk.content_hi ? chunk.content_hi : chunk.content);
    if (chunk.content_type === 'RECORDED_HISTORY') {
      verified.push({ text, source: chunk.source_name });
    } else {
      folklore.push({ text, attribution: chunk.source_name });
    }
  }

  const lead = scored[0].chunk;
  const leadText = isHi && lead.content_hi ? lead.content_hi : lead.content;
  const leadSentences = leadText.split(/(?<=[.।])\s+/).filter(Boolean);
  let summary =
    persona === 'scholar' && !simpleLanguage
      ? leadSentences.slice(0, 2).join(' ') || leadText
      : leadSentences[0] || leadText;
  if (lead.content_type !== 'RECORDED_HISTORY') {
    summary = isHi
      ? `स्थानीय परंपरा के अनुसार (यह दर्ज इतिहास नहीं है): ${summary}`
      : `According to local tradition (this is not recorded history): ${summary}`;
  }
  if (persona === 'kids') {
    summary = (isHi ? 'चलो, एक कहानी सुनते हैं! ' : "Here's the story! ") + summary;
  } else if (persona === 'pilgrim') {
    summary = (isHi ? 'आस्था और सम्मान के साथ: ' : 'With respect for the faith and traditions of this place: ') + summary;
  }
  const leadMonument = pack.monuments?.find((m) => m.id === lead.monument_id);

  return {
    answer_summary: summary,
    verified_history: verified,
    folklore_legends: folklore,
    follow_up_suggestions: [],
    is_knowledge_gap: false,
    matched_monument_slug: leadMonument?.slug ?? null,
    language,
    persona,
    simple_language: simpleLanguage,
    mode: 'local_fallback',
  };
}


/**
 * Offline "point the camera" fallback, mirroring the backend's GPS fallback:
 * with no server to look at the photo, name the nearest monument to the
 * visitor and show its verified history and folklore from the offline pack.
 */
export function offlineVisionFallback(
  pack: OfflinePack | null,
  coords: { lat: number; lng: number } | null,
  language: string,
  persona: PersonaType,
): VisionResponse | null {
  if (!pack || !pack.monuments.length || !coords) return null;
  const isHi = language.toLowerCase().startsWith('hi');
  const ranked = [...pack.monuments].sort(
    (a, b) =>
      haversineMeters(coords.lat, coords.lng, a.lat, a.lng) -
      haversineMeters(coords.lat, coords.lng, b.lat, b.lng),
  );
  const nearest = ranked[0];
  const distance = haversineMeters(coords.lat, coords.lng, nearest.lat, nearest.lng);
  const name = isHi && nearest.name_hi ? nearest.name_hi : nearest.name;
  const chunks = pack.knowledge_chunks.filter((c) => c.monument_id === nearest.id).slice(0, 3);
  const verified: HistoryFactItem[] = [];
  const folklore: FolkloreItem[] = [];
  for (const chunk of chunks) {
    const text = isHi && chunk.content_hi ? chunk.content_hi : chunk.content;
    if (chunk.content_type === 'RECORDED_HISTORY') verified.push({ text, source: chunk.source_name });
    else folklore.push({ text, attribution: chunk.source_name });
  }
  return {
    identified_name: name,
    confidence: distance <= 150 ? 'medium' : 'low',
    architectural_features: nearest.visual_cues.slice(0, 4),
    answer_summary: isHi
      ? `ऑफ़लाइन: फ़ोटो की पहचान के लिए नेटवर्क चाहिए। आपकी लोकेशन के अनुसार सबसे निकट स्मारक '${name}' है (~${distance} मी)।`
      : `Offline: photo recognition needs a network. Based on your location, the nearest monument is ${name} (about ${distance} m away).`,
    verified_history: verified,
    folklore_legends: folklore,
    matched_monument_slug: nearest.slug,
    candidate_monuments: ranked.slice(0, 3).map((m) => (isHi && m.name_hi ? m.name_hi : m.name)),
    is_knowledge_gap: false,
    language,
    persona,
    mode: 'local_fallback',
  };
}
