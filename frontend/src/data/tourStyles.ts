// Audio-tour narration in each answer style.
//
// Where the text comes from:
// - the stop's verified script: the backend's tour routes (API / offline pack)
// - recorded history, legends and etiquette: the backend's knowledge base for the
//   destination (offline pack, knowledge_chunks), with their sources
// - Kids Story and Devotional openings: written here, one per monument; they only
//   re-tell what the monument's verified script says (no new facts)
//
// Quick Guide    = the verified stop script.
// History & Arch = the script + every recorded-history entry for the monument + sources.
// Kids Story     = the story opening + the monument's legend, labelled as a legend.
// Devotional     = the devotional opening + the destination's visitor etiquette.

import type { KnowledgeChunk, OfflinePack, PersonaType } from '../types/api';

type Pair = { en: string; hi: string };

const KIDS: Record<string, Pair> = {
  // Agra
  'darwaza-i-rauza': {
    en: 'Look, explorers! This giant red gate is the Great Gate of the Taj Mahal. Can you count the eleven little white domes on top? Walk through slowly — the shining white Taj appears like a picture in a frame!',
    hi: 'देखो, नन्हे खोजियों! यह लाल पत्थर का विशाल द्वार ताजमहल का मुख्य द्वार है। क्या तुम ऊपर के ग्यारह छोटे सफ़ेद गुंबद गिन सकते हो? धीरे-धीरे अंदर चलो — चमकता सफ़ेद ताज एक तस्वीर की तरह सामने दिखेगा!',
  },
  'taj-mahal-mausoleum': {
    en: 'Wow — this is the Taj Mahal! Emperor Shah Jahan had it built from shiny white Makrana marble, starting in 1631. Here is a secret: the four tall towers lean a tiny bit outward, to keep the tomb safe if an earthquake ever came!',
    hi: 'वाह — यही है ताजमहल! बादशाह शाहजहाँ ने 1631 से इसे चमकदार सफ़ेद मकराना संगमरमर से बनवाया। एक राज़ की बात: चारों ऊँची मीनारें थोड़ी-सी बाहर की ओर झुकी हैं, ताकि भूकंप आए तो भी मकबरा सुरक्षित रहे!',
  },
  'taj-mahal-mosque-jawab': {
    en: 'Look left and right — two red buildings that look like twins! The one on the west is a real mosque where people pray on Fridays. Its twin on the east, the Jawab, is there to keep everything perfectly balanced, like a reflection in a mirror.',
    hi: 'बाएँ और दाएँ देखो — दो लाल इमारतें, बिल्कुल जुड़वाँ जैसी! पश्चिम वाली असली मस्जिद है, जहाँ शुक्रवार को नमाज़ होती है। पूरब वाली जुड़वाँ, जवाब, संतुलन के लिए बनी है — जैसे आईने में परछाईं।',
  },
  'amar-singh-gate': {
    en: 'Welcome to Agra Fort — a real castle! Emperor Akbar built this gate in 1565. See how the ramp bends like a dog’s leg? That made it hard for war elephants to charge straight in. Clever, right?',
    hi: 'आगरा किले में स्वागत है — एक असली क़िला! बादशाह अकबर ने यह द्वार 1565 में बनवाया। देखो, रास्ता कुत्ते की टांग की तरह मुड़ता है — इससे युद्ध के हाथी सीधे दौड़कर अंदर नहीं आ पाते थे। है न चतुराई?',
  },
  'jahangiri-mahal': {
    en: 'Treasure hunt time in Jahangiri Mahal! Look for the carved stone brackets that seem to hold up the roof — that is Rajput style mixed with Mughal courtyards. Then find the giant stone bowl outside, carved from one single rock!',
    hi: 'जहाँगीरी महल में ख़ज़ाने की खोज! छत को थामे हुए नक़्क़ाशीदार पत्थर के ब्रैकेट ढूँढो — यह राजपूत शैली है, मुग़ल आँगनों के साथ मिली हुई। फिर बाहर रखा विशाल पत्थर का कटोरा देखो, जो एक ही चट्टान से तराशा गया है!',
  },
  'musamman-burj': {
    en: 'This marble balcony has eight sides — that shape is called an octagon! Long ago, Emperor Shah Jahan was kept here as a prisoner. From this balcony he looked across the river at the Taj Mahal, the tomb of his wife Mumtaz Mahal.',
    hi: 'इस संगमरमर की बालकनी की आठ भुजाएँ हैं — इसे अष्टकोण कहते हैं! बहुत पहले बादशाह शाहजहाँ को यहाँ क़ैद रखा गया था। इसी बालकनी से वह नदी के पार अपनी पत्नी मुमताज़ महल के मकबरे, ताजमहल, को देखा करते थे।',
  },
  // Lucknow
  'rumi-darwaza': {
    en: 'Look up, way up! This gate is 18 metres tall — about as high as a six-storey building. It was built in 1784, and its shape came from a faraway city called Constantinople, so people call it the Turkish Gate.',
    hi: 'ऊपर देखो, बहुत ऊपर! यह द्वार 18 मीटर ऊँचा है — लगभग छह मंज़िला इमारत जितना। इसे 1784 में बनाया गया, और इसका आकार दूर के शहर कुस्तुनतुनिया (कॉन्स्टेंटिनोपल) से प्रेरित है, इसलिए लोग इसे तुर्की दरवाज़ा कहते हैं।',
  },
  'bara-imambara': {
    en: 'Imagine a year with hardly any food — that was the famine of 1784. To help, the Bara Imambara was built, and more than 20,000 people earned wages working on it. And guess what? Its giant hall has no wooden or steel beams holding up the ceiling at all!',
    hi: 'सोचो, एक ऐसा साल जब खाना ही मुश्किल से मिले — 1784 में ऐसा ही अकाल पड़ा था। मदद के लिए बड़ा इमामबाड़ा बनाया गया और 20,000 से ज़्यादा लोगों को इस पर काम करके मज़दूरी मिली। और अंदाज़ा लगाओ? इसके बड़े हॉल की छत को थामने के लिए एक भी लकड़ी या स्टील की बीम नहीं है!',
  },
  'shahi-baoli': {
    en: 'This is a stepwell — a well with stairs going down five floors! River water flowed in through a channel under the ground. The story goes that guards up top watched the water, and could see visitors’ reflections before the visitors saw them. Sneaky!',
    hi: 'यह बावली है — सीढ़ियों वाला कुआँ, जो पाँच मंज़िल नीचे तक जाता है! गोमती नदी का पानी ज़मीन के नीचे एक नहर से आता था। कहते हैं, पहरेदार ऊपर खड़े होकर पानी में आने वालों की परछाईं देख लेते थे — उनके दिखने से पहले ही!',
  },
  'chota-imambara': {
    en: 'Ready for some sparkle? Chota Imambara was built in 1838 and is filled with shining crystal chandeliers from Belgium. It glitters so much that people call it the Palace of Lights! Look for the golden dome too.',
    hi: 'चमक के लिए तैयार? छोटा इमामबाड़ा 1838 में बना और बेल्जियम के चमचमाते क्रिस्टल झाड़-फ़ानूसों से भरा है। यह इतना जगमगाता है कि लोग इसे रोशनियों का महल कहते हैं! सुनहरा गुंबद भी ज़रूर देखो।',
  },
  'bhool-bhulaiya': {
    en: 'Welcome to the maze! The Bhool Bhulaiya has 489 doorways that all look the same — so stay close to your guide. Try whispering near the wall: a friend far down the gallery can hear you! Some people even tell stories of secret tunnels.',
    hi: 'भूलभुलैया में स्वागत है! यहाँ 489 दरवाज़े हैं जो सब एक जैसे दिखते हैं — इसलिए अपने गाइड के पास रहना। दीवार के पास फुसफुसाकर देखो: गलियारे के दूसरे छोर पर खड़ा दोस्त भी सुन लेगा! कुछ लोग गुप्त सुरंगों की कहानियाँ भी सुनाते हैं।',
  },
  'asfi-mosque': {
    en: 'From up here, can you see three white domes and tall towers? That is the Asfi Mosque. People still come here to pray, so it is a place to be calm and quiet, just like in a library.',
    hi: 'यहाँ ऊपर से क्या तुम्हें तीन सफ़ेद गुंबद और ऊँची मीनारें दिख रही हैं? वह आसफ़ी मस्जिद है। लोग आज भी यहाँ नमाज़ पढ़ने आते हैं, इसलिए यहाँ लाइब्रेरी की तरह शांत रहना है।',
  },
  // Sarnath
  'dhamek-stupa': {
    en: 'This big round tower is the Dhamek Stupa — about as tall as a fourteen-storey building! Right here in the Deer Park, the Buddha gave his very first teaching. Look closely at the stone band around it: can you find the carved lotus flowers?',
    hi: 'यह बड़ा गोल स्तूप धमेख स्तूप है — लगभग चौदह मंज़िला इमारत जितना ऊँचा! यहीं मृगदाव में बुद्ध ने अपना सबसे पहला उपदेश दिया था। इसके चारों ओर की पत्थर की पट्टी को ध्यान से देखो: क्या तुम्हें नक़्क़ाशीदार कमल के फूल मिले?',
  },
  'dharmarajika-stupa': {
    en: 'These brick circles are what is left of a stupa built by Emperor Ashoka to keep relics of the Buddha safe. In 1794, workers taking its bricks found a green marble urn inside — and that discovery helped people find old Sarnath again!',
    hi: 'ये ईंटों के गोल घेरे सम्राट अशोक के बनवाए एक स्तूप के अवशेष हैं, जो बुद्ध के अवशेषों को सुरक्षित रखने के लिए बना था। 1794 में इसकी ईंटें निकालते समय मज़दूरों को अंदर हरे संगमरमर का एक कलश मिला — और इसी खोज से पुराने सारनाथ को फिर से खोजा गया!',
  },
  'ashoka-pillar-sarnath': {
    en: 'Under this roof is the bottom of Emperor Ashoka’s pillar, made around 250 BCE. On it he wrote a message asking the monks to live in harmony. The famous four lions from its top are now India’s National Emblem — you can see them in the museum!',
    hi: 'इस छत के नीचे सम्राट अशोक के स्तंभ का निचला हिस्सा है, जो लगभग 250 ईसा पूर्व बना। इस पर उन्होंने भिक्षुओं से मिल-जुलकर रहने का संदेश लिखवाया था। इसके ऊपर के प्रसिद्ध चार शेर आज भारत का राष्ट्रीय प्रतीक हैं — उन्हें तुम संग्रहालय में देख सकते हो!',
  },
  'sarnath-archaeological-museum': {
    en: 'Inside this museum is the real Lion Capital — four lions sitting back to back. Since 26 January 1950 it has been India’s National Emblem, the one on our coins and notes! Look for the calm Preaching Buddha statue too. Remember: the museum is closed on Fridays.',
    hi: 'इस संग्रहालय के अंदर असली सिंह शीर्ष है — पीठ से पीठ सटाए बैठे चार शेर। 26 जनवरी 1950 से यह भारत का राष्ट्रीय प्रतीक है, वही जो हमारे सिक्कों और नोटों पर है! शांत उपदेश देते बुद्ध की मूर्ति भी देखना। याद रखना: संग्रहालय शुक्रवार को बंद रहता है।',
  },
  'chaukhandi-stupa': {
    en: 'This is the place where the Buddha met his five old friends again! Much later, in 1588, an eight-sided brick tower was built on top to remember a night when Emperor Humayun stayed here.',
    hi: 'यही वह जगह है जहाँ बुद्ध अपने पाँच पुराने साथियों से फिर मिले! बहुत बाद में, 1588 में, ऊपर आठ कोनों वाली ईंटों की मीनार बनाई गई, ताकि बादशाह हुमायूँ के यहाँ एक रात ठहरने की याद रहे।',
  },
  'mulagandhakuti-vihara': {
    en: 'Last stop! Take off your shoes and climb the stairs into the prayer hall. The walls are painted with pictures of the Buddha’s life by a Japanese artist. Then rest under the Bodhi Tree — it grew from a tree in Bodh Gaya that travelled via Sri Lanka!',
    hi: 'आख़िरी पड़ाव! जूते उतारो और सीढ़ियाँ चढ़कर प्रार्थना-कक्ष में चलो। दीवारों पर एक जापानी कलाकार ने बुद्ध के जीवन के चित्र बनाए हैं। फिर बोधि वृक्ष की छाँव में आराम करो — यह बोधगया के पेड़ से श्रीलंका होते हुए आया है!',
  },
};

