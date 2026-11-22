// Short scroll-story panels for the landing page, one per live destination.
// Facts follow the verified content packs (data/destinations/<slug>).

export interface LocationStoryPanel {
  slug: string;
  kicker: string;
  kickerHi: string;
  title: string;
  titleHi: string;
  body: string;
  bodyHi: string;
}

export const LOCATION_STORY_INTRO = {
  kicker: 'Live today',
  kickerHi: 'आज उपलब्ध',
  title: 'Three heritage cities, one guide.',
  titleHi: 'तीन विरासत नगर, एक गाइड।',
};

export const LOCATION_STORY: LocationStoryPanel[] = [
  {
    slug: 'agra',
    kicker: 'Explore the Taj Mahal · Agra',
    kickerHi: 'ताजमहल देखें · आगरा',
    title: 'A love story in white marble.',
    titleHi: 'सफ़ेद संगमरमर में एक प्रेम कथा।',
    body: 'Shah Jahan’s tomb for Mumtaz Mahal, begun in 1631, with Agra Fort just up the Yamuna. Raahi tells you what is recorded history and what is legend.',
    bodyHi: 'शाहजहाँ द्वारा मुमताज़ महल के लिए 1631 में आरंभ मकबरा, और यमुना किनारे पास ही आगरा किला। राही बताएगा क्या दर्ज इतिहास है और क्या किंवदंती।',
  },
  {
    slug: 'lucknow',
    kicker: 'Explore the Bara Imambara · Lucknow',
    kickerHi: 'बड़ा इमामबाड़ा देखें · लखनऊ',
    title: 'A hall with no beams, a maze above it.',
    titleHi: 'बिना बीम का हॉल, ऊपर एक भूलभुलैया।',
    body: 'Built in 1784 by Nawab Asaf-ud-Daula in a year of famine, with the Bhool Bhulaiya labyrinth upstairs and the Rumi Darwaza beside it.',
    bodyHi: 'अकाल के वर्ष 1784 में नवाब आसफ़-उद-दौला द्वारा निर्मित, ऊपर भूलभुलैया और पास में रूमी दरवाज़ा।',
  },
  {
    slug: 'sarnath',
    kicker: 'Explore the Dhamek Stupa · Sarnath',
    kickerHi: 'धमेख स्तूप देखें · सारनाथ',
    title: 'Where the Buddha first taught.',
    titleHi: 'जहाँ बुद्ध ने पहला उपदेश दिया।',
    body: 'The deer park of the first sermon, the Ashokan pillar, and the Lion Capital that became India’s national emblem.',
    bodyHi: 'प्रथम उपदेश का मृगदाव, अशोक स्तंभ, और वह सिंह शीर्ष जो भारत का राष्ट्रीय प्रतीक बना।',
  },
];
