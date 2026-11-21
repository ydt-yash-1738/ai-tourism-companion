export interface LocationMediaItem {
  image: string;
  alt: string;
  objectPosition: string;
}

export interface MonumentSpotlightMeta {
  slug: string;
  name: string;
  nameHi: string;
  shortSummary: string;
  shortSummaryHi: string;
  visitDurationMin: number;
  stepFree: boolean;
  promptEn: string;
  promptHi: string;
}

export interface GuideTopicCard {
  id: string;
  badgeEn: string;
  badgeHi: string;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  questionEn: string;
  questionHi: string;
  accent: 'saffron' | 'navy' | 'emerald' | 'brass';
}

export interface VisitorSnapshotTile {
  id: string;
  titleEn: string;
  titleHi: string;
  bodyEn: string;
  bodyHi: string;
}

const DEFAULT_AGRA_MEDIA: LocationMediaItem = {
  image: '/images/taj-mahal.webp',
  alt: 'Taj Mahal white marble mausoleum and reflecting pool in Agra',
  objectPosition: 'center 42%',
};

export const NEARBY_MEDIA_MAP: Record<string, LocationMediaItem> = {
  'mehtab-bagh': {
    image: '/images/nearby/mehtab-bagh.webp',
    alt: 'Mehtab Bagh riverfront garden framing the Taj Mahal across the Yamuna River',
    objectPosition: 'center 45%',
  },
  'itimad-ud-daulah-baby-taj': {
    image: '/images/nearby/itimad-ud-daulah-baby-taj.webp',
    alt: 'Tomb of Itimad-ud-Daulah (Baby Taj) white marble Pietra Dura mausoleum in Agra',
    objectPosition: 'center 40%',
  },
  'parchinkari-artisan-hub': {
    image: '/images/nearby/parchinkari-artisan-hub.webp',
    alt: 'Carved marble flowers and stone inlay inside the Taj Mahal',
    objectPosition: 'center center',
  },
  'agra-odop-leather-emporium': {
    image: '/images/nearby/agra-odop-leather-emporium.webp',
    alt: 'Handcrafted embroidered leather juttis on display at a crafts market',
    objectPosition: 'center center',
  },
  'sadar-bazaar-chaat-gali': {
    image: '/images/nearby/sadar-bazaar-chaat-gali.webp',
    alt: 'A plate of papri chaat, a favourite North Indian street snack',
    objectPosition: 'center 52%',
  },
  'agra-petha-heritage-lane': {
    image: '/images/nearby/agra-petha-heritage-lane.webp',
    alt: 'Traditional golden saffron Agra Petha ash-gourd sweets',
    objectPosition: 'center center',
  },
  'kinari-bazaar-heritage': {
    image: '/images/nearby/kinari-bazaar-heritage.webp',
    alt: 'Jama Masjid, Agra, beside the old Kinari Bazaar',
    objectPosition: 'center 38%',
  },
};

export const MONUMENT_MEDIA_MAP: Record<string, LocationMediaItem> = {
  'darwaza-i-rauza': {
    image: '/images/monuments/darwaza-i-rauza.webp',
    alt: 'Darwaza-i-Rauza red sandstone southern Great Gate of the Taj Mahal',
    objectPosition: 'center 35%',
  },
  'taj-mahal-mausoleum': DEFAULT_AGRA_MEDIA,
  'taj-mahal-mosque-jawab': {
    image: '/images/monuments/taj-mahal-mosque-jawab.webp',
    alt: 'Twin red sandstone Taj Mosque and Jawab pavilion flanking the marble plinth',
    objectPosition: 'center 45%',
  },
  'amar-singh-gate': {
    image: '/images/monuments/amar-singh-gate.webp',
    alt: 'Amar Singh Gate red sandstone defensive bastion entrance at Agra Fort',
    objectPosition: 'center 38%',
  },
  'jahangiri-mahal': {
    image: '/images/monuments/jahangiri-mahal.webp',
    alt: 'Jahangiri Mahal red sandstone palace courtyard inside Agra Fort',
    objectPosition: 'center 42%',
  },
  'musamman-burj': {
    image: '/images/monuments/musamman-burj.webp',
    alt: 'Musamman Burj white marble octagonal pavilion at Agra Fort',
    objectPosition: 'center 38%',
  },
};

