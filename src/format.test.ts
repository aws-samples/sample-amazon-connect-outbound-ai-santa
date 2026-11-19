// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, expect, it } from 'vitest';
import { addDays, formatNationalNumber, callTimeSlots, firstCallDay, lastCallDay, countdownLabel, daysUntil, defaultCallSlot, formatCallDate, formatCallWhen, formatPhone, todayInMadrid } from './format.ts';
import { friendlyError } from './errors.ts';

// 1 Dec 2026, 10:00 in Madrid (UTC+1).
const MORNING = new Date('2026-12-01T09:00:00Z');
// 1 Dec 2026, 23:30 in Madrid: still the 1st there, already late.
const LATE = new Date('2026-12-01T22:30:00Z');

describe('format', () => {
  it('uses the Madrid calendar day', () => {
    expect(todayInMadrid(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02');
  });

  it('defaults to today at 18:00 while there is time, else tomorrow', () => {
    expect(defaultCallSlot(MORNING)).toEqual({ date: '2026-12-01', time: '18:00' });
    expect(defaultCallSlot(LATE)).toEqual({ date: '2026-12-02', time: '18:00' });
    expect(defaultCallSlot(new Date('2026-12-31T22:00:00Z'))).toEqual({ date: '2027-01-01', time: '18:00' });
  });

  it('offers 15-minute slots from 09:00 to 22:00, only in the future today', () => {
    const tomorrow = callTimeSlots('2026-12-02', MORNING);
    expect(tomorrow[0]).toBe('09:00');
    expect(tomorrow.at(-1)).toBe('22:00');
    expect(tomorrow).toHaveLength(53);
    // 10:00 now plus 10 minutes of lead time, rounded up to the next slot.
    expect(callTimeSlots('2026-12-01', MORNING)[0]).toBe('10:15');
    expect(callTimeSlots('2026-12-01', LATE)).toEqual([]);
    expect(callTimeSlots('2026-11-30', MORNING)).toEqual([]);
  });
  it('lets parents pick from today, or tomorrow when it is too late, up to 24 December', () => {
    expect(firstCallDay(MORNING)).toBe('2026-12-01');
    expect(firstCallDay(LATE)).toBe('2026-12-02');
    expect(lastCallDay(MORNING)).toBe('2026-12-24');
    expect(lastCallDay(new Date('2026-12-26T10:00:00Z'))).toBe('2027-12-24');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('counts calendar days', () => {
    expect(daysUntil('2026-12-24', MORNING)).toBe(23);
    expect(countdownLabel('2026-12-01', LATE)).toBe('¡Es hoy!');
    expect(countdownLabel('2026-12-02', MORNING)).toBe('¡Es mañana!');
    expect(countdownLabel('2026-12-04', MORNING)).toBe('Faltan 3 días');
    expect(countdownLabel('2026-11-30', MORNING)).toBe('');
  });

  it('formats dates in Spanish', () => {
    expect(formatCallDate('2026-12-24')).toBe('jueves, 24 de diciembre');
    expect(formatCallWhen('2026-12-24', '18:00')).toBe('jueves, 24 de diciembre a las 18:00');
  });

  it('groups Spanish mobile numbers', () => {
    expect(formatPhone('+34600123456')).toBe('+34 600 12 34 56');
    expect(formatPhone('+441234')).toBe('+441234');
  });
});

describe('friendlyError', () => {
  it('maps Cognito errors by name', () => {
    const err = Object.assign(new Error('Invalid verification code provided, please try again.'), { name: 'CodeMismatchException' });
    expect(friendlyError(err)).toMatch(/código no es el bueno/);
  });

  it('keeps the backend Spanish messages', () => {
    expect(friendlyError(new Error('Santa ya está llamando; no se puede cancelar ahora.'))).toBe(
      'Santa ya está llamando; no se puede cancelar ahora.',
    );
  });

  it('hides English or empty messages', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/Polo Norte/);
    expect(friendlyError(new Error('Unauthorized'))).toMatch(/elfo/);
    expect(friendlyError(null)).toMatch(/elfo/);
  });
  it('writes a Spanish number the national way', () => {
    expect(formatNationalNumber('+34900123456')).toBe('900 123 456');
    expect(formatNationalNumber('+4930123456')).toBe('+4930123456');
  });
});
