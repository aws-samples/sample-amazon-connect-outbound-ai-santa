// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';
import { lastCallDate, toAtExpression, validateCallTime, wallTimeToUtc } from './time.js';
import { isEmailAllowed, isPhoneAllowed, sanitizeFreeText, validateChildName, validateNotes } from './validation.js';
import { escapeHtml, giftLinksFromEnv, giftSearchUrl, LOGO_CID, sendEmail, ses, wishlistEmail } from './email.js';

const rules = { windowStart: '10:00', windowEnd: '20:30', minLeadMinutes: 5 };

describe('wallTimeToUtc', () => {
  it('converts winter time (UTC+1)', () => {
    expect(wallTimeToUtc('2026-12-24', '18:00').toISOString()).toBe('2026-12-24T17:00:00.000Z');
  });
  it('converts summer time (UTC+2)', () => {
    expect(wallTimeToUtc('2026-07-01', '18:00').toISOString()).toBe('2026-07-01T16:00:00.000Z');
  });
  it('formats a scheduler at() expression', () => {
    expect(toAtExpression(new Date('2026-12-24T17:00:00.000Z'))).toBe('at(2026-12-24T17:00:00)');
  });
});

describe('validateCallTime', () => {
  const now = new Date('2026-12-20T09:00:00Z');
  it('accepts a time inside the window', () => {
    expect(validateCallTime('2026-12-24', '18:00', rules, now)).toMatchObject({ ok: true });
  });
  it('rejects a time before the window', () => {
    expect(validateCallTime('2026-12-24', '09:59', rules, now).ok).toBe(false);
  });
  it('rejects a time after the window', () => {
    expect(validateCallTime('2026-12-24', '20:31', rules, now).ok).toBe(false);
  });
  it('rejects a time in the past', () => {
    expect(validateCallTime('2026-12-19', '18:00', rules, now).ok).toBe(false);
  });
  it('rejects less than 5 minutes ahead', () => {
    expect(validateCallTime('2026-12-20', '10:03', rules, now).ok).toBe(false);
  });
  it('rejects dates after 24 December', () => {
    expect(validateCallTime('2026-12-25', '18:00', rules, now)).toEqual({ ok: false, error: 'Santa solo llama hasta el 24 de diciembre.' });
  });
  it('accepts days well before 24 December', () => {
    expect(validateCallTime('2026-12-01', '18:00', rules, new Date('2026-10-15T09:00:00Z')).ok).toBe(true);
  });
  it('moves the last day to next year once 24 December has passed in Madrid', () => {
    expect(lastCallDate(new Date('2026-12-24T22:30:00Z'))).toBe('2026-12-24');
    expect(lastCallDate(new Date('2026-12-24T23:30:00Z'))).toBe('2027-12-24');
  });
  it('rejects malformed input', () => {
    expect(validateCallTime('24/12/2026', '6pm', rules, now).ok).toBe(false);
  });
});

describe('validation', () => {
  it('accepts names with accents and hyphens', () => {
    expect(validateChildName('  José-María  ')).toEqual({ ok: true, value: 'José-María' });
  });
  it('rejects names with digits or markup', () => {
    expect(validateChildName('<script>').ok).toBe(false);
    expect(validateChildName('Ana2').ok).toBe(false);
  });
  it('rejects names over 40 characters', () => {
    expect(validateChildName('a'.repeat(41)).ok).toBe(false);
  });
  it('rejects notes over 300 characters', () => {
    expect(validateNotes('a'.repeat(301)).ok).toBe(false);
  });
  it('strips brackets and control characters from free text', () => {
    expect(sanitizeFreeText('hola <b>{x}</b>\u0007 adiós', 100)).toBe('hola b x /b adiós');
  });
  it('only allows configured phone prefixes', () => {
    expect(isPhoneAllowed('+34600123456', '+34')).toBe(true);
    expect(isPhoneAllowed('+33600123456', '+34')).toBe(false);
    expect(isPhoneAllowed('600123456', '+34')).toBe(false);
  });
  it('matches the sign-up allowlist by address or domain, and blocks everything when empty', () => {
    expect(isEmailAllowed('Ana@Example.com', '@example.com')).toBe(true);
    expect(isEmailAllowed('ana@example.com', 'bob@example.com')).toBe(false);
    expect(isEmailAllowed('ana@example.com', '')).toBe(false);
  });
});

