import type { PersonaType } from '../types/api';

export interface UiStrings {
  govTag: string;
  appTitle: string;
  deptInsights: string;
  eyebrow: string;
  heroHeadline: string;
  heroSub: string;
  launchAgra: string;
  launchSarnath: string;
  detectGps: string;
  detectingGps: string;
  locationActive: string;
  refreshLocation: string;
  locDefaultNotice: string;
  citiesHeading: string;
  citiesSub: string;
  liveBadge: string;
  liveNow: string;
  comingSoon: string;
  exploreFeatures: string;
  packPlanned: string;
  footerText: string;

  companionTitle: string;
  upTourismLabel: string;
  online: string;
  offline: string;
  offlineReady: string;
  offlinePack: string;
  easyMode: string;
  easyModeOn: string;
  langLabel: string;
  styleLabel: string;
  offlineBanner: string;

  tabs: {
    guide: string;
    camera: string;
    tour: string;
    nearby: string;
    facilities: string;
  };
  personas: Record<PersonaType, string>;

  guideHeading: string;
  guideSub: string;
  allMonuments: string;
  exploreMonumentsHeading: string;
  exploreMonumentsSub: string;
  askAboutMonument: string;
  curatedTopicsHeading: string;
  curatedTopicsSub: string;
  newChat: string;
  stepFreeBadge: string;
  stairsBadge: string;
  guideWelcomeBadge: string;
  recordedHistory: string;
  localFolklore: string;
  sourceLabel: string;
  attributionLabel: string;
  readAloud: string;
  stopAudio: string;
  loadingAudio: string;
  retry: string;
  loadingTours: string;
  loadingNearby: string;
  loadingFacilities: string;
  loadingEmergency: string;
  loadingMonuments: string;
  translating: string;
  analyzingPhoto: string;
  serverErrorTitle: string;
  serverErrorDesc: string;
  offlineFallbackNotice: string;
  offlinePackFailed: string;
  downloadingPack: string;
  nowShowing: string;
  noNearbyMatched: string;
  noFacilitiesMatched: string;
  resetFilters: string;
  gapNotice: string;
  searchingRecords: string;
  chatPlaceholder: string;
  starters: string[];

  cameraHeading: string;
  cameraSub: string;
  chooseAnotherPhoto: string;
  capturePhoto: string;
  cameraPlaceholder: string;
  demoGpsOff: string;
  demoGpsOn: string;
  usingLiveGps: string;
  identifyBtn: string;
  identifyingBtn: string;
  offlineCameraErr: string;

  tourHeading: string;
  tourSub: string;
  anyTime: string;
  stepFreeOnly: string;
  playAudioStory: string;
  prevStop: string;
  nextStop: string;
  nearStopPrefix: string;
  jumpToStop: string;
  noToursMatched: string;
  stopLabel: string;

  nearbyHeading: string;
  nearbySub: string;
  odopOnly: string;
  timingsLabel: string;
  feeLabel: string;
  reachLabel: string;
  directions: string;
  interests: Record<'heritage' | 'crafts' | 'food' | 'shopping', string>;
  groups: Record<string, string>;
  budgetAny: string;
  budgetFree: string;
  budgetLow: string;
  budgetMed: string;

  facilitiesHeading: string;
  facilitiesSub: string;
  wheelchairAccessible: string;
  facilityTypes: Record<string, string>;

  sosTitle: string;
  sosSub: string;
  hospitalDirections: string;
}

