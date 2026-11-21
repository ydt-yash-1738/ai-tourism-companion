import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useParallax } from '../hooks/useParallax';

/**
 * Illustrated dawn view of the Taj Mahal across the Yamuna, built from
 * independent SVG layers that drift at different speeds (scroll + tilt).
 * All layers share the viewBox "300 0 600 700" with overflow visible, so the
 * monument always fits a narrow phone while river and banks extend to any width.
 */

const VB = '300 0 600 700';

function layerStyle(scrollRate: number, tilt: number): CSSProperties {
  return { ['--k' as string]: scrollRate, ['--m' as string]: tilt } as CSSProperties;
}

function Minaret({ x, scale = 1, shade = false }: { x: number; scale?: number; shade?: boolean }) {
  const top = 492 - 184 * scale;
  const w = 9 * scale;
  const balconies = [0.27, 0.55, 0.82].map((f) => 492 - 184 * scale * f);
  return (
    <g fill={shade ? 'url(#marbleShade)' : 'url(#marble)'}>
      <polygon points={`${x - w},492 ${x + w},492 ${x + w * 0.78},${top} ${x - w * 0.78},${top}`} />
      {balconies.map((y) => (
        <rect key={y} x={x - w * 1.5} y={y} width={w * 3} height={4 * scale} rx={1} />
      ))}
      <path
        d={`M ${x - w * 1.25} ${top} C ${x - w * 1.25} ${top - 14 * scale}, ${x - w * 0.4} ${top - 22 * scale}, ${x} ${top - 26 * scale} C ${x + w * 0.4} ${top - 22 * scale}, ${x + w * 1.25} ${top - 14 * scale}, ${x + w * 1.25} ${top} Z`}
      />
      <rect x={x - 0.8} y={top - 36 * scale} width={1.6} height={11 * scale} fill="#d9b46a" />
    </g>
  );
}

function Chhatri({ x }: { x: number }) {
  return (
    <g fill="url(#marble)">
      <rect x={x - 17} y={364} width={34} height={8} />
      <path d={`M ${x - 18} 366 C ${x - 19} 346, ${x - 8} 336, ${x} 330 C ${x + 8} 336, ${x + 19} 346, ${x + 18} 366 Z`} />
      <rect x={x - 0.8} y={318} width={1.6} height={13} fill="#d9b46a" />
    </g>
  );
}

function TajMahal() {
  return (
    <g>
      {/* back minarets (further away, slightly shorter and shaded) */}
      <Minaret x={402} scale={0.88} shade />
      <Minaret x={798} scale={0.88} shade />
      {/* plinth */}
      <rect x={330} y={490} width={540} height={30} fill="url(#marbleShade)" />
      <rect x={330} y={490} width={540} height={3} fill="#fffaf2" opacity={0.7} />
      {/* main chamfered hall */}
      <polygon points="455,394 476,372 724,372 745,394 745,492 455,492" fill="url(#marble)" />
      {/* side arches, two storeys */}
      {[486, 518, 682, 714].map((x) => (
        <g key={x} fill="#cdb79c">
          <path d={`M ${x - 11} 432 V 404 Q ${x - 11} 392 ${x} 386 Q ${x + 11} 392 ${x + 11} 404 V 432 Z`} />
          <path d={`M ${x - 11} 488 V 460 Q ${x - 11} 448 ${x} 442 Q ${x + 11} 448 ${x + 11} 460 V 488 Z`} />
        </g>
      ))}
      {/* pishtaq (great central portal) */}
      <rect x={546} y={356} width={108} height={136} fill="url(#marble)" />
      <rect x={551} y={361} width={98} height={131} fill="none" stroke="#b79d7c" strokeWidth={1.4} />
      <path d="M 566 492 V 424 Q 566 394 600 380 Q 634 394 634 424 V 492 Z" fill="url(#iwan)" />
      <path d="M 584 492 V 452 Q 584 440 600 433 Q 616 440 616 452 V 492 Z" fill="#a98f70" />
      {/* drum + onion dome + finial */}
      <rect x={550} y={326} width={100} height={32} fill="url(#marbleShade)" />
      <path d="M 548 330 C 518 308, 526 258, 600 214 C 674 258, 682 308, 652 330 Z" fill="url(#dome)" />
      <path d="M 560 326 C 540 300, 552 262, 600 228" fill="none" stroke="#fffdf8" strokeWidth={2} opacity={0.55} />
      <rect x={598.6} y={178} width={2.8} height={38} fill="#d9b46a" />
      <circle cx={600} cy={196} r={3.4} fill="#d9b46a" />
      <circle cx={600} cy={186} r={2.6} fill="#d9b46a" />
      <Chhatri x={500} />
      <Chhatri x={700} />
      {/* front minarets */}
      <Minaret x={352} />
      <Minaret x={848} />
    </g>
  );
}

function SideMosque({ x, flip = false }: { x: number; flip?: boolean }) {
  const t = flip ? `translate(${2 * x},0) scale(-1,1)` : undefined;
  return (
    <g transform={t} fill="url(#sandstone)">
      <rect x={x} y={470} width={150} height={50} />
      {[x + 38, x + 75, x + 112].map((cx, i) => (
        <path
          key={cx}
          d={`M ${cx - (i === 1 ? 17 : 12)} 472 C ${cx - (i === 1 ? 18 : 13)} 456, ${cx - 6} 446, ${cx} ${i === 1 ? 438 : 446} C ${cx + 6} 446, ${cx + (i === 1 ? 18 : 13)} 456, ${cx + (i === 1 ? 17 : 12)} 472 Z`}
          fill="#f3e6d3"
        />
      ))}
      <rect x={x - 4} y={452} width={8} height={68} />
      <rect x={x + 146} y={452} width={8} height={68} />
    </g>
  );
}

