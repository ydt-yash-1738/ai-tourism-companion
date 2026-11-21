import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { GuideAvatar } from './GuideAvatar';

interface AvatarCaptionProps {
  text: string;
  /** 'idle' shows the opening line; 'loading' a waiting hint; 'playing' follows the voice */
  status: 'idle' | 'loading' | 'playing';
  progress: number;
  idleHint?: string;
  fullTextLabel?: string;
  size?: number;
  tone?: 'light' | 'dark';
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}

/** Raahi with a speech bubble at his mouth that shows the sentence being spoken. */
export function AvatarCaption({
  text,
  status,
  progress,
  idleHint,
  fullTextLabel = 'Read full text',
  size = 92,
  tone = 'light',
}: AvatarCaptionProps) {
  const [showFull, setShowFull] = useState(false);
  const sentences = useMemo(() => splitSentences(text), [text]);
  const ends = useMemo(
    () => sentences.reduce<number[]>((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s.length], []),
    [sentences],
  );
  const total = ends[ends.length - 1] || 1;
  const idx = status === 'playing' ? Math.max(0, ends.findIndex((e) => e >= progress * total)) : 0;

  return (
    <div className={`avatar-caption is-${tone}`}>
      <div className="avatar-caption__row">
        <GuideAvatar speaking={status === 'playing'} size={size} className="avatar-caption__avatar" />
        <div className="avatar-caption__bubble" aria-live="polite">
          <p key={`${status}-${idx}`} className="avatar-caption__line">
            {sentences[idx]}
          </p>
          <div className="avatar-caption__meta">
            {status === 'idle' && idleHint ? (
              <span>{idleHint}</span>
            ) : (
              <span className="avatar-caption__dots" aria-hidden="true">
                {sentences.map((_, i) => (
                  <i key={i} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''} />
                ))}
              </span>
            )}
            {sentences.length > 1 && (
              <button type="button" className="avatar-caption__toggle" onClick={() => setShowFull((v) => !v)}>
                {fullTextLabel}
                {showFull ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>
      {showFull && <p className="avatar-caption__full">{text}</p>}
    </div>
  );
}
