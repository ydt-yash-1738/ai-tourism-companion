import type {
  ChatResponse,
  Facility,
  FolkloreItem,
  HelplineItem,
  HistoryFactItem,
  ItineraryStopItem,
  Monument,
  NearbyPlace,
  OfflinePack,
  PersonaType,
  RecommendedPlaceItem,
  TourRoute,
  VisionResponse,
} from '../types/api';
import { GAP_THRESHOLD, rankChunks, tokenize } from './offlineSearch';

const PACK_KEY_PREFIX = 'up_tourism_offline_pack_v2_';
const SESSION_KEY = 'up_tourism_anon_session';

export const DEFAULT_AGRA_HELPLINES: HelplineItem[] = [
  { label: 'National Emergency (Police / Fire / Medical)', label_hi: 'राष्ट्रीय आपातकाल', number: '112', category: 'emergency' },
  { label: 'Medical Ambulance', label_hi: 'एम्बुलेंस सेवा', number: '108', category: 'medical' },
  { label: 'Women Power Line (UP)', label_hi: 'महिला पावर लाइन (उ.प्र.)', number: '1090', category: 'police' },
  { label: 'UP / Incredible India Tourist Helpline', label_hi: 'पर्यटन हेल्पलाइन', number: '1363', category: 'help_desk' },
  { label: 'Agra Tourist Police Station', label_hi: 'आगरा पर्यटन पुलिस', number: '+91-562-2226431', category: 'police' },
  { label: 'S.N. Medical College Hospital', label_hi: 'एस.एन. मेडिकल कॉलेज अस्पताल', number: '+91-562-2260353', category: 'medical' },
];

