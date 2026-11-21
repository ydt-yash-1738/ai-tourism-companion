import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { postVoiceSTT } from '../services/api';
import { convertBlobToWav16k } from '../services/audioRecorder';
import { startBrowserSpeechFallback } from '../services/speech';

export interface UseVoiceInputOptions {
  language: string;
  isOnline: boolean;
  value: string;
  onValueChange: Dispatch<SetStateAction<string>>;
  onBeforeStart?: () => void;
}

export interface UseVoiceInputResult {
  recording: boolean;
  transcribing: boolean;
  voiceStatus: string;
  clearVoiceStatus: () => void;
  toggleMic: () => Promise<void>;
  cancelMic: () => void;
}

function formatBrowserSpeechError(code: string | undefined, isHi: boolean): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return isHi
      ? 'माइक्रोफ़ोन की अनुमति अस्वीकृत है। कृपया ब्राउज़र में माइक अनुमति दें।'
      : 'Microphone permission was blocked. Please allow microphone access in your browser.';
  }
  if (code === 'audio-capture') {
    return isHi
      ? 'कोई सक्रिय माइक्रोफ़ोन नहीं मिला। कृपया माइक डिवाइस जाँचें।'
      : 'No active microphone was detected. Please check your microphone device.';
  }
  if (code === 'no-speech') {
    return isHi
      ? 'कोई आवाज़ सुनाई नहीं दी — कृपया माइक के पास स्पष्ट बोलें।'
      : 'No speech detected — please speak closer to the microphone.';
  }
  if (code === 'network') {
    return isHi
      ? 'ब्राउज़र स्पीच सेवा नेटवर्क के कारण रुकी। बैकएंड जुड़ने पर Sarvam AI वॉइस इनपुट अपने आप काम करेगा।'
      : 'Browser speech service hit a network error. When the backend is connected, Sarvam AI voice input handles transcription directly.';
  }
  return isHi
    ? 'आवाज़ स्पष्ट नहीं थी, कृपया पुनः प्रयास करें या टाइप करें।'
    : 'Voice input stopped before speech was captured — please try again or type.';
}

/**
 * Shared microphone voice-input hook using cloud Sarvam AI STT when online and
 * falling back to Capacitor / browser Web Speech recognition otherwise.
 */
