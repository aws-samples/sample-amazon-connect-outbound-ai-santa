// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Phone rules shared with the backend: E.164 with an allowed prefix, plus a mobile check for the two
 * countries we know (+1 and +34). Pure functions, so they can be tested without amplify_outputs.json.
 */

const E164 = /^\+[1-9]\d{7,14}$/;
const MOBILE: Record<string, RegExp> = {
  '+1': /^\+1[2-9]\d{9}$/,
  '+34': /^\+34[67]\d{8}$/,
};

/** True when `phone` is E.164, starts with one of `allowed` and passes the country check when there is one. */
export function isValidPhone(phone: string, allowed: readonly string[]): boolean {
  if (!E164.test(phone)) return false;
  const prefix = prefixOf(phone, allowed);
  if (!prefix) return false;
  return MOBILE[prefix]?.test(phone) ?? true;
}

/** The longest prefix in `allowed` that `phone` starts with, or undefined. */
export function prefixOf(phone: string, allowed: readonly string[]): string | undefined {
  return [...allowed].sort((a, b) => b.length - a.length).find((p) => phone.startsWith(p));
}

/** Split a stored number into one of the allowed prefixes and the national digits. */
export function splitPhone(phone: string | null | undefined, allowed: readonly string[]): { prefix: string; digits: string } {
  const prefix = phone ? prefixOf(phone, allowed) : undefined;
  if (phone && prefix) return { prefix, digits: phone.slice(prefix.length) };
  return { prefix: allowed[0] ?? '+1', digits: '' };
}

/** How many national digits the input accepts for a prefix. */
export function nationalLength(prefix: string): number {
  if (prefix === '+1') return 10;
  if (prefix === '+34') return 9;
  // E.164 allows 15 digits in total, country code included.
  return 15 - (prefix.length - 1);
}

/** An example national number for the input placeholder. */
export function phonePlaceholder(prefix: string): string {
  if (prefix === '+1') return '2125550123';
  if (prefix === '+34') return '600123456';
  return '';
}

/** `+12125550123` → `+1 (212) 555-0123`; `+34600123456` → `+34 600 12 34 56`. Other formats unchanged. */
export function formatPhone(phone: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  if (us) return `+1 (${us[1]}) ${us[2]}-${us[3]}`;
  const es = /^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(phone);
  if (es) return `+34 ${es[1]} ${es[2]} ${es[3]} ${es[4]}`;
  return phone;
}

/**
 * A number as people write it at home: `+18005550123` → `(800) 555-0123`, `+34900123456` → `900 123 456`.
 * Other formats are returned unchanged.
 */
export function formatNationalNumber(phone: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;
  const es = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(phone);
  if (es) return `${es[1]} ${es[2]} ${es[3]}`;
  return phone;
}