const EN: UiStrings = {
  govTag: 'Government of Uttar Pradesh · UP Tourism & AI Mission',
  appTitle: 'UP AI Heritage Companion',
  deptInsights: 'Dept. Insights',
  eyebrow: 'Digital India Initiative · Multilingual Heritage Guide',
  heroHeadline: "Every Monument's Story, Explained in Your Own Language.",
  heroSub:
    'Ask by text, voice, or camera with verified ASI history separated from local folklore, step-free audio tours, UP ODOP crafts, and offline emergency help.',
  launchAgra: 'Launch Agra Companion',
  launchSarnath: 'Launch Sarnath Companion',
  detectGps: 'Detect My Location',
  detectingGps: 'Detecting GPS...',
  locationActive: 'Location Active',
  refreshLocation: 'Refresh Location',
  locDefaultNotice: 'Location not provided — select an active UP heritage destination (Agra or Sarnath) below to begin.',
  citiesHeading: 'Heritage Destinations Across Uttar Pradesh',
  citiesSub: 'Agra (Taj Mahal & Agra Fort) and Sarnath (Dhamek Stupa & Ashoka Pillar) are live right now; additional UP heritage circuits are pre-mapped below.',
  liveBadge: '2 Destinations Live',
  liveNow: 'Live Now',
  comingSoon: 'Coming Soon',
  exploreFeatures: 'Explore 9/9 Companion Features',
  packPlanned: 'Destination Pack Planned',
  footerText:
    'Built for UP AI Mission · Department of IT & Electronics, Government of Uttar Pradesh · Public & ASI-Grounded Heritage Data',

  companionTitle: 'Agra Heritage Companion',
  upTourismLabel: 'UP Tourism',
  online: 'Online',
  offline: 'Offline Mode',
  offlineReady: 'Offline Ready',
  offlinePack: 'Offline Pack',
  easyMode: 'Aa+ Easy',
  easyModeOn: 'Aa+ On',
  langLabel: 'Lang',
  styleLabel: 'Style',
  offlineBanner:
    'Offline / Weak-Network Mode: Using downloaded heritage data, maps, facilities & 1-Tap SOS.',

  tabs: {
    guide: 'Guide',
    camera: 'Camera',
    tour: 'Tour',
    nearby: 'Nearby',
    facilities: 'Facilities',
  },
  personas: {
    quick: 'Quick Guide',
    kids: 'Kids Story',
    scholar: 'History & Arch',
    pilgrim: 'Devotional',
  },

  guideHeading: 'Ask Anything About Agra Heritage',
  guideSub: 'Answers ground in ASI/UNESCO sources and separate recorded history from folklore.',
  allMonuments: 'All Agra Monuments',
  exploreMonumentsHeading: 'Explore Agra Monuments',
  exploreMonumentsSub: 'Tap any monument to focus the AI Guide and hear its verified history & folklore.',
  askAboutMonument: 'Ask Guide',
  curatedTopicsHeading: 'History vs. Folklore & Curated Stories',
  curatedTopicsSub: 'Every answer clearly separates ASI/UNESCO records from popular legends.',
  newChat: 'Explore Monuments',
  stepFreeBadge: 'Step-Free',
  stairsBadge: 'Has Stairs',
  guideWelcomeBadge: 'UNESCO Dual Heritage · Taj Mahal & Agra Fort',
  recordedHistory: 'Recorded History',
  localFolklore: 'Local Folklore & Tradition',
  sourceLabel: 'Source: ',
  attributionLabel: 'Attribution: ',
  readAloud: 'Read Aloud',
  stopAudio: 'Stop',
  loadingAudio: 'Loading audio...',
  retry: 'Try Again',
  loadingTours: 'Loading walking routes & audio stops...',
  loadingNearby: 'Discovering nearby heritage & UP ODOP crafts...',
  loadingFacilities: 'Finding nearest public facilities...',
  loadingEmergency: 'Checking nearest live emergency units...',
  loadingMonuments: 'Loading monuments...',
  translating: 'Translating...',
  analyzingPhoto: 'Analyzing monument architecture & verified records...',
  serverErrorTitle: 'Unable to reach heritage server',
  serverErrorDesc: 'The server may be waking up or your connection is unstable. Tap retry to load again.',
  offlineFallbackNotice: 'Live server unreachable — showing saved offline data.',
  offlinePackFailed: 'Could not download offline pack. Check your connection and try again.',
  downloadingPack: 'Saving...',
  nowShowing: 'Featured Heritage',
  noNearbyMatched: 'No nearby places matched those filters.',
  noFacilitiesMatched: 'No facilities matched those filters.',
  resetFilters: 'Reset Filters',
  gapNotice: 'Logged as a knowledge gap for the UP Tourism Department content team (UC-9).',
  searchingRecords: 'Searching verified heritage records...',
  chatPlaceholder: 'Type or speak a question about Taj Mahal or Agra Fort...',
  starters: [
    'Why was the Taj Mahal built, and is the Black Taj Mahal story true?',
    'What do the floral carvings and Parchinkari inlay mean?',
    'What happened to Shah Jahan at Musamman Burj?',
    'Are there step-free routes and shoe cover rules here?',
  ],

  cameraHeading: 'Point Camera & Ask (UC-2)',
  cameraSub: 'Take or upload a photo of a monument, gateway, carving, or inlay panel to identify it.',
  chooseAnotherPhoto: 'Choose Another Photo',
  capturePhoto: 'Capture or Upload Photo',
  cameraPlaceholder: 'Optional question (e.g., What are these wall carvings and history?)',
  demoGpsOff: 'Attach Musamman Burj Demo GPS',
  demoGpsOn: 'Demo GPS: Musamman Burj On',
  usingLiveGps: 'Using Live GPS',
  identifyBtn: 'Identify Monument',
  identifyingBtn: 'Identifying...',
  offlineCameraErr:
    'Live camera image recognition requires network access. Use Audio Tour or Guide tabs while offline.',

  tourHeading: 'Self-Guided Audio Tour (UC-4)',
  tourSub: 'Pick a walking route based on your available time; play audio automatically by GPS or step-by-step.',
  anyTime: 'Any Time',
  stepFreeOnly: 'Step-Free Only',
  playAudioStory: 'Play Audio Story',
  prevStop: 'Prev',
  nextStop: 'Next',
  nearStopPrefix: 'You are near Stop #',
  jumpToStop: 'Jump to This Stop',
  noToursMatched: 'No tour routes matched those filters. Try widening the duration or turning off Step-Free Only.',
  stopLabel: 'Stop',

  nearbyHeading: 'Personalised Nearby Attractions & UP ODOP (UC-5)',
  nearbySub: 'Tailored local sites, markets, cuisine, and One District One Product crafts with official timings and fees.',
  odopOnly: 'UP ODOP Only',
  timingsLabel: 'Timings:',
  feeLabel: 'Fee:',
  reachLabel: 'Reach:',
  directions: 'Directions',
  interests: {
    heritage: 'Heritage',
    crafts: 'Crafts & ODOP',
    food: 'Local Food',
    shopping: 'Markets',
  },
  groups: {
    '': 'Travelling: Everyone',
    family: 'Travelling: Family',
    kids: 'Travelling: With Kids',
    elderly: 'Travelling: Elderly-Friendly',
    solo: 'Travelling: Solo',
  },
  budgetAny: 'Budget: Any',
  budgetFree: 'Free Entry',
  budgetLow: 'Budget-Friendly',
  budgetMed: 'Moderate',

  facilitiesHeading: 'Nearby Public Facilities (UC-6)',
  facilitiesSub: 'Locate toilets, RO water, electric shuttle parking, medical rooms, police booths, and food plazas.',
  wheelchairAccessible: 'Wheelchair Accessible',
  facilityTypes: {
    '': 'All',
    toilet: 'Toilets',
    drinking_water: 'Water',
    parking: 'Parking',
    medical: 'Medical',
    police: 'Police',
    help_desk: 'Help Desk',
    food: 'Food',
  },

  sosTitle: '1-Tap Emergency Help',
  sosSub: 'Works even on weak or offline networks. Tap any number below to dial immediately.',
  hospitalDirections: 'Open Hospital Directions →',
};