export const DEFAULT_LUCKNOW_HELPLINES: HelplineItem[] = [
  { label: 'National Emergency (Police / Fire / Medical)', label_hi: 'राष्ट्रीय आपातकाल', number: '112', category: 'emergency' },
  { label: 'Medical Ambulance', label_hi: 'एम्बुलेंस सेवा', number: '108', category: 'medical' },
  { label: 'Women Power Line (UP)', label_hi: 'महिला पावर लाइन (उ.प्र.)', number: '1090', category: 'police' },
  { label: 'UP / Incredible India Tourist Helpline', label_hi: 'पर्यटन हेल्पलाइन', number: '1363', category: 'help_desk' },
  { label: 'Chowk Police Station (Old Lucknow Heritage Zone)', label_hi: 'चौक पुलिस थाना (पुराना लखनऊ विरासत क्षेत्र)', number: '+91-9454403847', category: 'police' },
  { label: 'KGMU Trauma Centre & Emergency Hospital, Chowk', label_hi: 'केजीएमयू ट्रॉमा सेंटर एवं आपातकालीन अस्पताल, चौक', number: '+91-522-2258425', category: 'medical' },
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
  if (slug === 'sarnath') return DEFAULT_SARNATH_HELPLINES;
  if (slug === 'lucknow') return DEFAULT_LUCKNOW_HELPLINES;
  return DEFAULT_AGRA_HELPLINES;
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

function getOfflineGapSuggestions(slug: string, isHi: boolean): string[] {
  if (slug === 'lucknow') {
    return isHi
      ? ['बड़ा इमामबाड़ा किसने बनवाया?', 'भूलभुलैया क्या है?']
      : ['Who built the Bara Imambara?', 'What is the Bhool Bhulaiya?'];
  }
  if (slug === 'sarnath') {
    return isHi
      ? ['बुद्ध ने पहला उपदेश कहाँ दिया था?', 'अशोक स्तंभ और सारनाथ संग्रहालय कब बंद रहता है?']
      : ['Where did Gautama Buddha deliver his first sermon?', 'Tell me the Golden Deer Jataka story of Sarnath'];
  }
  return isHi
    ? ['ताजमहल क्यों बनाया गया?', 'काले ताजमहल की कहानी सच है या लोककथा?']
    : ['Why was the Taj Mahal built?', 'Is the Black Taj Mahal myth true?'];
}

const ITINERARY_RE =
  /\b(?:itinerary|travel plan|trip plan|day plan|schedule|plan a|plan my|plan an|plan for|create a .*plan|make a .*plan|build a .*plan|half[- ]day|full[- ]day)\b|(?:यात्रा योजना|यात्रा प्लान|ट्रिप प्लान|घूमने का प्लान|यात्रा कार्यक्रम|योजना बना|प्लान बना)/i;
const FOOD_RE =
  /\b(?:street food|food|chaat|petha|bedai|jalebi|kebab|kebabs|biryani|kulfi|kachori|lassi|momos|thukpa|snack|snacks|eat|eating|dining|restaurant|restaurants|cafe|cafes|cuisine|dishes|sweets|breakfast|lunch|dinner|makhan malai|basket chaat)\b|(?:स्ट्रीट फ़ूड|स्ट्रीट फूड|भोजन|खाना|खाने|चाट|पेठा|बेड़ई|जलेबी|कबाब|कुल्फी|कचौड़ी|लस्सी|मोमोज़|थुकपा|व्यंजन|नाश्ता|मिठाई)/i;
const NEARBY_RE =
  /\b(?:nearby|places to visit|things to do|market|markets|bazaar|shopping|souvenir|souvenirs|where to buy|where to shop|where to eat)\b|(?:आस-पास|आसपास|बाज़ार|बाजार|खरीदारी|कहाँ खरीदें)/i;
const FACILITY_RE =
  /\b(?:toilet|toilets|restroom|restrooms|washroom|drinking water|parking|first aid|hospital|police|wheelchair|cloakroom|locker|facilit(?:y|ies))\b|(?:शौचालय|पेयजल|पार्किंग|प्राथमिक उपचार|अस्पताल|पुलिस|व्हीलचेयर|सुविधा)/i;

const ALLOWED_BUDGETS: Record<string, Set<string>> = {
  free: new Set(['free']),
  low: new Set(['free', 'low']),
  medium: new Set(['free', 'low', 'medium']),
  high: new Set(['free', 'low', 'medium', 'high']),
};

function formatTimeOfDay(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h >= 1 && h <= 12 ? h : h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

function parseOfflineConstraints(question: string, persona: PersonaType) {
  const q = question.toLowerCase();
  let maxMinutes = 180;
  const hrMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:-|\s)?\s*(?:hr|hrs|hour|hours|घंटे|घंटा)/);
  const minMatch = q.match(/(\d+)\s*(?:-|\s)?\s*(?:min|mins|minute|minutes|मिनट)/);
  if (hrMatch) maxMinutes = Math.max(30, Math.min(600, Math.round(parseFloat(hrMatch[1]) * 60)));
  else if (minMatch) maxMinutes = Math.max(20, Math.min(600, parseInt(minMatch[1], 10)));
  else if (/half[- ]day|अर्ध-दिवस|आधा दिन/.test(q)) maxMinutes = 240;
  else if (/full[- ]day|पूरा दिन/.test(q)) maxMinutes = 420;

  const stepFreeOnly =
    /wheelchair|step-free|step free|no stairs|ramp|elderly|senior|व्हीलचेयर|सीढ़ी-रहित|रैंप|दिव्यांग|बुजुर्ग|वरिष्ठ/.test(
      q,
    );

  let budget: string | null = null;
  if (/\bfree\b|निःशुल्क|मुफ़्त/.test(q)) budget = 'free';
  else if (/low[- ]budget|budget|cheap|affordable|किफायती|कम बजट|सस्ता/.test(q)) budget = 'low';
  else if (/medium|moderate|मध्यम/.test(q)) budget = 'medium';

  let group: string | null = null;
  if (/kid|kids|child|children|बच्च|बाल/.test(q)) group = 'kids';
  else if (/elderly|senior|wheelchair|बुजुर्ग|वरिष्ठ/.test(q)) group = 'elderly';
  else if (/family|परिवार|पारिवारिक/.test(q)) group = 'family';
  else if (/solo|अकेले/.test(q)) group = 'solo';
  else if (persona === 'kids') group = 'kids';

  const wantsFood = FOOD_RE.test(question);
  const wantsCrafts =
    /craft|crafts|odop|parchinkari|leather|chikankari|zardozi|silk|toys|market|bazaar|shopping|शिल्प|ओडीओपी|चिकनकारी|रेशम|बाज़ार|बाजार|खरीद/.test(
      q,
    );

  return { maxMinutes, stepFreeOnly, budget, group, wantsFood, wantsCrafts };
}

