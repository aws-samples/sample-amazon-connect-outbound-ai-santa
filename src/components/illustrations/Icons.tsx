// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** Small decorative icons for steps and headings. */
type P = { className?: string };

export const GiftIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <rect x="6" y="18" width="36" height="24" rx="3" fill="#C8372D" />
    <rect x="4" y="12" width="40" height="10" rx="3" fill="#B8302A" />
    <rect x="21" y="12" width="6" height="30" fill="#E3A93B" />
    <path d="M24 12c-6-8-14-6-12 0zM24 12c6-8 14-6 12 0z" fill="none" stroke="#E3A93B" strokeWidth="3" />
  </svg>
);

export const PhoneIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <rect x="13" y="4" width="22" height="40" rx="5" fill="#2F6B3A" />
    <rect x="16" y="9" width="16" height="26" rx="2" fill="#FFF8EC" />
    <circle cx="24" cy="39" r="2" fill="#FFF8EC" />
    <path d="M20 22l3 3 6-7" stroke="#C8372D" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

export const LetterIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <rect x="4" y="10" width="40" height="28" rx="3" fill="#FFF8EC" stroke="#B8873F" strokeWidth="2" />
    <path d="M4 13l20 14 20-14" fill="none" stroke="#B8873F" strokeWidth="2" />
    <path d="M24 28c-4-4-8 0-4 4l4 4 4-4c4-4 0-8-4-4z" fill="#C8372D" />
  </svg>
);

export const StarIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 4l6 13 14 2-10 10 2 14-12-7-12 7 2-14L4 19l14-2z" fill="#E3A93B" />
  </svg>
);

export const BellIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 6c-9 0-14 7-14 16v8l-4 6h36l-4-6v-8c0-9-5-16-14-16z" fill="#E3A93B" />
    <circle cx="24" cy="40" r="4" fill="#B8873F" />
    <path d="M18 8c-2-4 2-6 6-2 4-4 8-2 6 2" fill="#2F6B3A" />
  </svg>
);

export const ClockIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="26" r="17" fill="#FFF8EC" stroke="#B8873F" strokeWidth="2" />
    <circle cx="24" cy="26" r="13" fill="none" stroke="#E8D6B8" strokeWidth="2" strokeDasharray="2 4.8" />
    <path d="M24 17v9l6 4" fill="none" stroke="#2F6B3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="26" r="2.5" fill="#C8372D" />
    <path d="M16 6c3-2 6 0 5 3-3 0-5-1-5-3zM32 6c-3-2-6 0-5 3 3 0 5-1 5-3z" fill="#2F6B3A" />
    <circle cx="24" cy="8" r="2.5" fill="#C8372D" />
  </svg>
);

export const CalendarIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <rect x="6" y="9" width="36" height="33" rx="5" fill="#FFF8EC" stroke="#B8873F" strokeWidth="2" />
    <path d="M6 14a5 5 0 0 1 5-5h26a5 5 0 0 1 5 5v5H6z" fill="#C8372D" />
    <rect x="14" y="5" width="4" height="9" rx="2" fill="#3B2A20" />
    <rect x="30" y="5" width="4" height="9" rx="2" fill="#3B2A20" />
    <text x="24" y="37" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="15" fill="#2F6B3A">24</text>
    <path d="M36 24c4-3 7 0 4 3 3 1 1 5-3 3z" fill="#2F6B3A" />
    <circle cx="35" cy="27" r="2" fill="#C8372D" />
  </svg>
);

export const RingingPhoneIcon = ({ className = '' }: P) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path
      d="M14 10c2-2 5-2 6 1l2 6c1 2 0 4-2 5l-2 1c1 4 5 8 9 9l1-2c1-2 3-3 5-2l6 2c3 1 3 4 1 6l-3 3c-3 3-9 2-16-5S11 16 14 10z"
      fill="#C8372D"
    />
    <path d="M18 13l2 5" stroke="#E0574C" strokeWidth="2" strokeLinecap="round" />
    <g stroke="#E3A93B" strokeWidth="3" strokeLinecap="round" fill="none">
      <path d="M28 10q6 1 9 8" />
      <path d="M28 4q11 2 15 13" />
    </g>
  </svg>
);
