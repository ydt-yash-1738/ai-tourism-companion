import { useEffect, useId, useRef, useState } from 'react';

/**
 * "Raahi" — the app's travel guide, drawn as a stylised 3D character.
 * Pure SVG shaded with gradients (no WebGL, ~10 KB) and animated with CSS:
 * breathes, blinks and waves now and then when idle; nods, talks and
 * gestures with both hands while speaking.
 */
interface GuideAvatarProps {
  speaking?: boolean;
  size?: number;
  /** 'bust' shows head, shoulders and hands; 'head' crops to the face for small chips */
  variant?: 'bust' | 'head';
  className?: string;
}

export const AVATAR_NAME = 'Raahi';

const BUST = { x: 0, y: 6, w: 240, h: 274 };
const HEAD = { x: 54, y: 22, w: 132, h: 156 };

function Hand({ id, mirrored }: { id: (n: string) => string; mirrored?: boolean }) {
  // An open palm raised from below the frame; the mirrored copy points with its index finger.
  return (
    <g transform={mirrored ? 'translate(240 0) scale(-1 1)' : undefined}>
      {/* sleeve */}
      <path d="M14 300 C18 274 30 254 42 242 L72 250 C68 266 66 284 66 300 Z" fill={`url(#${id('sleeve')})`} />
      <path d="M40 240 C48 236 64 240 74 248 L71 258 C62 251 50 248 39 250 Z" fill="#1c1f26" />
      {/* palm */}
      <ellipse cx="58" cy="230" rx="15" ry="16" fill={`url(#${id('hand')})`} />
      {/* thumb */}
      <ellipse cx="73" cy="234" rx="5.5" ry="10" transform="rotate(38 73 234)" fill={`url(#${id('hand')})`} />
      {mirrored ? (
        <>
          {/* index finger up, the rest curled */}
          <rect x="45.5" y="196" width="7.5" height="26" rx="3.75" transform="rotate(-6 49 222)" fill={`url(#${id('hand')})`} />
          <ellipse cx="57" cy="219" rx="5" ry="6" fill="#d9976a" />
          <ellipse cx="64" cy="221" rx="4.6" ry="5.6" fill="#d9976a" />
          <ellipse cx="69" cy="224" rx="4" ry="5" fill="#d9976a" />
        </>
      ) : (
        <>
          <rect x="42" y="203" width="7" height="22" rx="3.5" transform="rotate(-14 45 225)" fill={`url(#${id('hand')})`} />
          <rect x="50" y="198" width="7" height="25" rx="3.5" transform="rotate(-5 53 223)" fill={`url(#${id('hand')})`} />
          <rect x="58" y="199" width="7" height="24" rx="3.5" transform="rotate(4 61 223)" fill={`url(#${id('hand')})`} />
          <rect x="65" y="204" width="6.4" height="20" rx="3.2" transform="rotate(13 68 224)" fill={`url(#${id('hand')})`} />
        </>
      )}
      {/* soft shading where the palm meets the wrist */}
      <ellipse cx="58" cy="243" rx="12" ry="4" fill="#9c5f3c" opacity="0.22" />
    </g>
  );
}

