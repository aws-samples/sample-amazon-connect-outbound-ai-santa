// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, expect, it, vi } from 'vitest';
import {
  addDays,
  callTimeSlots,
  countdownLabel,
  daysUntil,
  defaultCallSlot,
  firstCallDay,
  formatCallDate,
  formatCallWhen,
  formatTime,
  lastCallDay,
  todayInCallZone,
  zoneCity,
} from './format.ts';
import { friendlyError } from './errors.ts';

// Calls placed from Europe: Madrid time zone and Spanish numbers. format.test.ts covers the US default.
vi.mock('./config.ts', () => ({
  callTimezone: 'Europe/Madrid',
  allowedPhonePrefixes: ['+34'],
  phoneVerificationRequired: true,
  santaCallerNumber: '',
}));

// 1 Dec 2026, 10:00 in Madrid (UTC+1).
const MORNING = new Date('2026-12-01T09:00:00Z');
// 1 Dec 2026, 23:30 in Madrid: still the 1st there, already late.
const LATE = new Date('2026-12-01T22:30:00Z');

describe('format', () => {
  it('uses the Madrid calendar day', () => {
    expect(todayInCallZone(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02');
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
  it('counts calendar days in the call zone', () => {
    expect(daysUntil('2026-12-24', MORNING)).toBe(23);
    expect(countdownLabel('2026-12-01', LATE)).toBe("It's today!");
    expect(countdownLabel('2026-12-02', MORNING)).toBe("It's tomorrow!");
    expect(countdownLabel('2026-12-04', MORNING)).toBe('3 days to go');
    expect(countdownLabel('2026-11-30', MORNING)).toBe('');
  });
  it('keeps US English formats and names the zone city', () => {
    expect(formatCallDate('2026-12-24')).toBe('Thursday, December 24');
    expect(formatTime('18:00')).toBe('6:00 PM');
    expect(formatCallWhen('2026-12-24', '18:00')).toBe('Thursday, December 24 at 6:00 PM');
    expect(zoneCity()).toBe('Madrid');
  });
});
describe('friendlyError (Spanish numbers)', () => {
  it('gives the phone hint for +34', () => {
    expect(friendlyError({ name: 'InvalidParameterException' })).toMatch(/Spanish mobile/);
  });
});
