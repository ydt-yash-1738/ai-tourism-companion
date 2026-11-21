// 360° walks: each stop is a real Street View position facing the subject, with a
// short narration drawn from the same verified facts as the content packs.
// Legends are introduced as legends. Photos are the offline fallback.

export interface WalkStop {
  id: string;
  title: string;
  titleHi: string;
  lat: number;
  lng: number;
  /** compass direction the view opens facing, in degrees */
  heading: number;
  pitch?: number;
  /**
   * Verified Google Street View panorama ID. Find it by dropping the yellow Pegman at
   * the spot in Google Maps: the URL contains "!1s<PANO_ID>!2e0". Stops with an ID
   * open in 360° Street View; others open in photo view.
   */
  panoId?: string;
  photo: string;
  narration: string;
  narrationHi: string;
}

export interface Walk {
  destination: 'agra' | 'lucknow' | 'sarnath';
  title: string;
  titleHi: string;
  stops: WalkStop[];
}

export const WALKS: Walk[] = [
  {
    destination: 'agra',
    title: 'Video tour: Taj Mahal',
    titleHi: 'वीडियो टूर: ताजमहल',
    stops: [
      {
        id: 'great-gate',
        title: 'The Great Gate (Darwaza-i-Rauza)',
        titleHi: 'मुख्य द्वार (दरवाज़ा-ए-रौज़ा)',
        lat: 27.17085,
        lng: 78.04215,
        heading: 0,
        pitch: 8,
        photo: '/images/monuments/darwaza-i-rauza.webp',
        narration:
          'This is Darwaza-i-Rauza, the Great Gate. It is built of red sandstone inlaid with white marble calligraphy. Step through the dark archway and watch the Taj Mahal appear, framed perfectly inside it.',
        narrationHi:
          'यह दरवाज़ा-ए-रौज़ा है, ताजमहल का मुख्य द्वार। यह लाल बलुआ पत्थर से बना है और इस पर सफेद संगमरमर की सुलेख कला जड़ी है। अंधेरे मेहराब से गुज़रें और देखें कैसे ताजमहल उसके भीतर फ्रेम की तरह दिखाई देता है।',
      },
      {
        id: 'central-pool',
        title: 'The garden and central pool',
        titleHi: 'चारबाग़ और मध्य जलकुंड',
        lat: 27.1736,
        lng: 78.0421,
        heading: 0,
        pitch: 6,
        photo: '/images/taj-mahal.webp',
        narration:
          'You are standing in the Charbagh, a garden divided into four parts by water channels. The raised central pool reflects the mausoleum. In local tradition, the four-part garden is a picture of paradise.',
        narrationHi:
          'आप चारबाग़ में खड़े हैं, जो जल-नहरों से चार भागों में बँटा उद्यान है। ऊँचा मध्य जलकुंड मकबरे का प्रतिबिंब दिखाता है। स्थानीय परंपरा में इस चारबाग़ को स्वर्ग का प्रतीक माना जाता है।',
      },
      {
        id: 'mausoleum',
        title: 'The main mausoleum',
        titleHi: 'मुख्य मकबरा',
        lat: 27.17455,
        lng: 78.0421,
        heading: 0,
        pitch: 18,
        photo: '/images/nearby/parchinkari-artisan-hub.webp',
        narration:
          'Emperor Shah Jahan commissioned the Taj Mahal in 1631 to 1632 in memory of his wife Mumtaz Mahal. Look closely at the white Makrana marble: the flowers are semi-precious stones set into the stone, a craft called Parchinkari.',
        narrationHi:
          'सम्राट शाहजहाँ ने 1631-1632 में अपनी बेगम मुमताज महल की याद में ताजमहल बनवाना शुरू किया। सफेद मकराना संगमरमर को ध्यान से देखें: ये फूल पत्थर में जड़े बहुमूल्य रत्न हैं, जिसे पर्चिनकारी कहते हैं।',
      },
      {
        id: 'mosque',
        title: 'The Taj mosque',
        titleHi: 'ताज मस्जिद',
        lat: 27.1751,
        lng: 78.0417,
        heading: 270,
        pitch: 8,
        photo: '/images/monuments/taj-mahal-mosque-jawab.webp',
        narration:
          'To the west stands a red sandstone mosque facing Mecca. On the east, an identical building called the Jawab mirrors it, so the whole complex stays perfectly symmetrical.',
        narrationHi:
          'पश्चिम में मक्का की ओर मुख किए लाल बलुआ पत्थर की मस्जिद है। पूर्व में उसी जैसा भवन, जवाब, बना है, ताकि पूरा परिसर पूरी तरह सममित रहे।',
      },
      {
        id: 'mehtab-bagh',
        title: 'View from Mehtab Bagh',
        titleHi: 'मेहताब बाग़ से दृश्य',
        lat: 27.1797,
        lng: 78.0425,
        heading: 180,
        pitch: 4,
        photo: '/images/nearby/mehtab-bagh.webp',
        narration:
          'Across the Yamuna is Mehtab Bagh. A popular legend says Shah Jahan planned a black marble twin of the Taj here. Archaeological Survey of India excavations instead found a moonlit garden aligned with the Taj, not a second tomb.',
        narrationHi:
          'यमुना के पार मेहताब बाग़ है। एक प्रचलित किंवदंती कहती है कि शाहजहाँ यहाँ काले संगमरमर का ताज बनवाना चाहते थे। भारतीय पुरातत्व सर्वेक्षण की खुदाई में यहाँ ताज की सीध में एक चाँदनी उद्यान मिला, दूसरा मकबरा नहीं।',
      },
    ],
  },
  {
    destination: 'lucknow',
    title: 'Video tour: Bara Imambara',
    titleHi: 'वीडियो टूर: बड़ा इमामबाड़ा',
    stops: [
      {
        id: 'rumi-darwaza',
        title: 'Rumi Darwaza',
        titleHi: 'रूमी दरवाज़ा',
        lat: 26.8706,
        lng: 80.9126,
        heading: 270,
        pitch: 10,
        photo: '/images/heritage/lucknow.webp',
        narration:
          'This towering gateway is the Rumi Darwaza, built in 1784 under Nawab Asaf-ud-Daula. It is a fine example of Awadhi architecture and has become a symbol of Lucknow.',
        narrationHi:
          'यह ऊँचा द्वार रूमी दरवाज़ा है, जो 1784 में नवाब आसफ़-उद-दौला के समय बना। यह अवधी स्थापत्य का सुंदर उदाहरण है और लखनऊ की पहचान बन गया है।',
      },
      {
        id: 'imambara-court',
        title: 'Bara Imambara',
        titleHi: 'बड़ा इमामबाड़ा',
        lat: 26.8691,
        lng: 80.9124,
        heading: 180,
        pitch: 8,
        photo: '/images/monuments/bara-imambara.webp',
        narration:
          'Nawab Asaf-ud-Daula began the Bara Imambara in 1784, in a year of famine, and the work gave employment to thousands. Its great central hall is one of the largest vaulted halls built without beams.',
        narrationHi:
          'नवाब आसफ़-उद-दौला ने 1784 में, अकाल के वर्ष में, बड़ा इमामबाड़ा बनवाना शुरू किया और इस काम से हज़ारों लोगों को रोज़गार मिला। इसका विशाल मध्य हॉल बिना बीम के बने सबसे बड़े मेहराबदार हॉलों में से एक है।',
      },
      {
        id: 'bhool-bhulaiya',
        title: 'The Bhool Bhulaiya',
        titleHi: 'भूलभुलैया',
        lat: 26.8689,
        lng: 80.9129,
        heading: 160,
        pitch: 14,
        photo: '/images/monuments/imambara-rooftop.webp',
        narration:
          'Above the hall lies the Bhool Bhulaiya, a maze of narrow passages and identical doorways. Local legend speaks of secret tunnels leading far away from here, but these stories are tradition, not recorded history.',
        narrationHi:
          'हॉल के ऊपर भूलभुलैया है, संकरे रास्तों और एक जैसे दरवाज़ों का जाल। स्थानीय किंवदंती यहाँ से दूर तक जाने वाली गुप्त सुरंगों की बात करती है, पर ये कहानियाँ परंपरा हैं, दर्ज इतिहास नहीं।',
      },
      {
        id: 'asfi-mosque',
        title: 'The Asfi Mosque',
        titleHi: 'आसफ़ी मस्जिद',
        lat: 26.8693,
        lng: 80.9119,
        heading: 300,
        pitch: 10,
        photo: '/images/monuments/asfi-mosque.webp',
        narration:
          'From the rooftop you can see the Asfi Mosque, built by Nawab Asaf-ud-Daula within the Imambara complex. It is still used for prayers, so please dress modestly when you visit.',
        narrationHi:
          'छत से आसफ़ी मस्जिद दिखती है, जिसे नवाब आसफ़-उद-दौला ने इमामबाड़ा परिसर में बनवाया। यहाँ आज भी नमाज़ होती है, इसलिए दर्शन के समय शालीन वस्त्र पहनें।',
      },
    ],
  },
  {
    destination: 'sarnath',
    title: 'Video tour: Sarnath',
    titleHi: 'वीडियो टूर: सारनाथ',
    stops: [
      {
        id: 'dhamek',
        title: 'Dhamek Stupa',
        titleHi: 'धमेख स्तूप',
        lat: 25.3809,
        lng: 83.0238,
        heading: 90,
        pitch: 14,
        photo: '/images/heritage/sarnath.webp',
        narration:
          'This is the Dhamek Stupa. Buddhist tradition holds that the Buddha gave his first sermon at Sarnath. The stupa you see today largely dates from around the sixth century, built on much older foundations.',
        narrationHi:
          'यह धमेख स्तूप है। बौद्ध परंपरा के अनुसार भगवान बुद्ध ने अपना पहला उपदेश सारनाथ में दिया था। आज दिखने वाला स्तूप अधिकतर लगभग छठी शताब्दी का है, जो इससे बहुत पुरानी नींव पर बना है।',
      },
      {
        id: 'ashoka-pillar',
        title: 'Ashoka Pillar',
        titleHi: 'अशोक स्तंभ',
        lat: 25.3797,
        lng: 83.0235,
        heading: 200,
        pitch: 4,
        photo: '/images/monuments/ashoka-pillar.webp',
        narration:
          'Here stand the remains of a pillar raised by Emperor Ashoka in the third century BCE. Its Lion Capital is now kept in the Sarnath Museum and was adopted as the National Emblem of India.',
        narrationHi:
          'यहाँ सम्राट अशोक द्वारा ईसा पूर्व तीसरी शताब्दी में बनवाए गए स्तंभ के अवशेष हैं। इसका सिंह शीर्ष अब सारनाथ संग्रहालय में है और इसे भारत का राष्ट्रीय प्रतीक बनाया गया।',
      },
      {
        id: 'mulagandha',
        title: 'Mulagandha Kuti Vihara',
        titleHi: 'मूलगंध कुटी विहार',
        lat: 25.3792,
        lng: 83.0256,
        heading: 90,
        pitch: 8,
        photo: '/images/monuments/mulagandha-kuti-vihara.webp',
        narration:
          'This temple, the Mulagandha Kuti Vihara, was built in 1931 by the Maha Bodhi Society. Inside, wall paintings by the Japanese artist Kosetsu Nosu tell the story of the Buddha’s life.',
        narrationHi:
          'यह मूलगंध कुटी विहार 1931 में महाबोधि सोसाइटी द्वारा बनवाया गया। भीतर जापानी कलाकार कोसेत्सु नोसु के भित्ति चित्र भगवान बुद्ध के जीवन की कथा बताते हैं।',
      },
    ],
  },
];

export function getWalk(destination: string): Walk | undefined {
  return WALKS.find((w) => w.destination === destination);
}
