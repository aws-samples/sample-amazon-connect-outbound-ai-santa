// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cognitoCodeEmail, cognitoInviteEmail, missedCallEmail, wishlistEmail } from './email.js';
import { language, msg, zoneCity } from './i18n.js';
import { localDate, localTime, validateCallTime, wallTimeToUtc } from './time.js';
import { isMobileAllowed, validateChildName } from './validation.js';

const saved = { ...process.env };
const rules = { windowStart: '09:00', windowEnd: '22:00', minLeadMinutes: 5 };

describe('English deployment in the US (the defaults)', () => {
  beforeEach(() => {
    delete process.env.SANTA_LANGUAGE;
    delete process.env.CALL_TIMEZONE;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults to English and New York time', () => {
    expect(language()).toBe('en');
    expect(msg().noNotes).toBe('No notes.');
    expect(zoneCity('America/New_York')).toBe('New York');
  });

  it('reads call times in New York', () => {
    // 18:00 in New York on 20 Dec is 23:00 UTC (EST, UTC-5).
    expect(wallTimeToUtc('2026-12-20', '18:00').toISOString()).toBe('2026-12-20T23:00:00.000Z');
    const lateUtc = new Date('2026-12-21T03:30:00Z'); // 22:30 on the 20th in New York
    expect(localDate(lateUtc)).toBe('2026-12-20');
    expect(localTime(lateUtc)).toBe('22:30');
  });

  it('explains the call window in English with the city', () => {
    const res = validateCallTime('2026-12-24', '23:00', rules, new Date('2026-12-20T12:00:00Z'));
    expect(res).toEqual({ ok: false, error: 'Santa only calls between 09:00 and 22:00 (New York time).' });
    expect(validateChildName('')).toEqual({ ok: false, error: "Write your child's first name." });
  });

  it('accepts US mobiles and rejects malformed NANP numbers', () => {
    expect(isMobileAllowed('+12125550123', '+1')).toBe(true);
    expect(isMobileAllowed('+11125550123', '+1')).toBe(false);
    expect(isMobileAllowed('+34600123456', '+1')).toBe(false);
    expect(isMobileAllowed('+34600123456', '+1,+34')).toBe(true);
    expect(isMobileAllowed('+34900123456', '+34')).toBe(false);
    // Countries without a specific rule only need valid E.164 and an allowed prefix.
    expect(isMobileAllowed('+447700900123', '+44')).toBe(true);
  });

  it('writes the emails in English', () => {
    const letter = wishlistEmail('Lucy', ['a red bike'], ['a red bike'], { domain: 'amazon.com' });
    expect(letter.subject).toBe("🎁 Lucy's letter to Santa");
    expect(letter.html).toContain('<html lang="en">');
    expect(letter.html).toContain('FROM THE NORTH POLE');
    expect(letter.html).toContain('See ideas on Amazon');
    expect(letter.html).toContain('https://www.amazon.com/s?k=a+red+bike');
    expect(letter.text).toContain("Lucy's wish list:");
    expect(missedCallEmail('Lucy', 'NO_ANSWER').subject).toContain('Santa tried to call Lucy');
    const invite = cognitoInviteEmail('https://example.com');
    expect(invite.html).toContain('{username}');
    expect(invite.html).toContain('{####}');
    expect(invite.html).toContain('Temporary password');
    expect(cognitoCodeEmail('{####}')).toContain('Your verification code');
  });
});

describe('Spanish deployment', () => {
  beforeEach(() => {
    process.env.SANTA_LANGUAGE = 'es';
    process.env.CALL_TIMEZONE = 'Europe/Madrid';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('keeps the Spanish texts and Madrid time', () => {
    expect(msg().noNotes).toBe('Sin notas.');
    const letter = wishlistEmail('Lucía', [], []);
    expect(letter.subject).toBe('🎁 La carta de Lucía para Santa');
    expect(letter.html).toContain('<html lang="es">');
    const res = validateCallTime('2026-12-24', '23:00', rules, new Date('2026-12-20T12:00:00Z'));
    expect(res).toEqual({ ok: false, error: 'Santa solo llama entre las 09:00 y las 22:00 (hora de Madrid).' });
  });
});