export function useVoiceInput({
  language,
  isOnline,
  value,
  onValueChange,
  onBeforeStart,
}: UseVoiceInputOptions): UseVoiceInputResult {
  const isHi = language.startsWith('hi');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const browserSpeechRef = useRef<{ stop: () => void } | null>(null);
  const baseInputBeforeSpeechRef = useRef('');
  const valueRef = useRef(value);
  const unmountedRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const cancelMic = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // Ignore already-stopped recorder
        }
      }
      mediaRecorderRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (browserSpeechRef.current) {
      browserSpeechRef.current.stop();
      browserSpeechRef.current = null;
    }
    if (!unmountedRef.current) {
      setRecording(false);
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      cancelMic();
    };
  }, [cancelMic]);

  const clearVoiceStatus = useCallback(() => {
    setVoiceStatus('');
  }, []);

  const launchBrowserSpeech = () => {
    baseInputBeforeSpeechRef.current = valueRef.current.trim();
    const fallback = startBrowserSpeechFallback(
      language,
      (transcript) => {
        if (unmountedRef.current) return;
        const prefix = baseInputBeforeSpeechRef.current;
        onValueChange(prefix ? `${prefix} ${transcript}` : transcript);
        setVoiceStatus(isHi ? 'सुन रहे हैं... बोलें' : 'Listening...');
      },
      (info) => {
        browserSpeechRef.current = null;
        if (unmountedRef.current) return;
        setRecording(false);
        if (info?.gotTranscript) {
          setVoiceStatus('');
        } else {
          setVoiceStatus(formatBrowserSpeechError(info?.error, isHi));
        }
      },
    );
    if (fallback) {
      browserSpeechRef.current = fallback;
      setRecording(true);
      setVoiceStatus(
        isHi ? 'सुन रहे हैं... बोलने के बाद लाल बटन दबाएँ' : 'Listening... tap stop when done',
      );
      return true;
    }
    return false;
  };

  const toggleMic = async () => {
    if (transcribing) return;

    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      browserSpeechRef.current?.stop();
      browserSpeechRef.current = null;
      setRecording(false);
      return;
    }

    onBeforeStart?.();
    setVoiceStatus('');

    if (isOnline && 'MediaRecorder' in window && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (unmountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        const chunks: BlobPart[] = [];
        const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        const chosenMime =
          typeof MediaRecorder.isTypeSupported === 'function'
            ? preferredTypes.find((t) => MediaRecorder.isTypeSupported(t))
            : undefined;
        const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };

        recorder.onerror = () => {
          stream.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
          mediaRecorderRef.current = null;
          if (unmountedRef.current) return;
          setRecording(false);
          setVoiceStatus(
            isHi
              ? 'ऑडियो रिकॉर्डिंग में त्रुटि आई। कृपया पुनः प्रयास करें।'
              : 'Microphone recording error — please try again.',
          );
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
          mediaRecorderRef.current = null;
          if (unmountedRef.current) return;
          setRecording(false);

          const rawBlob = new Blob(chunks, { type: recorder.mimeType || chosenMime || 'audio/webm' });
          if (rawBlob.size === 0) {
            setVoiceStatus(
              isHi
                ? 'कोई आवाज़ रिकॉर्ड नहीं हुई। कृपया माइक के पास बोलें।'
                : 'No audio captured. Please speak closer to the microphone.',
            );
            return;
          }

          setTranscribing(true);
          setVoiceStatus(isHi ? 'आपकी आवाज़ समझी जा रही है...' : 'Transcribing speech...');
          try {
            const wavBlob = await convertBlobToWav16k(rawBlob);
            const stt = await postVoiceSTT(wavBlob, language);
            if (unmountedRef.current) return;
            if (!stt.fallback_to_device && stt.transcript.trim()) {
              const spoken = stt.transcript.trim();
              onValueChange((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
              setVoiceStatus('');
              return;
            }
            if (stt.fallback_to_device) {
              // Server has no cloud speech service: listen again with the device recogniser
              if (launchBrowserSpeech()) {
                setVoiceStatus(isHi ? 'कृपया दोबारा बोलें...' : 'Please say that once more...');
                return;
              }
            }
            setVoiceStatus(
              stt.transcript.trim() === '' && !stt.fallback_to_device
                ? isHi
                  ? 'आवाज़ स्पष्ट नहीं थी, कृपया पुनः प्रयास करें।'
                  : 'No clear speech detected — please try again or type your question.'
                : stt.message || 'Voice transcription unavailable — please type your question.',
            );
          } catch {
            if (!unmountedRef.current) {
              setVoiceStatus(
                isHi
                  ? 'वॉइस सेवा से संपर्क नहीं हो सका। कृपया टाइप करें या दोबारा बोलें।'
                  : 'Could not reach voice transcription service — please try again or type.',
              );
            }
          } finally {
            if (!unmountedRef.current) {
              setTranscribing(false);
            }
          }
        };

        recorder.start(250);
        setRecording(true);
        setVoiceStatus(
          isHi ? 'सुन रहे हैं... बोलने के बाद लाल बटन दबाएँ' : 'Listening... tap stop when done',
        );
        return;
      } catch {
        // Microphone denied or unsupported -> try browser Web Speech fallback
      }
    }

    if (!unmountedRef.current && !launchBrowserSpeech()) {
      setVoiceStatus(
        isHi
          ? 'माइक्रोफ़ोन उपलब्ध नहीं है। कृपया नीचे अपना प्रश्न टाइप करें।'
          : 'Microphone permission unavailable in this browser — please type your question.',
      );
    }
  };

  return {
    recording,
    transcribing,
    voiceStatus,
    clearVoiceStatus,
    toggleMic,
    cancelMic,
  };
}

