// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useEffect, useState } from 'react';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const RED = '#C8372D';
const RED_SHADE = '#A92E25';
const FUR = '#FFF8EC';
const FUR_LINE = '#E3D3BA';
const SKIN = '#F6C9A8';

/** Fluffy fur trim: a thick band plus round bumps along the same path (dash trick). */
function Fur({ d, width = 12 }: { d: string; width?: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={FUR_LINE} strokeWidth={width + 3} />
      <path d={d} stroke={FUR} strokeWidth={width} />
      <path d={d} stroke={FUR} strokeWidth={width + 4} strokeDasharray={`0 ${width * 0.9}`} />
    </g>
  );
}

/** Flat 2D Santa waving with his right arm and holding a phone in his left. Decorative. */
export function Santa({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <svg className={className} viewBox="0 0 220 250" aria-hidden="true">
      <ellipse cx="110" cy="241" rx="66" ry="7" fill="#000" opacity=".08" />

      {/* boots */}
      <path d="M76 208h26v20H70q-6 0-6-6t8-6h4z" fill="#3B2A20" />
      <path d="M118 208h26v8h4q8 0 8 6t-6 6h-32z" fill="#3B2A20" />
      <path d="M72 222q8-3 14 0" stroke="#5A4232" strokeWidth="2" fill="none" />
      <path d="M134 222q8-3 14 0" stroke="#5A4232" strokeWidth="2" fill="none" />

      {/* left arm holding a phone */}
      <path d="M68 136 Q46 158 50 180" stroke={RED} strokeWidth="21" strokeLinecap="round" fill="none" />
      <path d="M66 140 Q52 156 54 176" stroke={RED_SHADE} strokeWidth="6" strokeLinecap="round" fill="none" opacity=".5" />
      <rect x="36" y="150" width="20" height="34" rx="4" fill="#3B2A20" />
      <rect x="39" y="154" width="14" height="24" rx="2" fill="#9ED0E6" />
      <path d="M46 162c-2.5-2.5-5.5 0-3 2.5l3 3 3-3c2.5-2.5-.5-5-3-2.5z" fill={RED} />
      <g className="twinkle" stroke="#E3A93B" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M30 152q-5 6 0 12" />
        <path d="M24 148q-8 10 0 20" />
      </g>
      <Fur d="M40 182h22" width={9} />
      <circle cx="50" cy="190" r="10" fill="#2F6B3A" />
      <ellipse cx="42" cy="183" rx="5" ry="6" fill="#2F6B3A" />

      {/* coat with shaded right half */}
      <path d="M62 132 Q110 112 158 132 L170 206 Q110 220 50 206 Z" fill={RED} />
      <path d="M110 120 Q140 120 158 132 L170 206 Q142 214 110 216 Z" fill={RED_SHADE} />
      <path d="M70 140 Q66 170 60 196" stroke="#E0574C" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".6" />
      <Fur d="M110 126V208" width={11} />
      <Fur d="M54 207 Q110 221 166 207" width={12} />

      {/* belt */}
      <path d="M56 168 Q110 176 164 168 L165 181 Q110 189 55 181 Z" fill="#3B2A20" />
      <rect x="97" y="166" width="26" height="22" rx="4" fill="none" stroke="#E3A93B" strokeWidth="5" />
      <path d="M100 170h6" stroke="#FFE49A" strokeWidth="2" strokeLinecap="round" />

      {/* right arm, waving from the shoulder */}
      <g>
        {!reduced && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 152 136; -16 152 136; 0 152 136"
            dur="1.4s"
            repeatCount="indefinite"
          />
        )}
        <path d="M152 136 Q176 120 180 94" stroke={RED_SHADE} strokeWidth="21" strokeLinecap="round" fill="none" />
        <Fur d="M169 95h22" width={9} />
        <circle cx="180" cy="82" r="11" fill="#2F6B3A" />
        <ellipse cx="170" cy="86" rx="4.5" ry="6" fill="#2F6B3A" transform="rotate(-25 170 86)" />
        <path d="M176 74v-4M181 73v-5M186 75v-4" stroke="#24552E" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* head */}
      <circle cx="80" cy="88" r="7" fill={SKIN} />
      <circle cx="140" cy="88" r="7" fill={SKIN} />
      <circle cx="110" cy="84" r="32" fill={SKIN} />

      {/* beard with curls */}
      <path
        d="M78 88 Q74 128 110 146 Q146 128 142 88 Q132 102 122 98 Q110 106 98 98 Q88 102 78 88 Z"
        fill={FUR}
        stroke={FUR_LINE}
        strokeWidth="2"
      />
      <g fill={FUR} stroke={FUR_LINE} strokeWidth="2">
        <circle cx="86" cy="124" r="8" />
        <circle cx="134" cy="124" r="8" />
        <circle cx="97" cy="136" r="8" />
        <circle cx="123" cy="136" r="8" />
        <circle cx="110" cy="143" r="8" />
      </g>
      <path
        d="M80 96 Q78 124 110 140 Q142 124 140 96 Q130 104 122 100 Q110 108 98 100 Q90 104 80 96 Z"
        fill={FUR}
      />
      <g stroke={FUR_LINE} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M92 116q4 4 0 8" />
        <path d="M128 116q-4 4 0 8" />
        <path d="M110 122q4 4 0 8" />
        <path d="M100 130q3 3 0 6M120 130q-3 3 0 6" />
      </g>
      {/* mouth */}
      <path d="M103 110q7 7 14 0z" fill="#8E231B" />
      {/* mustache with curled tips */}
      <path d="M110 101 Q98 90 86 99 Q82 104 78 100 Q82 110 92 106 Q102 106 110 101Z" fill={FUR} stroke={FUR_LINE} strokeWidth="2" />
      <path d="M110 101 Q122 90 134 99 Q138 104 142 100 Q138 110 128 106 Q118 106 110 101Z" fill={FUR} stroke={FUR_LINE} strokeWidth="2" />
      {/* nose */}
      <ellipse cx="110" cy="93" rx="7.5" ry="6.5" fill="#E9967A" />
      <circle cx="107.5" cy="90.5" r="2" fill="#FFF8EC" opacity=".7" />
      {/* cheeks */}
      <circle cx="88" cy="93" r="6.5" fill="#F2A08A" opacity=".7" />
      <circle cx="132" cy="93" r="6.5" fill="#F2A08A" opacity=".7" />
      {/* eyes behind round glasses */}
      <path d="M94 82 q5 -6 10 0" stroke="#3B2A20" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M116 82 q5 -6 10 0" stroke="#3B2A20" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <g fill="#FFFFFF" fillOpacity=".25" stroke="#E3A93B" strokeWidth="2.5">
        <circle cx="99" cy="81" r="9" />
        <circle cx="121" cy="81" r="9" />
      </g>
      <path d="M108 80q2-2 4 0" stroke="#E3A93B" strokeWidth="2.5" fill="none" />
      {/* bushy eyebrows */}
      <path d="M90 72q9-6 17 0" stroke={FUR} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M113 72q8-6 17 0" stroke={FUR} strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* hat with a fold and fluffy pompom */}
      <path d="M80 64 Q92 18 146 26 Q166 30 170 46 L156 50 Q148 40 138 42 Q142 54 140 64 Z" fill={RED} />
      <path d="M138 42 Q142 54 140 64 L126 64 Q132 50 138 42Z" fill={RED_SHADE} />
      <path d="M96 40 Q110 28 128 30" stroke="#E0574C" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".6" />
      <Fur d="M80 63H140" width={14} />
      <g fill={FUR} stroke={FUR_LINE} strokeWidth="2">
        <circle cx="166" cy="52" r="9" />
        <circle cx="172" cy="46" r="6" />
        <circle cx="160" cy="46" r="6" />
        <circle cx="167" cy="58" r="6" />
      </g>
      <circle cx="165" cy="51" r="8" fill={FUR} />
    </svg>
  );
}
