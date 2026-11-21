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
let resolvePendingAudio: ((outcome: 'sarvam' | 'cancelled') => void) | null = null;
let resolvePendingSpeech: (() => void) | null = null;

function clearCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.onplaying = null;
    currentAudio.ontimeupdate = null;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (resolvePendingAudio) {
    const resolve = resolvePendingAudio;
    resolvePendingAudio = null;
    resolve('cancelled');
  }
}

export function stopSpeaking(): void {
  activePlaybackToken += 1;
  if (activeTtsAbort) {
    activeTtsAbort.abort();
    activeTtsAbort = null;
  }
  clearCurrentAudio();
  if (resolvePendingSpeech) {
    const resolve = resolvePendingSpeech;
    resolvePendingSpeech = null;
    resolve();
  }
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
  let controller: AbortController | null = null;

  // Try cloud Sarvam AI / Bhashini TTS first; automatically translate if text isn't in target language
  try {
    if (navigator.onLine) {
      controller = new AbortController();
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
        let settled = false;
        let resolveAudio!: (outcome: 'sarvam' | 'cancelled') => void;
        const playbackDone = new Promise<'sarvam' | 'cancelled'>((resolve) => {
          resolveAudio = resolve;
        });
        const settleCompletion = (outcome: 'sarvam' | 'cancelled') => {
          if (settled) return;
          settled = true;
          if (resolvePendingAudio === settleCompletion) {
            resolvePendingAudio = null;
          }
          resolveAudio(outcome);
        };
        resolvePendingAudio = settleCompletion;

        const markPlaying = () => {
          if (!markedPlaying && !settled && token === activePlaybackToken) {
            markedPlaying = true;
            onStateChange?.('playing');
          }
        };
        audio.playbackRate = options?.rate ?? 1;
        audio.onplaying = markPlaying;
        audio.ontimeupdate = () => {
          if (token === activePlaybackToken && Number.isFinite(audio.duration) && audio.duration > 0) {
            options?.onProgress?.(Math.min(1, audio.currentTime / audio.duration));
          }
        };
        audio.onended = () => {
          if (currentAudio === audio) currentAudio = null;
          if (token === activePlaybackToken) {
            options?.onProgress?.(1);
            onStateChange?.('idle');
            settleCompletion('sarvam');
          } else {
            settleCompletion('cancelled');
          }
        };
        audio.onerror = () => {
          if (currentAudio === audio) currentAudio = null;
          if (token === activePlaybackToken) onStateChange?.('idle');
          settleCompletion('cancelled');
        };
        await audio.play();
        if (token !== activePlaybackToken) {
          if (currentAudio === audio) {
            clearCurrentAudio();
          } else {
            audio.pause();
            audio.src = '';
          }
          settleCompletion('cancelled');
          return 'cancelled';
        }
        markPlaying();
        return await playbackDone;
      }
    }
  } catch {
    if (controller && activeTtsAbort === controller) {
      activeTtsAbort = null;
    }
    if (token !== activePlaybackToken) {
      return 'cancelled';
    }
    clearCurrentAudio();
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
    if (token === activePlaybackToken) {
      options?.onProgress?.(1);
      onStateChange?.('idle');
    }
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

    const settle = (outcome: 'device' | 'cancelled') => {
      if (settled) return;
      settled = true;
      cleanup();
      if (resolvePendingSpeech === cancelSpeech) {
        resolvePendingSpeech = null;
      }
      resolve(outcome);
    };

    const cancelSpeech = () => {
      settle('cancelled');
    };
    resolvePendingSpeech = cancelSpeech;

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
      if (token === activePlaybackToken) {
        options?.onProgress?.(1);
        onStateChange?.('idle');
      }
      settle(token === activePlaybackToken ? 'device' : 'cancelled');
    };
    utterance.onerror = () => {
      if (token === activePlaybackToken) onStateChange?.('idle');
      settle('cancelled');
    };
    window.speechSynthesis.speak(utterance);
  });
}

export interface BrowserSpeechResult {
  stop: () => void;
}

export interface BrowserSpeechDoneInfo {
  error?: string;
  gotTranscript?: boolean;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternativeLike> {
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function startBrowserSpeechFallback(
  languageCode: string,
  onTranscript: (text: string, isFinal?: boolean) => void,
  onDone: (info?: BrowserSpeechDoneInfo) => void,
): BrowserSpeechResult | null {
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
  };
  if (isNative) {
    const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === languageCode);
    let stopped = false;
    let finished = false;
    let gotTranscript = false;
    let lastError: string | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDone({ error: lastError, gotTranscript });
    };
    void (async () => {
      try {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') {
          lastError = 'not-allowed';
          return;
        }
        const res = await SpeechRecognition.start({
          language: langMeta?.bcp47 || 'en-IN',
          maxResults: 1,
          partialResults: false,
          popup: true,
        });
        const first = res?.matches?.[0] || '';
        if (!stopped && first.trim()) {
          gotTranscript = true;
          onTranscript(first.trim(), true);
        }
      } catch {
        lastError = 'service-not-allowed';
      } finally {
        finish();
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
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finished = false;
  let gotTranscript = false;
  let lastError: string | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone({ error: lastError, gotTranscript });
  };

  recognition.onresult = (event) => {
    const parts: string[] = [];
    let isFinal = false;
    for (let i = 0; i < event.results.length; i += 1) {
      const res = event.results[i];
      const text = res?.[0]?.transcript?.trim();
      if (text) parts.push(text);
      if (i === event.results.length - 1 && res?.isFinal) isFinal = true;
    }
    const combined = parts.join(' ').trim();
    if (combined) {
      gotTranscript = true;
      onTranscript(combined, isFinal);
    }
  };
  recognition.onerror = (ev) => {
    lastError = ev?.error || 'unknown';
    finish();
  };
  recognition.onend = () => finish();

  try {
    recognition.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        finish();
      }
    },
  };
}