const HI: UiStrings = {
  ...EN,
  govTag: 'उत्तर प्रदेश सरकार · पर्यटन एवं यूपी एआई मिशन',
  appTitle: 'एआई पर्यटन साथी',
  deptInsights: 'विभाग डैशबोर्ड',
  eyebrow: 'डिजिटल इंडिया पहल · बहुभाषी विरासत मार्गदर्शक',
  heroHeadline: 'उत्तर प्रदेश की जीवंत विरासत को अपनी भाषा में जानें।',
  heroSub: 'सत्यापित इतिहास व लोककथा का अंतर, कैमरा पहचान, ऑडियो टूर, ODOP शिल्प और 1-टैप आपातकालीन सहायता।',
  launchAgra: 'आगरा विरासत साथी खोलें',
  launchSarnath: 'सारनाथ विरासत साथी खोलें',
  detectGps: 'मेरा स्थान पहचानें',
  detectingGps: 'लोकेशन जाँच जारी...',
  locationActive: 'स्थान सक्रिय है',
  refreshLocation: 'स्थान रीफ़्रेश करें',
  locDefaultNotice: 'स्थान उपलब्ध नहीं होने पर नीचे उत्तर प्रदेश के सक्रिय विरासत स्थलों (आगरा या सारनाथ) में से चुनें।',
  citiesHeading: 'उत्तर प्रदेश के प्रमुख विरासत शहर',
  citiesSub: 'वर्तमान में आगरा और सारनाथ सक्रिय हैं; अन्य शहर आगामी चरण में जुड़ेंगे।',
  liveBadge: '2 स्थल सक्रिय',
  liveNow: 'सक्रिय',
  comingSoon: 'शीघ्र उपलब्ध',
  exploreFeatures: 'सभी 9 सुविधाएँ देखें',
  packPlanned: 'आगामी चरण में',
  footerText: 'उत्तर प्रदेश एआई मिशन · सूचना प्रौद्योगिकी एवं इलेक्ट्रॉनिक्स विभाग, उत्तर प्रदेश सरकार',

  companionTitle: 'आगरा विरासत साथी',
  upTourismLabel: 'उ.प्र. पर्यटन',
  online: 'ऑनलाइन',
  offline: 'ऑफ़लाइन',
  offlineReady: 'ऑफ़लाइन तैयार',
  offlinePack: 'ऑफ़लाइन पैक',
  easyMode: 'Aa+ सरल',
  easyModeOn: 'Aa+ चालू',
  langLabel: 'भाषा',
  styleLabel: 'शैली',
  offlineBanner: 'ऑफ़लाइन मोड: कैश्ड विरासत सामग्री, मानचित्र एवं 1-टैप SOS सक्रिय हैं।',

  tabs: { guide: 'गाइड', camera: 'कैमरा', tour: 'टूर', nearby: 'आस-पास', facilities: 'सुविधाएँ' },
  personas: { quick: 'संक्षिप्त', kids: 'बाल कथा', scholar: 'इतिहास', pilgrim: 'आध्यात्मिक' },

  guideHeading: 'अपना विरासत प्रश्न पूछें',
  guideSub: 'प्रत्येक उत्तर में प्रमाणित इतिहास और लोककथाएँ अलग-अलग दिखाई जाती हैं।',
  allMonuments: 'पूरा आगरा क्षेत्र',
  exploreMonumentsHeading: 'आगरा के प्रमुख स्मारक देखें',
  exploreMonumentsSub: 'किसी भी स्मारक पर टैप करें और उसका प्रमाणित इतिहास व लोककथा जानें।',
  askAboutMonument: 'गाइड से पूछें',
  curatedTopicsHeading: 'इतिहास बनाम लोककथा एवं विशेष विषय',
  curatedTopicsSub: 'हर उत्तर में प्रमाणित इतिहास और लोककथा अलग-अलग दिखाई जाती है।',
  newChat: 'स्मारक देखें',
  stepFreeBadge: 'सुगम मार्ग',
  stairsBadge: 'सीढ़ियाँ',
  guideWelcomeBadge: 'यूनेस्को युगल विरासत · ताजमहल एवं आगरा किला',
  recordedHistory: 'प्रमाणित इतिहास',
  localFolklore: 'लोककथा एवं परंपरा',
  sourceLabel: 'स्रोत: ',
  attributionLabel: 'संदर्भ: ',
  readAloud: 'सुनें',
  stopAudio: 'रोकें',
  loadingAudio: 'ऑडियो लोड हो रहा है...',
  retry: 'पुनः प्रयास करें',
  loadingTours: 'पैदल यात्रा मार्ग और ऑडियो पड़ाव लोड हो रहे हैं...',
  loadingNearby: 'आस-पास के स्थल और यूपी ODOP शिल्प लोड हो रहे हैं...',
  loadingFacilities: 'निकटतम सार्वजनिक सुविधाएँ खोजी जा रही हैं...',
  loadingEmergency: 'निकटतम आपातकालीन केंद्र जाँचे जा रहे हैं...',
  loadingMonuments: 'स्मारक लोड हो रहे हैं...',
  translating: 'अनुवाद हो रहा है...',
  analyzingPhoto: 'स्मारक की वास्तुकला और अभिलेखों का विश्लेषण जारी...',
  serverErrorTitle: 'विरासत सर्वर से संपर्क नहीं हो सका',
  serverErrorDesc: 'सर्वर शुरू हो रहा हो सकता है या नेटवर्क धीमा है। पुनः प्रयास करें।',
  offlineFallbackNotice: 'लाइव सर्वर उपलब्ध नहीं — सहेजा गया ऑफ़लाइन डेटा दिखाया जा रहा है।',
  offlinePackFailed: 'ऑफ़लाइन पैक डाउनलोड नहीं हो सका। नेटवर्क जाँचें और पुनः प्रयास करें।',
  downloadingPack: 'सहेज रहे हैं...',
  nowShowing: 'प्रमुख विरासत',
  noNearbyMatched: 'इन फ़िल्टर से कोई निकटतम स्थान नहीं मिला।',
  noFacilitiesMatched: 'इन फ़िल्टर से कोई सुविधा नहीं मिली।',
  resetFilters: 'फ़िल्टर हटाएँ',
  gapNotice: 'यह प्रश्न पर्यटन विभाग डैशबोर्ड (UC-9) में सामग्री सुधार हेतु दर्ज किया गया है।',
  searchingRecords: 'विरासत अभिलेख खोजे जा रहे हैं...',
  chatPlaceholder: 'अपना प्रश्न लिखें या माइक दबाकर बोलें...',
  starters: [
    'ताजमहल क्यों बनाया गया और काले ताजमहल की कहानी सच है या लोककथा?',
    'दीवारों पर फूल-पत्ती की पर्चिनकारी कला का क्या अर्थ है?',
    'शाहजहाँ ने मुसम्मन बुर्ज में अंतिम वर्ष कैसे बिताए?',
    'ताजमहल खुलने का समय और शुक्रवार के नियम क्या हैं?',
  ],

  cameraHeading: 'कैमरा दिखाएँ और पहचानें (UC-2)',
  cameraSub: 'किसी भी इमारत, द्वार, नक्काशी या शिलालेख की फ़ोटो अपलोड करें।',
  chooseAnotherPhoto: 'दूसरी फ़ोटो चुनें',
  capturePhoto: 'फ़ोटो लें या अपलोड करें',
  cameraPlaceholder: 'वैकल्पिक प्रश्न: इस नक्काशी का क्या अर्थ है?',
  demoGpsOff: 'मुसम्मन बुर्ज डेमो GPS जोड़ें',
  demoGpsOn: 'डेमो GPS: मुसम्मन बुर्ज सक्रिय',
  usingLiveGps: 'लाइव GPS संलग्न',
  identifyBtn: 'स्मारक पहचानें',
  identifyingBtn: 'पहचान जारी...',
  offlineCameraErr: 'लाइव कैमरा पहचान के लिए इंटरनेट आवश्यक है।',

  tourHeading: 'स्व-निर्देशित ऑडियो टूर (UC-4)',
  tourSub: 'अपने समय व सुगम मार्ग के अनुसार पैदल यात्रा चुनें।',
  anyTime: 'सभी समय',
  stepFreeOnly: 'केवल रैंप/सुगम मार्ग',
  playAudioStory: 'ऑडियो सुनें',
  prevStop: 'पिछला',
  nextStop: 'अगला',
  nearStopPrefix: 'आप इस पड़ाव के पास हैं #',
  jumpToStop: 'इस पड़ाव पर जाएँ',
  noToursMatched: 'इन फ़िल्टर के लिए कोई यात्रा मार्ग नहीं मिला।',
  stopLabel: 'पड़ाव',

  nearbyHeading: 'आस-पास के आकर्षण एवं यूपी ODOP (UC-5)',
  nearbySub: 'अपनी रुचि व बजट के अनुसार आधिकारिक समय व शुल्क सहित सुझाव पाएं।',
  odopOnly: 'केवल UP ODOP',
  timingsLabel: 'समय:',
  feeLabel: 'शुल्क:',
  reachLabel: 'पहुँच:',
  directions: 'दिशा देखें',
  interests: { heritage: 'विरासत', crafts: 'शिल्प एवं ODOP', food: 'स्थानीय भोजन', shopping: 'बाज़ार' },
  groups: { '': 'समूह: सभी', family: 'समूह: परिवार', kids: 'समूह: बच्चों सहित', elderly: 'समूह: वरिष्ठ नागरिक', solo: 'समूह: अकेले' },
  budgetAny: 'बजट: सभी',
  budgetFree: 'निःशुल्क',
  budgetLow: 'किफायती',
  budgetMed: 'मध्यम',

  facilitiesHeading: 'निकटतम सुविधाएँ (UC-6)',
  facilitiesSub: 'शौचालय, पेयजल, पार्किंग, चिकित्सा और पुलिस सहायता देखें।',
  wheelchairAccessible: 'व्हीलचेयर सुगम',
  facilityTypes: { '': 'सभी', toilet: 'शौचालय', drinking_water: 'पेयजल', parking: 'पार्किंग', medical: 'चिकित्सा', police: 'पुलिस', help_desk: 'सहायता', food: 'भोजन' },

  sosTitle: 'आपातकालीन सहायता (SOS)',
  sosSub: 'बिना इंटरनेट के भी उपलब्ध। कॉल करने के लिए टैप करें।',
  hospitalDirections: 'अस्पताल का मार्ग देखें →',
};