describe('email', () => {
  it('escapes HTML in child-provided content', () => {
    const mail = wishlistEmail('Ana', ['Hola'], ['<img src=x onerror=alert(1)>']);
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain(escapeHtml('<img src=x onerror=alert(1)>'));
  });

  it('addresses the parents and numbers the wishes', () => {
    const mail = wishlistEmail('Ana', ['Hola'], ['Una bici', 'Un libro']);
    expect(mail.text).toMatch(/^Hola, familia de Ana:/);
    expect(mail.html).toContain('Hola, familia de Ana:');
    expect(mail.text).toContain('1. Una bici');
    expect(mail.text).toContain('2. Un libro');
  });

  it('shows the title as an inline image and Santa with light skin', () => {
    const mail = wishlistEmail('Ana', ['Hola'], []);
    expect(mail.html).toContain(`src="cid:${LOGO_CID}"`);
    expect(mail.html).toContain('alt="Llamada de Santa"');
    expect(mail.html).toContain('\u{1F385}\u{1F3FB}');
  });

  it('links each wish to an Amazon search, without a tag by default', () => {
    const mail = wishlistEmail('Ana', ['Hola'], ['Una bici roja', 'Lego & más'], { domain: 'amazon.es' });
    expect(mail.html).toContain('https://www.amazon.es/s?k=Una+bici+roja');
    expect(mail.html).toContain('k=Lego+%26+m%C3%A1s');
    expect(mail.html).toContain('Ver ideas en Amazon');
    expect(mail.text).toContain('https://www.amazon.es/s?k=Una+bici+roja');
    expect(mail.html).not.toContain('tag=');
    expect(mail.html).not.toContain('afiliado');
  });

  it('adds the associate tag and says the links are affiliate links', () => {
    const mail = wishlistEmail('Ana', ['Hola'], ['Una bici'], { domain: 'amazon.es', tag: 'santa-21' });
    expect(mail.html).toContain('tag=santa-21');
    expect(mail.html).toContain('enlaces de afiliado');
    expect(mail.text).toContain('enlaces de afiliado');
  });

  it('escapes wish text inside the link', () => {
    const url = giftSearchUrl('"><script>x</script>', { domain: 'amazon.es' });
    expect(url).not.toContain('<');
    const mail = wishlistEmail('Ana', ['Hola'], ['"><script>x</script>'], { domain: 'amazon.es' });
    expect(mail.html).not.toContain('<script>');
  });

  it('has no links when off, invalid or without wishes', () => {
    expect(giftLinksFromEnv({ GIFT_LINKS_DOMAIN: 'off' })).toBeUndefined();
    expect(giftLinksFromEnv({ GIFT_LINKS_DOMAIN: 'evil.com' })).toBeUndefined();
    expect(giftLinksFromEnv({ GIFT_LINKS_DOMAIN: 'amazon.es', AMAZON_ASSOCIATE_TAG: 'bad tag&x=1' })).toEqual({ domain: 'amazon.es', tag: undefined });
    expect(giftLinksFromEnv({ GIFT_LINKS_DOMAIN: 'amazon.co.uk', AMAZON_ASSOCIATE_TAG: 'santa-21' })).toEqual({ domain: 'amazon.co.uk', tag: 'santa-21' });
    const mail = wishlistEmail('Ana', ['Hola'], [], { domain: 'amazon.es' });
    expect(mail.html).not.toContain('amazon.es/s');
    expect(mail.html).not.toContain('Los elfos han buscado');
  });

  it('sends the title image as an inline attachment', async () => {
    const mock = mockClient(ses);
    mock.on(SendEmailCommand).resolves({});
    process.env.SENDER_EMAIL = 'santa@example.com';
    await sendEmail('padres@example.com', wishlistEmail('Ana', ['Hola'], []));
    const att = mock.commandCalls(SendEmailCommand)[0].args[0].input.Content?.Simple?.Attachments?.[0];
    expect(att).toMatchObject({ ContentDisposition: 'INLINE', ContentId: LOGO_CID, ContentType: 'image/png' });
    expect(Buffer.from(att!.RawContent!).subarray(1, 4).toString()).toBe('PNG');
    mock.restore();
  });
});
