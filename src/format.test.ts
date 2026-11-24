// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, expect, it, vi } from 'vitest';
import {
  callTimeSlots,
  countdownLabel,
  defaultCallSlot,
  formatCallDate,
  formatCallWhen,
  formatMonth,
  formatTime,
  monthCells,
  todayInCallZone,
  weekdayInitials,
  zoneCity,
} from './format.ts';
import { friendlyError } from './errors.ts';
import { t } from './i18n.ts';

// The default deployment: English, New York, US numbers.
vi.mock('./config.ts', () => ({
  callTimezone: 'America/New_York',
  allowedPhonePrefixes: ['+1'],
  phoneVerificationRequired: true,
  santaCallerNumber: '',
}));

// 1 Dec 2026, 10:00 in New York (UTC-5).
const MORNING = new Date('2026-12-01T15:00:00Z');
// 1 Dec 2026, 23:30 in New York: already the 2nd in UTC.
const LATE = new Date('2026-12-02T04:30:00Z');

describe('format (en, New York)', () => {
  it('uses the New York calendar day', () => {
    expect(todayInCallZone(LATE)).toBe('2026-12-01');
    expect(defaultCallSlot(MORNING)).toEqual({ date: '2026-12-01', time: '18:00' });
    expect(defaultCallSlot(LATE)).toEqual({ date: '2026-12-02', time: '18:00' });
    expect(callTimeSlots('2026-12-01', MORNING)[0]).toBe('10:15');
    expect(callTimeSlots('2026-12-01', LATE)).toEqual([]);
  });

  it('writes countdowns, dates and times in US English', () => {
    expect(countdownLabel('2026-12-01', MORNING)).toBe("It's today!");
    expect(countdownLabel('2026-12-02', MORNING)).toBe("It's tomorrow!");
    expect(countdownLabel('2026-12-04', MORNING)).toBe('3 days to go');
    expect(formatCallDate('2026-12-24')).toBe('Thursday, December 24');
    expect(formatTime('09:00')).toBe('9:00 AM');
    expect(formatTime('12:15')).toBe('12:15 PM');
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(formatCallWhen('2026-12-24', '18:00')).toBe('Thursday, December 24 at 6:00 PM');
    expect(zoneCity()).toBe('New York');
  });

  it('starts the calendar on Sunday', () => {
    expect(weekdayInitials()).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    // 1 December 2026 is a Tuesday: two blanks before it.
    expect(monthCells(2026, 11).slice(0, 3)).toEqual([null, null, '2026-12-01']);
    expect(formatMonth(2026, 11)).toBe('December 2026');
  });
});

describe('friendlyError (en)', () => {
  it('maps Cognito errors to English', () => {
    expect(friendlyError({ name: 'CodeMismatchException', message: 'Invalid code' })).toBe(t.errCodeMismatch);
    expect(friendlyError({ name: 'InvalidParameterException' })).toMatch(/10-digit US/);
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/North Pole/);
  });

  it('shows UserError messages from the bookings API and hides other text', () => {
    const userError = Object.assign(new Error('Santa is fully booked that day. Try another day.'), { name: 'UserError' });
    expect(friendlyError(userError)).toBe('Santa is fully booked that day. Try another day.');
    expect(friendlyError(new Error('Unauthorized'))).toMatch(/elf/);
    expect(friendlyError(new Error('Santa ya está llamando.'))).toBe(t.errGeneric);
  });
});