/** Photo for a nearby place, or null when no verified photo exists (an illustrated tile is shown). */
export function getNearbyMedia(slug: string): LocationMediaItem | null {
  return NEARBY_MEDIA_MAP[slug] ?? null;
}

export function getMonumentMedia(slug: string): LocationMediaItem {
  return MONUMENT_MEDIA_MAP[slug] || DEFAULT_AGRA_MEDIA;
}

export const GUIDE_MONUMENT_SPOTLIGHTS: MonumentSpotlightMeta[] = [
  {
    slug: 'taj-mahal-mausoleum',
    name: 'Taj Mahal Main Mausoleum',
    nameHi: 'ताजमहल मुख्य मकबरा',
    shortSummary:
      'Ivory-white Makrana marble mausoleum built by Shah Jahan featuring Pietra Dura floral inlay and four minarets.',
    shortSummaryHi:
      'सम्राट शाहजहाँ द्वारा मकराना के सफेद संगमरमर से निर्मित मुख्य मकबरा, जिसमें पर्चिनकारी की उत्कृष्ट कला है।',
    visitDurationMin: 25,
    stepFree: false,
    promptEn: 'Tell me the verified history, architecture, and folklore of the Taj Mahal Main Mausoleum.',
    promptHi: 'ताजमहल मुख्य मकबरे का प्रमाणित इतिहास, वास्तुकला और लोककथा बताइए।',
  },
  {
    slug: 'darwaza-i-rauza',
    name: 'Darwaza-i-Rauza (The Great Gate)',
    nameHi: 'दरवाज़ा-ए-रौज़ा (मुख्य शाही प्रवेश द्वार)',
    shortSummary:
      'Monumental red sandstone southern gateway leading into the Charbagh garden with optical framing of the Taj Mahal.',
    shortSummaryHi:
      'ताजमहल के चारबाग उद्यान में प्रवेश कराने वाला भव्य लाल बलुआ पत्थर का मुख्य द्वार।',
    visitDurationMin: 10,
    stepFree: true,
    promptEn: 'What makes Darwaza-i-Rauza special, including its eleven domes and optical framing?',
    promptHi: 'दरवाज़ा-ए-रौज़ा की 11 छतरियों और वास्तुकला के दृष्टि प्रभाव के बारे में बताइए।',
  },
  {
    slug: 'taj-mahal-mosque-jawab',
    name: 'Taj Mosque & Jawab Pavilion',
    nameHi: 'ताज मस्जिद एवं जवाब भवन',
    shortSummary:
      'Twin red sandstone structures flanking the mausoleum on the west and east to maintain Mughal symmetry.',
    shortSummaryHi:
      'मुख्य मकबरे के पश्चिम और पूर्व में समरूपता बनाए रखने के लिए निर्मित लाल बलुआ पत्थर के दो जुड़वाँ भवन।',
    visitDurationMin: 10,
    stepFree: true,
    promptEn: 'Why were the Taj Mosque and Jawab Pavilion built as twins, and why is Taj Mahal closed on Fridays?',
    promptHi: 'ताज मस्जिद और जवाब भवन की समरूपता तथा शुक्रवार को बंद रहने का कारण बताइए।',
  },
  {
    slug: 'amar-singh-gate',
    name: 'Amar Singh Gate (Agra Fort)',
    nameHi: 'अमर सिंह द्वार (आगरा किला)',
    shortSummary:
      'Primary public entrance to Agra Fort featuring a defensive dog-leg L-shaped ramp and glazed tile inlay.',
    shortSummaryHi:
      'आगरा किले का मुख्य प्रवेश द्वार, जिसमें सुरक्षा हेतु मोड़दार ढलान और आकर्षक पत्थर की नक्काशी है।',
    visitDurationMin: 15,
    stepFree: true,
    promptEn: 'Explain the defensive history and L-shaped ramp of Amar Singh Gate at Agra Fort.',
    promptHi: 'आगरा किले के अमर सिंह द्वार के इतिहास और सुरक्षात्मक ढलान के बारे में बताइए।',
  },
  {
    slug: 'jahangiri-mahal',
    name: 'Jahangiri Mahal',
    nameHi: 'जहाँगीरी महल',
    shortSummary:
      'Akbar-era red sandstone palace showcasing a fusion of Timurid arches and Rajput stone brackets.',
    shortSummaryHi:
      'अकबर काल का लाल बलुआ पत्थर का महल, जो मुगल और राजपूत स्थापत्य शैली का सुंदर संगम दर्शाता है।',
    visitDurationMin: 20,
    stepFree: true,
    promptEn: 'What Rajput-Mughal features and Hauz-i-Jahangiri bowl are inside Jahangiri Mahal?',
    promptHi: 'जहाँगीरी महल में मुगल-राजपूत स्थापत्य और हौज-ए-जहाँगीरी की विशेषता बताइए।',
  },
  {
    slug: 'musamman-burj',
    name: 'Musamman Burj (Octagonal Tower)',
    nameHi: 'मुसम्मन बुर्ज (अष्टकोणीय मीनार)',
    shortSummary:
      'White marble pavilion overlooking the Yamuna River where Emperor Shah Jahan spent his final years.',
    shortSummaryHi:
      'यमुना और ताजमहल की ओर मुख किए सफेद संगमरमर का अष्टकोणीय मंडप, जहाँ शाहजहाँ ने अंतिम वर्ष बिताए।',
    visitDurationMin: 15,
    stepFree: false,
    promptEn: 'What happened to Shah Jahan at Musamman Burj, and what is history vs folklore there?',
    promptHi: 'मुसम्मन बुर्ज में शाहजहाँ के अंतिम वर्षों का प्रमाणित इतिहास और लोककथा बताइए।',
  },
];

