import { LANGUAGE_OPTIONS } from '../data/upCities';
import { postVoiceTTS } from './api';

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function speakText(
  text: string,
  languageCode: string,
  onSpeakingChange?: (speaking: boolean) => void,
  options?: { autoTranslate?: boolean },
): Promise<'sarvam' | 'device'> {
  stopSpeaking();
  if (!text.trim()) return 'device';

  onSpeakingChange?.(true);
  let textForDeviceFallback = text;

  // Try cloud Sarvam AI / Bhashini TTS first; automatically translate if text isn't in target language
  try {
    if (navigator.onLine) {
      const res = await postVoiceTTS(text, languageCode, Boolean(options?.autoTranslate));
      if (res.spoken_text && res.spoken_text.trim()) {
        textForDeviceFallback = res.spoken_text;
      }
      if (!res.fallback_to_device && res.audio_base64) {
        const audio = new Audio(`data:${res.content_type};base64,${res.audio_base64}`);
        currentAudio = audio;
        audio.onended = () => {
          currentAudio = null;
          onSpeakingChange?.(false);
        };
        audio.onerror = () => {
          currentAudio = null;
          onSpeakingChange?.(false);
        };
        await audio.play();
        return 'sarvam';
      }
    }
  } catch {
    // Silent failover to device speech
  }

  return new Promise<'device'>((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onSpeakingChange?.(false);
      resolve('device');
      return;
    }
    const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === languageCode);
    const targetBcp47 = langMeta?.bcp47 || 'en-IN';
    const baseLang = targetBcp47.split('-')[0].toLowerCase();

    const utterance = new SpeechSynthesisUtterance(textForDeviceFallback);
    utterance.lang = targetBcp47;
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === targetBcp47.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(baseLang));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.rate = 0.96;
    utterance.onend = () => {
      onSpeakingChange?.(false);
      resolve('device');
    };
    utterance.onerror = () => {
      onSpeakingChange?.(false);
      resolve('device');
    };
    window.speechSynthesis.speak(utterance);
  });
}

export interface BrowserSpeechResult {
  stop: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionAlternativeLike>>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function startBrowserSpeechFallback(
  languageCode: string,
  onTranscript: (text: string) => void,
  onDone: () => void,
): BrowserSpeechResult | null {
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
  };
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) return null;

  const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === languageCode);
  const recognition = new Ctor();
  recognition.lang = langMeta?.bcp47 || 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const first = event.results?.[0]?.[0]?.transcript || '';
    if (first.trim()) onTranscript(first.trim());
  };
  recognition.onerror = () => onDone();
  recognition.onend = () => onDone();
  recognition.start();
  return { stop: () => recognition.stop() };
}