/** The drawn Raahi: used where WebGL is unavailable or the 3D model fails to load. */
export function GuideAvatarSvg({ speaking = false, size = 120, variant = 'bust', className = '' }: GuideAvatarProps) {
  // gradient ids must be unique per instance: several avatars share a page
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `raahi-${uid}-${name}`;
  const box = variant === 'head' ? HEAD : BUST;

  return (
    <svg
      className={`guide-avatar guide-avatar--${variant} ${speaking ? 'is-speaking' : ''} ${className}`}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      width={size}
      height={size * (box.h / box.w)}
      role="img"
      aria-label={`${AVATAR_NAME}, your heritage guide${speaking ? ', speaking' : ''}`}
    >
      <defs>
        <radialGradient id={id('skin')} cx="0.4" cy="0.34" r="0.75">
          <stop offset="0%" stopColor="#f6cba4" />
          <stop offset="55%" stopColor="#e2a57a" />
          <stop offset="100%" stopColor="#bf7d55" />
        </radialGradient>
        <radialGradient id={id('hand')} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#f4c49c" />
          <stop offset="100%" stopColor="#cf8f63" />
        </radialGradient>
        <linearGradient id={id('neck')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9774f" />
          <stop offset="100%" stopColor="#d39468" />
        </linearGradient>
        <radialGradient id={id('hair')} cx="0.35" cy="0.2" r="0.9">
          <stop offset="0%" stopColor="#9a6a43" />
          <stop offset="55%" stopColor="#6b4428" />
          <stop offset="100%" stopColor="#3e2616" />
        </radialGradient>
        <linearGradient id={id('beard')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a4a33" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4a3020" />
        </linearGradient>
        <radialGradient id={id('hoodie')} cx="0.5" cy="0.15" r="0.95">
          <stop offset="0%" stopColor="#4a505d" />
          <stop offset="100%" stopColor="#22252d" />
        </radialGradient>
        <linearGradient id={id('sleeve')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#262a32" />
          <stop offset="60%" stopColor="#464c58" />
          <stop offset="100%" stopColor="#2b2f38" />
        </linearGradient>
        <radialGradient id={id('iris')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#8a5a34" />
          <stop offset="100%" stopColor="#3a2112" />
        </radialGradient>
      </defs>

      <g className="guide-avatar__body">
        {/* hoodie: torso, hood rim around the neck, drawstrings */}
        <path d="M14 290 C18 228 60 198 98 190 L142 190 C180 198 222 228 226 290 Z" fill={`url(#${id('hoodie')})`} />
        <rect x="103" y="148" width="34" height="48" rx="15" fill={`url(#${id('neck')})`} />
        <path d="M76 184 C80 214 160 214 164 184 C170 196 166 222 120 226 C74 222 70 196 76 184 Z" fill="#2c3039" />
        <path d="M84 190 C92 210 148 210 156 190" stroke="#3c414c" strokeWidth="3" fill="none" />
        <path d="M108 210 C107 224 105 238 104 250" stroke="#eef0f3" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M132 210 C133 224 135 238 136 250" stroke="#eef0f3" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <rect x="101.6" y="249" width="5" height="9" rx="2" fill="#c9ccd2" />
        <rect x="133.4" y="249" width="5" height="9" rx="2" fill="#c9ccd2" />
      </g>

      <g className="guide-avatar__head">
        {/* ears */}
        <ellipse cx="67" cy="114" rx="10.5" ry="14.5" fill="#d8996c" />
        <ellipse cx="69" cy="115" rx="5" ry="8" fill="#b9774f" opacity="0.55" />
        <ellipse cx="173" cy="114" rx="10.5" ry="14.5" fill="#d8996c" />
        <ellipse cx="171" cy="115" rx="5" ry="8" fill="#b9774f" opacity="0.55" />

        {/* face */}
        <ellipse cx="120" cy="108" rx="52" ry="60" fill={`url(#${id('skin')})`} />
        <ellipse cx="96" cy="78" rx="18" ry="9" fill="#ffffff" opacity="0.18" />

        {/* beard along the jaw, moustache */}
        <path
          d="M70 120 C70 154 92 175 120 175 C148 175 170 154 170 120 C165 136 155 143 146 142 C138 155 102 155 94 142 C85 143 75 136 70 120 Z"
          fill={`url(#${id('beard')})`}
        />
        <path d="M100 135 C108 128 116 130 120 132 C124 130 132 128 140 135 C134 137 126 137 120 136 C114 137 106 137 100 135 Z" fill="#4a3020" />

        {/* mouth: smile when idle, animated when speaking */}
        <g className="guide-avatar__smile">
          <path d="M105 141 Q120 155 135 141 Q120 147 105 141 Z" fill="#ffffff" />
          <path d="M105 141 Q120 155 135 141" stroke="#7a3a2a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
        <g className="guide-avatar__talk">
          <g className="guide-avatar__talk-inner">
            <ellipse cx="120" cy="144" rx="10" ry="7.5" fill="#5a1f17" />
            <ellipse cx="120" cy="148" rx="6" ry="3" fill="#d76a5b" />
            <path d="M111.5 140.6 Q120 138.6 128.5 140.6" stroke="#ffffff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </g>
        </g>

        {/* nose */}
        <path d="M117 108 Q110 124 117 128 Q123 130 127 126" stroke="#a9653f" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse cx="121" cy="116" rx="3" ry="6" fill="#ffffff" opacity="0.22" />
        {/* cheeks */}
        <ellipse cx="88" cy="126" rx="9" ry="6" fill="#ec8f7a" opacity="0.28" />
        <ellipse cx="152" cy="126" rx="9" ry="6" fill="#ec8f7a" opacity="0.28" />

        {/* eyes */}
        <g className="guide-avatar__eye">
          <ellipse cx="98" cy="104" rx="9.5" ry="10" fill="#ffffff" />
          <circle cx="99" cy="105" r="6.2" fill={`url(#${id('iris')})`} />
          <circle cx="99" cy="105" r="3" fill="#1a0f08" />
          <circle cx="101.4" cy="102.4" r="1.9" fill="#ffffff" />
        </g>
        <g className="guide-avatar__eye">
          <ellipse cx="142" cy="104" rx="9.5" ry="10" fill="#ffffff" />
          <circle cx="143" cy="105" r="6.2" fill={`url(#${id('iris')})`} />
          <circle cx="143" cy="105" r="3" fill="#1a0f08" />
          <circle cx="145.4" cy="102.4" r="1.9" fill="#ffffff" />
        </g>

        {/* brows */}
        <g className="guide-avatar__brows" fill="#4a2d18">
          <path d="M82 88 C90 80 104 80 112 86 C104 85 92 86 84 92 Z" />
          <path d="M158 88 C150 80 136 80 128 86 C136 85 148 86 156 92 Z" />
        </g>

        {/* round glasses */}
        <g className="guide-avatar__glasses" fill="none" stroke="#5b3a22" strokeWidth="4.2">
          <circle cx="98" cy="105" r="17" fill="#ffffff" fillOpacity="0.06" />
          <circle cx="142" cy="105" r="17" fill="#ffffff" fillOpacity="0.06" />
          <path d="M115 103 Q120 99 125 103" />
          <path d="M81 101 L70 98" />
          <path d="M159 101 L170 98" />
        </g>
        <path d="M86 96 Q92 90 99 90" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" fill="none" />
        <path d="M130 96 Q136 90 143 90" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" fill="none" />

        {/* swept quiff with a side part */}
        <path
          d="M66 108 C58 74 68 50 90 40 C96 28 112 20 128 22 C138 16 154 18 162 28 C178 36 184 62 175 108 C171 88 164 76 154 70 C142 64 126 66 112 68 C92 70 74 82 66 108 Z"
          fill={`url(#${id('hair')})`}
        />
        {/* swept-up front locks */}
        <path d="M84 58 C86 34 108 20 132 22 C126 30 124 38 126 46 C116 42 102 44 94 52 Z" fill="#7c5132" />
        <path d="M118 48 C120 30 138 18 160 26 C170 32 174 44 172 56 C160 44 146 42 132 46 Z" fill="#6e4729" />
        <path d="M96 46 C106 32 122 26 136 26" stroke="#c08d5e" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.75" />
        <path d="M130 40 C140 30 154 30 164 38" stroke="#b07e52" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M100 58 C110 50 124 48 134 50" stroke="#a87650" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.55" />
        <path d="M138 52 C150 50 162 56 168 66" stroke="#4a2d18" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
        {/* sideburns joining the beard */}
        <path d="M66 104 C66 112 68 118 70 122 L74 104 Z" fill="#4a3020" />
        <path d="M174 104 C174 112 172 118 170 122 L166 104 Z" fill="#4a3020" />
      </g>

      {variant === 'bust' && (
        <>
          <g className="guide-avatar__hand guide-avatar__hand--left">
            <Hand id={id} />
          </g>
          <g className="guide-avatar__hand guide-avatar__hand--right">
            <Hand id={id} mirrored />
          </g>
        </>
      )}
    </svg>
  );
}

type AvatarController = { setSpeaking: (next: boolean) => void; detach: () => void };

/**
 * Raahi as a 3D model (public/models/raahi.glb), drawn by a shared WebGL renderer
 * that is loaded on first use. Falls back to the drawn avatar without WebGL.
 */
export function GuideAvatar({ speaking = false, size = 120, variant = 'bust', className = '' }: GuideAvatarProps) {
  const box = variant === 'head' ? HEAD : BUST;
  const width = size;
  const height = size * (box.h / box.w);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const speakingRef = useRef(speaking);

  useEffect(() => {
    speakingRef.current = speaking;
    controllerRef.current?.setSpeaking(speaking);
  }, [speaking]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    import('../avatar3d/raahiEngine')
      .then(async (engine) => {
        if (!engine.isWebGLAvailable()) throw new Error('no webgl');
        const ctl = await engine.attachAvatar(canvas, variant, speakingRef.current);
        if (cancelled) {
          ctl.detach();
          return;
        }
        controllerRef.current = ctl;
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('fallback');
      });
    return () => {
      cancelled = true;
      controllerRef.current?.detach();
      controllerRef.current = null;
    };
  }, [variant]);

  if (state === 'fallback') {
    return <GuideAvatarSvg speaking={speaking} size={size} variant={variant} className={className} />;
  }
  return (
    <canvas
      ref={canvasRef}
      className={`guide-avatar guide-avatar--3d guide-avatar--${variant} ${state === 'ready' ? 'is-ready' : 'is-loading'} ${speaking ? 'is-speaking' : ''} ${className}`}
      style={{ width, height }}
      role="img"
      aria-label={`${AVATAR_NAME}, your heritage guide${speaking ? ', speaking' : ''}`}
    />
  );
}