export const GUIDE_TOPIC_CARDS: GuideTopicCard[] = [
  {
    id: 'black-taj-myth',
    badgeEn: 'History vs. Folklore',
    badgeHi: 'इतिहास बनाम लोककथा',
    titleEn: 'Black Taj Mahal & Artisans’ Hands Myths',
    titleHi: 'काला ताजमहल व कारीगरों के हाथ काटने की किंवदंती',
    descEn: 'Compare Tavernier’s 1665 Black Taj legend and artisan myths against ASI excavations at Mehtab Bagh.',
    descHi: 'मेहताब बाग में ASI की खुदाई और मुगल अभिलेखों के आधार पर इन प्रचलित लोककथाओं की सच्चाई जानें।',
    questionEn: 'Are the Black Taj Mahal story and the myth about cutting off artisans hands true?',
    questionHi: 'क्या काले ताजमहल और कारीगरों के हाथ काटने की कहानी सच है या लोककथा?',
    accent: 'saffron',
  },
  {
    id: 'optical-parchinkari',
    badgeEn: 'Architecture & Craft',
    badgeHi: 'स्थापत्य एवं शिल्प',
    titleEn: 'Optical Illusions & Pietra Dura Inlay',
    titleHi: 'दृष्टि-कौशल सुलेख और पर्चिनकारी कला',
    descEn: 'Discover Amanat Khan’s scaled calligraphy, outward-tilting minarets, and semi-precious stone inlay.',
    descHi: 'ऊँचाई के अनुसार बड़े होते अक्षर, बाहर की ओर झुकी मीनारें और संगमरमर में रत्न जड़ाई का रहस्य।',
    questionEn: 'Explain the calligraphy optical illusions, tilting minarets, and Parchinkari stone inlay at the Taj Mahal.',
    questionHi: 'ताजमहल की कैलीग्राफी के दृष्टि-कौशल, झुकी मीनारों और पर्चिनकारी कला को समझाइए।',
    accent: 'navy',
  },
  {
    id: 'musamman-burj-story',
    badgeEn: 'Agra Fort',
    badgeHi: 'आगरा किला',
    titleEn: 'Shah Jahan’s Final Years & Secret Tunnels',
    titleHi: 'शाहजहाँ के अंतिम वर्ष और गुप्त सुरंगों का सच',
    descEn: 'Separate recorded 1658–1666 house arrest history from folk stories of reflective gems and river tunnels.',
    descHi: '1658-1666 के ऐतिहासिक विवरण और गुप्त सुरंगों व हीरे के प्रतिबिंब की लोककथा का अंतर जानें।',
    questionEn: 'What happened to Shah Jahan at Musamman Burj and are there secret tunnels to the Taj Mahal?',
    questionHi: 'मुसम्मन बुर्ज में शाहजहाँ के अंतिम वर्ष कैसे बीते और क्या वहाँ से ताजमहल तक कोई गुप्त सुरंग है?',
    accent: 'brass',
  },
  {
    id: 'timings-etiquette',
    badgeEn: 'Visitor Essentials',
    badgeHi: 'यात्री नियम',
    titleEn: 'Sunrise Hours, Friday Closure & Rules',
    titleHi: 'खुलने का समय, शुक्रवार बंद व प्रवेश नियम',
    descEn: 'Check sunrise-to-sunset timings, annual Shah Jahan Urs access, shoe covers, and step-free routes.',
    descHi: 'सूर्योदय-सूर्यास्त समय, शाहजहाँ उर्स, शू-कवर नियम और व्हीलचेयर सुगम मार्ग की जानकारी लें।',
    questionEn: 'What are the Taj Mahal timings, Friday closure rule, shoe cover etiquette, and step-free routes?',
    questionHi: 'ताजमहल खुलने का समय, शुक्रवार नियम, शू-कवर और व्हीलचेयर सुगम मार्ग की जानकारी दें।',
    accent: 'emerald',
  },
];

