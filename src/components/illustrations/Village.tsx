// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useSyncExternalStore } from 'react';
import { t as text } from '../../i18n.ts';

/**
 * North Pole village skyline. Decorative.
 * Blue mountains sit behind the village so the white snow reads against the beige page.
 * Trees stand on the hill line (their base sits a few units below it).
 * Hills and mountains extend far past the viewBox so wide screens never show an edge.
 */

const SNOW = '#FBFDFF';
const SNOW_SHADE = '#D3E1EC';
const SNOW_DEEP = '#B4C9DA';
const FAR = -2400;
const NEAR = 3600;

/** Deterministic jagged range: alternating valleys and peaks with snow caps on each peak. */
function mountainRange(baseY: number, step: number, amp: number, seed: number) {
  const pts: [number, number][] = [];
  for (let i = 0, x = FAR; x <= NEAR; i++, x += step) {
    const jitter = Math.sin(i * 1.7 + seed) * step * 0.2;
    const peak = i % 2 === 1;
    const y = peak
      ? baseY - amp * (0.6 + 0.4 * Math.abs(Math.sin(i * seed)))
      : baseY - amp * 0.18 * Math.abs(Math.cos(i * seed));
    pts.push([x + jitter, y]);
  }
  const f = (n: number) => n.toFixed(1);
  const body = `M${FAR} 220 ` + pts.map(([x, y]) => `L${f(x)} ${f(y)}`).join(' ') + ` L${NEAR} 220Z`;
  const caps = pts
    .map(([px, py], i) => {
      if (i % 2 === 0 || i === pts.length - 1) return '';
      const [lx, ly] = pts[i - 1];
      const [rx, ry] = pts[i + 1];
      const t = 0.32;
      const ax = px + (lx - px) * t;
      const ay = py + (ly - py) * t;
      const bx = px + (rx - px) * t;
      const by = py + (ry - py) * t;
      // zigzag lower edge of the cap, from right back to left
      const z1x = bx + (ax - bx) * 0.33;
      const z2x = bx + (ax - bx) * 0.66;
      const zy = (ay + by) / 2;
      return `M${f(ax)} ${f(ay)}L${f(px)} ${f(py)}L${f(bx)} ${f(by)}L${f(z1x)} ${f(zy - 5)}L${f(z2x)} ${f(zy + 2)}Z`;
    })
    .join('');
  return { body, caps };
}

const BACK = mountainRange(178, 95, 96, 0.9);
const FRONT = mountainRange(186, 72, 72, 2.3);

/** White bumps along a line, with a blue shadow just below. */
function snowEdge(x0: number, x1: number, y: number, bumps: number, h = 6) {
  const w = (x1 - x0) / bumps;
  let d = `M${x0} ${y}`;
  for (let i = 0; i < bumps; i++) d += `q${w / 2} ${-h} ${w} 0`;
  return `${d}v5H${x0}z`;
}

function Tree({ x, y, s = 1, star = false }: { x: number; y: number; s?: number; star?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-5" y="44" width="10" height="12" fill="#7A5236" />
      <ellipse cx="0" cy="56" rx="30" ry="4.5" fill={SNOW} />
      {/* tiers, each with a darker right half */}
      <path d="M0 8L38 48H-38z" fill="#2F6B3A" />
      <path d="M0 8L38 48H0z" fill="#24552E" />
      <path d={snowEdge(-40, 40, 49, 6)} fill={SNOW_SHADE} transform="translate(0 2)" />
      <path d={snowEdge(-40, 40, 49, 6)} fill={SNOW} />
      <path d="M0 -10L30 28H-30z" fill="#2F6B3A" />
      <path d="M0 -10L30 28H0z" fill="#24552E" />
      <path d={snowEdge(-31, 31, 29, 5)} fill={SNOW} />
      <path d="M0 -26L21 6H-21z" fill="#2F6B3A" />
      <path d="M0 -26L21 6H0z" fill="#24552E" />
      <path d={snowEdge(-22, 22, 7, 4)} fill={SNOW} />
      <path d="M0 -26L8 -14c-4 3-12 3-16 0z" fill={SNOW} />
      {/* baubles */}
      <circle cx="-14" cy="20" r="3.2" fill="#C8372D" />
      <circle cx="12" cy="14" r="3.2" fill="#E3A93B" />
      <circle cx="-6" cy="38" r="3.2" fill="#E3A93B" />
      <circle cx="20" cy="40" r="3.2" fill="#C8372D" />
      <circle cx="6" cy="-4" r="2.6" fill="#C8372D" />
      {star && (
        <path className="twinkle" d="M0 -40l3.5 7.5 8 1-6 5.5 1.6 8L0 -22l-7.1 4 1.6-8-6-5.5 8-1z" fill="#E3A93B" />
      )}
    </g>
  );
}

