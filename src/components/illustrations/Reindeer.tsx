// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** Flat 2D reindeer head. Decorative. */
export function Reindeer({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 150" aria-hidden="true">
      {/* antlers */}
      <path
        d="M52 46C40 34 36 18 40 6M46 30c-8-2-14-8-16-16M60 40c-4-12 0-24 8-30"
        stroke="#8A5A3B"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M108 46c12-12 16-28 12-40M114 30c8-2 14-8 16-16M100 40c4-12 0-24-8-30"
        stroke="#8A5A3B"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      {/* ears */}
      <ellipse cx="42" cy="62" rx="16" ry="8" transform="rotate(-20 42 62)" fill="#B07A52" />
      <ellipse cx="118" cy="62" rx="16" ry="8" transform="rotate(20 118 62)" fill="#B07A52" />
      {/* head */}
      <path d="M80 40c26 0 38 20 36 46-2 28-16 50-36 50S46 114 44 86c-2-26 10-46 36-46z" fill="#B07A52" />
      <ellipse cx="80" cy="112" rx="24" ry="18" fill="#E2C29E" />
      <circle cx="66" cy="78" r="5" fill="#3B2A20" />
      <circle cx="94" cy="78" r="5" fill="#3B2A20" />
      <circle cx="68" cy="76" r="1.6" fill="#fff" />
      <circle cx="96" cy="76" r="1.6" fill="#fff" />
      <circle className="reindeer-nose" cx="80" cy="102" r="11" fill="#C8372D" />
      <circle cx="76" cy="98" r="3" fill="#fff" opacity=".6" />
      <path d="M72 120q8 6 16 0" stroke="#3B2A20" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* bell collar */}
      <path d="M58 132q22 12 44 0" stroke="#2F6B3A" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="80" cy="142" r="6" fill="#E3A93B" />
    </svg>
  );
}
