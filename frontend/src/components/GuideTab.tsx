import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { getUiText } from '../data/i18n';
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
  offlinePack: OfflinePack | null;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: ChatResponse;
}

export function GuideTab({
  language,
  persona,
  simpleLanguage,
  isOnline,
  sessionHash,
  monuments,
  offlinePack,
}: GuideTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const [selectedMonument, setSelectedMonument] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const browserSpeechRef = useRef<{ stop: () => void } | null>(null);
  const msgSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      browserSpeechRef.current?.stop();
    };
  }, []);

  const sendQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    setVoiceStatus('');
    const userMsg: ChatTurn = { id: `u_${++msgSeqRef.current}`, role: 'user', text: question };
    const nextHistory = [...messages, userMsg].slice(-6).map((m) => ({
      role: m.role,
      content: m.role === 'assistant' && m.response ? m.response.answer_summary : m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let res: ChatResponse;
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
        }
      } else {
        res = offlineLocalChatSearch(offlinePack, question, language, persona, simpleLanguage);
      }

      const botMsg: ChatTurn = {
        id: `a_${++msgSeqRef.current}`,
        role: 'assistant',
        text: res.answer_summary,
        response: res,
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
    if (speakingId === turn.id) {
      stopSpeaking();
      setSpeakingId(null);
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
    setSpeakingId(turn.id);
    await speakText(
      fullText,
      language,
      (active) => {
        if (!active) setSpeakingId(null);
      },
      { autoTranslate: needsAutoTranslate },
    );
  };

  return (
    <div className="tab-panel guide-layout">
      <div className="section-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
              {ui.guideHeading}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              {ui.guideSub}
            </p>
          </div>

          <select
            className="lang-select"
            value={selectedMonument}
            onChange={(e) => setSelectedMonument(e.target.value)}
            aria-label="Filter by specific monument"
          >
            <option value="">{ui.allMonuments}</option>
            {monuments.map((m) => (
              <option key={m.slug} value={m.slug}>
                {isHi && m.name_hi ? m.name_hi : m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="starter-chips">
          {ui.starters.map((q) => (
            <button key={q} type="button" className="chip-btn" onClick={() => sendQuestion(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-stream">
        {messages.map((turn) =>
          turn.role === 'user' ? (
            <div key={turn.id} className="chat-bubble is-user">
              {turn.text}
            </div>
          ) : (
            <article key={turn.id} className="chat-bubble is-assistant">
              <div className="chat-bubble__meta">
                <span>
                  {turn.response?.mode === 'gemini'
                    ? '✦ Grounded Gemini + Neon pgvector'
                    : 'Offline / Local Knowledge Cache'}
                  {turn.response?.matched_monument_slug
                    ? ` · ${turn.response.matched_monument_slug}`
                    : ''}
                </span>
                <button
                  type="button"
                  className={`pill-btn ${speakingId === turn.id ? 'is-saffron' : ''}`}
                  style={{ minHeight: 34, padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => handleReadAloud(turn)}
                >
                  {speakingId === turn.id ? <Square size={13} /> : <Volume2 size={14} />}
                  <span>{speakingId === turn.id ? ui.stopAudio : ui.readAloud}</span>
                </button>
              </div>

              <p className="chat-bubble__summary">{turn.text}</p>

              {turn.response &&
                (turn.response.verified_history.length > 0 ||
                  turn.response.folklore_legends.length > 0) && (
                  <div className="split-grid">
                    {turn.response.verified_history.length > 0 && (
                      <div className="fact-box">
                        <div className="fact-box__heading">
                          <ShieldCheck size={15} />
                          <span>{ui.recordedHistory}</span>
                        </div>
                        {turn.response.verified_history.map((item, idx) => (
                          <div key={idx} className="fact-box__item">
                            <p>{item.text}</p>
                            <cite>
                              {ui.sourceLabel}
                              {item.source}
                            </cite>
                          </div>
                        ))}
                      </div>
                    )}

                    {turn.response.folklore_legends.length > 0 && (
                      <div className="folklore-box">
                        <div className="folklore-box__heading">
                          <BookOpen size={15} />
                          <span>{ui.localFolklore}</span>
                        </div>
                        {turn.response.folklore_legends.map((item, idx) => (
                          <div key={idx} className="folklore-box__item">
                            <p>{item.text}</p>
                            <cite>
                              {ui.attributionLabel}
                              {item.attribution}
                            </cite>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              {turn.response?.is_knowledge_gap && (
                <div className="gap-notice">
                  <AlertTriangle size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                  {ui.gapNotice}
                </div>
              )}

              {turn.response && turn.response.follow_up_suggestions.length > 0 && (
                <div className="starter-chips">
                  {turn.response.follow_up_suggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className="chip-btn"
                      onClick={() => sendQuestion(sug)}
                    >
                      <Sparkles size={13} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ),
        )}

        {loading && (
          <div className="chat-bubble is-assistant">
            <Loader2 size={18} className="spin-icon" style={{ marginRight: 8 }} />
            <span>{ui.searchingRecords}</span>
          </div>
        )}
      </div>

      {voiceStatus && (
        <div
          role="status"
          style={{
            padding: '7px 12px',
            borderRadius: 12,
            fontSize: '0.82rem',
            fontWeight: 600,
            background: recording || transcribing ? 'var(--navy-tint)' : 'var(--terracotta-tint)',
            color: recording || transcribing ? 'var(--navy)' : 'var(--terracotta)',
          }}
        >
          {voiceStatus}
        </div>
      )}

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
      >
        <button
          type="button"
          className={`pill-btn ${recording ? 'mic-recording' : ''}`}
          disabled={transcribing}
          onClick={handleToggleMic}
          aria-label={recording ? 'Stop voice recording' : 'Speak your question'}
          title={recording ? 'Stop recording' : 'Speak (Sarvam AI / Device Mic)'}
        >
          {transcribing ? (
            <Loader2 size={17} className="spin-icon" />
          ) : recording ? (
            <Square size={17} />
          ) : (
            <Mic size={17} />
          )}
        </button>

        <input
          type="text"
          className="chat-composer__input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (voiceStatus && !recording && !transcribing) setVoiceStatus('');
          }}
          placeholder={ui.chatPlaceholder}
        />

        <button
          type="submit"
          className="pill-btn is-saffron"
          disabled={!input.trim() || loading}
          aria-label="Send question"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