const LIGHT_COLORS = ['#C8372D', '#E3A93B', '#3C8D4A'];

function Cabin({ x, y, wall, door = '#5A3A26' }: { x: number; y: number; wall: string; door?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* chimney smoke */}
      <g className="smoke" fill="#E7EEF4">
        <circle cx="56" cy="-18" r="5" />
        <circle cx="61" cy="-28" r="6.5" />
        <circle cx="57" cy="-40" r="8" />
      </g>
      <rect x="50" y="-6" width="11" height="18" fill="#8E231B" />
      <rect x="48" y="-11" width="15" height="7" rx="3.5" fill={SNOW} />
      {/* walls with log lines */}
      <rect x="0" y="20" width="70" height="48" fill={wall} />
      <g stroke="#000" strokeOpacity=".12" strokeWidth="1.5">
        <path d="M0 30h70M0 40h70M0 50h70M0 60h70" />
      </g>
      {/* roof, snow and icicles */}
      <path d="M-8 24L35 -6 78 24z" fill="#8E231B" />
      <path d="M-11 27L35 -9 81 27c-10 5-16-2-23 3-8-4-14 3-23-1-8 4-14-3-23 1-8-4-14 2-23-3z" fill={SNOW_SHADE} transform="translate(0 2)" />
      <path d="M-11 27L35 -9 81 27c-10 5-16-2-23 3-8-4-14 3-23-1-8 4-14-3-23 1-8-4-14 2-23-3z" fill={SNOW} />
      <path d="M2 30l2 7 2-7M20 31l2 9 2-9M44 31l2 6 2-6M64 30l2 8 2-8" fill={SNOW} />
      {/* string of lights under the eave */}
      <path d="M-2 31q9 6 18 0t18 0 18 0 18 0" stroke="#3B2A20" strokeWidth="1" fill="none" />
      {Array.from({ length: 8 }, (_, i) => (
        <circle
          key={i}
          cx={-2 + i * 9 + 4.5}
          cy={33.5}
          r="2.3"
          fill={LIGHT_COLORS[i % 3]}
          className={`bulb bulb-${i % 3}`}
        />
      ))}
      {/* window with frame */}
      <rect x="9" y="38" width="20" height="16" rx="2" fill="#F4D27A" className="window-glow" />
      <path d="M19 38v16M9 46h20" stroke="#8A5A3B" strokeWidth="2" />
      <rect x="7" y="53" width="24" height="4" rx="2" fill={SNOW} />
      {/* door and wreath */}
      <rect x="42" y="40" width="18" height="28" rx="9" fill={door} />
      <circle cx="51" cy="51" r="5.5" fill="none" stroke="#2F6B3A" strokeWidth="3" />
      <path d="M48 56l3-2 3 2-1 3-2-2-2 2z" fill="#C8372D" />
      <circle cx="56" cy="60" r="1.6" fill="#E3A93B" />
      {/* snow drift at the base */}
      <ellipse cx="35" cy="69" rx="44" ry="5" fill={SNOW} />
    </g>
  );
}

