export type PersonaType = 'kids' | 'quick' | 'scholar' | 'pilgrim';
export type ContentType = 'RECORDED_HISTORY' | 'FOLKLORE_TRADITION';
export type EventType =
  | 'chat_query'
  | 'vision_query'
  | 'spot_visit'
  | 'facility_search'
  | 'tour_start'
  | 'nearby_view';

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  bcp47: string;
}

export interface HelplineItem {
  label: string;
  label_hi: string;
  number: string;
  category: string;
}

export interface Destination {
  id: number;
  slug: string;
  name: string;
  name_hi: string;
  state: string;
  description: string;
  description_hi: string;
  center_lat: number;
  center_lng: number;
  supported_languages: string[];
  emergency_helplines: HelplineItem[];
  metadata_json: Record<string, unknown>;
}

export interface Monument {
  id: number;
  slug: string;
  name: string;
  name_hi: string;
  short_summary: string;
  short_summary_hi: string;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  visit_duration_min: number;
  visual_cues: string[];
  wheelchair_accessible: boolean;
  has_ramp: boolean;
  step_free: boolean;
  rest_points: string[];
  stairs_warning: boolean;
  accessibility_notes: string;
  accessibility_notes_hi: string;
}

export interface KnowledgeChunk {
  id: number;
  chunk_key: string;
  monument_id: number | null;
  title: string;
  title_hi: string;
  content: string;
  content_hi: string;
  content_type: ContentType;
  source_name: string;
  tags: string[];
}

export interface HistoryFactItem {
  text: string;
  source: string;
}

export interface FolkloreItem {
  text: string;
  attribution: string;
}

export interface ItineraryStopItem {
  time_slot: string;
  title: string;
  category: 'monument' | 'food' | 'craft' | 'market' | 'heritage' | 'facility' | 'festival';
  duration_min?: number | null;
  notes: string;
  accessibility_note: string;
  lat?: number | null;
  lng?: number | null;
  source_slug?: string | null;
}

export interface RecommendedPlaceItem {
  name: string;
  category: string;
  description: string;
  timings: string;
  budget_tier: string;
  entry_fee_inr: string;
  is_odop: boolean;
  is_accessible?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  address: string;
  source_slug?: string | null;
}

export interface ChatRequest {
  destination_slug: string;
  question: string;
  language: string;
  persona: PersonaType;
  simple_language: boolean;
  monument_slug?: string | null;
  session_hash?: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChatResponse {
  answer_summary: string;
  verified_history: HistoryFactItem[];
  folklore_legends: FolkloreItem[];
  itinerary_stops?: ItineraryStopItem[];
  recommended_places?: RecommendedPlaceItem[];
  follow_up_suggestions: string[];
  is_knowledge_gap: boolean;
  matched_monument_slug: string | null;
  language: string;
  persona: PersonaType;
  simple_language: boolean;
  mode: 'gemini' | 'local_fallback';
}

export interface VisionResponse {
  identified_name: string;
  confidence: 'high' | 'medium' | 'low';
  architectural_features: string[];
  answer_summary: string;
  verified_history: HistoryFactItem[];
  folklore_legends: FolkloreItem[];
  matched_monument_slug: string | null;
  candidate_monuments: string[];
  is_knowledge_gap: boolean;
  language: string;
  persona: PersonaType;
  mode: 'gemini' | 'local_fallback';
}

export interface TourStop {
  order: number;
  monument_slug: string;
  monument_name: string;
  monument_name_hi: string;
  lat: number | null;
  lng: number | null;
  geofence_radius_m: number;
  duration_min: number;
  audio_script_en: string;
  audio_script_hi: string;
  audio_url_en: string | null;
  audio_url_hi: string | null;
  accessibility_tip: string;
  step_free: boolean;
}

export interface TourRoute {
  id: number;
  slug: string;
  title: string;
  title_hi: string;
  duration_minutes: number;
  step_free: boolean;
  description: string;
  description_hi: string;
  stops: TourStop[];
}

export interface Facility {
  id: number;
  slug: string;
  name: string;
  name_hi: string;
  facility_type: string;
  lat: number;
  lng: number;
  timings: string;
  address: string;
  phone: string | null;
  is_accessible: boolean;
  is_emergency: boolean;
  notes: string;
  notes_hi: string;
  distance_meters: number | null;
}

export interface EmergencyResponse {
  destination_slug: string;
  nearest_hospital: Facility | null;
  nearest_police: Facility | null;
  helplines: HelplineItem[];
}

export interface NearbyPlace {
  id: number;
  slug: string;
  name: string;
  name_hi: string;
  category: string;
  is_odop: boolean;
  odop_product: string | null;
  budget_tier: string;
  suitable_for: string[];
  interests: string[];
  estimated_time_min: number;
  timings: string;
  entry_fee_inr: string;
  how_to_reach: string;
  official_source: string;
  description: string;
  description_hi: string;
  lat: number;
  lng: number;
  address: string;
  distance_meters: number | null;
}

export interface OfflinePack {
  destination: Destination;
  monuments: Monument[];
  knowledge_chunks: KnowledgeChunk[];
  tour_routes: TourRoute[];
  facilities: Facility[];
  nearby_places: NearbyPlace[];
  generated_at: string;
}

export interface AnalyticsEventCreate {
  destination_slug: string;
  event_type: EventType;
  session_hash?: string;
  language?: string;
  persona?: PersonaType;
  monument_slug?: string | null;
  facility_type?: string | null;
  query_topic?: string | null;
  is_knowledge_gap?: boolean;
}

export interface CountItem {
  label: string;
  count: number;
}

export interface AnalyticsSummary {
  destination_slug: string;
  total_events: number;
  synthetic_events: number;
  live_events: number;
  top_questions: CountItem[];
  language_breakdown: CountItem[];
  popular_spots: CountItem[];
  facility_demand: CountItem[];
  persona_breakdown: CountItem[];
  knowledge_gaps: CountItem[];
}

export interface VoiceSTTResponse {
  transcript: string;
  detected_language: string;
  provider: 'sarvam' | 'bhashini' | 'device_fallback';
  fallback_to_device: boolean;
  message: string;
}

export interface VoiceTTSResponse {
  audio_base64: string | null;
  content_type: string;
  language: string;
  provider: 'sarvam' | 'bhashini' | 'device_fallback';
  fallback_to_device: boolean;
  message: string;
  spoken_text?: string;
}

export interface VoiceTranslateResponse {
  translations: string[];
  target_language: string;
  translated: boolean;
}