const DEVOTIONAL: Record<string, Pair> = {
  // Agra
  'darwaza-i-rauza': {
    en: 'Pause at Darwaza-i-Rauza, the Great Gate. The black marble calligraphy inlaid around its arch greets every visitor. As the white tomb appears framed before you, walk on at a calm and respectful pace.',
    hi: 'दरवाज़ा-ए-रौज़ा पर एक क्षण रुकिए। मेहराब के चारों ओर जड़ी काले संगमरमर की सुलेख हर आगंतुक का स्वागत करती है। सफ़ेद मकबरा सामने दिखते ही शांत और सम्मानपूर्ण कदमों से आगे बढ़िए।',
  },
  'taj-mahal-mausoleum': {
    en: 'Stand quietly by the central marble pool. This is a tomb, raised by Shah Jahan between 1631 and 1648 in memory of his wife, and many visitors pause here in silence. Speak softly, keep to the paths, and let the stillness of the place guide you.',
    hi: 'बीच के संगमरमर के हौज़ के पास शांति से खड़े होइए। यह एक मकबरा है, जिसे शाहजहाँ ने 1631 से 1648 के बीच अपनी पत्नी की याद में बनवाया; बहुत से लोग यहाँ मौन होकर रुकते हैं। धीरे बोलिए, रास्तों पर ही चलिए और इस जगह की शांति को महसूस कीजिए।',
  },
  'taj-mahal-mosque-jawab': {
    en: 'To the west stands the Friday Mosque, still a place of prayer, mirrored on the east by the Jawab pavilion. If prayers are under way, keep a respectful distance and keep your voice low; the balance around you invites a quiet, unhurried visit.',
    hi: 'पश्चिम में शुक्रवार की मस्जिद है, जहाँ आज भी नमाज़ होती है, और पूरब में उसका प्रतिबिंब जवाब मंडप। नमाज़ के समय सम्मानजनक दूरी रखिए और धीमे स्वर में बात कीजिए; चारों ओर का संतुलन शांत, बिना जल्दबाज़ी की यात्रा का निमंत्रण देता है।',
  },
  'amar-singh-gate': {
    en: 'You enter Agra Fort through Amar Singh Gate, built by Emperor Akbar in 1565. Climb the winding ramp at an easy pace and take a moment at the top; a calm walk lets you take in the place before the palaces ahead.',
    hi: 'आप अमर सिंह द्वार से आगरा किले में प्रवेश कर रहे हैं, जिसे बादशाह अकबर ने 1565 में बनवाया। घुमावदार ढलान पर आराम से चढ़िए और ऊपर एक क्षण रुकिए; शांत कदमों से आप आगे के महलों से पहले इस जगह को महसूस कर पाएँगे।',
  },
  'jahangiri-mahal': {
    en: 'In Jahangiri Mahal, Rajput carving and Mughal courtyards meet in one building, traditions side by side. Walk the courtyards slowly, and pause by the great Hauz-i-Jahangiri bowl outside.',
    hi: 'जहाँगीरी महल में राजपूत नक़्क़ाशी और मुग़ल आँगन एक ही इमारत में मिलते हैं — परंपराएँ साथ-साथ। आँगनों में धीरे चलिए और बाहर रखे विशाल हौज़-ए-जहाँगीरी के पास एक क्षण रुकिए।',
  },
  'musamman-burj': {
    en: 'Musamman Burj is a place for reflection. From this octagonal marble balcony, an imprisoned Shah Jahan looked across the Yamuna toward Mumtaz Mahal’s tomb. Stand here quietly for a moment before you leave.',
    hi: 'मुसम्मन बुर्ज चिंतन की जगह है। इसी अष्टकोणीय संगमरमर की बालकनी से क़ैद शाहजहाँ यमुना के पार मुमताज़ महल के मकबरे को निहारते थे। जाने से पहले यहाँ एक क्षण शांति से खड़े रहिए।',
  },
  // Lucknow
  'rumi-darwaza': {
    en: 'The Rumi Darwaza, raised in 1784 under Nawab Asaf-ud-Daula, has welcomed travellers into old Lucknow for centuries. Pass beneath it unhurried; it leads toward the Imambaras, places of devotion that ask for modest dress and quiet.',
    hi: '1784 में नवाब आसफ़-उद-दौला के समय बना रूमी दरवाज़ा सदियों से यात्रियों का पुराने लखनऊ में स्वागत करता आया है। इसके नीचे से बिना जल्दबाज़ी के गुज़रिए; यह इमामबाड़ों की ओर ले जाता है, जो श्रद्धा के स्थान हैं और शालीन पहनावे व शांति की अपेक्षा रखते हैं।',
  },
  'bara-imambara': {
    en: 'The Bara Imambara is a place of devotion, begun in the famine of 1784 so that more than 20,000 residents could earn a living. Dress modestly, remove footwear where asked, and keep your voice low in the great hall.',
    hi: 'बड़ा इमामबाड़ा श्रद्धा का स्थान है, जो 1784 के अकाल में शुरू हुआ ताकि 20,000 से अधिक लोग रोज़गार पा सकें। शालीन कपड़े पहनिए, कहे जाने पर जूते उतारिए और बड़े हॉल में धीमे स्वर में बात कीजिए।',
  },
  'shahi-baoli': {
    en: 'The five-storey Shahi Baoli is fed by an underground channel from the Gomti River. Step down carefully and pause at the still water; this is a calm corner of the Imambara complex.',
    hi: 'पाँच मंज़िला शाही बावली में गोमती नदी का पानी ज़मीन के नीचे की नहर से आता है। सीढ़ियाँ सावधानी से उतरिए और शांत पानी के पास एक क्षण रुकिए; यह इमामबाड़ा परिसर का एक शांत कोना है।',
  },
  'chota-imambara': {
    en: 'Chota Imambara, built by Nawab Muhammad Ali Shah in 1838, is a place of devotion adorned with Quranic calligraphy beneath its golden dome. Enter respectfully, dress modestly, and move quietly among the chandeliers that earned it the name Palace of Lights.',
    hi: '1838 में नवाब मुहम्मद अली शाह द्वारा बनवाया गया छोटा इमामबाड़ा श्रद्धा का स्थान है, जिसके सुनहरे गुंबद के नीचे क़ुरानी सुलेख सजी है। सम्मान से प्रवेश कीजिए, शालीन कपड़े पहनिए और उन झाड़-फ़ानूसों के बीच शांति से चलिए जिनसे इसे रोशनियों का महल कहा जाता है।',
  },
  'bhool-bhulaiya': {
    en: 'The Bhool Bhulaiya rises above the hall of the Bara Imambara, itself a place of devotion. Go up with a licensed guide, stay together among its 489 look-alike doorways, and keep voices soft; these walls carry even a whisper.',
    hi: 'भूलभुलैया बड़ा इमामबाड़ा के हॉल के ऊपर है, जो स्वयं श्रद्धा का स्थान है। लाइसेंसधारी गाइड के साथ ऊपर जाइए, 489 एक-जैसे दरवाज़ों में साथ बने रहिए और धीमे स्वर में बोलिए; ये दीवारें फुसफुसाहट भी दूर तक पहुँचा देती हैं।',
  },
  'asfi-mosque': {
    en: 'Before you are the three fluted white domes of Asfi Mosque, an active place of worship. Dress modestly, and keep a respectful quiet, especially near prayer hours.',
    hi: 'सामने आसफ़ी मस्जिद के तीन धारीदार सफ़ेद गुंबद हैं — एक सक्रिय इबादतगाह। शालीन कपड़े पहनिए और ख़ासकर नमाज़ के समय सम्मानजनक शांति बनाए रखिए।',
  },
  // Sarnath
  'dhamek-stupa': {
    en: 'You stand in the Deer Park where Gautama Buddha delivered his first sermon. Many pilgrims walk clockwise around the Dhamek Stupa in quiet reflection; walk slowly, keep your voice low, and do not climb on the monument.',
    hi: 'आप उस मृगदाव में खड़े हैं जहाँ गौतम बुद्ध ने अपना पहला उपदेश दिया। बहुत से श्रद्धालु धमेख स्तूप की घड़ी की दिशा में शांत परिक्रमा करते हैं; धीरे चलिए, धीमे बोलिए और स्मारक पर चढ़िए नहीं।',
  },
  'dharmarajika-stupa': {
    en: 'These brick rings are the remains of Dharmarajika Stupa, raised by Emperor Ashoka to enshrine relics of the Buddha. Pause here respectfully, and walk around the ruins rather than over them.',
    hi: 'ये ईंटों के घेरे धर्मराजिका स्तूप के अवशेष हैं, जिसे सम्राट अशोक ने बुद्ध के अवशेष स्थापित करने के लिए बनवाया था। यहाँ सम्मान से रुकिए; खंडहरों के ऊपर नहीं, उनके चारों ओर चलिए।',
  },
  'ashoka-pillar-sarnath': {
    en: 'Around 250 BCE, Emperor Ashoka inscribed this pillar with an edict urging harmony in the Sangha, the community of monks. Take it as a call to unity, and stand quietly beside the shrine ruins around it.',
    hi: 'लगभग 250 ईसा पूर्व सम्राट अशोक ने इस स्तंभ पर संघ — भिक्षुओं के समुदाय — में एकता का आग्रह करने वाला शिलालेख उत्कीर्ण कराया। इसे एकता के संदेश के रूप में लीजिए और आसपास के मंदिर-खंडहरों के पास शांति से खड़े रहिए।',
  },
  'sarnath-archaeological-museum': {
    en: 'In the main hall stand the Lion Capital of Ashoka and the serene fifth-century Preaching Buddha. Move quietly among the sculptures and give the Buddha image a moment of stillness. The museum is closed every Friday.',
    hi: 'मुख्य हॉल में अशोक का सिंह शीर्ष और पाँचवीं सदी की शांत उपदेशरत बुद्ध प्रतिमा हैं। मूर्तियों के बीच शांति से चलिए और बुद्ध प्रतिमा के सामने एक क्षण मौन रहिए। संग्रहालय हर शुक्रवार बंद रहता है।',
  },
  'chaukhandi-stupa': {
    en: 'Chaukhandi Stupa marks where the Buddha reunited with his five former ascetic companions. Begin your visit here in quiet, and walk around the mound respectfully rather than climbing it.',
    hi: 'चौखंडी स्तूप उस स्थान को चिह्नित करता है जहाँ बुद्ध अपने पाँच पूर्व तपस्वी साथियों से फिर मिले। अपनी यात्रा यहीं शांति से शुरू कीजिए; टीले पर चढ़ने के बजाय सम्मान से उसके चारों ओर चलिए।',
  },
  'mulagandhakuti-vihara': {
    en: 'Mulagandhakuti Vihara has a prayer hall: remove your shoes before the stairs and enter in silence. After viewing Kosetsu Nosu’s frescoes of the Buddha’s life, sit for a while beneath the Sacred Bodhi Tree, descended from Bodh Gaya via Sri Lanka.',
    hi: 'मूलगंधकुटी विहार में प्रार्थना-कक्ष है: सीढ़ियों से पहले जूते उतारिए और मौन होकर प्रवेश कीजिए। कोसेत्सु नोसु के बुद्ध-जीवन भित्तिचित्र देखने के बाद, बोधगया से श्रीलंका होते हुए आए पवित्र बोधि वृक्ष के नीचे कुछ देर बैठिए।',
  },
};