function Snowman({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-14 6L-30 -6M-30 -6l-4 -6M-30 -6l-6 1" stroke="#7A5236" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M14 6L30 -8M30 -8l2 -7M30 -8l7 -1" stroke="#7A5236" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="0" cy="26" r="20" fill={SNOW} stroke={SNOW_DEEP} strokeWidth="2" />
      <circle cx="0" cy="2" r="14" fill={SNOW} stroke={SNOW_DEEP} strokeWidth="2" />
      <circle cx="0" cy="-19" r="11" fill={SNOW} stroke={SNOW_DEEP} strokeWidth="2" />
      <circle cx="-4" cy="-21" r="1.8" fill="#3B2A20" />
      <circle cx="4" cy="-21" r="1.8" fill="#3B2A20" />
      <path d="M0 -17l10 3-10 1z" fill="#E8833A" />
      <path d="M-4 -12q4 3 8 0" stroke="#3B2A20" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* scarf */}
      <path d="M-11 -9q11 6 22 0v5q-11 6-22 0z" fill="#C8372D" />
      <path d="M5 -5l5 14-6 1-3-13z" fill="#C8372D" />
      <path d="M5 8l5 1M4 6l6 1" stroke="#FFF8EC" strokeWidth="1" />
      {/* hat */}
      <rect x="-12" y="-30" width="24" height="4" rx="2" fill="#3B2A20" />
      <rect x="-8" y="-44" width="16" height="15" rx="2" fill="#3B2A20" />
      <rect x="-8" y="-34" width="16" height="3.5" fill="#C8372D" />
      <circle cx="0" cy="0" r="1.8" fill="#3B2A20" />
      <circle cx="0" cy="8" r="1.8" fill="#3B2A20" />
      <circle cx="0" cy="22" r="1.8" fill="#3B2A20" />
    </g>
  );
}

function Lamppost({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="0" r="18" fill="#F4D27A" opacity=".35" className="window-glow" />
      <rect x="-2.5" y="8" width="5" height="76" fill="#24552E" />
      <path d="M-2.5 30l5 -5M-2.5 44l5 -5M-2.5 58l5 -5" stroke="#C8372D" strokeWidth="2.5" />
      <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#F4D27A" stroke="#24552E" strokeWidth="3" />
      <path d="M-11 -9h22l-11 -8z" fill="#24552E" />
      <path d="M-12 -10q12 -12 24 0q-12 -4 -24 0z" fill={SNOW} />
      <rect x="-9" y="80" width="18" height="6" rx="3" fill="#24552E" />
    </g>
  );
}

function Signpost({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <pattern id="candy" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill="#FFF8EC" />
          <rect width="7" height="14" fill="#C8372D" />
        </pattern>
      </defs>
      <rect x="-6" y="0" width="12" height="110" rx="6" fill="url(#candy)" />
      <circle cx="0" cy="-4" r="9" fill="#E3A93B" />
      <path d="M-7 -9q7 -7 14 0q-7 -2 -14 0z" fill={SNOW} />
      <path d="M-8 12h112l12 12-12 12h-112z" fill="#FFF8EC" stroke="#8E231B" strokeWidth="3" />
      <path d="M-8 13h112l3 3c-30 -3 -80 3 -115 -1z" fill={SNOW} />
      <text x="48" y="28" textAnchor="middle" className="sign-text">{text.signNorthPole}</text>
      <path d="M8 44h-74l-12 11 12 11h74z" fill="#2F6B3A" />
      <path d="M8 45h-74l-3 3c25 -3 55 2 77 -1z" fill={SNOW} />
      <text x="-32" y="59" textAnchor="middle" className="sign-text light">{text.signWorkshop}</text>
      <path d="M-8 74h72l11 10-11 10h-72z" fill="#C8372D" />
      <path d="M-8 75h72l3 3c-25 -3 -55 2 -75 -1z" fill={SNOW} />
      <text x="28" y="88" textAnchor="middle" className="sign-text light">{text.signReindeer}</text>
    </g>
  );
}