export const AGRA_VISITOR_SNAPSHOT: VisitorSnapshotTile[] = [
  {
    id: 'timings',
    titleEn: 'Visiting Window & Friday Rule',
    titleHi: 'खुलने का समय व शुक्रवार नियम',
    bodyEn: 'Taj Mahal opens 30 min before sunrise to sunset (closed Fridays). Agra Fort is open all days.',
    bodyHi: 'ताजमहल सूर्योदय से 30 मिनट पहले खुलता है (शुक्रवार बंद)। आगरा किला सभी दिन खुला रहता है।',
  },
  {
    id: 'unesco',
    titleEn: 'Dual UNESCO Heritage Circuit',
    titleHi: 'दो यूनेस्को विश्व धरोहर स्थल',
    bodyEn: 'Taj Mahal & Agra Fort sit 2.5 km apart along the Yamuna bend, paired with UP ODOP Marble & Leather crafts.',
    bodyHi: 'ताजमहल और आगरा किला यमुना तट पर 2.5 किमी दूर स्थित हैं, साथ में यूपी ODOP शिल्प केंद्र भी हैं।',
  },
  {
    id: 'verified',
    titleEn: 'ASI-Grounded + 10-Lang Voice',
    titleHi: 'ASI प्रमाणित + 10 भाषाओं में आवाज़',
    bodyEn: 'Every answer separates recorded history from local folklore with voice input and read-aloud support.',
    bodyHi: 'प्रत्येक उत्तर प्रमाणित इतिहास व लोककथा को अलग दिखाता है तथा बोलकर पूछने और सुनने की सुविधा देता है।',
  },
];