const MR: UiStrings = {
  ...EN,
  govTag: 'उत्तर प्रदेश शासन · पर्यटन व एआय मिशन',
  appTitle: 'यूपी एआय वारसा सोबती',
  deptInsights: 'विभाग डॅशबोर्ड',
  eyebrow: 'डिजिटल इंडिया उपक्रम · बहुभाषिक वारसा मार्गदर्शक',
  heroHeadline: 'उत्तर प्रदेशातील ऐतिहासिक वारसा तुमच्या भाषेत जाणून घ्या.',
  heroSub: 'अधिकृत इतिहास आणि लोककथा वेगळ्या स्वरूपात, कॅमेरा ओळख, ऑडिओ टूर, ODOP कला व आपत्कालीन मदत.',
  launchAgra: 'आग्रा सोबती उघडा',
  launchSarnath: 'सारनाथ सोबती उघडा',
  detectGps: 'माझे स्थान शोधा',
  detectingGps: 'GPS शोधत आहे...',
  locationActive: 'स्थान सक्रिय आहे',
  locDefaultNotice: 'स्थान उपलब्ध नाही — सुरू करण्यासाठी खालील आग्रा किंवा सारनाथ निवडा.',
  citiesHeading: 'उत्तर प्रदेशातील वारसा शहरे',
  citiesSub: 'सध्या आग्रा आणि सारनाथ कार्यरत आहेत; इतर शहरे लवकरच जोडली जातील.',
  liveBadge: '२ शहरे सक्रिय',
  liveNow: 'सक्रिय',
  comingSoon: 'लवकरच',
  exploreFeatures: '९/९ सुविधा पहा',
  packPlanned: 'नियोजित',

  companionTitle: 'आग्रा वारसा सोबती',
  upTourismLabel: 'यूपी पर्यटन',
  online: 'ऑनलाइन',
  offline: 'ऑफलाइन',
  offlineReady: 'ऑफलाइन तयार',
  offlinePack: 'ऑफलाइन पॅक',
  easyMode: 'Aa+ सोपे',
  easyModeOn: 'Aa+ चालू',
  langLabel: 'भाषा',
  styleLabel: 'शैली',
  offlineBanner: 'ऑफलाइन मोड: जतन केलेला डेटा, नकाशे व 1-टॅप SOS सक्रिय आहेत.',

  tabs: { guide: 'मार्गदर्शक', camera: 'कॅमेरा', tour: 'टूर', nearby: 'जवळपास', facilities: 'सुविधा' },
  personas: { quick: 'संक्षिप्त', kids: 'मुलांची गोष्ट', scholar: 'इतिहास', pilgrim: 'भक्तीभाव' },

  guideHeading: 'आग्रा वारशाबद्दल काहीही विचारा',
  guideSub: 'अधिकृत इतिहास आणि लोककथा स्पष्टपणे वेगळ्या दाखवल्या जातात.',
  allMonuments: 'संपूर्ण आग्रा परिसर',
  recordedHistory: 'नोंदलेला इतिहास',
  localFolklore: 'लोककथा व परंपरा',
  sourceLabel: 'स्रोत: ',
  attributionLabel: 'संदर्भ: ',
  readAloud: 'ऐका',
  stopAudio: 'थांबवा',
  loadingAudio: 'ऑडिओ लोड होत आहे...',
  retry: 'पुन्हा प्रयत्न करा',
  gapNotice: 'हा प्रश्न पर्यटन विभागाच्या डॅशबोर्डवर नोंदवला गेला आहे.',
  searchingRecords: 'ऐतिहासिक नोंदी शोधत आहे...',
  chatPlaceholder: 'ताजमहाल किंवा आग्रा किल्ल्याबद्दल विचारा किंवा बोला...',
  starters: [
    'ताजमहाल का बांधला गेला आणि काळ्या ताजमहालची गोष्ट खरी आहे का?',
    'भिंतीवरील फुलांच्या नक्षीकामाचा (पर्चिनकारी) अर्थ काय?',
    'शाहजहानने मुसम्मन बुर्जमध्ये शेवटची वर्षे कशी घालवली?',
    'येथील रॅम्प मार्ग आणि प्रवेश नियम काय आहेत?',
  ],

  cameraHeading: 'कॅमेरा दाखवा आणि विचारा (UC-2)',
  cameraSub: 'कोणत्याही वास्तूचा, दरवाजाचा किंवा कोरीव कामाचा फोटो अपलोड करा.',
  chooseAnotherPhoto: 'दुसरा फोटो निवडा',
  capturePhoto: 'फोटो काढा / अपलोड करा',
  cameraPlaceholder: 'ऐच्छिक प्रश्न: या कोरीव कामाचा इतिहास काय?',
  demoGpsOff: 'मुसम्मन बुर्ज डेमो GPS जोडा',
  demoGpsOn: 'डेमो GPS चालू',
  usingLiveGps: 'लाइव्ह GPS जोडले',
  identifyBtn: 'वास्तू ओळखा',
  identifyingBtn: 'ओळखत आहे...',

  tourHeading: 'स्वयं-मार्गदर्शित ऑडिओ टूर (UC-4)',
  tourSub: 'वेळेनुसार आणि सुगम मार्गानुसार चालण्याची सफर निवडा.',
  anyTime: 'सर्व वेळ',
  stepFreeOnly: 'पायऱ्यांशिवाय मार्ग',
  playAudioStory: 'ऑडिओ ऐका',
  prevStop: 'मागील',
  nextStop: 'पुढील',
  nearStopPrefix: 'तुम्ही या थांब्याजवळ आहात #',
  jumpToStop: 'या थांब्यावर जा',
  stopLabel: 'थांबा',

  nearbyHeading: 'जवळपासची ठिकाणे आणि यूपी ODOP (UC-5)',
  nearbySub: 'आवडीनुसार व बजेटनुसार अधिकृत वेळा व प्रवेश शुल्कासह शिफारसी.',
  odopOnly: 'फक्त UP ODOP',
  timingsLabel: 'वेळ:',
  feeLabel: 'शुल्क:',
  reachLabel: 'प्रवास:',
  directions: 'दिशा पहा',
  interests: { heritage: 'वारसा', crafts: 'कला व ODOP', food: 'स्थानिक खाद्य', shopping: 'बाजार' },
  groups: { '': 'गट: सर्व', family: 'गट: कुटुंब', kids: 'गट: मुलांसोबत', elderly: 'गट: ज्येष्ठ नागरिक', solo: 'गट: एकटा' },
  budgetAny: 'बजेट: सर्व',
  budgetFree: 'मोफत',
  budgetLow: 'परवडणारे',
  budgetMed: 'मध्यम',

  facilitiesHeading: 'जवळपासच्या सार्वजनिक सुविधा (UC-6)',
  facilitiesSub: 'स्वच्छतागृहे, पिण्याचे पाणी, पार्किंग, वैद्यकीय मदत व पोलीस चौकी शोधा.',
  wheelchairAccessible: 'व्हीलचेअर सुगम',
  facilityTypes: { '': 'सर्व', toilet: 'स्वच्छतागृह', drinking_water: 'पाणी', parking: 'पार्किंग', medical: 'वैद्यकीय', police: 'पोलीस', help_desk: 'मदत केंद्र', food: 'भोजन' },

  sosTitle: 'तात्काळ मदत (SOS)',
  sosSub: 'इंटरनेटशिवायही कार्यरत. कॉल करण्यासाठी क्रमांकावर टॅप करा.',
  hospitalDirections: 'रुग्णालयाचा मार्ग पहा →',
};