export interface StopScript {
  monumentSlug: string;
  scriptEn: string;
  scriptHi: string;
}

/** Knowledge-base entries that lengthen a stop's narration (from the content pack). */
export interface StopExtras {
  history: KnowledgeChunk[];
  legends: KnowledgeChunk[];
  etiquette: KnowledgeChunk | null;
}

const NO_EXTRAS: StopExtras = { history: [], legends: [], etiquette: null };

/** The knowledge-base entries for one monument, from the destination's content pack. */
export function stopExtras(pack: OfflinePack | null, monumentSlug: string): StopExtras {
  if (!pack) return NO_EXTRAS;
  const monument = pack.monuments.find((m) => m.slug === monumentSlug);
  const forMonument = pack.knowledge_chunks.filter((c) => monument && c.monument_id === monument.id);
  return {
    history: forMonument.filter((c) => c.content_type === 'RECORDED_HISTORY' && !/etiquette/i.test(c.title)),
    legends: forMonument.filter((c) => c.content_type === 'FOLKLORE_TRADITION'),
    // a monument's own etiquette entry, else the destination's general one
    etiquette:
      forMonument.find((c) => /etiquette/i.test(c.title)) ??
      pack.knowledge_chunks.find((c) => c.monument_id === null && /etiquette/i.test(c.title)) ??
      null,
  };
}