function selectOfflineNearby(
  places: NearbyPlace[],
  query: string,
  constraints: ReturnType<typeof parseOfflineConstraints>,
  onlyFood: boolean,
  limit = 4,
): NearbyPlace[] {
  const qTokens = tokenize(query);
  const allowedBudgets = constraints.budget ? ALLOWED_BUDGETS[constraints.budget] : null;
  return places
    .filter((p) => {
      const suitable = new Set((p.suitable_for || []).map((s) => s.toLowerCase()));
      if (constraints.group && !suitable.has(constraints.group)) return false;
      if (constraints.stepFreeOnly && !suitable.has('elderly')) return false;
      const cat = p.category.toLowerCase();
      const interests = (p.interests || []).map((i) => i.toLowerCase());
      if (onlyFood && cat !== 'food' && !interests.includes('food')) return false;
      return true;
    })
    .map((p) => {
      const cat = p.category.toLowerCase();
      const interests = (p.interests || []).map((i) => i.toLowerCase());
      const haystack = `${p.name} ${p.name_hi} ${p.description} ${p.description_hi} ${interests.join(' ')}`.toLowerCase();
      const tokenHits = qTokens.filter((t) => haystack.includes(t)).length;
      const budgetOk = !allowedBudgets || allowedBudgets.has(p.budget_tier.toLowerCase());
      let catScore = 0;
      if (constraints.wantsFood && (cat === 'food' || interests.includes('food'))) catScore += 3;
      if (constraints.wantsCrafts && (p.is_odop || cat === 'crafts' || interests.includes('crafts'))) catScore += 3;
      return { place: p, budgetOk, score: catScore + tokenHits };
    })
    .sort((a, b) => {
      if (a.budgetOk !== b.budgetOk) return a.budgetOk ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return (a.place.is_odop ? 0 : 1) - (b.place.is_odop ? 0 : 1);
    })
    .slice(0, limit)
    .map((x) => x.place);
}

function selectOfflineFacilities(
  facilities: Facility[],
  query: string,
  stepFreeOnly: boolean,
  limit = 4,
): Facility[] {
  const q = query.toLowerCase();
  const hints = new Set<string>();
  if (/toilet|restroom|washroom|शौचालय/.test(q)) hints.add('toilet');
  if (/water|पेयजल/.test(q)) hints.add('drinking_water');
  if (/parking|पार्किंग/.test(q)) hints.add('parking');
  if (/medical|first aid|hospital|अस्पताल|चिकित्सा/.test(q)) hints.add('medical');
  if (/police|पुलिस/.test(q)) hints.add('police');
  if (/food|eat|snack|भोजन|खाना/.test(q)) hints.add('food');
  if (/help|wheelchair|desk|व्हीलचेयर|सहायता/.test(q)) hints.add('help_desk');

  const matched = facilities.filter(
    (f) => (!hints.size || hints.has(f.facility_type)) && (!stepFreeOnly || f.is_accessible),
  );
  return (matched.length ? matched : facilities.filter((f) => !stepFreeOnly || f.is_accessible)).slice(0, limit);
}

function toRecFromNearby(p: NearbyPlace, isHi: boolean): RecommendedPlaceItem {
  return {
    name: isHi && p.name_hi ? p.name_hi : p.name,
    category: p.category,
    description: isHi && p.description_hi ? p.description_hi : p.description,
    timings: p.timings,
    budget_tier: p.budget_tier,
    entry_fee_inr: p.entry_fee_inr,
    is_odop: p.is_odop,
    is_accessible: (p.suitable_for || []).some((s) => s.toLowerCase() === 'elderly'),
    lat: p.lat,
    lng: p.lng,
    address: p.address,
    source_slug: p.slug,
  };
}