const TA: UiStrings = {
  ...EN,
  govTag: 'உத்தரப் பிரதேச அரசு · சுற்றுலா & AI இயக்கம்',
  appTitle: 'உ.பி. AI பாரம்பரிய தோழன்',
  deptInsights: 'துறை புள்ளிவிவரம்',
  eyebrow: 'டிஜிட்டல் இந்தியா · பன்மொழி பாரம்பரிய வழிகாட்டி',
  heroHeadline: 'ஒவ்வொரு நினைவுச்சின்னத்தின் கதையையும் உங்கள் மொழியில் அறியுங்கள்.',
  heroSub: 'சரிபார்க்கப்பட்ட வரலாறும் நாட்டுப்புறக் கதைகளும் தனித்தனியாக, கேமரா அடையாளம், ஆடியோ சுற்றுலா & அவசர உதவி.',
  launchAgra: 'ஆக்ரா தோழனைத் திற',
  launchSarnath: 'சாரநாத் தோழனைத் திற',
  detectGps: 'என் இடத்தைக் கண்டறி',
  detectingGps: 'GPS கண்டறியப்படுகிறது...',
  locationActive: 'இடம் செயலில் உள்ளது',
  locDefaultNotice: 'இடம் கிடைக்கவில்லை — தொடங்க கீழே உள்ள ஆக்ரா அல்லது சாரநாத்தைத் தேர்ந்தெடுக்கவும்.',
  citiesHeading: 'உத்தரப் பிரதேச பாரம்பரிய நகரங்கள்',
  citiesSub: 'தற்போது ஆக்ரா மற்றும் சாரநாத் நேரலையில் உள்ளன; பிற நகரங்கள் விரைவில் இணையும்.',
  liveBadge: '2 இடங்கள் நேரலையில்',
  liveNow: 'நேரலை',
  comingSoon: 'விரைவில்',
  exploreFeatures: '9/9 அம்சங்களைக் காண்க',
  packPlanned: 'திட்டமிடப்பட்டது',

  companionTitle: 'ஆக்ரா பாரம்பரிய தோழன்',
  upTourismLabel: 'உ.பி. சுற்றுலா',
  online: 'ஆன்லைன்',
  offline: 'ஆஃப்லைன்',
  offlineReady: 'ஆஃப்லைன் தயார்',
  offlinePack: 'ஆஃப்லைன் தொகுப்பு',
  easyMode: 'Aa+ எளிய',
  easyModeOn: 'Aa+ இயக்கத்தில்',
  langLabel: 'மொழி',
  styleLabel: 'நடை',
  offlineBanner: 'ஆஃப்லைன் நிலை: சேமிக்கப்பட்ட தகவல், வரைபடம் & SOS செயல்படுகின்றன.',

  tabs: { guide: 'வழிகாட்டி', camera: 'கேமரா', tour: 'சுற்றுலா', nearby: 'அருகில்', facilities: 'வசதிகள்' },
  personas: { quick: 'சுருக்கம்', kids: 'சிறுவர் கதை', scholar: 'வரலாறு', pilgrim: 'ஆன்மீகம்' },

  guideHeading: 'ஆக்ரா பாரம்பரியம் பற்றி எதையும் கேளுங்கள்',
  guideSub: 'ASI ஆதாரங்களின் அடிப்படையில் வரலாறும் நாட்டுப்புறக் கதைகளும் தனித்தனியாக வழங்கப்படுகின்றன.',
  allMonuments: 'அனைத்து ஆக்ரா தளங்கள்',
  recordedHistory: 'பதிவுசெய்யப்பட்ட வரலாறு',
  localFolklore: 'நாட்டுப்புறக் கதை & மரபு',
  sourceLabel: 'ஆதாரம்: ',
  attributionLabel: 'குறிப்பு: ',
  readAloud: 'ஒலிபரப்பு',
  stopAudio: 'நிறுத்து',
  loadingAudio: 'ஆடியோ ஏற்றப்படுகிறது...',
  retry: 'மீண்டும் முயல்க',
  gapNotice: 'இது சுற்றுலாத் துறை உள்ளடக்கக் குழுவுக்குப் பதிவு செய்யப்பட்டது (UC-9).',
  searchingRecords: 'ஆவணங்கள் தேடப்படுகின்றன...',
  chatPlaceholder: 'தாஜ்மஹால் அல்லது ஆக்ரா கோட்டை பற்றி கேளுங்கள்...',
  starters: [
    'தாஜ்மஹால் ஏன் கட்டப்பட்டது, கருப்பு தாஜ்மஹால் கதை உண்மையா?',
    'பளிங்குச் சுவர்களில் உள்ள பர்ச்சின்காரி பூ வேலைப்பாடுகளின் பொருள் என்ன?',
    'முசம்மன் புர்ஜில் ஷாஜகானின் இறுதி ஆண்டுகள் எப்படி இருந்தன?',
    'சக்கர நாற்காலி வசதி மற்றும் காலணி விதிகள் என்ன?',
  ],

  cameraHeading: 'கேமரா காட்டி கேளுங்கள் (UC-2)',
  cameraSub: 'கட்டிடம், நுழைவாயில் அல்லது சிற்பத்தின் புகைப்படத்தைப் பதிவேற்றவும்.',
  chooseAnotherPhoto: 'வேறு படம் தேர்ந்தெடு',
  capturePhoto: 'புகைப்படம் எடு / பதிவேற்று',
  cameraPlaceholder: 'விருப்பக் கேள்வி: இந்தச் சிற்பத்தின் வரலாறு என்ன?',
  demoGpsOff: 'முசம்மன் புர்ஜ் டெமோ GPS சேர்',
  demoGpsOn: 'டெமோ GPS இயக்கத்தில்',
  usingLiveGps: 'நேரலை GPS இணைக்கப்பட்டது',
  identifyBtn: 'நினைவிடத்தை அடையாளம் காண்',
  identifyingBtn: 'கண்டறிகிறது...',

  tourHeading: 'சுய-வழிகாட்டி ஆடியோ சுற்றுலா (UC-4)',
  tourSub: 'நேரம் மற்றும் படியற்ற பாதை அடிப்படையில் நடைப்பயணத்தைத் தேர்ந்தெடுக்கவும்.',
  anyTime: 'எல்லா நேரமும்',
  stepFreeOnly: 'படிகள் இல்லாத பாதை',
  playAudioStory: 'ஆடியோ கதை கேள்',
  prevStop: 'முந்தையது',
  nextStop: 'அடுத்தது',
  nearStopPrefix: 'நீங்கள் அருகில் உள்ள நிறுத்தம் #',
  jumpToStop: 'இங்கு செல்',
  stopLabel: 'நிறுத்தம்',

  nearbyHeading: 'அருகிலுள்ள இடங்கள் & UP ODOP (UC-5)',
  nearbySub: 'உங்கள் விருப்பம் மற்றும் பட்ஜெட்டுக்கு ஏற்ப அதிகாரப்பூர்வ நேரங்களுடன் பரிந்துரைகள்.',
  odopOnly: 'UP ODOP மட்டும்',
  timingsLabel: 'நேரம்:',
  feeLabel: 'கட்டணம்:',
  reachLabel: 'செல்லும் வழி:',
  directions: 'வழிகாட்டுதல்',
  interests: { heritage: 'பாரம்பரியம்', crafts: 'கைவினை & ODOP', food: 'உணவு', shopping: 'சந்தை' },
  groups: { '': 'குழு: அனைவரும்', family: 'குடும்பம்', kids: 'குழந்தைகளுடன்', elderly: 'முதியவர் நட்பு', solo: 'தனிப்பயணம்' },
  budgetAny: 'பட்ஜெட்: அனைத்தும்',
  budgetFree: 'இலவசம்',
  budgetLow: 'குறைந்த செலவு',
  budgetMed: 'நடுத்தரம்',

  facilitiesHeading: 'அருகிலுள்ள பொது வசதிகள் (UC-6)',
  facilitiesSub: 'கழிப்பறை, குடிநீர், பார்க்கிங், மருத்துவம் & காவல் உதவி.',
  wheelchairAccessible: 'சக்கர நாற்காலி வசதி',
  facilityTypes: { '': 'அனைத்தும்', toilet: 'கழிப்பறை', drinking_water: 'தண்ணீர்', parking: 'பார்க்கிங்', medical: 'மருத்துவம்', police: 'காவல்', help_desk: 'உதவி மையம்', food: 'உணவு' },

  sosTitle: 'அவசர உதவி (SOS)',
  sosSub: 'இணையம் இல்லாமலும் செயல்படும். அழைக்க எண்ணைத் தட்டவும்.',
  hospitalDirections: 'மருத்துவமனை வழி →',
};

