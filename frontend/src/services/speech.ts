import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { LANGUAGE_OPTIONS } from '../data/upCities';

// Android's WebView has no Web Speech engine, so the installed app uses the
// phone's native text-to-speech and speech recogniser, which also work offline
// when the language pack is on the device.
const isNative = Capacitor.isNativePlatform();
import { postVoiceTTS } from './api';

export type AudioPlaybackState = 'idle' | 'loading' | 'playing';

let currentAudio: HTMLAudioElement | null = null;
let activePlaybackToken = 0;
let activeTtsAbort: AbortController | null = null;
/** resolves the pending "wait until done" promise when audio ends or is stopped */
let finishCurrentAudio: (() => void) | null = null;

function clearCurrentAudio(): void {
  if (finishCurrentAudio) {
    finishCurrentAudio();
    finishCurrentAudio = null;
  }
  if (currentAudio) {
    currentAudio.onplaying = null;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

export function stopSpeaking(): void {
  activePlaybackToken += 1;
  if (activeTtsAbort) {
    activeTtsAbort.abort();
    activeTtsAbort = null;
  }
  clearCurrentAudio();
  if (isNative) {
    void TextToSpeech.stop().catch(() => undefined);
  } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function speakText(
  text: string,
  languageCode: string,
  onStateChange?: (state: AudioPlaybackState) => void,
  options?: {
    autoTranslate?: boolean;
    /** Playback progress 0..1, for captions that follow the voice */
    onProgress?: (fraction: number) => void;
    /** Speaking speed multiplier (1 = normal) */
    rate?: number;
    /**
     * Resolve only when the audio has finished (or was stopped). By default the
     * cloud voice resolves as soon as playback starts.
     */
    waitUntilDone?: boolean;
  },
): Promise<'sarvam' | 'device' | 'cancelled'> {
  stopSpeaking();
  if (!text.trim()) {
    onStateChange?.('idle');
    return 'cancelled';
  }

  const token = ++activePlaybackToken;
  onStateChange?.('loading');
  let textForDeviceFallback = text;

  // Try cloud Sarvam AI / Bhashini TTS first; automatically translate if text isn't in target language
  try {
    if (navigator.onLine) {
      const controller = new AbortController();
      activeTtsAbort = controller;
      const res = await postVoiceTTS(
        text,
        languageCode,
        Boolean(options?.autoTranslate),
        controller.signal,
      );
      if (activeTtsAbort === controller) {
        activeTtsAbort = null;
      }
      if (token !== activePlaybackToken) {
        return 'cancelled';
      }
      if (res.spoken_text && res.spoken_text.trim()) {
        textForDeviceFallback = res.spoken_text;
      }
      if (!res.fallback_to_device && res.audio_base64) {
        const audio = new Audio(`data:${res.content_type};base64,${res.audio_base64}`);
        currentAudio = audio;
        let markedPlaying = false;
        const markPlaying = () => {
          if (!markedPlaying && token === activePlaybackToken) {
            markedPlaying = true;
            onStateChange?.('playing');
          }
        };
        audio.playbackRate = options?.rate ?? 1;
        audio.onplaying = markPlaying;
        audio.ontimeupdate = () => {
          if (token === activePlaybackToken && audio.duration > 0) {
            options?.onProgress?.(audio.currentTime / audio.duration);
          }
        };
        const finished = new Promise<void>((resolve) => {
          finishCurrentAudio = resolve;
        });
        const done = () => {
          if (finishCurrentAudio) {
            finishCurrentAudio();
            finishCurrentAudio = null;
          }
        };
        audio.onended = () => {
          if (currentAudio === audio) currentAudio = null;
          if (token === activePlaybackToken) onStateChange?.('idle');
          done();
        };
        audio.onerror = () => {
          if (currentAudio === audio) currentAudio = null;
          if (token === activePlaybackToken) onStateChange?.('idle');
          done();
        };
        await audio.play();
        if (token !== activePlaybackToken) {
          clearCurrentAudio();
          return 'cancelled';
        }
        markPlaying();
        if (options?.waitUntilDone) {
          await finished;
          return token === activePlaybackToken ? 'sarvam' : 'cancelled';
        }
        return 'sarvam';
      }
    }
  } catch {
    activeTtsAbort = null;
    clearCurrentAudio();
    if (token !== activePlaybackToken) {
      return 'cancelled';
    }
    // Silent failover to device speech
  }

  if (token !== activePlaybackToken) {
    return 'cancelled';
  }

  if (isNative) {
    const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === languageCode);
    onStateChange?.('playing');
    // Native TTS gives no word timings: estimate progress from typical speaking speed
    const started = performance.now();
    const expectedMs = Math.max(1500, (textForDeviceFallback.length / 14 / (options?.rate ?? 1)) * 1000);
    const timer = window.setInterval(() => {
      if (token === activePlaybackToken) options?.onProgress?.(Math.min(0.99, (performance.now() - started) / expectedMs));
    }, 200);
    try {
      await TextToSpeech.speak({ text: textForDeviceFallback, lang: langMeta?.bcp47 || 'en-IN', rate: 0.96 * (options?.rate ?? 1) });
    } catch {
      // No voice for this language on the device: finish quietly
    }
    window.clearInterval(timer);
    if (token === activePlaybackToken) onStateChange?.('idle');
    return token === activePlaybackToken ? 'device' : 'cancelled';
  }

  return new Promise<'device' | 'cancelled'>((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (token === activePlaybackToken) onStateChange?.('idle');
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

    utterance.rate = 0.96 * (options?.rate ?? 1);
    let started = false;
    let settled = false;
    const safetyTimer = window.setTimeout(() => {
      if (!started && !settled && token === activePlaybackToken && window.speechSynthesis.speaking) {
        started = true;
        onStateChange?.('playing');
      }
    }, 250);

    const cleanup = () => {
      window.clearTimeout(safetyTimer);
    };

    utterance.onboundary = (ev) => {
      if (token === activePlaybackToken && textForDeviceFallback.length) {
        options?.onProgress?.(ev.charIndex / textForDeviceFallback.length);
      }
    };
    utterance.onstart = () => {
      if (token !== activePlaybackToken) return;
      started = true;
      onStateChange?.('playing');
    };
    utterance.onend = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (token === activePlaybackToken) onStateChange?.('idle');
      resolve(token === activePlaybackToken ? 'device' : 'cancelled');
    };
    utterance.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (token === activePlaybackToken) onStateChange?.('idle');
      resolve(token === activePlaybackToken ? 'device' : 'cancelled');
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
  if (isNative) {
    const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === languageCode);
    let stopped = false;
    void (async () => {
      try {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') return;
        const res = await SpeechRecognition.start({
          language: langMeta?.bcp47 || 'en-IN',
          maxResults: 1,
          partialResults: false,
          popup: true,
        });
        const first = res?.matches?.[0] || '';
        if (!stopped && first.trim()) onTranscript(first.trim());
      } catch {
        // recogniser unavailable or cancelled
      } finally {
        onDone();
      }
    })();
    return {
      stop: () => {
        stopped = true;
        void SpeechRecognition.stop().catch(() => undefined);
      },
    };
  }

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
