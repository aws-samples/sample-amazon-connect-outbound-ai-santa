// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { msg } from './i18n.js';

export const CHILD_NAME_MAX = 40;
export const NOTES_MAX = 300;

// Letters (any script), spaces, apostrophes and hyphens. No digits, URLs or markup.
const NAME_RE = /^[\p{L}][\p{L} '-]*$/u;
// Control characters and angle/curly brackets are removed from free text before it reaches a prompt.
const UNSAFE_CHARS_RE = /[\p{Cc}<>{}]/gu;

export type FieldResult = { ok: true; value: string } | { ok: false; error: string };

export function validateChildName(raw: unknown): FieldResult {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!value) return { ok: false, error: msg().childNameRequired };
  if (value.length > CHILD_NAME_MAX) return { ok: false, error: msg().childNameTooLong(CHILD_NAME_MAX) };
  if (!NAME_RE.test(value)) return { ok: false, error: msg().childNameChars };
  return { ok: true, value };
}

export function sanitizeFreeText(raw: unknown, max: number): string {
  const value = typeof raw === 'string' ? raw : '';
  return value.replace(UNSAFE_CHARS_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validateNotes(raw: unknown): FieldResult {
  const original = typeof raw === 'string' ? raw.trim() : '';
  if (original.length > NOTES_MAX) return { ok: false, error: msg().notesTooLong(NOTES_MAX) };
  return { ok: true, value: sanitizeFreeText(original, NOTES_MAX) };
}

export function parseList(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPhoneAllowed(phone: string, prefixesCsv: string): boolean {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return false;
  return parseList(prefixesCsv).some((p) => phone.startsWith(p));
}

/** Mobile numbers for the countries we know. Santa calls a mobile and the code goes by SMS. */
const MOBILE_RULES: Record<string, RegExp> = {
  '+1': /^\+1[2-9]\d{9}$/, // US and Canada (NANP)
  '+34': /^\+34[67]\d{8}$/, // Spain
};

/** Allowed prefix and, for known countries, the mobile number shape. Other countries: E.164 only. */
export function isMobileAllowed(phone: string, prefixesCsv: string): boolean {
  if (!isPhoneAllowed(phone, prefixesCsv)) return false;
  const rule = Object.entries(MOBILE_RULES).find(([prefix]) => phone.startsWith(prefix))?.[1];
  return rule ? rule.test(phone) : true;
}

/** True when `email` matches an entry in the allowlist: an exact address or an `@domain`. Empty list allows nobody. */
export function isEmailAllowed(email: string, allowlistCsv: string): boolean {
  const e = email.trim().toLowerCase();
  return parseList(allowlistCsv).some((entry) => (entry.startsWith('@') ? e.endsWith(entry) : e === entry));
}