const BN: UiStrings = {
  ...EN,
  govTag: 'উত্তর প্রদেশ সরকার · পর্যটন ও এআই মিশন',
  appTitle: 'ইউপি এআই ঐতিহ্য সঙ্গী',
  deptInsights: 'দপ্তর ড্যাশবোর্ড',
  eyebrow: 'ডিজিটাল ইন্ডিয়া উদ্যোগ · বহুভাষিক গাইড',
  heroHeadline: 'উত্তর প্রদেশের জীবন্ত ঐতিহ্য জানুন আপনার নিজের ভাষায়।',
  launchAgra: 'আগ্রা সঙ্গী খুলুন',
  launchSarnath: 'সারনাথ সঙ্গী খুলুন',
  detectGps: 'আমার অবস্থান খুঁজুন',
  locationActive: 'অবস্থান সক্রিয়',
  citiesHeading: 'উত্তর প্রদেশের ঐতিহ্যবাহী শহরসমূহ',
  liveBadge: '২টি শহর সক্রিয়',
  liveNow: 'সক্রিয়',
  comingSoon: 'শীঘ্রই আসছে',
  companionTitle: 'আগ্রা ঐতিহ্য সঙ্গী',
  tabs: { guide: 'গাইড', camera: 'ক্যামেরা', tour: 'ট্যুর', nearby: 'কাছাকাছি', facilities: 'সুবিধা' },
  personas: { quick: 'সংক্ষিপ্ত', kids: 'ছোটদের গল্প', scholar: 'ইতিহাস', pilgrim: 'আধ্যাত্মিক' },
  recordedHistory: 'নথিভুক্ত ইতিহাস',
  localFolklore: 'লোককথা ও ঐতিহ্য',
  readAloud: 'শুনুন',
  stopAudio: 'থামান',
  loadingAudio: 'অডিও লোড হচ্ছে...',
  retry: 'আবার চেষ্টা করুন',
  playAudioStory: 'অডিও শুনুন',
  prevStop: 'পূর্ববর্তী',
  nextStop: 'পরবর্তী',
  chatPlaceholder: 'তাজমহল বা আগ্রা দুর্গ সম্পর্কে প্রশ্ন করুন...',
  starters: [
    'তাজমহল কেন তৈরি হয়েছিল এবং কালো তাজমহলের গল্প কি সত্যি?',
    'মার্বেল পাথরের ওপর পারচিনকারি ফুলের কাজের অর্থ কী?',
    'মুসাম্মান বুর্জে শাহজাহানের শেষ দিনগুলো কেমন ছিল?',
    'হুইলচেয়ার র‍্যাম্প ও প্রবেশের নিয়মাবলী কী কী?',
  ],
  sosTitle: 'জরুরি সহায়তা (SOS)',
};