const text = (c: KnowledgeChunk, hi: boolean) => (hi && c.content_hi ? c.content_hi : c.content);

/**
 * What Raahi reads at a tour stop in the chosen style. `useHindi` picks the
 * Hindi text; other languages use English, which is translated when shown.
 */
export function styledStopScript(
  stop: StopScript,
  style: PersonaType,
  useHindi: boolean,
  extras: StopExtras = NO_EXTRAS,
): string {
  const base = useHindi && stop.scriptHi ? stop.scriptHi : stop.scriptEn;
  const pick = (table: Record<string, Pair>) => {
    const pair = table[stop.monumentSlug];
    return pair ? (useHindi ? pair.hi : pair.en) : base;
  };
  const join = (...parts: string[]) => parts.filter((p) => p && p.trim()).join(' ');
  switch (style) {
    case 'quick':
      return base;
    case 'kids': {
      const legend = extras.legends[0];
      return join(
        pick(KIDS),
        legend
          ? `${useHindi ? 'और अब एक किंवदंती, जो लोग सुनाते हैं — यह कहानी है, दर्ज इतिहास नहीं:' : 'Now a legend that people tell — it is a story, not recorded history:'} ${text(legend, useHindi)}`
          : '',
      );
    }
    case 'pilgrim':
      return join(pick(DEVOTIONAL), extras.etiquette ? text(extras.etiquette, useHindi) : '');
    default: {
      const sources = [...new Set(extras.history.map((c) => c.source_name).filter(Boolean))];
      return join(
        base,
        ...extras.history.map((c) => text(c, useHindi)),
        sources.length ? `${useHindi ? 'स्रोत' : 'Sources'}: ${sources.join(', ')}.` : '',
      );
    }
  }
}