function toRecFromFacility(f: Facility, isHi: boolean): RecommendedPlaceItem {
  return {
    name: isHi && f.name_hi ? f.name_hi : f.name,
    category: f.facility_type,
    description: isHi && f.notes_hi ? f.notes_hi : f.notes,
    timings: f.timings,
    budget_tier: 'free',
    entry_fee_inr: 'Free',
    is_odop: false,
    is_accessible: f.is_accessible,
    lat: f.lat,
    lng: f.lng,
    address: f.address,
    source_slug: f.slug,
  };
}

function buildOfflineItinerary(
  pack: OfflinePack,
  question: string,
  constraints: ReturnType<typeof parseOfflineConstraints>,
  isHi: boolean,
): { stops: ItineraryStopItem[]; recs: RecommendedPlaceItem[]; summary: string } {
  const monumentsBySlug = new Map((pack.monuments || []).map((m) => [m.slug, m]));
  const ordered: Monument[] = [];
  const routes: TourRoute[] = [...(pack.tour_routes || [])].sort((a, b) => {
    const aStep = !constraints.stepFreeOnly || a.step_free ? 0 : 1;
    const bStep = !constraints.stepFreeOnly || b.step_free ? 0 : 1;
    return aStep !== bStep ? aStep - bStep : b.duration_minutes - a.duration_minutes;
  });
  for (const r of routes) {
    if (constraints.stepFreeOnly && !r.step_free) continue;
    for (const st of r.stops || []) {
      const m = monumentsBySlug.get(st.monument_slug);
      if (m && !ordered.includes(m)) ordered.push(m);
    }
  }
  for (const m of pack.monuments || []) if (!ordered.includes(m)) ordered.push(m);
  let eligible = ordered.filter(
    (m) => !constraints.stepFreeOnly || (m.step_free && m.wheelchair_accessible),
  );
  if (!eligible.length) eligible = ordered.slice(0, 2);

  const extras: NearbyPlace[] = [];
  if (constraints.wantsCrafts) {
    const craftsOnly = (pack.nearby_places || []).filter(
      (p) => p.category.toLowerCase() === 'crafts',
    );
    const craftPool = craftsOnly.length
      ? craftsOnly
      : (pack.nearby_places || []).filter(
          (p) => p.is_odop || ['crafts', 'market'].includes(p.category.toLowerCase()),
        );
    extras.push(
      ...selectOfflineNearby(
        craftPool,
        question,
        { ...constraints, wantsFood: false },
        false,
        1,
      ),
    );
  }
  if (constraints.wantsFood) {
    extras.push(
      ...selectOfflineNearby(
        (pack.nearby_places || []).filter((p) => p.category.toLowerCase() === 'food'),
        question,
        { ...constraints, wantsCrafts: false },
        true,
        1,
      ),
    );
  }

  const extraMins = extras.reduce((acc, p) => acc + Math.min(35, p.estimated_time_min), 0);
  const availMonMins = Math.max(30, constraints.maxMinutes - extraMins);
  const chosenMons: Array<{ m: Monument; dur: number }> = [];
  let usedMons = 0;
  for (const m of eligible) {
    const dur = Math.min(m.visit_duration_min, constraints.maxMinutes <= 180 ? 30 : m.visit_duration_min);
    if (usedMons + dur <= availMonMins || !chosenMons.length) {
      chosenMons.push({ m, dur });
      usedMons += dur;
    }
    if (chosenMons.length >= 4) break;
  }

  let cursor = 9 * 60;
  const stops: ItineraryStopItem[] = [];
  for (const { m, dur } of chosenMons) {
    stops.push({
      time_slot: `${formatTimeOfDay(cursor)} – ${formatTimeOfDay(cursor + dur)}`,
      title: isHi && m.name_hi ? m.name_hi : m.name,
      category: 'monument',
      duration_min: dur,
      notes: isHi && m.short_summary_hi ? m.short_summary_hi : m.short_summary,
      accessibility_note: isHi && m.accessibility_notes_hi ? m.accessibility_notes_hi : m.accessibility_notes,
      lat: m.lat,
      lng: m.lng,
      source_slug: m.slug,
    });
    cursor += dur + 10;
  }

  const recs: RecommendedPlaceItem[] = [];
  for (const p of extras) {
    const dur = Math.min(35, p.estimated_time_min);
    const cat = p.category.toLowerCase();
    stops.push({
      time_slot: `${formatTimeOfDay(cursor)} – ${formatTimeOfDay(cursor + dur)}`,
      title: isHi && p.name_hi ? p.name_hi : p.name,
      category: cat === 'crafts' ? 'craft' : cat === 'food' ? 'food' : 'market',
      duration_min: dur,
      notes: isHi && p.description_hi ? p.description_hi : p.description,
      accessibility_note: p.timings,
      lat: p.lat,
      lng: p.lng,
      source_slug: p.slug,
    });
    recs.push(toRecFromNearby(p, isHi));
    cursor += dur + 10;
  }

  const closure = String((pack.destination.metadata_json as Record<string, unknown>)?.weekly_closure || '');
  const summary = isHi
    ? `ऑफ़लाइन पैक से आपकी आवश्यकताओं के अनुसार ${constraints.maxMinutes} मिनट की ${constraints.stepFreeOnly ? 'व्हीलचेयर-सुगम ' : ''}यात्रा योजना (${stops.length} पड़ाव) तैयार है। ${closure}`.trim()
    : `Here is your offline ${constraints.stepFreeOnly ? 'wheelchair-accessible, step-free ' : ''}${constraints.maxMinutes}-minute itinerary for ${pack.destination.name} (${stops.length} stops). ${closure}`.trim();
  return { stops, recs, summary };
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
      itinerary_stops: [],
      recommended_places: [],
      follow_up_suggestions: [],
      is_knowledge_gap: true,
      matched_monument_slug: null,
      language,
      persona,
      simple_language: simpleLanguage,
      mode: 'local_fallback',
    };
  }

  const hasItinerary = ITINERARY_RE.test(question);
  const hasFood = FOOD_RE.test(question);
  const hasNearby = NEARBY_RE.test(question);
  const hasFacility = FACILITY_RE.test(question);
  const constraints = parseOfflineConstraints(question, persona);

  const ranked = rankChunks(pack.knowledge_chunks, pack.monuments ?? [], question);
  const scored = ranked.coverage >= GAP_THRESHOLD ? ranked.chunks.map((chunk) => ({ chunk })) : [];

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

  if (hasItinerary && (pack.monuments?.length || pack.nearby_places?.length)) {
    const { stops, recs, summary } = buildOfflineItinerary(pack, question, constraints, isHi);
    return {
      answer_summary: summary,
      verified_history: verified.slice(0, 2),
      folklore_legends: folklore.slice(0, 1),
      itinerary_stops: stops,
      recommended_places: recs,
      follow_up_suggestions: getOfflineGapSuggestions(pack.destination.slug, isHi),
      is_knowledge_gap: false,
      matched_monument_slug: stops[0]?.category === 'monument' ? stops[0].source_slug ?? null : null,
      language,
      persona,
      simple_language: simpleLanguage,
      mode: 'local_fallback',
    };
  }

  if (hasFood || hasNearby || hasFacility) {
    const recs: RecommendedPlaceItem[] = [];
    const seen = new Set<string>();
    if (hasFood || hasNearby) {
      const onlyFood = hasFood && !hasNearby && !constraints.wantsCrafts;
      for (const p of selectOfflineNearby(pack.nearby_places || [], question, constraints, onlyFood, 4)) {
        if (!seen.has(p.slug)) {
          seen.add(p.slug);
          recs.push(toRecFromNearby(p, isHi));
        }
      }
    }
    if (hasFacility || (hasFood && recs.length < 4)) {
      const facQuery = hasFacility ? question : `${question} food`;
      for (const f of selectOfflineFacilities(pack.facilities || [], facQuery, constraints.stepFreeOnly, 4 - recs.length)) {
        if (!seen.has(f.slug)) {
          seen.add(f.slug);
          recs.push(toRecFromFacility(f, isHi));
        }
      }
    }
    if (recs.length) {
      const names = recs.slice(0, 3).map((r) => r.name).join(', ');
      return {
        answer_summary: isHi
          ? `ऑफ़लाइन पैक से सत्यापित स्थानीय सुझाव: ${names}।`
          : `Here are verified offline spots matching your request: ${names}.`,
        verified_history: verified,
        folklore_legends: folklore,
        itinerary_stops: [],
        recommended_places: recs,
        follow_up_suggestions: getOfflineGapSuggestions(pack.destination.slug, isHi),
        is_knowledge_gap: false,
        matched_monument_slug: null,
        language,
        persona,
        simple_language: simpleLanguage,
        mode: 'local_fallback',
      };
    }
  }

  if (!scored.length) {
    return {
      answer_summary: isHi
        ? 'ऑफ़लाइन कैश में इस विषय पर सत्यापित जानकारी नहीं मिली। नेटवर्क आने पर पुनः पूछें।'
        : 'No matching verified info found in your downloaded offline pack for that query.',
      verified_history: [],
      folklore_legends: [],
      itinerary_stops: [],
      recommended_places: [],
      follow_up_suggestions: getOfflineGapSuggestions(pack.destination.slug, isHi),
      is_knowledge_gap: true,
      matched_monument_slug: null,
      language,
      persona,
      simple_language: simpleLanguage,
      mode: 'local_fallback',
    };
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
 * Fill in structured place/itinerary cards from the bundled offline pack when
 * an older or remote API response answers in prose without `recommended_places`
 * or `itinerary_stops`.
 */
export function enrichChatResponseWithOfflinePack(
  res: ChatResponse,
  pack: OfflinePack | null,
  question: string,
  language: string,
  persona: PersonaType,
  simpleLanguage: boolean,
): ChatResponse {
  const recommendedPlaces = res.recommended_places ?? [];
  const itineraryStops = res.itinerary_stops ?? [];
  const normalized: ChatResponse = {
    ...res,
    recommended_places: recommendedPlaces,
    itinerary_stops: itineraryStops,
  };

  const wantsItinerary = ITINERARY_RE.test(question);
  const hasStructuredIntent =
    wantsItinerary ||
    FOOD_RE.test(question) ||
    NEARBY_RE.test(question) ||
    FACILITY_RE.test(question);

  if (!hasStructuredIntent || !pack) {
    return normalized;
  }

  const missingRecs = recommendedPlaces.length === 0;
  const missingStops = wantsItinerary && itineraryStops.length === 0;

  if (!missingRecs && !missingStops) {
    return normalized;
  }

  const fallback = offlineLocalChatSearch(pack, question, language, persona, simpleLanguage);
  const mergedPlaces = missingRecs ? (fallback.recommended_places ?? []) : recommendedPlaces;
  const mergedStops = missingStops ? (fallback.itinerary_stops ?? []) : itineraryStops;

  if (!mergedPlaces.length && !mergedStops.length) {
    return normalized;
  }

  const clearedGap = Boolean(normalized.is_knowledge_gap);
  return {
    ...normalized,
    answer_summary: clearedGap ? fallback.answer_summary : normalized.answer_summary,
    is_knowledge_gap: clearedGap ? false : normalized.is_knowledge_gap,
    recommended_places: mergedPlaces,
    itinerary_stops: mergedStops,
    follow_up_suggestions:
      normalized.follow_up_suggestions?.length
        ? normalized.follow_up_suggestions
        : fallback.follow_up_suggestions,
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
