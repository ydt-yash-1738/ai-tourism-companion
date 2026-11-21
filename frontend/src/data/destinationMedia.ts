import { DEFAULT_AGRA_HELPLINES, DEFAULT_LUCKNOW_HELPLINES, DEFAULT_SARNATH_HELPLINES } from '../services/offlineStore';
import type { HelplineItem } from '../types/api';

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
  focusMonumentSlug?: string;
}

export interface VisitorSnapshotTile {
  id: string;
  titleEn: string;
  titleHi: string;
  bodyEn: string;
  bodyHi: string;
}

export interface TabHeroOverride {
  image: string;
  position: string;
  eyebrowEn?: string;
  eyebrowHi?: string;
  titleEn?: string;
  titleHi?: string;
}

export interface DestinationConfig {
  slug: string;
  nameEn: string;
  nameHi: string;
  /** landing-page hero slide for this destination */
  hero: {
    photo: string;
    alt: string;
    titleEn: string;
    titleHi: string;
    kickerEn: string;
    kickerHi: string;
  };
  center: [number, number];
  facilitiesCenter: [number, number];
  demoGps: {
    lat: number;
    lng: number;
    labelEn: string;
    labelHi: string;
  };
  defaultMedia: LocationMediaItem;
  guideBanner: {
    image: string;
    greetingEn: string;
    greetingHi: string;
    greetingSubEn: string;
    greetingSubHi: string;
  };
  tabHeroes: Record<'tour' | 'camera' | 'nearby' | 'facilities', TabHeroOverride>;
  defaultHelplines: HelplineItem[];
  offlineGapFollowUps: {
    en: string[];
    hi: string[];
  };
  copy: {
    companionTitleEn: string;
    companionTitleHi: string;
    guideWelcomeBadgeEn: string;
    guideWelcomeBadgeHi: string;
    guideHeadingEn: string;
    guideHeadingHi: string;
    allMonumentsEn: string;
    allMonumentsHi: string;
    exploreMonumentsHeadingEn: string;
    exploreMonumentsHeadingHi: string;
    chatPlaceholderEn: string;
    chatPlaceholderHi: string;
    startersEn: string[];
    startersHi: string[];
  };
  monumentSpotlights: MonumentSpotlightMeta[];
  topicCards: GuideTopicCard[];
  visitorSnapshot: VisitorSnapshotTile[];
}

const DEFAULT_AGRA_MEDIA: LocationMediaItem = {
  image: '/images/taj-mahal.webp',
  alt: 'Taj Mahal white marble mausoleum and reflecting pool in Agra',
  objectPosition: 'center 42%',
};

const DEFAULT_LUCKNOW_MEDIA: LocationMediaItem = {
  image: '/images/heritage/lucknow.webp',
  alt: 'The Rumi Darwaza, an ornate Awadhi gateway in Lucknow',
  objectPosition: 'center 42%',
};

const DEFAULT_SARNATH_MEDIA: LocationMediaItem = {
  image: '/images/heritage/sarnath.webp',
  alt: 'Ancient cylindrical brick and carved stone Dhamek Stupa at Sarnath',
  objectPosition: 'center 36%',
};

export const NEARBY_MEDIA_MAP: Record<string, LocationMediaItem> = {
  // Agra Nearby & ODOP (verified Wikimedia Commons WebP assets)
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
  // Sarnath Nearby & ODOP
  'thai-temple-giant-buddha': {
    image: '/images/nearby/thai-temple-giant-buddha.jpg',
    alt: 'Wat Thai Sarnath monastery gardens and 80-foot standing Buddha statue',
    objectPosition: 'center 18%',
  },
  'sarnath-deer-park-isipatana': {
    image: '/images/nearby/sarnath-deer-park-isipatana.jpg',
    alt: 'Spotted deer inside Sarnath Mrigadava Deer Park sanctuary',
    objectPosition: 'center 45%',
  },
  'digambar-jain-temple-sarnath': {
    image: '/images/nearby/digambar-jain-temple-sarnath.jpg',
    alt: 'Shri Digambar Jain Temple at Simhapuri adjacent to Dhamek Stupa in Sarnath',
    objectPosition: 'center 38%',
  },
  'deendayal-hastkala-sankul-odop': {
    image: '/images/nearby/deendayal-hastkala-sankul-odop.jpg',
    alt: 'Deendayal Hastkala Sankul Trade Facilitation Centre & Crafts Museum in Varanasi',
    objectPosition: 'center 42%',
  },
  'sarai-mohana-banarasi-weavers': {
    image: '/images/nearby/sarai-mohana-banarasi-weavers.jpg',
    alt: 'Traditional Banarasi silk saree handloom weaving in Sarai Mohana near Sarnath',
    objectPosition: 'center center',
  },
  'varanasi-wooden-toys-craft-hub': {
    image: '/images/nearby/varanasi-wooden-toys-craft-hub.jpg',
    alt: 'Hand-painted GI-tagged Varanasi wooden lacquerware and traditional toys',
    objectPosition: 'center center',
  },
  'sarnath-tibetan-monastery-food-lane': {
    image: '/images/nearby/sarnath-tibetan-monastery-food-lane.jpg',
    alt: 'Tibetan momos and monastery street refreshments near Sarnath',
    objectPosition: 'center center',
  },
  'buddha-purnima-sarnath-mahotsav': {
    image: '/images/nearby/buddha-purnima-sarnath-mahotsav.jpg',
    alt: 'Illuminated Dhamek Stupa and evening cultural celebration during Buddha Purnima',
    objectPosition: 'center 40%',
  },
};

