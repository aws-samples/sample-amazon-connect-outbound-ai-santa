// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** Flat 2D elf carrying a sealed letter for Santa. Decorative. */
const GREEN = '#2F6B3A';
const GREEN_SHADE = '#24552E';
const SKIN = '#F6C9A8';
const GOLD = '#E3A93B';

function Bell({ x, y, r = 4 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={GOLD} />
      <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill="#FFE49A" />
      <path d={`M${x - r * 0.5} ${y + r * 0.3}h${r}`} stroke="#B8873F" strokeWidth="1.2" />
    </g>
  );
}

export function Elf({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 170 230" aria-hidden="true">
      <ellipse cx="85" cy="222" rx="50" ry="6" fill="#000" opacity=".08" />
      <defs>
        <pattern id="elf-stripes" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="5" fill="#C8372D" />
          <rect y="5" width="10" height="5" fill="#FFF8EC" />
        </pattern>
      </defs>

      {/* striped legs */}
      <rect x="62" y="168" width="14" height="42" rx="5" fill="url(#elf-stripes)" />
      <rect x="94" y="168" width="14" height="42" rx="5" fill="url(#elf-stripes)" />

      {/* curly shoes with bells on the tips */}
      <path d="M78 206v10H52c-8 0-12-6-10-12 1-3 5-3 6 0 1 3 3 3 6 2z" fill={GREEN} />
      <path d="M92 206v10h26c8 0 12-6 10-12-1-3-5-3-6 0-1 3-3 3-6 2z" fill={GREEN_SHADE} />
      <Bell x={43} y={202} r={3.6} />
      <Bell x={127} y={202} r={3.6} />

      {/* tunic with zigzag hem and gold trim */}
      <path d="M50 176l14-74h42l14 74-10-8-10 8-10-8-10 8-10-8-10 8z" fill={GREEN} />
      <path d="M85 102h21l14 74-10-8-10 8-10-8-5 4z" fill={GREEN_SHADE} />
      <path d="M50 176l10-8 10 8 10-8 10 8 10-8 10 8 10-8" stroke={GOLD} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <g fill={GOLD}>
        <circle cx="85" cy="122" r="2.5" />
        <circle cx="85" cy="160" r="2.5" />
      </g>

      {/* belt */}
      <rect x="54" y="140" width="62" height="10" fill="#3B2A20" />
      <rect x="78" y="138" width="14" height="14" rx="2" fill="none" stroke={GOLD} strokeWidth="4" />

      {/* zigzag collar with bells */}
      <path d="M58 104l9 12 9-12 9 12 9-12 9 12 9-12v-6H58z" fill="#C8372D" />
      <Bell x={67} y={118} r={3} />
      <Bell x={85} y={118} r={3} />
      <Bell x={103} y={118} r={3} />

      {/* arms holding the letter */}
      <path d="M62 112c-12 10-14 24-6 32" stroke={GREEN} strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M108 112c12 10 14 24 6 32" stroke={GREEN_SHADE} strokeWidth="14" strokeLinecap="round" fill="none" />
      <g className="elf-letter">
        <rect x="50" y="126" width="70" height="46" rx="4" fill="#FFF8EC" stroke="#D9C3A0" strokeWidth="2" />
        <path d="M50 130l35 23 35-23" fill="none" stroke="#D9C3A0" strokeWidth="2" />
        {/* stamp */}
        <rect x="102" y="131" width="12" height="14" fill="#FFF8EC" stroke="#C8372D" strokeWidth="1.5" strokeDasharray="2 1.5" />
        <path d="M108 134l3 7h-6z" fill={GREEN} />
        {/* wax seal with a heart */}
        <circle cx="85" cy="154" r="9" fill="#A92E25" />
        <path d="M85 151c-3-3-7 0-4 3l4 4 4-4c3-3-1-6-4-3z" fill="#E0574C" />
        <path d="M58 160h16M58 165h10" stroke="#D9C3A0" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="56" cy="146" r="7" fill={SKIN} />
      <circle cx="114" cy="146" r="7" fill={SKIN} />

      {/* pointy ears */}
      <path d="M58 72l-26-18 4 10-6 2 30 14z" fill={SKIN} />
      <path d="M54 72l-14-9 2 5z" fill="#F2A08A" />
      <path d="M112 72l26-18-4 10 6 2-30 14z" fill={SKIN} />
      <path d="M116 72l14-9-2 5z" fill="#F2A08A" />

      {/* head */}
      <circle cx="85" cy="76" r="30" fill={SKIN} />
      {/* hair peeking under the hat */}
      <path d="M58 62q6 10 12 2 4 8 10 2 5 8 10 0 5 8 10 0 6 8 12 -4" fill="#A0622D" />
      {/* eyes with highlights */}
      <ellipse cx="73" cy="76" rx="4" ry="4.6" fill="#3B2A20" />
      <ellipse cx="97" cy="76" rx="4" ry="4.6" fill="#3B2A20" />
      <circle cx="74.5" cy="74.2" r="1.5" fill="#FFF" />
      <circle cx="98.5" cy="74.2" r="1.5" fill="#FFF" />
      <path d="M68 68q5-3 9 0M93 68q5-3 9 0" stroke="#A0622D" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* nose, smile, cheeks and freckles */}
      <ellipse cx="85" cy="82" rx="3.5" ry="2.8" fill="#EDA98A" />
      <path d="M75 88q10 10 20 0" stroke="#3B2A20" strokeWidth="3" fill="#8E231B" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="64" cy="86" r="5.5" fill="#F2A08A" opacity=".7" />
      <circle cx="106" cy="86" r="5.5" fill="#F2A08A" opacity=".7" />
      <g fill="#C98563">
        <circle cx="62" cy="82" r="1" />
        <circle cx="66" cy="84" r="1" />
        <circle cx="63" cy="88" r="1" />
        <circle cx="104" cy="82" r="1" />
        <circle cx="108" cy="84" r="1" />
        <circle cx="107" cy="88" r="1" />
      </g>

      {/* floppy hat with a bell */}
      <path d="M54 58c4-30 26-48 52-40 14 4 22 18 34 10-4 16-18 22-30 18 2 6 2 10 0 12z" fill={GREEN} />
      <path d="M106 18c14 4 22 18 34 10-4 16-18 22-30 18 2 6 2 10 0 12h-8c4-14 6-28 4-40z" fill={GREEN_SHADE} />
      <rect x="52" y="52" width="66" height="12" rx="6" fill="#C8372D" />
      <g fill={GOLD}>
        <circle cx="62" cy="58" r="1.8" />
        <circle cx="74" cy="58" r="1.8" />
        <circle cx="86" cy="58" r="1.8" />
        <circle cx="98" cy="58" r="1.8" />
        <circle cx="110" cy="58" r="1.8" />
      </g>
      <Bell x={142} y={28} r={7} />
    </svg>
  );
}
