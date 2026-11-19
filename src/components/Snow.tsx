// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const FLAKES = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 0.7) % 10,
  duration: 8 + ((i * 13) % 10),
  size: 6 + ((i * 7) % 10),
  // Two in three are six-armed crystals, drawn a bit larger so their shape reads.
  crystal: i % 3 !== 0,
}));

function Crystal({ size }: { size: number }) {
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size}>
      <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none">
        {[0, 60, 120].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d="M0 -10V10" />
            <path d="M-3 -7L0 -4L3 -7M-3 7L0 4L3 7" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => {
        const style = { left: `${f.left}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` };
        return f.crystal ? (
          <span key={i} className="flake crystal" style={style}>
            <Crystal size={f.size + 8} />
          </span>
        ) : (
          <span key={i} className="flake dot" style={{ ...style, width: f.size, height: f.size }} />
        );
      })}
    </div>
  );
}
