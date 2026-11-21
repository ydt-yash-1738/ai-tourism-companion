import type { LanguageOption, PersonaType } from '../types/api';

export type HeritageSketchKey =
  | 'agra'
  | 'varanasi'
  | 'lucknow'
  | 'ayodhya'
  | 'mathura-vrindavan'
  | 'prayagraj'
  | 'sarnath'
  | 'fatehpur-sikri';

export interface UpHeritageCity {
  slug: HeritageSketchKey;
  name: string;
  nameHi: string;
  monumentLabel: string;
  monumentLabelHi: string;
  tagline: string;
  taglineHi: string;
  image: string;
  imageAlt: string;
  objectPosition: string;
  lat: number;
  lng: number;
  clickable: boolean;
}

export const UP_HERITAGE_CITIES: UpHeritageCity[] = [
  {
    slug: 'agra',
    name: 'Agra',
    nameHi: 'आगरा',
    monumentLabel: 'Taj Mahal & Agra Fort',
    monumentLabelHi: 'ताजमहल एवं आगरा किला',
    tagline: 'UNESCO Mughal marble artistry, Yamuna gardens & Parchinkari ODOP crafts.',
    taglineHi: 'यूनेस्को मुगल स्थापत्य, यमुना उद्यान एवं पर्चिनकारी ओडीओपी शिल्प।',
    image: '/images/taj-mahal.webp',
    imageAlt: 'Taj Mahal white marble mausoleum and reflecting pool in Agra',
    objectPosition: 'center 42%',
    lat: 27.1751,
    lng: 78.0421,
    clickable: true,
  },
  {
    slug: 'lucknow',
    name: 'Lucknow',
    nameHi: 'लखनऊ',
    monumentLabel: 'Bara Imambara & Rumi Gate',
    monumentLabelHi: 'बड़ा इमामबाड़ा एवं रूमी गेट',
    tagline: 'Awadhi architecture, Bhool Bhulaiya labyrinth & Chikankari crafts.',
    taglineHi: 'अवधी स्थापत्य, भूलभुलैया और चिकनकारी शिल्प विरासत।',
    image: '/images/heritage/lucknow.webp',
    imageAlt: 'Rumi Darwaza ornate Awadhi gateway in Lucknow',
    objectPosition: 'center 42%',
    lat: 26.8692,
    lng: 80.9131,
    clickable: true,
  },
  {
    slug: 'sarnath',
    name: 'Sarnath',
    nameHi: 'सारनाथ',
    monumentLabel: 'Dhamek Stupa & Ashoka Capital',
    monumentLabelHi: 'धमेख स्तूप एवं अशोक स्तंभ',
    tagline: 'Buddhist pilgrimage center where the first Dharma sermon was given & Banarasi ODOP crafts.',
    taglineHi: 'पावन बौद्ध तीर्थ जहाँ भगवान बुद्ध ने प्रथम धर्मोपदेश दिया, अशोक की लाट एवं बनारसी शिल्प।',
    image: '/images/heritage/sarnath.webp',
    imageAlt: 'Ancient cylindrical brick and carved stone Dhamek Stupa at Sarnath',
    objectPosition: 'center 36%',
    lat: 25.3808,
    lng: 83.0245,
    clickable: true,
  },
  {
    slug: 'varanasi',
    name: 'Varanasi',
    nameHi: 'वाराणसी',
    monumentLabel: 'Kashi Vishwanath & Ghats',
    monumentLabelHi: 'काशी विश्वनाथ एवं घाट',
    tagline: 'Ancient riverfront ghats, sacred temples & Banarasi silk heritage.',
    taglineHi: 'प्राचीन गंगा घाट, पावन मंदिर एवं बनारसी रेशम परंपरा।',
    image: '/images/heritage/varanasi.webp',
    imageAlt: 'Boats moored along the ghats of the Ganga in Varanasi',
    objectPosition: 'center 45%',
    lat: 25.3176,
    lng: 82.9739,
    clickable: false,
  },
  {
    slug: 'ayodhya',
    name: 'Ayodhya',
    nameHi: 'अयोध्या',
    monumentLabel: 'Shri Ram Janmabhoomi & Saryu',
    monumentLabelHi: 'श्री राम जन्मभूमि एवं सरयू घाट',
    tagline: 'Sacred Nagara temple architecture, Saryu aarti & cultural trails.',
    taglineHi: 'दिव्य नागर मंदिर स्थापत्य, सरयू आरती एवं पावन परिक्रमा।',
    image: '/images/heritage/ayodhya.webp',
    imageAlt: 'Ram Ki Paidi ghats along the Saryu river in Ayodhya',
    objectPosition: 'center 35%',
    lat: 26.7922,
    lng: 82.1998,
    clickable: false,
  },
  {
    slug: 'mathura-vrindavan',
    name: 'Mathura–Vrindavan',
    nameHi: 'मथुरा–वृंदावन',
    monumentLabel: 'Braj Heritage & Prem Mandir',
    monumentLabelHi: 'ब्रज धाम एवं प्रेम मंदिर',
    tagline: 'Braj devotional temples, Yamuna ghats & Raslila cultural traditions.',
    taglineHi: 'ब्रज के पावन मंदिर, यमुना घाट और रासलीला परंपरा।',
    image: '/images/heritage/mathura-vrindavan.webp',
    imageAlt: 'The carved white marble Prem Mandir in Vrindavan',
    objectPosition: 'center 38%',
    lat: 27.4924,
    lng: 77.6737,
    clickable: false,
  },
  {
    slug: 'prayagraj',
    name: 'Prayagraj',
    nameHi: 'प्रयागराज',
    monumentLabel: 'Triveni Sangam & Akbar Fort',
    monumentLabelHi: 'त्रिवेणी संगम एवं अकबर किला',
    tagline: 'Confluence of Ganga-Yamuna-Saraswati, Ashoka Pillar & Kumbh lore.',
    taglineHi: 'गंगा-यमुना-सरस्वती का संगम, अशोक स्तंभ एवं कुंभ गाथा।',
    image: '/images/heritage/prayagraj.webp',
    imageAlt: 'A pilgrim boat at the Triveni Sangam in Prayagraj',
    objectPosition: 'center 42%',
    lat: 25.4358,
    lng: 81.8463,
    clickable: false,
  },
  {
    slug: 'fatehpur-sikri',
    name: 'Fatehpur Sikri',
    nameHi: 'फतेहपुर सीकरी',
    monumentLabel: 'Buland Darwaza & Panch Mahal',
    monumentLabelHi: 'बुलंद दरवाज़ा एवं पंच महल',
    tagline: 'Akbar’s red sandstone imperial capital & Sufi Dargah heritage.',
    taglineHi: 'अकबर की लाल बलुआ पत्थर राजधानी और सूफी दरगाह विरासत।',
    image: '/images/heritage/fatehpur-sikri.webp',
    imageAlt: 'Buland Darwaza grand red sandstone Mughal gateway at Fatehpur Sikri',
    objectPosition: 'center 35%',
    lat: 27.0945,
    lng: 77.6679,
    clickable: false,
  },
];

export const LIVE_DESTINATION_SLUGS: string[] = UP_HERITAGE_CITIES.filter((c) => c.clickable).map(
  (c) => c.slug,
);

export function isLiveDestinationSlug(slug: string): boolean {
  return LIVE_DESTINATION_SLUGS.includes(slug);
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', bcp47: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', bcp47: 'bn-IN' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', bcp47: 'mr-IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', bcp47: 'ur-IN' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', bcp47: 'fr-FR' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', bcp47: 'ja-JP' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', bcp47: 'es-ES' },
];

export const PERSONA_OPTIONS: Array<{
  id: PersonaType;
  label: string;
  labelHi: string;
  hint: string;
}> = [
  { id: 'quick', label: 'Quick Guide', labelHi: 'संक्षिप्त', hint: 'Short crisp facts' },
  { id: 'kids', label: 'Kids Story', labelHi: 'बाल कथा', hint: 'Fun storytelling' },
  { id: 'scholar', label: 'History & Arch', labelHi: 'इतिहास', hint: 'Deep architectural detail' },
  { id: 'pilgrim', label: 'Devotional', labelHi: 'आध्यात्मिक', hint: 'Cultural & sacred context' },
];