function SledWithGifts({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* gifts */}
      <rect x="6" y="-30" width="28" height="24" fill="#2F6B3A" />
      <rect x="17" y="-30" width="6" height="24" fill="#E3A93B" />
      <path d="M20 -30c-6-8-12-4-8 0zM20 -30c6-8 12-4 8 0z" fill="none" stroke="#E3A93B" strokeWidth="2.5" />
      <rect x="36" y="-20" width="22" height="14" fill="#FFF8EC" stroke="#D9C3A0" strokeWidth="1.5" />
      <rect x="44" y="-20" width="5" height="14" fill="#C8372D" />
      <rect x="22" y="-44" width="18" height="14" fill="#C8372D" />
      <rect x="29" y="-44" width="4" height="14" fill="#FFF8EC" />
      <path d="M22 -46h18v3h-18z" fill={SNOW} />
      {/* sled */}
      <path d="M0 -8h66l-4 10H6z" fill="#C8372D" />
      <path d="M2 -8h62" stroke="#8E231B" strokeWidth="2" />
      <path d="M8 2v6M58 2v6" stroke="#B8873F" strokeWidth="3" />
      <path d="M-4 8h70q10 0 10 -8" stroke="#E3A93B" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </g>
  );
}

const NARROW = '(max-width: 860px)';
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const isNarrow = () => window.matchMedia(NARROW).matches;

export function Village({ className = '' }: { className?: string }) {
  // On phones the whole scene would be tiny, so fill the height and crop the sides instead.
  const narrow = useSyncExternalStore(subscribe, isNarrow, () => false);
  return (
    <svg
      className={className}
      viewBox="0 50 1200 170"
      preserveAspectRatio={narrow ? 'xMidYMax slice' : 'xMidYMax meet'}
      aria-hidden="true"
    >
      {/* stars */}
      <g fill="#E3A93B" className="twinkle">
        <path d="M120 62l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" />
        <path d="M660 58l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path d="M1125 58l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" />
      </g>
      <g fill="#E3A93B" className="twinkle twinkle-late">
        <path d="M355 70l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z" />
        <path d="M890 56l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z" />
        <path d="M-180 66l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path d="M1380 60l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
      </g>

      {/* mountains */}
      <path d={BACK.body} fill="#AFC3D6" />
      <path d={BACK.caps} fill={SNOW} />
      <path d={FRONT.body} fill="#5B7CA1" />
      <path d={FRONT.caps} fill={SNOW} />

      {/* snowy hill the village stands on */}
      <path d="M-2400 168H0C150 140 300 158 450 150S750 136 900 150 1100 160 1200 146H3600V220H-2400z" fill={SNOW_SHADE} />
      <path d="M-2400 172H0C150 146 300 162 450 155S750 142 900 155 1100 164 1200 151H3600V220H-2400z" fill="#EAF2F8" />

      {/* outside the 0–1200 frame, seen only on wide screens */}
      <Tree x={-260} y={128} s={0.85} />
      <Tree x={-120} y={137} s={0.7} />
      <Tree x={1300} y={105} s={0.9} />
      <Tree x={1440} y={116} s={0.7} />

      <Tree x={70} y={125} s={0.75} />
      <Cabin x={150} y={108} wall="#C8372D" />
      <Tree x={290} y={102} s={1.05} star />
      <Signpost x={430} y={70} />
      <SledWithGifts x={555} y={182} />
      <Snowman x={668} y={146} />
      <Tree x={745} y={104} s={0.85} />
      <Cabin x={800} y={112} wall="#2F6B3A" door="#8E231B" />
      <Cabin x={905} y={102} wall="#B8873F" />
      <Lamppost x={1010} y={106} />
      <Tree x={1065} y={111} star />
      <Tree x={1150} y={122} s={0.7} />

      {/* front snow with a shaded lip */}
      <path d="M-2400 184H0c120-24 260-10 400-4s320 18 480 4 240-20 320-6H3600V220H-2400z" fill={SNOW_DEEP} />
      <path d="M-2400 187H0c120-24 260-10 400-4s320 18 480 4 240-20 320-6H3600V220H-2400z" fill={SNOW} />
      {/* footprints */}
      <g fill={SNOW_SHADE}>
        {Array.from({ length: 9 }, (_, i) => (
          <ellipse key={i} cx={250 + i * 22} cy={201 + (i % 2) * 5 - i * 0.6} rx="4" ry="2.2" />
        ))}
      </g>
    </svg>
  );
}