const TE: UiStrings = {
  ...EN,
  govTag: 'ఉత్తర ప్రదేశ్ ప్రభుత్వం · పర్యాటక & AI మిషన్',
  appTitle: 'యూపీ AI వారసత్వ సహాయకుడు',
  deptInsights: 'శాఖ గణాంకాలు',
  eyebrow: 'డిజిటల్ ఇండియా · బహుభాషా వారసత్వ మార్గదర్శి',
  heroHeadline: 'ప్రతి కట్టడం కథను మీ స్వంత భాషలో తెలుసుకోండి.',
  launchAgra: 'ఆగ్రా సహాయకుడిని తెరవండి',
  launchSarnath: 'సారనాథ్ సహాయకుడిని తెరవండి',
  detectGps: 'నా స్థానాన్ని గుర్తించు',
  locationActive: 'స్థానం సక్రియంగా ఉంది',
  citiesHeading: 'ఉత్తర ప్రదేశ్ వారసత్వ నగరాలు',
  liveBadge: '2 నగరాలు సిద్ధం',
  liveNow: 'సిద్ధం',
  comingSoon: 'త్వరలో',
  companionTitle: 'ఆగ్రా వారసత్వ సహాయకుడు',
  tabs: { guide: 'గైడ్', camera: 'కెమెరా', tour: 'టూర్', nearby: 'సమీపంలో', facilities: 'సౌకర్యాలు' },
  personas: { quick: 'సంక్షిప్తం', kids: 'పిల్లల కథ', scholar: 'చరిత్ర', pilgrim: 'ఆధ్యాత్మికం' },
  recordedHistory: 'నమోదైన చరిత్ర',
  localFolklore: 'జానపద కథలు & సంప్రదాయం',
  readAloud: 'వినండి',
  stopAudio: 'ఆపండి',
  loadingAudio: 'ఆడియో లోడ్ అవుతోంది...',
  retry: 'మళ్లీ ప్రయత్నించండి',
  playAudioStory: 'ఆడియో కథ వినండి',
  prevStop: 'ముందు',
  nextStop: 'తర్వాత',
  chatPlaceholder: 'తాజ్ మహల్ లేదా ఆగ్రా కోట గురించి అడగండి...',
  starters: [
    'తాజ్ మహల్ ఎందుకు నిర్మించారు? నల్ల తాజ్ మహల్ కథ నిజమా?',
    'పాలరాతిపై పర్చినకారి పూల చెక్కడాల ప్రత్యేకత ఏమిటి?',
    'ముసమ్మన్ బుర్జ్‌లో షాజహాన్ చివరి రోజులు ఎలా గడిచాయి?',
    'వీల్‌చైర్ ర్యాంప్‌లు మరియు సందర్శన నియమాలు ఏమిటి?',
  ],
  sosTitle: 'అత్యవసర సహాయం (SOS)',
};

const UR: UiStrings = {
  ...EN,
  govTag: 'حکومت اتر پردیش · سیاحت و اے آئی مشن',
  appTitle: 'یوپی اے آئی ورثہ ساتھی',
  deptInsights: 'محکمہ تجزیات',
  eyebrow: 'ڈیجیٹل انڈیا · کثیر لسانی رہنما',
  heroHeadline: 'اتر پردیش کے تاریخی ورثے کی کہانی اپنی زبان میں جانیں۔',
  launchAgra: 'آگرہ ساتھی کھولیں',
  launchSarnath: 'سارناتھ ساتھی کھولیں',
  detectGps: 'میرا مقام تلاش کریں',
  locationActive: 'مقام فعال ہے',
  citiesHeading: 'اتر پردیش کے تاریخی شہر',
  liveNow: 'دستیاب',
  comingSoon: 'جلد آرہا ہے',
  companionTitle: 'آگرہ ورثہ ساتھی',
  tabs: { guide: 'رہنما', camera: 'کیمرہ', tour: 'سفر', nearby: 'قریبی', facilities: 'سہولیات' },
  personas: { quick: 'مختصر', kids: 'بچوں کی کہانی', scholar: 'تاریخ', pilgrim: 'روحانی' },
  recordedHistory: 'مستند تاریخ',
  localFolklore: 'لوک داستانیں و روایات',
  readAloud: 'سنیں',
  stopAudio: 'روکیں',
  loadingAudio: 'آڈیو لوڈ ہو رہا ہے...',
  retry: 'دوبارہ کوشش کریں',
  playAudioStory: 'آڈیو کہانی سنیں',
  chatPlaceholder: 'تاج محل یا آگرہ قلعہ کے بارے میں پوچھیں...',
  starters: [
    'تاج محل کیوں بنایا گیا اور کالے تاج محل کی کہانی کی حقیقت کیا ہے؟',
    'سنگ مرمر پر پرچین کاری کے پھولوں کا کیا مطلب ہے؟',
    'شاہ جہاں نے مسمن برج میں آخری ایام کیسے گزارے؟',
    'وہیل چیئر ریمپ اور داخلے کے اصول کیا ہیں؟',
  ],
  sosTitle: 'ہنگامی مدد (SOS)',
};