function Cypress({ x, y, h, w }: { x: number; y: number; h: number; w: number }) {
  return (
    <path
      d={`M ${x} ${y} C ${x - w} ${y - h * 0.35}, ${x - w * 0.6} ${y - h * 0.8}, ${x} ${y - h} C ${x + w * 0.6} ${y - h * 0.8}, ${x + w} ${y - h * 0.35}, ${x} ${y} Z`}
    />
  );
}

export interface ParallaxSceneProps {
  variant?: 'hero' | 'banner';
  className?: string;
  children?: ReactNode;
}

export function ParallaxScene({ variant = 'hero', className = '', children }: ParallaxSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref, true);

  return (
    <div ref={ref} className={`parallax-scene parallax-scene--${variant} ${className}`}>
      <div className="parallax-scene__sky" style={layerStyle(0.6, 2)} aria-hidden="true" />

      <svg className="parallax-scene__layer" viewBox={VB} preserveAspectRatio="xMidYMax meet" overflow="visible" style={layerStyle(0.5, 4)} aria-hidden="true">
        <defs>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#ffe3a8" stopOpacity={0.95} />
            <stop offset="35%" stopColor="#ffb469" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ff8a4c" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={690} cy={470} r={230} fill="url(#sunGlow)" />
        <circle cx={690} cy={470} r={44} fill="#ffe7b8" opacity={0.95} />
        <g className="parallax-scene__stars" fill="#fff">
          {[
            [140, 70, 1.4], [260, 130, 1], [420, 60, 1.6], [520, 150, 1], [760, 90, 1.3], [880, 40, 1],
            [980, 140, 1.5], [1100, 80, 1], [330, 210, 0.9], [1040, 230, 0.9], [-120, 120, 1.3], [1320, 110, 1.2],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      </svg>

      <svg className="parallax-scene__layer" viewBox={VB} preserveAspectRatio="xMidYMax meet" overflow="visible" style={layerStyle(0.42, 6)} aria-hidden="true">
        {/* distant Agra skyline: fort ramparts and domes */}
        <path
          fill="#7a5a86"
          opacity={0.55}
          d="M -1500 520 V 488 H -300 V 470 H -260 V 456 H -230 V 470 H 60 L 80 452 H 120 L 140 470 H 250 V 496 H 950 V 478 H 990 C 990 458, 1010 448, 1020 444 C 1030 448, 1050 458, 1050 478 H 1180 V 462 H 1220 V 478 H 1500 V 468 L 1520 454 H 1560 L 1580 468 H 2700 V 520 Z"
        />
        <path fill="#5d4a76" opacity={0.6} d="M -1500 520 V 500 H 2700 V 520 Z" />
      </svg>

      <svg className="parallax-scene__layer" viewBox={VB} preserveAspectRatio="xMidYMax meet" overflow="visible" style={layerStyle(0.28, 12)} aria-hidden="true">
        <defs>
          <linearGradient id="marble" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fffaf1" />
            <stop offset="100%" stopColor="#ecdcc6" />
          </linearGradient>
          <linearGradient id="marbleShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#efe2cf" />
            <stop offset="100%" stopColor="#d9c5aa" />
          </linearGradient>
          <linearGradient id="dome" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff6e6" />
            <stop offset="55%" stopColor="#fbeedd" />
            <stop offset="100%" stopColor="#e2cba9" />
          </linearGradient>
          <linearGradient id="iwan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7ad8b" />
            <stop offset="100%" stopColor="#b39674" />
          </linearGradient>
          <linearGradient id="sandstone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a24a33" />
            <stop offset="100%" stopColor="#7c3323" />
          </linearGradient>
          <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2a06b" />
            <stop offset="18%" stopColor="#8d5b7d" />
            <stop offset="100%" stopColor="#14284a" />
          </linearGradient>
          <filter id="ripple" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>
        <rect x={-1500} y={520} width={4200} height={400} fill="url(#river)" />
        <g transform="translate(0,1040) scale(1,-1)" opacity={0.28} filter="url(#ripple)">
          <TajMahal />
        </g>
        <g className="parallax-scene__shimmer" stroke="#ffe3b5" strokeLinecap="round">
          {[540, 556, 574, 596, 620].map((y, i) => (
            <line key={y} x1={520 - i * 18} x2={680 + i * 18} y1={y} y2={y} strokeWidth={1.2} opacity={0.5 - i * 0.07} />
          ))}
        </g>
        <SideMosque x={130} />
        <SideMosque x={1070} flip />
        <TajMahal />
      </svg>

      <svg className="parallax-scene__layer" viewBox={VB} preserveAspectRatio="xMidYMax meet" overflow="visible" style={layerStyle(0.1, 24)} aria-hidden="true">
        {/* near riverbank with cypress groves */}
        <g fill="#132542">
          <path d="M -1500 1000 V 640 C -600 618, 120 628, 330 646 C 450 656, 520 664, 600 664 C 680 664, 750 656, 870 646 C 1080 628, 1800 618, 2700 640 V 1000 Z" />
          <Cypress x={318} y={652} h={150} w={22} />
          <Cypress x={292} y={652} h={112} w={18} />
          <Cypress x={346} y={656} h={96} w={16} />
          <Cypress x={882} y={652} h={150} w={22} />
          <Cypress x={908} y={652} h={112} w={18} />
          <Cypress x={854} y={656} h={96} w={16} />
          <Cypress x={150} y={646} h={190} w={28} />
          <Cypress x={1050} y={646} h={190} w={28} />
          <Cypress x={-60} y={642} h={170} w={26} />
          <Cypress x={1260} y={642} h={170} w={26} />
        </g>
      </svg>

      <div className="parallax-scene__birds" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="parallax-scene__content">{children}</div>
    </div>
  );
}
