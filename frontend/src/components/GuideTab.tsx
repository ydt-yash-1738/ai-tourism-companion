import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Landmark,
  Loader2,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
import { PERSONA_OPTIONS } from '../data/upCities';
import { postChat, postVoiceSTT } from '../services/api';
import { convertBlobToWav16k } from '../services/audioRecorder';
import { offlineLocalChatSearch } from '../services/offlineStore';
import { speakText, startBrowserSpeechFallback, stopSpeaking } from '../services/speech';
import type { ChatResponse, Monument, OfflinePack, PersonaType } from '../types/api';

interface GuideTabProps {
  language: string;
  persona: PersonaType;
  simpleLanguage: boolean;
  isOnline: boolean;
  sessionHash: string;
  monuments: Monument[];
  monumentsLoading?: boolean;
  offlinePack: OfflinePack | null;
  onChangePersona: (p: PersonaType) => void;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: ChatResponse;
  /** True when the answer came from the on-device offline pack, not the server */
  fromDevice?: boolean;
}

export function GuideTab({
  language,
  persona,
  simpleLanguage,
  isOnline,
  sessionHash,
  monuments,
  monumentsLoading = false,
  offlinePack,
  onChangePersona,
}: GuideTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');

  const [selectedMonument, setSelectedMonument] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [audioState, setAudioState] = useState<{
    id: string;
    status: 'loading' | 'playing';
  } | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const browserSpeechRef = useRef<{ stop: () => void } | null>(null);
  const msgSeqRef = useRef(0);
  const streamRef = useRef<HTMLDivElement>(null);

  // Bring the newest question or answer into view, below the sticky header
  useEffect(() => {
    const last = streamRef.current?.lastElementChild as HTMLElement | null;
    if (!last) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const top = last.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }, [messages.length, loading]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      browserSpeechRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const sendQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    setVoiceStatus('');
    const userMsg: ChatTurn = { id: `u_${++msgSeqRef.current}`, role: 'user', text: question };
    const nextHistory = [...messages, userMsg]
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.response ? m.response.answer_summary : m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let res: ChatResponse;
      let fromDevice = false;
      if (isOnline) {
        try {
          res = await postChat({
            destination_slug: 'agra',
            question,
            language,
            persona,
            simple_language: simpleLanguage,
            monument_slug: selectedMonument || null,
            session_hash: sessionHash,
            conversation_history: nextHistory,
          });
        } catch {
          res = offlineLocalChatSearch(offlinePack, question, language, persona, simpleLanguage);
          fromDevice = true;
        }
      } else {
        res = offlineLocalChatSearch(offlinePack, question, language, persona, simpleLanguage);
        fromDevice = true;
      }

      const botMsg: ChatTurn = {
        id: `a_${++msgSeqRef.current}`,
        role: 'assistant',
        text: res.answer_summary,
        response: res,
        fromDevice,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMic = async () => {
    if (transcribing) return;

    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      browserSpeechRef.current?.stop();
      setRecording(false);
      return;
    }

    setVoiceStatus('');

    if (isOnline && 'MediaRecorder' in window && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
          setRecording(false);

          const rawBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
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
            if (!stt.fallback_to_device && stt.transcript.trim()) {
              const spoken = stt.transcript.trim();
              setInput((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
              setVoiceStatus('');
              return;
            }
            setVoiceStatus(
              stt.transcript.trim() === '' && !stt.fallback_to_device
                ? isHi
                  ? 'आवाज़ स्पष्ट नहीं थी, कृपया पुनः प्रयास करें।'
                  : 'No clear speech detected — please try again or type your question.'
                : stt.message || 'Voice transcription unavailable — please type your question.',
            );
          } catch {
            setVoiceStatus(
              isHi
                ? 'वॉइस सेवा से संपर्क नहीं हो सका। कृपया टाइप करें या दोबारा बोलें।'
                : 'Could not reach voice transcription service — please try again or type.',
            );
          } finally {
            setTranscribing(false);
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

    const fallback = startBrowserSpeechFallback(
      language,
      (transcript) => {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
        setVoiceStatus('');
      },
      () => setRecording(false),
    );
    if (fallback) {
      browserSpeechRef.current = fallback;
      setRecording(true);
      setVoiceStatus(
        isHi ? 'सुन रहे हैं... बोलने के बाद लाल बटन दबाएँ' : 'Listening... tap stop when done',
      );
    } else {
      setVoiceStatus(
        isHi
          ? 'माइक्रोफ़ोन उपलब्ध नहीं है। कृपया नीचे अपना प्रश्न टाइप करें।'
          : 'Microphone permission unavailable in this browser — please type your question.',
      );
    }
  };

  const handleReadAloud = async (turn: ChatTurn) => {
    if (audioState?.id === turn.id) {
      stopSpeaking();
      setAudioState(null);
      return;
    }

    const r = turn.response;
    const historyPart = r?.verified_history.length
      ? `${ui.recordedHistory}: ${r.verified_history.map((h) => h.text).join(' ')}`
      : '';
    const folklorePart = r?.folklore_legends.length
      ? `${ui.localFolklore}: ${r.folklore_legends.map((f) => f.text).join(' ')}`
      : '';
    const fullText = [turn.text, historyPart, folklorePart].filter(Boolean).join(' ');

    const needsAutoTranslate = Boolean(r && r.language !== language);
    await speakText(
      fullText,
      language,
      (state) => {
        setAudioState(state === 'idle' ? null : { id: turn.id, status: state });
      },
      { autoTranslate: needsAutoTranslate },
    );
  };

  const monumentName = (slug: string | null | undefined) => {
    const m = monuments.find((x) => x.slug === slug);
    if (!m) return null;
    return isHi && m.name_hi ? m.name_hi : m.name;
  };

  return (
    <div className="guide-layout">
      <div className="photo-banner">
        <img src={`${import.meta.env.BASE_URL}images/taj-mahal-banner.webp`} alt="" aria-hidden="true" />
        <div className="guide-banner">
          <span className="guide-banner__eyebrow">
            <span className="dot-live" />
            {ui.greetingSub}
          </span>
          <h2>{ui.greeting}</h2>
        </div>
      </div>

      <section className="guide-intro">
        <div className="guide-intro__head">
          <div>
            <h3>{ui.guideHeading}</h3>
            <p>{ui.guideSub}</p>
          </div>
          {monumentsLoading && monuments.length === 0 && (
            <span className="translating-pill" role="status">
              <Loader2 size={13} className="spin-icon" />
              <span>{ui.loadingMonuments}</span>
            </span>
          )}
        </div>

        <div className="segmented segmented--scroll" role="radiogroup" aria-label={ui.styleLabel}>
          {PERSONA_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={persona === p.id}
              className={persona === p.id ? 'is-active' : ''}
              onClick={() => onChangePersona(p.id)}
            >
              {ui.personas[p.id]}
            </button>
          ))}
        </div>

        <div className="chip-rail" role="radiogroup" aria-label="Filter by monument">
          <button
            type="button"
            role="radio"
            aria-checked={selectedMonument === ''}
            className={`place-chip ${selectedMonument === '' ? 'is-active' : ''}`}
            onClick={() => setSelectedMonument('')}
          >
            <Landmark size={15} />
            {ui.allMonuments}
          </button>
          {monuments.map((m) => (
            <button
              key={m.slug}
              type="button"
              role="radio"
              aria-checked={selectedMonument === m.slug}
              className={`place-chip ${selectedMonument === m.slug ? 'is-active' : ''}`}
              onClick={() => setSelectedMonument(m.slug)}
            >
              {isHi && m.name_hi ? m.name_hi : m.name}
            </button>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="starter-grid">
            {ui.starters.map((q, i) => (
              <button
                key={q}
                type="button"
                className="starter-card"
                style={{ ['--i' as string]: i }}
                onClick={() => sendQuestion(q)}
              >
                <Sparkles size={16} aria-hidden="true" />
                <span>{q}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="chat-stream" aria-live="polite" ref={streamRef}>
        {messages.map((turn) => {
          if (turn.role === 'user') {
            return (
              <div key={turn.id} className="chat-bubble is-user">
                {turn.text}
              </div>
            );
          }

          const turnAudioStatus = audioState?.id === turn.id ? audioState.status : 'idle';

          return (
            <article key={turn.id} className="answer-card">
              <header className="answer-card__meta">
                <span className={`answer-card__source ${turn.fromDevice ? 'is-device' : ''}`}>
                  {turn.fromDevice ? <WifiOff size={13} /> : <ShieldCheck size={13} />}
                  {turn.fromDevice
                    ? ui.answeredOnDevice
                    : turn.response?.mode === 'gemini'
                      ? ui.sourceAi
                      : ui.sourceVerified}
                </span>
                {monumentName(turn.response?.matched_monument_slug) && (
                  <span className="answer-card__place">
                    <Landmark size={13} />
                    {monumentName(turn.response?.matched_monument_slug)}
                  </span>
                )}
              </header>

              <p className="answer-card__summary">{turn.text}</p>

              {turn.response && turn.response.verified_history.length > 0 && (
                <div className="evidence evidence--history">
                  <div className="evidence__label">
                    <ShieldCheck size={15} />
                    {ui.recordedHistory}
                  </div>
                  {turn.response.verified_history.map((item, idx) => (
                    <div key={idx} className="evidence__item">
                      <p>{item.text}</p>
                      <cite>{item.source}</cite>
                    </div>
                  ))}
                </div>
              )}

              {turn.response && turn.response.folklore_legends.length > 0 && (
                <div className="evidence evidence--folklore">
                  <div className="evidence__label">
                    <BookOpen size={15} />
                    {ui.localFolklore}
                  </div>
                  {turn.response.folklore_legends.map((item, idx) => (
                    <div key={idx} className="evidence__item">
                      <p>{item.text}</p>
                      <cite>{item.attribution}</cite>
                    </div>
                  ))}
                </div>
              )}

              {turn.response?.is_knowledge_gap && (
                <div className="gap-notice">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{turn.fromDevice ? ui.gapNoticeOffline : ui.gapNotice}</span>
                </div>
              )}

              <footer className="answer-card__actions">
                <button
                  type="button"
                  className={`soft-btn ${
                    turnAudioStatus === 'playing'
                      ? 'is-playing'
                      : turnAudioStatus === 'loading'
                        ? 'is-audio-loading'
                        : ''
                  }`}
                  onClick={() => handleReadAloud(turn)}
                >
                  {turnAudioStatus === 'loading' ? (
                    <>
                      <Loader2 size={16} className="spin-icon" />
                      {ui.loadingAudio}
                    </>
                  ) : turnAudioStatus === 'playing' ? (
                    <>
                      <span className="audio-eq" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      {ui.stopAudio}
                    </>
                  ) : (
                    <>
                      <Volume2 size={16} />
                      {ui.readAloud}
                    </>
                  )}
                </button>
              </footer>

              {turn.response && turn.response.follow_up_suggestions.length > 0 && (
                <div className="followups">
                  {turn.response.follow_up_suggestions.map((sug) => (
                    <button key={sug} type="button" className="followup-chip" onClick={() => sendQuestion(sug)}>
                      {sug}
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}

        {loading && (
          <div className="answer-card answer-card--loading" role="status">
            <span className="typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>{ui.searchingRecords}</span>
          </div>
        )}
      </div>

      {voiceStatus && (
        <div className={`voice-status ${recording || transcribing ? 'is-live' : 'is-warn'}`} role="status">
          {voiceStatus}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
      >
        <button
          type="button"
          className={`composer__mic ${recording ? 'is-recording' : ''}`}
          disabled={transcribing}
          onClick={handleToggleMic}
          aria-label={recording ? 'Stop voice recording' : 'Speak your question'}
        >
          {transcribing ? <Loader2 size={20} className="spin-icon" /> : recording ? <Square size={18} /> : <Mic size={20} />}
        </button>
        <input
          type="text"
          className="composer__input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (voiceStatus && !recording && !transcribing) setVoiceStatus('');
          }}
          placeholder={ui.chatPlaceholder}
          aria-label={ui.chatPlaceholder}
        />
        <button type="submit" className="composer__send" disabled={!input.trim() || loading} aria-label="Send question">
          <Send size={19} />
        </button>
      </form>
    </div>
  );
}