const FR: UiStrings = {
  ...EN,
  appTitle: 'Compagnon Patrimoine UP',
  deptInsights: 'Analytique',
  heroHeadline: "L'histoire de chaque monument, racontée dans votre langue.",
  launchAgra: "Ouvrir le Guide d'Agra",
  launchSarnath: 'Ouvrir le Guide de Sarnath',
  detectGps: 'Détecter ma position',
  locationActive: 'Position active',
  citiesHeading: "Villes Patrimoniales de l'Uttar Pradesh",
  liveNow: 'Actif',
  comingSoon: 'Bientôt',
  companionTitle: "Compagnon d'Agra",
  tabs: { guide: 'Guide', camera: 'Caméra', tour: 'Visite', nearby: 'À proximité', facilities: 'Services' },
  personas: { quick: 'Rapide', kids: 'Enfants', scholar: 'Histoire', pilgrim: 'Spirituel' },
  recordedHistory: 'Histoire documentée',
  localFolklore: 'Folklore et traditions',
  readAloud: 'Écouter',
  stopAudio: 'Arrêter',
  loadingAudio: 'Chargement audio...',
  retry: 'Réessayer',
  playAudioStory: "Écouter l'audio",
  prevStop: 'Précédent',
  nextStop: 'Suivant',
  chatPlaceholder: 'Posez une question sur le Taj Mahal ou le Fort d’Agra...',
  starters: [
    "Pourquoi le Taj Mahal a-t-il été construit et le Taj Noir est-il un mythe ?",
    'Que signifient les incrustations florales Pietra Dura ?',
    'Quelle est l’histoire de Shah Jahan au Musamman Burj ?',
    'Y a-t-il des parcours accessibles sans marches ?',
  ],
  sosTitle: "Aide d'Urgence (SOS)",
};

const JA: UiStrings = {
  ...EN,
  appTitle: 'UP遺産AIコンパニオン',
  deptInsights: '観光統計',
  heroHeadline: 'すべての歴史遺産の物語を、あなたの言葉で。',
  launchAgra: 'アグラ案内を開始',
  launchSarnath: 'サールナート案内を開始',
  detectGps: '現在地を検出',
  locationActive: '現在地取得済み',
  citiesHeading: 'ウッタル・プラデーシュ州の遺産都市',
  liveNow: '公開中',
  comingSoon: '近日公開',
  companionTitle: 'アグラ遺産ガイド',
  tabs: { guide: 'ガイド', camera: 'カメラ', tour: 'ツアー', nearby: '周辺', facilities: '施設' },
  personas: { quick: '簡潔', kids: '子ども向け', scholar: '歴史・建築', pilgrim: '巡礼' },
  recordedHistory: '記録された歴史',
  localFolklore: '伝承・伝説',
  readAloud: '読み上げ',
  stopAudio: '停止',
  loadingAudio: '音声を読み込み中...',
  retry: '再試行',
  playAudioStory: '音声ガイド再生',
  prevStop: '前へ',
  nextStop: '次へ',
  chatPlaceholder: 'タージ・マハルやアグラ城について質問してください...',
  starters: [
    'タージ・マハルはなぜ建てられましたか？黒いタージ伝説は本当ですか？',
    '大理石の花の象嵌（ピエトラ・ドゥーラ）の意味は何ですか？',
    'ムサンマン・ブルジでのシャー・ジャハーンの歴史を教えてください。',
    '車椅子対応ルートや入場時のルールはありますか？',
  ],
  sosTitle: '緊急ヘルプ (SOS)',
};

const ES: UiStrings = {
  ...EN,
  appTitle: 'Guía IA de Patrimonio UP',
  deptInsights: 'Estadísticas',
  heroHeadline: 'La historia de cada monumento, explicada en tu propio idioma.',
  launchAgra: 'Abrir Guía de Agra',
  launchSarnath: 'Abrir Guía de Sarnath',
  detectGps: 'Detectar mi ubicación',
  locationActive: 'Ubicación activa',
  citiesHeading: 'Ciudades Patrimoniales de Uttar Pradesh',
  liveNow: 'Activo',
  comingSoon: 'Próximamente',
  companionTitle: 'Guía de Agra',
  tabs: { guide: 'Guía', camera: 'Cámara', tour: 'Tour', nearby: 'Cerca', facilities: 'Servicios' },
  personas: { quick: 'Rápido', kids: 'Niños', scholar: 'Historia', pilgrim: 'Devocional' },
  recordedHistory: 'Historia documentada',
  localFolklore: 'Folclore y tradición',
  readAloud: 'Escuchar',
  stopAudio: 'Detener',
  loadingAudio: 'Cargando audio...',
  retry: 'Reintentar',
  playAudioStory: 'Reproducir audio',
  prevStop: 'Anterior',
  nextStop: 'Siguiente',
  chatPlaceholder: 'Pregunta sobre el Taj Mahal o el Fuerte de Agra...',
  starters: [
    '¿Por qué se construyó el Taj Mahal y es real la leyenda del Taj Negro?',
    '¿Qué significan los mosaicos florales Pietra Dura?',
    '¿Qué ocurrió con Shah Jahan en Musamman Burj?',
    '¿Hay rutas sin escalones y reglas de calzado?',
  ],
  sosTitle: 'Ayuda de Emergencia (SOS)',
};

const UI_MAP: Record<string, UiStrings> = {
  en: EN,
  hi: HI,
  mr: MR,
  ta: TA,
  bn: BN,
  te: TE,
  ur: UR,
  fr: FR,
  ja: JA,
  es: ES,
};

export function getUiText(languageCode: string): UiStrings {
  const base = (languageCode || 'en').toLowerCase().split('-')[0];
  return UI_MAP[base] || EN;
}