export const MONUMENT_MEDIA_MAP: Record<string, LocationMediaItem> = {
  // Agra Monuments
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
  // Sarnath Monuments
  // Lucknow
  'rumi-darwaza': DEFAULT_LUCKNOW_MEDIA,
  'bara-imambara': {
    image: '/images/monuments/bara-imambara.webp',
    alt: 'The Bara Imambara complex in Lucknow',
    objectPosition: 'center 45%',
  },
  'bhool-bhulaiya': {
    image: '/images/monuments/imambara-rooftop.webp',
    alt: 'Rooftop of the Bara Imambara above the Bhool Bhulaiya labyrinth',
    objectPosition: 'center 40%',
  },
  'asfi-mosque': {
    image: '/images/monuments/asfi-mosque.webp',
    alt: 'The white-domed Asfi Mosque within the Bara Imambara complex in Lucknow',
    objectPosition: 'center 45%',
  },
  'dhamek-stupa': DEFAULT_SARNATH_MEDIA,
  'ashoka-pillar-sarnath': {
    image: '/images/monuments/ashoka-pillar-sarnath.jpg',
    alt: 'In-situ polished Chunar sandstone stump of Ashoka Pillar in Sarnath',
    objectPosition: 'center 45%',
  },
  'dharmarajika-stupa': {
    image: '/images/monuments/dharmarajika-stupa.jpg',
    alt: 'Circular excavated brick foundation of Dharmarajika Stupa in Sarnath',
    objectPosition: 'center 48%',
  },
  'sarnath-archaeological-museum': {
    image: '/images/monuments/sarnath-archaeological-museum.jpg',
    alt: 'Original four-lion Capital of Ashoka at Sarnath Archaeological Museum',
    objectPosition: 'center 18%',
  },
  'mulagandhakuti-vihara': {
    image: '/images/monuments/mulagandhakuti-vihara.jpg',
    alt: 'Mulagandhakuti Vihara temple tower and monastery courtyard in Sarnath',
    objectPosition: 'center 36%',
  },
  'chaukhandi-stupa': {
    image: '/images/monuments/chaukhandi-stupa.jpg',
    alt: 'Chaukhandi Stupa brick terraces crowned by 1588 CE octagonal Mughal tower',
    objectPosition: 'center 38%',
  },
};

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

