import type {
  AnalyticsEventCreate,
  AnalyticsSummary,
  ChatRequest,
  ChatResponse,
  Destination,
  EmergencyResponse,
  Facility,
  Monument,
  NearbyPlace,
  OfflinePack,
  PersonaType,
  TourRoute,
  VisionResponse,
  VoiceSTTResponse,
  VoiceTTSResponse,
  VoiceTranslateResponse,
} from '../types/api';

const BASE_URL = (import.meta.env.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 25000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${detail || res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export function getApiBaseUrl(): string {
  return BASE_URL;
}

export function getDestination(slug: string): Promise<Destination> {
  return requestJson<Destination>(`/api/destinations/${encodeURIComponent(slug)}`);
}

export function getMonuments(slug: string): Promise<Monument[]> {
  return requestJson<Monument[]>(`/api/destinations/${encodeURIComponent(slug)}/monuments`);
}

export function getOfflinePack(slug: string): Promise<OfflinePack> {
  return requestJson<OfflinePack>(`/api/destinations/${encodeURIComponent(slug)}/offline-pack`);
}

export function postChat(payload: ChatRequest): Promise<ChatResponse> {
  return requestJson<ChatResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function postVisionAsk(params: {
  imageFile: File;
  destinationSlug: string;
  question: string;
  language: string;
  persona: PersonaType;
  simpleLanguage: boolean;
  lat: number | null;
  lng: number | null;
  sessionHash: string;
}): Promise<VisionResponse> {
  const form = new FormData();
  form.append('image', params.imageFile);
  form.append('destination_slug', params.destinationSlug);
  form.append('question', params.question);
  form.append('language', params.language);
  form.append('persona', params.persona);
  form.append('simple_language', String(params.simpleLanguage));
  if (params.lat !== null && params.lng !== null) {
    form.append('lat', String(params.lat));
    form.append('lng', String(params.lng));
  }
  form.append('session_hash', params.sessionHash);
  return requestJson<VisionResponse>('/api/vision-ask', { method: 'POST', body: form }, 35000);
}

export function getTours(
  slug: string,
  params?: { maxMinutes?: number; stepFreeOnly?: boolean },
): Promise<TourRoute[]> {
  const qs = new URLSearchParams();
  if (params?.maxMinutes) qs.set('max_minutes', String(params.maxMinutes));
  if (params?.stepFreeOnly) qs.set('step_free_only', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return requestJson<TourRoute[]>(`/api/destinations/${encodeURIComponent(slug)}/tours${suffix}`);
}

export function getFacilities(
  slug: string,
  params?: {
    facilityType?: string;
    accessibleOnly?: boolean;
    lat?: number | null;
    lng?: number | null;
    sessionHash?: string;
  },
): Promise<Facility[]> {
  const qs = new URLSearchParams();
  if (params?.facilityType) qs.set('facility_type', params.facilityType);
  if (params?.accessibleOnly) qs.set('accessible_only', 'true');
  if (params?.lat != null && params?.lng != null) {
    qs.set('lat', String(params.lat));
    qs.set('lng', String(params.lng));
  }
  if (params?.sessionHash) qs.set('session_hash', params.sessionHash);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return requestJson<Facility[]>(
    `/api/destinations/${encodeURIComponent(slug)}/facilities${suffix}`,
  );
}

export function getEmergency(
  slug: string,
  lat?: number | null,
  lng?: number | null,
): Promise<EmergencyResponse> {
  const qs = new URLSearchParams();
  if (lat != null && lng != null) {
    qs.set('lat', String(lat));
    qs.set('lng', String(lng));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return requestJson<EmergencyResponse>(
    `/api/destinations/${encodeURIComponent(slug)}/emergency${suffix}`,
  );
}

export function getNearbyPlaces(
  slug: string,
  params?: {
    interests?: string;
    budget?: string;
    group?: string;
    maxMinutes?: number;
    odopOnly?: boolean;
    lat?: number | null;
    lng?: number | null;
  },
): Promise<NearbyPlace[]> {
  const qs = new URLSearchParams();
  if (params?.interests) qs.set('interests', params.interests);
  if (params?.budget) qs.set('budget', params.budget);
  if (params?.group) qs.set('group', params.group);
  if (params?.maxMinutes) qs.set('max_minutes', String(params.maxMinutes));
  if (params?.odopOnly) qs.set('odop_only', 'true');
  if (params?.lat != null && params?.lng != null) {
    qs.set('lat', String(params.lat));
    qs.set('lng', String(params.lng));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return requestJson<NearbyPlace[]>(
    `/api/destinations/${encodeURIComponent(slug)}/nearby${suffix}`,
  );
}

export function postAnalyticsEvent(payload: AnalyticsEventCreate): Promise<void> {
  return requestJson('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(() => undefined);
}

export function getAnalyticsSummary(
  destinationSlug: string,
  includeSynthetic = true,
): Promise<AnalyticsSummary> {
  const qs = new URLSearchParams({
    destination_slug: destinationSlug,
    include_synthetic: String(includeSynthetic),
  });
  return requestJson<AnalyticsSummary>(`/api/analytics/summary?${qs.toString()}`);
}

export function postVoiceSTT(audioBlob: Blob, language: string): Promise<VoiceSTTResponse> {
  const cleanType = (audioBlob.type || 'audio/wav').split(';')[0].trim().toLowerCase();
  const ext =
    cleanType.includes('wav')
      ? 'wav'
      : cleanType.includes('mp3') || cleanType.includes('mpeg')
        ? 'mp3'
        : cleanType.includes('ogg')
          ? 'ogg'
          : cleanType.includes('mp4') || cleanType.includes('m4a')
            ? 'm4a'
            : 'webm';
  const normalizedBlob = new Blob([audioBlob], { type: cleanType || 'audio/wav' });
  const form = new FormData();
  form.append('audio', normalizedBlob, `voice_query.${ext}`);
  form.append('language', language);
  form.append('provider', 'auto');
  return requestJson<VoiceSTTResponse>('/api/voice/stt', { method: 'POST', body: form });
}

export function postVoiceTTS(
  text: string,
  language: string,
  autoTranslate = false,
): Promise<VoiceTTSResponse> {
  return requestJson<VoiceTTSResponse>('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, 2400),
      language,
      provider: 'auto',
      auto_translate: autoTranslate,
    }),
  });
}

export function postTranslate(
  texts: string[],
  targetLanguage: string,
): Promise<VoiceTranslateResponse> {
  return requestJson<VoiceTranslateResponse>('/api/voice/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, target_language: targetLanguage }),
  });
}

