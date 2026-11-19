// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
export const CHILD_NAME_MAX = 40;
export const NOTES_MAX = 300;

// Letters (any script), spaces, apostrophes and hyphens. No digits, URLs or markup.
const NAME_RE = /^[\p{L}][\p{L} '-]*$/u;
// Control characters and angle/curly brackets are removed from free text before it reaches a prompt.
const UNSAFE_CHARS_RE = /[\p{Cc}<>{}]/gu;

export type FieldResult = { ok: true; value: string } | { ok: false; error: string };

export function validateChildName(raw: unknown): FieldResult {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!value) return { ok: false, error: 'Escribe el nombre del niño o la niña.' };
  if (value.length > CHILD_NAME_MAX) return { ok: false, error: `El nombre admite ${CHILD_NAME_MAX} caracteres como máximo.` };
  if (!NAME_RE.test(value)) return { ok: false, error: 'El nombre solo puede contener letras, espacios y guiones.' };
  return { ok: true, value };
}

export function sanitizeFreeText(raw: unknown, max: number): string {
  const value = typeof raw === 'string' ? raw : '';
  return value.replace(UNSAFE_CHARS_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validateNotes(raw: unknown): FieldResult {
  const original = typeof raw === 'string' ? raw.trim() : '';
  if (original.length > NOTES_MAX) return { ok: false, error: `Las notas admiten ${NOTES_MAX} caracteres como máximo.` };
  return { ok: true, value: sanitizeFreeText(original, NOTES_MAX) };
}

export function parseList(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPhoneAllowed(phone: string, prefixesCsv: string): boolean {
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return false;
  return parseList(prefixesCsv).some((p) => phone.startsWith(p));
}

/** True when `email` matches an entry in the allowlist: an exact address or an `@domain`. Empty list allows nobody. */
export function isEmailAllowed(email: string, allowlistCsv: string): boolean {
  const e = email.trim().toLowerCase();
  return parseList(allowlistCsv).some((entry) => (entry.startsWith('@') ? e.endsWith(entry) : e === entry));
}