export const SARNATH_MONUMENT_SPOTLIGHTS: MonumentSpotlightMeta[] = [
  {
    slug: 'dhamek-stupa',
    name: 'Dhamek Stupa',
    nameHi: 'धमेख स्तूप',
    shortSummary:
      '43.6 m cylindrical brick and carved Chunar sandstone stupa marking the sacred spot of Buddha’s first sermon.',
    shortSummaryHi:
      '43.6 मीटर ऊँचा विशाल बेलनाकार स्तूप, जो भगवान बुद्ध के प्रथम धर्मोपदेश स्थल का प्रतीक है।',
    visitDurationMin: 20,
    stepFree: true,
    promptEn: 'Tell me the verified history, Gupta carvings, and Jataka deer lore of Dhamek Stupa.',
    promptHi: 'धमेख स्तूप का प्रमाणित इतिहास, गुप्तकालीन नक्काशी और मृग जातक कथा बताइए।',
  },
  {
    slug: 'ashoka-pillar-sarnath',
    name: 'Ashoka Pillar & Main Shrine',
    nameHi: 'अशोक स्तंभ एवं मुख्य विहार अवशेष',
    shortSummary:
      'In-situ polished Chunar sandstone stump of Ashoka’s c. 250 BCE pillar inscribed with his Brahmi Schism Edict.',
    shortSummaryHi:
      'लगभग 250 ई.पू. में सम्राट अशोक द्वारा स्थापित पॉलिश किए चुनार पत्थर के स्तंभ का मूल आधार व ब्राह्मी अभिलेख।',
    visitDurationMin: 15,
    stepFree: true,
    promptEn: 'What is inscribed on the Ashoka Pillar at Sarnath and how was it excavated?',
    promptHi: 'सारनाथ के अशोक स्तंभ पर क्या उत्कीर्ण है और इसकी खोज कैसे हुई?',
  },
  {
    slug: 'sarnath-archaeological-museum',
    name: 'Sarnath Museum (Lion Capital)',
    nameHi: 'सारनाथ पुरातत्व संग्रहालय',
    shortSummary:
      'Oldest ASI site museum (1910) preserving the original four-lion Ashoka Capital—India’s National Emblem.',
    shortSummaryHi:
      '1910 में स्थापित एएसआई संग्रहालय, जहाँ भारत का राष्ट्रीय प्रतीक मूल अशोक स्तंभ शीर्ष सुरक्षित है।',
    visitDurationMin: 30,
    stepFree: true,
    promptEn: 'Tell me about the Ashoka Lion Capital inside Sarnath Museum and its Friday closure.',
    promptHi: 'सारनाथ संग्रहालय में रखे अशोक के सिंह स्तंभ और शुक्रवार अवकाश के बारे में बताइए।',
  },
  {
    slug: 'dharmarajika-stupa',
    name: 'Dharmarajika Stupa Ruins',
    nameHi: 'धर्मराजिका स्तूप अवशेष',
    shortSummary:
      'Circular brick reliquary stupa founded by Emperor Ashoka whose 1794 excavation initiated Sarnath’s rediscovery.',
    shortSummaryHi:
      'सम्राट अशोक द्वारा निर्मित अस्थि-स्तूप की नींव, जिसके 1794 के उत्खनन से सारनाथ पुनः प्रकाश में आया।',
    visitDurationMin: 12,
    stepFree: true,
    promptEn: 'What happened at Dharmarajika Stupa in 1794 and what is history vs folklore there?',
    promptHi: '1794 में धर्मराजिका स्तूप के उत्खनन का इतिहास और इससे जुड़ी जनश्रुति बताइए।',
  },
  {
    slug: 'mulagandhakuti-vihara',
    name: 'Mulagandhakuti Vihara & Bodhi Tree',
    nameHi: 'मूलगंधकुटी विहार एवं बोधि वृक्ष',
    shortSummary:
      '1931 Mahabodhi temple famous for Kosetsu Nosu’s frescoes, sacred relics, and a Bodhi Tree from Bodh Gaya’s lineage.',
    shortSummaryHi:
      '1931 में निर्मित बौद्ध विहार, जिसमें कोसेत्सु नोसु के भित्तिचित्र और पवित्र बोधि वृक्ष स्थित हैं।',
    visitDurationMin: 20,
    stepFree: false,
    promptEn: 'Tell me about Kosetsu Nosu’s frescoes and the Sacred Bodhi Tree at Mulagandhakuti Vihara.',
    promptHi: 'मूलगंधकुटी विहार के भित्तिचित्र और पवित्र बोधि वृक्ष की परंपरा के बारे में बताइए।',
  },
  {
    slug: 'chaukhandi-stupa',
    name: 'Chaukhandi Stupa',
    nameHi: 'चौखंडी स्तूप',
    shortSummary:
      'Gupta-era terraced brick stupa crowned by Govardhan’s 1588 CE octagonal Mughal tower honouring Emperor Humayun.',
    shortSummaryHi:
      'गुप्तकालीन सीढ़ीदार ईंटों का स्तूप, जिसके शीर्ष पर 1588 ई. में हुमायूँ की स्मृति में मुगल मीनार बनी है।',
    visitDurationMin: 15,
    stepFree: false,
    promptEn: 'Why does Chaukhandi Stupa have an octagonal Mughal tower on top?',
    promptHi: 'बौद्ध चौखंडी स्तूप के शिखर पर अष्टकोणीय मुगल मीनार क्यों बनी है?',
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
    focusMonumentSlug: 'musamman-burj',
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
  {
    id: 'agra-street-food',
    badgeEn: 'Street Food',
    badgeHi: 'स्ट्रीट फ़ूड',
    titleEn: 'Chaat Gali, Bedai-Jalebi & Agra Petha',
    titleHi: 'चाट गली, बेड़ई-जलेबी और आगरा पेठा',
    descEn: 'Explore Sadar Bazaar Chaat Gali, Belanganj morning Bedai, Noori Darwaza Petha, and Taj Ganj food stops.',
    descHi: 'सदर बाजार चाट गली, बेलनगंज की सुबह की बेड़ई, नूरी दरवाज़ा का पेठा और ताजगंज भोजन स्थल देखें।',
    questionEn: 'What is the best street food in Agra and where can I eat chaat or petha?',
    questionHi: 'आगरा में सबसे अच्छा स्ट्रीट फ़ूड, चाट और पेठा कहाँ मिलता है?',
    accent: 'saffron',
  },
  {
    id: 'agra-step-free-plan',
    badgeEn: 'Smart Itinerary',
    badgeHi: 'यात्रा योजना',
    titleEn: '3-Hour Step-Free Family Travel Plan',
    titleHi: '3-घंटे की सुगम पारिवारिक यात्रा योजना',
    descEn: 'Build a wheelchair-accessible, low-budget schedule pairing monuments, Parchinkari crafts, and street food.',
    descHi: 'स्मारक, पर्चिनकारी शिल्प और स्ट्रीट फ़ूड को जोड़ने वाली व्हीलचेयर-सुगम व किफायती योजना बनाएँ।',
    questionEn: 'Create a 3-hour wheelchair-accessible Agra travel plan for a family on a low budget including food and crafts',
    questionHi: 'आगरा में परिवार के लिए 3 घंटे की व्हीलचेयर-सुगम और कम बजट की यात्रा योजना बनाएं जिसमें भोजन और शिल्प भी शामिल हों',
    accent: 'navy',
  },
];

export const SARNATH_TOPIC_CARDS: GuideTopicCard[] = [
  {
    id: 'sarnath-deer-jataka',
    badgeEn: 'History vs. Folklore',
    badgeHi: 'इतिहास बनाम लोककथा',
    titleEn: 'First Sermon & Golden Deer Jataka Lore',
    titleHi: 'प्रथम धर्मोपदेश एवं स्वर्ण मृग जातक कथा',
    descEn: 'Pair the historical Dhammacakkappavattana Sutta at Dhamek Stupa with the compassionate Saranganatha Deer Park legend.',
    descHi: 'धर्मचक्रप्रवर्तन के ऐतिहासिक प्रमाणों के साथ मृगदाव व सारंगनाथ की करुणामयी जातक कथा जानें।',
    questionEn: 'Tell me about Buddha first sermon at Sarnath and the Golden Deer Jataka folklore.',
    questionHi: 'सारनाथ में बुद्ध के प्रथम उपदेश और स्वर्ण मृग जातक लोककथा के बारे में बताइए।',
    accent: 'saffron',
    focusMonumentSlug: 'dhamek-stupa',
  },
  {
    id: 'sarnath-national-emblem',
    badgeEn: 'National Heritage',
    badgeHi: 'राष्ट्रीय धरोहर',
    titleEn: 'Lion Capital & India’s National Emblem',
    titleHi: 'अशोक का सिंह स्तंभ और राष्ट्रीय प्रतीक',
    descEn: 'Explore Friedrich Oertel’s 1904-1905 discovery, the 24-spoked Ashoka Chakra, and the Schism Edict.',
    descHi: '1904-1905 की खुदाई, 24 तीलियों वाले अशोक चक्र और भारत के राजचिह्न बनने की पूरी गाथा।',
    questionEn: "How was the Ashoka Lion Capital excavated and how did it become India's National Emblem?",
    questionHi: 'सारनाथ का सिंह स्तंभ कैसे खोजा गया और यह भारत का राष्ट्रीय प्रतीक कैसे बना?',
    accent: 'navy',
    focusMonumentSlug: 'sarnath-archaeological-museum',
  },
  {
    id: 'chaukhandi-humayun-story',
    badgeEn: 'Syncretic Monument',
    badgeHi: 'अनोखा स्थापत्य',
    titleEn: 'Chaukhandi Stupa & Humayun’s Tower',
    titleHi: 'चौखंडी स्तूप और हुमायूँ की मुगल मीनार',
    descEn: 'Discover how Gupta Buddhist terraces were topped by Govardhan’s 1588 CE Mughal tower after Humayun’s stay.',
    descHi: 'गुप्तकालीन बौद्ध स्तूप के ऊपर अकबर के शासन में 1588 ई. में अष्टकोणीय मुगल मीनार बनने की कहानी।',
    questionEn: 'Why does Chaukhandi Stupa have an octagonal Mughal tower on top of a Buddhist stupa?',
    questionHi: 'चौखंडी स्तूप के ऊपर अष्टकोणीय मुगल मीनार क्यों बनी है और इसकी लोककथा क्या है?',
    accent: 'brass',
    focusMonumentSlug: 'chaukhandi-stupa',
  },
  {
    id: 'sarnath-timings-etiquette',
    badgeEn: 'Visitor Essentials',
    badgeHi: 'यात्री नियम',
    titleEn: 'Park Hours, Museum Friday Closure & Rules',
    titleHi: 'दर्शन समय, संग्रहालय शुक्रवार बंद व नियम',
    descEn: 'Plan ahead: outdoor ruins open daily (INR 25/300), while Sarnath Museum is closed every Friday.',
    descHi: 'स्तूप उद्यान प्रतिदिन खुलता है, जबकि सारनाथ संग्रहालय प्रत्येक शुक्रवार बंद रहता है—टिकट व शिष्टाचार जानें।',
    questionEn: 'What are the Sarnath monument timings, ticket prices, Friday museum closure, and visitor rules?',
    questionHi: 'सारनाथ स्मारक व संग्रहालय खुलने का समय, टिकट शुल्क, शुक्रवार अवकाश और प्रवेश नियम बताइए।',
    accent: 'emerald',
  },
  {
    id: 'sarnath-street-food',
    badgeEn: 'Local Cuisine',
    badgeHi: 'स्थानीय व्यंजन',
    titleEn: 'Banarasi Kachori-Lassi & Monastery Cafes',
    titleHi: 'बनारसी कचौड़ी-लस्सी और मठ मार्ग कैफे',
    descEn: 'Find Sarnath Chowk kachori-sabzi, kulhad lassi, Tibetan momos & thukpa, and clean vegetarian thalis.',
    descHi: 'सारनाथ चौराहे की कचौड़ी-सब्ज़ी, कुल्हड़ लस्सी, मठ मार्ग के मोमोज़-थुकपा और सात्विक थाली खोजें।',
    questionEn: 'What local street food, kachori, lassi, or monastery cafes are near Sarnath?',
    questionHi: 'सारनाथ में स्थानीय स्ट्रीट फ़ूड, कचौड़ी-लस्सी और मठ मार्ग के व्यंजन कहाँ मिलते हैं?',
    accent: 'saffron',
  },
  {
    id: 'sarnath-step-free-plan',
    badgeEn: 'Smart Itinerary',
    badgeHi: 'यात्रा योजना',
    titleEn: '3-Hour Step-Free Family Travel Plan',
    titleHi: '3-घंटे की सीढ़ी-रहित पारिवारिक यात्रा योजना',
    descEn: 'Combine Dhamek Stupa, Ashoka Pillar, Sarnath Museum, Wooden Toys ODOP, and local food on flat paths.',
    descHi: 'समतल मार्गों पर धमेख स्तूप, अशोक स्तंभ, संग्रहालय, काष्ठ खिलौना ODOP और भोजन की योजना बनाएँ।',
    questionEn: 'Create a 3-hour step-free Sarnath travel plan for a family including local food and Banarasi crafts',
    questionHi: 'सारनाथ में परिवार के लिए 3 घंटे की सीढ़ी-रहित यात्रा योजना बनाएं जिसमें भोजन और बनारसी शिल्प शामिल हों',
    accent: 'navy',
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

export const SARNATH_VISITOR_SNAPSHOT: VisitorSnapshotTile[] = [
  {
    id: 'timings',
    titleEn: 'Site Open Daily · Museum Closed Fri',
    titleHi: 'उद्यान प्रतिदिन · संग्रहालय शुक्रवार बंद',
    bodyEn: 'Dhamek & Chaukhandi Stupas open daily (sunrise–sunset). Sarnath Museum (Lion Capital) is closed every Friday.',
    bodyHi: 'धमेख व चौखंडी स्तूप प्रतिदिन खुले रहते हैं, जबकि सारनाथ संग्रहालय प्रत्येक शुक्रवार बंद रहता है।',
  },
  {
    id: 'circuit',
    titleEn: 'Step-Free Buddhist & Jain Circuit',
    titleHi: 'सुगम बौद्ध एवं जैन विरासत क्षेत्र',
    bodyEn: 'Flat brick garden paths link Dhamek Stupa, Ashoka Pillar, Jain Temple, and Banarasi Silk & Toy UP ODOP hubs.',
    bodyHi: 'समतल उद्यान मार्ग धमेख स्तूप, अशोक स्तंभ, जैन मंदिर तथा बनारसी रेशम व काष्ठ खिलौना ODOP से जुड़े हैं।',
  },
  {
    id: 'verified',
    titleEn: 'ASI-Grounded + 10-Lang Voice',
    titleHi: 'ASI प्रमाणित + 10 भाषाओं में आवाज़',
    bodyEn: 'Every answer separates ASI archaeology from Jataka & oral folklore with multilingual voice and read-aloud support.',
    bodyHi: 'प्रत्येक उत्तर पुरातत्व इतिहास व जातक लोककथा को अलग दिखाता है तथा बहुभाषी आवाज़ सहायता देता है।',
  },
];

export const LUCKNOW_MONUMENT_SPOTLIGHTS: MonumentSpotlightMeta[] = [
  {
    slug: 'bara-imambara',
    name: 'Bara Imambara',
    nameHi: 'बड़ा इमामबाड़ा',
    shortSummary: 'Vast 1784 Nawabi complex famed for its beamless central hall.',
    shortSummaryHi: '1784 का विशाल नवाबी परिसर, बिना बीम वाले मध्य हॉल के लिए प्रसिद्ध।',
    visitDurationMin: 25,
    stepFree: true,
    promptEn: 'Who built the Bara Imambara, and why is its central hall famous?',
    promptHi: 'बड़ा इमामबाड़ा किसने बनवाया और इसका मध्य हॉल क्यों प्रसिद्ध है?',
  },
  {
    slug: 'bhool-bhulaiya',
    name: 'Bhool Bhulaiya',
    nameHi: 'भूलभुलैया',
    shortSummary: "Labyrinth of narrow passages above the Imambara's great hall.",
    shortSummaryHi: 'इमामबाड़े के विशाल हॉल के ऊपर संकरे रास्तों की भूलभुलैया।',
    visitDurationMin: 20,
    stepFree: false,
    promptEn: 'What is the Bhool Bhulaiya, and what do the tunnel legends say?',
    promptHi: 'भूलभुलैया क्या है और सुरंगों की लोककथा क्या कहती है?',
  },
  {
    slug: 'rumi-darwaza',
    name: 'Rumi Darwaza',
    nameHi: 'रूमी दरवाज़ा',
    shortSummary: 'Towering 18th-century Awadhi gateway, a symbol of Lucknow.',
    shortSummaryHi: '18वीं सदी का भव्य अवधी द्वार, लखनऊ की पहचान।',
    visitDurationMin: 10,
    stepFree: true,
    promptEn: 'When was the Rumi Darwaza built, and what does its name mean?',
    promptHi: 'रूमी दरवाज़ा कब बना और इसके नाम का अर्थ क्या है?',
  },
  {
    slug: 'asfi-mosque',
    name: 'Asfi Mosque',
    nameHi: 'आसफ़ी मस्जिद',
    shortSummary: 'Mosque within the Bara Imambara complex, in active use.',
    shortSummaryHi: 'बड़ा इमामबाड़ा परिसर में स्थित मस्जिद, जहाँ नमाज़ होती है।',
    visitDurationMin: 10,
    stepFree: false,
    promptEn: 'Tell me about the Asfi Mosque and how to visit it respectfully.',
    promptHi: 'आसफ़ी मस्जिद के बारे में बताइए और वहाँ सम्मानपूर्वक कैसे जाएँ?',
  },
  {
    slug: 'shahi-baoli',
    name: 'Shahi Baoli (Royal Stepwell)',
    nameHi: 'शाही बावली (राजसी बावड़ी)',
    shortSummary: 'Five-storeyed 18th-century arched stepwell featuring a water-reflection lookout.',
    shortSummaryHi: 'पाँच मंजिला मेहराबदार बावड़ी, जहाँ पानी के प्रतिबिंब से निगरानी होती थी।',
    visitDurationMin: 15,
    stepFree: true,
    promptEn: 'How did the Shahi Baoli stepwell work and what is the legend about it?',
    promptHi: 'शाही बावली कैसे काम करती थी और इससे जुड़ी लोककथा क्या है?',
  },
  {
    slug: 'chota-imambara',
    name: 'Chota Imambara (Hussainabad Imambara)',
    nameHi: 'छोटा इमामबाड़ा (हुसैनाबाद इमामबाड़ा)',
    shortSummary: 'Ornate 1838 congregation hall known for its gilded dome and Belgian crystal chandeliers.',
    shortSummaryHi: '1838 का अलंकृत इमामबाड़ा, अपने सुनहरे गुंबद और क्रिस्टल झाड़-फ़ानूसों के लिए प्रसिद्ध।',
    visitDurationMin: 25,
    stepFree: true,
    promptEn: 'Who built the Chota Imambara and why is it called the Palace of Lights?',
    promptHi: 'छोटा इमामबाड़ा किसने बनवाया और इसे रोशनी का महल क्यों कहा जाता है?',
  },
];

export const LUCKNOW_TOPIC_CARDS: GuideTopicCard[] = [
  {
    id: 'lucknow-famine-legend',
    badgeEn: 'History vs. Folklore',
    badgeHi: 'इतिहास बनाम लोककथा',
    titleEn: 'A Famine-Relief Monument & Its Legend',
    titleHi: 'अकाल राहत का स्मारक और उसकी लोककथा',
    descEn: 'The recorded 1784 famine-relief project, set beside the much-loved "built by day, undone by night" story.',
    descHi: '1784 की दर्ज अकाल राहत परियोजना और "दिन में बनाओ, रात में गिराओ" की प्रिय लोककथा।',
    questionEn: 'Why was the Bara Imambara built during a famine, and what is the built by day, undone by night story?',
    questionHi: 'अकाल के समय बड़ा इमामबाड़ा क्यों बना और "दिन में बनाओ, रात में गिराओ" की कहानी क्या है?',
    accent: 'saffron',
    focusMonumentSlug: 'bara-imambara',
  },
  {
    id: 'lucknow-beamless-hall',
    badgeEn: 'Architecture',
    badgeHi: 'स्थापत्य',
    titleEn: 'The Hall Built Without Beams',
    titleHi: 'बिना बीम का विशाल हॉल',
    descEn: 'How the great arched hall of the Bara Imambara stands with no supporting beams.',
    descHi: 'बड़ा इमामबाड़ा का मेहराबदार हॉल बिना सहारे की बीम के कैसे खड़ा है।',
    questionEn: 'How does the central hall of the Bara Imambara stand without beams?',
    questionHi: 'बड़ा इमामबाड़ा का मध्य हॉल बिना बीम के कैसे खड़ा है?',
    accent: 'navy',
    focusMonumentSlug: 'bara-imambara',
  },
  {
    id: 'lucknow-chikankari',
    badgeEn: 'ODOP Craft',
    badgeHi: 'ODOP शिल्प',
    titleEn: "Chikankari, Lucknow's Signature Craft",
    titleHi: 'चिकनकारी, लखनऊ की पहचान',
    descEn: "Lucknow's One District One Product embroidery, and where to see it near the Imambara.",
    descHi: 'लखनऊ की एक जनपद एक उत्पाद कढ़ाई, और इमामबाड़े के पास इसे कहाँ देखें।',
    questionEn: "What is Chikankari, Lucknow's ODOP craft?",
    questionHi: 'लखनऊ का ODOP शिल्प चिकनकारी क्या है?',
    accent: 'emerald',
  },
  {
    id: 'lucknow-etiquette',
    badgeEn: 'Visitor Tips',
    badgeHi: 'यात्री सुझाव',
    titleEn: 'Visiting a Living Religious Site',
    titleHi: 'सक्रिय धार्मिक स्थल की यात्रा',
    descEn: 'Dress, footwear and photography etiquette for the Imambara complex and Asfi Mosque.',
    descHi: 'इमामबाड़ा परिसर और आसफ़ी मस्जिद के लिए पहनावा, जूते और फ़ोटो के नियम।',
    questionEn: 'How should I dress and behave when visiting the Bara Imambara and Asfi Mosque?',
    questionHi: 'बड़ा इमामबाड़ा और आसफ़ी मस्जिद जाते समय पहनावा और व्यवहार कैसा हो?',
    accent: 'brass',
    focusMonumentSlug: 'asfi-mosque',
  },
  {
    id: 'lucknow-street-food',
    badgeEn: 'Street Food',
    badgeHi: 'स्ट्रीट फ़ूड',
    titleEn: 'Awadhi Kebabs, Basket Chaat & Kulfi',
    titleHi: 'अवधी कबाब, बास्केट चाट और कुल्फी',
    descEn: 'Discover Akbari Gate in Chowk, Hazratganj Royal Basket Chaat, and Aminabad Kulfi Falooda.',
    descHi: 'चौक के अकबरी गेट, हज़रतगंज की रॉयल बास्केट चाट और अमीनाबाद की कुल्फी फ़ालूदा के केंद्र जानें।',
    questionEn: 'What is the best street food in Lucknow like chaat, kebabs, and kulfi?',
    questionHi: 'लखनऊ में बास्केट चाट, कबाब और कुल्फी जैसा सबसे अच्छा स्ट्रीट फ़ूड कहाँ मिलता है?',
    accent: 'saffron',
  },
  {
    id: 'lucknow-step-free-plan',
    badgeEn: 'Smart Itinerary',
    badgeHi: 'यात्रा योजना',
    titleEn: '3-Hour Wheelchair & Family Travel Plan',
    titleHi: '3-घंटे की सुगम पारिवारिक यात्रा योजना',
    descEn: 'Pair Rumi Darwaza, Bara Imambara courtyard, Shahi Baoli, Chota Imambara, Chikankari, and street food.',
    descHi: 'रूमी दरवाज़ा, बड़ा इमामबाड़ा आँगन, शाही बावली, छोटा इमामबाड़ा, चिकनकारी और स्ट्रीट फ़ूड की योजना बनाएँ।',
    questionEn: 'Create a 3-hour wheelchair-accessible Lucknow travel plan for a family including Chikankari and street food',
    questionHi: 'लखनऊ में परिवार के लिए 3 घंटे की व्हीलचेयर-सुगम यात्रा योजना बनाएं जिसमें चिकनकारी और स्ट्रीट फ़ूड शामिल हों',
    accent: 'navy',
  },
];

export const LUCKNOW_VISITOR_SNAPSHOT: VisitorSnapshotTile[] = [
  {
    id: 'complex',
    titleEn: 'One Complex, Four Sights',
    titleHi: 'एक परिसर, चार दर्शनीय स्थल',
    bodyEn: 'Bara Imambara, Bhool Bhulaiya and Asfi Mosque share one complex; the Rumi Darwaza stands just beside it.',
    bodyHi: 'बड़ा इमामबाड़ा, भूलभुलैया और आसफ़ी मस्जिद एक ही परिसर में हैं; रूमी दरवाज़ा ठीक पास में है।',
  },
  {
    id: 'respect',
    titleEn: 'A Place of Worship',
    titleHi: 'एक धार्मिक स्थल',
    bodyEn: 'The complex is in active religious use: dress modestly and remove footwear where asked.',
    bodyHi: 'परिसर धार्मिक उपयोग में है: शालीन कपड़े पहनें और कहे जाने पर जूते उतारें।',
  },
  {
    id: 'verified',
    titleEn: 'History Kept Apart from Legend',
    titleHi: 'इतिहास और लोककथा अलग',
    bodyEn: 'Every answer separates recorded history from Lucknow folklore, with voice input and read-aloud.',
    bodyHi: 'हर उत्तर दर्ज इतिहास को लखनऊ की लोककथाओं से अलग रखता है, बोलकर पूछने और सुनने के साथ।',
  },
];

export const DESTINATION_CONFIG_MAP: Record<string, DestinationConfig> = {
  agra: {
    slug: 'agra',
    nameEn: 'Agra',
    hero: {
      photo: '/images/taj-mahal.webp',
      alt: 'The Taj Mahal in Agra, seen across its gardens',
      titleEn: 'Taj Mahal',
      titleHi: 'ताजमहल',
      kickerEn: 'Agra · UNESCO World Heritage',
      kickerHi: 'आगरा · यूनेस्को विश्व धरोहर',
    },
    nameHi: 'आगरा',
    center: [27.1751, 78.0421],
    facilitiesCenter: [27.1735, 78.0421],
    demoGps: {
      lat: 27.1802,
      lng: 78.0226,
      labelEn: 'Musamman Burj',
      labelHi: 'मुसम्मन बुर्ज',
    },
    defaultMedia: DEFAULT_AGRA_MEDIA,
    guideBanner: {
      image: '/images/taj-mahal-banner.webp',
      greetingEn: 'Namaste! Welcome to Agra',
      greetingHi: 'नमस्ते! आगरा में आपका स्वागत है',
      greetingSubEn: 'Taj Mahal · Agra Fort · UNESCO World Heritage',
      greetingSubHi: 'ताजमहल · आगरा किला · यूनेस्को विश्व धरोहर',
    },
    tabHeroes: {
      tour: { image: '/images/monuments/darwaza-i-rauza.webp', position: 'center 28%' },
      camera: { image: '/images/nearby/parchinkari-artisan-hub.webp', position: 'center 40%' },
      nearby: { image: '/images/nearby/itimad-ud-daulah-baby-taj.webp', position: 'center 32%' },
      facilities: { image: '/images/taj-mahal-banner.webp', position: 'center 35%' },
    },
    defaultHelplines: DEFAULT_AGRA_HELPLINES,
    offlineGapFollowUps: {
      en: ['Why was the Taj Mahal built?', 'Is the Black Taj Mahal myth true?'],
      hi: ['ताजमहल क्यों बनाया गया?', 'काले ताजमहल की कहानी सच है या लोककथा?'],
    },
    copy: {
      companionTitleEn: 'Agra Heritage Companion',
      companionTitleHi: 'आगरा विरासत साथी',
      guideWelcomeBadgeEn: 'UNESCO Dual Heritage · Taj Mahal & Agra Fort',
      guideWelcomeBadgeHi: 'यूनेस्को युगल विरासत · ताजमहल एवं आगरा किला',
      guideHeadingEn: 'Ask Anything About Agra Heritage',
      guideHeadingHi: 'आगरा विरासत के बारे में पूछें',
      allMonumentsEn: 'All Agra Monuments',
      allMonumentsHi: 'पूरा आगरा क्षेत्र',
      exploreMonumentsHeadingEn: 'Explore Agra Monuments',
      exploreMonumentsHeadingHi: 'आगरा के प्रमुख स्मारक देखें',
      chatPlaceholderEn: 'Type or speak a question about Taj Mahal or Agra Fort...',
      chatPlaceholderHi: 'ताजमहल या आगरा किले के बारे में लिखें या बोलकर पूछें...',
      startersEn: [
        'Why was the Taj Mahal built, and is the Black Taj Mahal story true?',
        'What do the floral carvings and Parchinkari inlay mean?',
        'What happened to Shah Jahan at Musamman Burj?',
        'Are there step-free routes and shoe cover rules here?',
      ],
      startersHi: [
        'ताजमहल क्यों बनाया गया और काले ताजमहल की कहानी सच है या लोककथा?',
        'दीवारों पर फूल-पत्ती की पर्चिनकारी कला का क्या अर्थ है?',
        'शाहजहाँ ने मुसम्मन बुर्ज में अंतिम वर्ष कैसे बिताए?',
        'ताजमहल खुलने का समय और शुक्रवार के नियम क्या हैं?',
      ],
    },
    monumentSpotlights: GUIDE_MONUMENT_SPOTLIGHTS,
    topicCards: GUIDE_TOPIC_CARDS,
    visitorSnapshot: AGRA_VISITOR_SNAPSHOT,
  },
  lucknow: {
    slug: 'lucknow',
    nameEn: 'Lucknow',
    nameHi: 'लखनऊ',
    hero: {
      photo: '/images/heritage/lucknow.webp',
      alt: 'The Rumi Darwaza gateway in Lucknow',
      titleEn: 'Rumi Darwaza',
      titleHi: 'रूमी दरवाज़ा',
      kickerEn: 'Lucknow · Nawabi heritage',
      kickerHi: 'लखनऊ · नवाबी विरासत',
    },
    center: [26.8691, 80.9124],
    facilitiesCenter: [26.8691, 80.9124],
    demoGps: {
      lat: 26.8692,
      lng: 80.9131,
      labelEn: 'Bara Imambara',
      labelHi: 'बड़ा इमामबाड़ा',
    },
    defaultMedia: DEFAULT_LUCKNOW_MEDIA,
    guideBanner: {
      image: '/images/heritage/lucknow.webp',
      greetingEn: 'Namaste! Welcome to Lucknow',
      greetingHi: 'नमस्ते! लखनऊ में आपका स्वागत है',
      greetingSubEn: 'Bara Imambara · Bhool Bhulaiya · Rumi Darwaza',
      greetingSubHi: 'बड़ा इमामबाड़ा · भूलभुलैया · रूमी दरवाज़ा',
    },
    tabHeroes: {
      tour: {
        image: '/images/monuments/bara-imambara.webp',
        position: 'center 32%',
        titleEn: 'Walk Lucknow at your own pace',
        titleHi: 'अपनी गति से लखनऊ घूमें',
      },
      camera: {
        image: '/images/monuments/imambara-rooftop.webp',
        position: 'center 30%',
      },
      nearby: {
        image: '/images/heritage/lucknow.webp',
        position: 'center 32%',
      },
      facilities: {
        image: '/images/monuments/bara-imambara.webp',
        position: 'center 32%',
      },
    },
    defaultHelplines: DEFAULT_LUCKNOW_HELPLINES,
    offlineGapFollowUps: {
      en: ['Who built the Bara Imambara?', 'What is the Bhool Bhulaiya?'],
      hi: ['बड़ा इमामबाड़ा किसने बनवाया?', 'भूलभुलैया क्या है?'],
    },
    copy: {
      companionTitleEn: 'Lucknow Heritage Companion',
      companionTitleHi: 'लखनऊ विरासत साथी',
      guideWelcomeBadgeEn: 'Nawabi Lucknow · Bara Imambara & Rumi Darwaza',
      guideWelcomeBadgeHi: 'नवाबी लखनऊ · बड़ा इमामबाड़ा एवं रूमी दरवाज़ा',
      guideHeadingEn: 'Ask Anything About Lucknow Heritage',
      guideHeadingHi: 'लखनऊ विरासत के बारे में पूछें',
      allMonumentsEn: 'All Lucknow Monuments',
      allMonumentsHi: 'पूरा लखनऊ क्षेत्र',
      exploreMonumentsHeadingEn: 'Explore Lucknow Monuments',
      exploreMonumentsHeadingHi: 'लखनऊ के प्रमुख स्मारक देखें',
      chatPlaceholderEn: 'Type or speak a question about the Bara Imambara, Bhool Bhulaiya or Rumi Darwaza...',
      chatPlaceholderHi: 'बड़ा इमामबाड़ा, भूलभुलैया या रूमी दरवाज़ा के बारे में लिखें या बोलकर पूछें...',
      startersEn: [
        'Who built the Bara Imambara, and why during a famine?',
        'How does the great hall stand without any beams?',
        'Are the secret tunnels of the Bhool Bhulaiya real?',
        'What does the name Rumi Darwaza mean?',
      ],
      startersHi: [
        'बड़ा इमामबाड़ा किसने और अकाल के समय क्यों बनवाया?',
        'विशाल हॉल बिना बीम के कैसे खड़ा है?',
        'क्या भूलभुलैया की गुप्त सुरंगें सच हैं?',
        'रूमी दरवाज़ा नाम का अर्थ क्या है?',
      ],
    },
    monumentSpotlights: LUCKNOW_MONUMENT_SPOTLIGHTS,
    topicCards: LUCKNOW_TOPIC_CARDS,
    visitorSnapshot: LUCKNOW_VISITOR_SNAPSHOT,
  },
  sarnath: {
    slug: 'sarnath',
    nameEn: 'Sarnath',
    hero: {
      photo: '/images/heritage/sarnath.webp',
      alt: 'The Dhamek Stupa at Sarnath',
      titleEn: 'Dhamek Stupa',
      titleHi: 'धमेख स्तूप',
      kickerEn: 'Sarnath · Where the Buddha first taught',
      kickerHi: 'सारनाथ · जहाँ बुद्ध ने पहला उपदेश दिया',
    },
    nameHi: 'सारनाथ',
    center: [25.3808, 83.0245],
    facilitiesCenter: [25.3792, 83.0235],
    demoGps: {
      lat: 25.3808,
      lng: 83.0245,
      labelEn: 'Dhamek Stupa',
      labelHi: 'धमेख स्तूप',
    },
    defaultMedia: DEFAULT_SARNATH_MEDIA,
    guideBanner: {
      image: '/images/heritage/sarnath.webp',
      greetingEn: 'Namaste! Welcome to Sarnath',
      greetingHi: 'नमस्ते! सारनाथ में आपका स्वागत है',
      greetingSubEn: 'Dhamek Stupa · Ashoka Pillar · Sacred Deer Park',
      greetingSubHi: 'धमेख स्तूप · अशोक स्तंभ · पावन मृगदाव',
    },
    tabHeroes: {
      tour: {
        image: '/images/monuments/chaukhandi-stupa.jpg',
        position: 'center 28%',
        titleEn: 'Walk Sarnath at your own pace',
        titleHi: 'अपनी गति से सारनाथ घूमें',
      },
      camera: {
        image: '/images/monuments/sarnath-archaeological-museum.jpg',
        position: 'center 18%',
      },
      nearby: {
        image: '/images/nearby/thai-temple-giant-buddha.jpg',
        position: 'center 18%',
      },
      facilities: {
        image: '/images/heritage/sarnath.webp',
        position: 'center 30%',
      },
    },
    defaultHelplines: DEFAULT_SARNATH_HELPLINES,
    offlineGapFollowUps: {
      en: [
        'Where did Gautama Buddha deliver his first sermon?',
        'Tell me the Golden Deer Jataka story of Sarnath',
      ],
      hi: [
        'बुद्ध ने पहला उपदेश कहाँ दिया था?',
        'सारनाथ की स्वर्ण मृग जातक लोककथा बताइए',
      ],
    },
    copy: {
      companionTitleEn: 'Sarnath Heritage Companion',
      companionTitleHi: 'सारनाथ विरासत साथी',
      guideWelcomeBadgeEn: 'Sacred Deer Park · Dhamek Stupa & Lion Capital',
      guideWelcomeBadgeHi: 'पावन मृगदाव · धमेख स्तूप एवं अशोक स्तंभ',
      guideHeadingEn: 'Ask Anything About Sarnath Heritage',
      guideHeadingHi: 'सारनाथ विरासत के बारे में पूछें',
      allMonumentsEn: 'All Sarnath Monuments',
      allMonumentsHi: 'पूरा सारनाथ क्षेत्र',
      exploreMonumentsHeadingEn: 'Explore Sarnath Monuments',
      exploreMonumentsHeadingHi: 'सारनाथ के प्रमुख स्मारक देखें',
      chatPlaceholderEn: 'Type or speak a question about Dhamek Stupa, Ashoka Pillar, or Sarnath...',
      chatPlaceholderHi: 'धमेख स्तूप, अशोक स्तंभ या सारनाथ के बारे में लिखें या बोलकर पूछें...',
      startersEn: [
        'Where did Buddha deliver his first sermon, and what is the Deer Park legend?',
        'How did the Ashoka Lion Capital become India’s National Emblem?',
        'Why does Chaukhandi Stupa have a Mughal octagonal tower on top?',
        'When is Sarnath Museum closed, and are step-free paths available?',
      ],
      startersHi: [
        'भगवान बुद्ध ने प्रथम उपदेश कहाँ दिया और स्वर्ण मृग जातक कथा क्या है?',
        'अशोक का सिंह स्तंभ भारत का राष्ट्रीय प्रतीक कैसे बना?',
        'चौखंडी स्तूप के शिखर पर मुगल मीनार क्यों बनाई गई?',
        'सारनाथ संग्रहालय किस दिन बंद रहता है और क्या रैंप मार्ग उपलब्ध है?',
      ],
    },
    monumentSpotlights: SARNATH_MONUMENT_SPOTLIGHTS,
    topicCards: SARNATH_TOPIC_CARDS,
    visitorSnapshot: SARNATH_VISITOR_SNAPSHOT,
  },
};

/**
 * Real photos of the *area* a facility is in (Wikimedia Commons, credited).
 * The caption says what the photo shows, so it is never mistaken for the facility itself.
 * Facilities without a verified photo of their location keep their type icon.
 */
export interface FacilityPhoto {
  image: string;
  position: string;
  captionEn: string;
  captionHi: string;
}

export const FACILITY_PHOTOS: Record<string, FacilityPhoto> = {
  'taj-west-gate-accessible-toilet': {
    image: '/images/facilities/agra-taj-west-gate.webp',
    position: 'center 45%',
    captionEn: 'Taj Mahal West Gate area',
    captionHi: 'ताजमहल पश्चिमी द्वार क्षेत्र',
  },
  'up-tourism-help-desk': {
    image: '/images/facilities/agra-taj-west-gate-entry.webp',
    position: 'center 40%',
    captionEn: 'West Gate entry approach',
    captionHi: 'पश्चिमी द्वार प्रवेश मार्ग',
  },
  'taj-ganj-tourist-police': {
    image: '/images/facilities/agra-taj-south-gate-tajganj.webp',
    position: 'center 55%',
    captionEn: 'South Gate, Taj Ganj side',
    captionHi: 'दक्षिणी द्वार, ताजगंज की ओर',
  },
  'taj-ro-drinking-water': {
    image: '/images/facilities/agra-taj-jilaukhana-forecourt.webp',
    position: 'center 50%',
    captionEn: 'Jilaukhana forecourt, by the Great Gate',
    captionHi: 'जिलौखाना प्रांगण, मुख्य द्वार के पास',
  },
  'taj-asi-medical-first-aid': {
    image: '/images/facilities/agra-taj-jilaukhana-forecourt.webp',
    position: 'center 35%',
    captionEn: 'Jilaukhana forecourt arcades',
    captionHi: 'जिलौखाना प्रांगण के दालान',
  },
  'sn-medical-college-hospital': {
    image: '/images/facilities/agra-sn-medical-college.webp',
    position: 'center 40%',
    captionEn: 'S.N. Medical College gate, Agra',
    captionHi: 'एस.एन. मेडिकल कॉलेज द्वार, आगरा',
  },
  'taj-east-gate-food-plaza': {
    image: '/images/facilities/agra-chaupati-food-court.webp',
    position: 'center 55%',
    captionEn: 'Agra Chaupati food court',
    captionHi: 'आगरा चौपाटी फ़ूड कोर्ट',
  },
  'taj-east-gate-toilet-water': {
    image: '/images/facilities/agra-taj-locker-room.webp',
    position: 'center 35%',
    captionEn: 'Taj Mahal locker room (ADA), gate plaza',
    captionHi: 'ताजमहल लॉकर रूम (आगरा विकास प्राधिकरण), द्वार प्रांगण',
  },
  'taj-shilpgram-parking': {
    image: '/images/facilities/agra-taj-western-gate-parking-sign.webp',
    position: 'center 30%',
    captionEn: 'Parking signage, Western Gate',
    captionHi: 'पार्किंग संकेत, पश्चिमी द्वार',
  },
  'agra-fort-gate-facilities': {
    image: '/images/monuments/amar-singh-gate.webp',
    position: 'center 45%',
    captionEn: 'Amar Singh Gate, Agra Fort',
    captionHi: 'अमर सिंह द्वार, आगरा किला',
  },
};

/** Destinations shown in the landing hero slideshow, in order */
export const HERO_DESTINATIONS = ['agra', 'lucknow', 'sarnath'] as const;

export function getDestinationConfig(slug: string): DestinationConfig {
  return DESTINATION_CONFIG_MAP[slug] || DESTINATION_CONFIG_MAP.agra;
}

/** Photo for a nearby place, or null when no verified photo exists (an illustrated tile is shown). */
export function getNearbyMedia(slug: string, _destSlug = 'agra'): LocationMediaItem | null {
  void _destSlug;
  return NEARBY_MEDIA_MAP[slug] ?? null;
}

export function getMonumentMedia(slug: string, destSlug = 'agra'): LocationMediaItem {
  return MONUMENT_MEDIA_MAP[slug] || getDestinationConfig(destSlug).defaultMedia;
}
