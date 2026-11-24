// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Display helpers. Calls are booked in the wall-clock time of the call zone (CALL_TIMEZONE in the backend,
 * `custom.callTimezone` here), so every date shown here is in that zone.
 */
import { callTimezone } from './config.ts';
import { locale, t } from './i18n.ts';

export const CALL_TIMEZONE = callTimezone;
/** Keep in line with CALL_WINDOW_START / CALL_WINDOW_END in the backend, which enforces them. */
export const CALL_WINDOW_START = '09:00';
export const CALL_WINDOW_END = '22:00';
/** The time picker offers one slot every 15 minutes. */
const SLOT_MINUTES = 15;
/** A little more than the backend's 5 minutes, so a slot picked now is still valid when the form is sent. */
const MIN_LEAD_MINUTES = 10;
const DEFAULT_TIME = '18:00';
/** Lead time used only to pick a sensible default; the backend enforces the real rule. */
const DEFAULT_LEAD_MINUTES = 30;

/** `YYYY-MM-DD` and `HH:MM` for an instant, in the call zone. */
function zoneParts(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function todayInCallZone(now = new Date()): string {
  return zoneParts(now).date;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Today at 18:00 if there is still time, otherwise tomorrow at 18:00. */
export function defaultCallSlot(now = new Date()): { date: string; time: string } {
  const soon = zoneParts(new Date(now.getTime() + DEFAULT_LEAD_MINUTES * 60_000));
  const today = todayInCallZone(now);
  if (soon.date === today && soon.time <= DEFAULT_TIME) return { date: today, time: DEFAULT_TIME };
  return { date: addDays(today, 1), time: DEFAULT_TIME };
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Times Santa can still call on `date` (call zone), every 15 minutes inside the call window. */
export function callTimeSlots(date: string, now = new Date()): string[] {
  const soon = zoneParts(new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000));
  if (date < soon.date) return [];
  let from = toMinutes(CALL_WINDOW_START);
  if (date === soon.date) from = Math.max(from, Math.ceil(toMinutes(soon.time) / SLOT_MINUTES) * SLOT_MINUTES);
  const slots: string[] = [];
  for (let m = from; m <= toMinutes(CALL_WINDOW_END); m += SLOT_MINUTES) slots.push(fromMinutes(m));
  return slots;
}

/** Santa calls until 24 December: this year's, or next year's once it has passed. Same rule as the backend. */
export function lastCallDay(now = new Date()): string {
  const today = todayInCallZone(now);
  const thisYear = `${today.slice(0, 4)}-12-24`;
  return today <= thisYear ? thisYear : `${Number(today.slice(0, 4)) + 1}-12-24`;
}

/** Today if Santa can still call today, otherwise tomorrow. */
export function firstCallDay(now = new Date()): string {
  const today = todayInCallZone(now);
  return callTimeSlots(today, now).length ? today : addDays(today, 1);
}

/** Whole calendar days from today (call zone) to `date`. Negative if it has passed. */
export function daysUntil(date: string, now = new Date()): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(date) - toUtc(todayInCallZone(now))) / 86_400_000);
}

/** «It's today!», «It's tomorrow!», «3 days to go». Empty when the date has passed. */
export function countdownLabel(date: string, now = new Date()): string {
  const days = daysUntil(date, now);
  if (days < 0) return '';
  if (days === 0) return t.countdownToday;
  if (days === 1) return t.countdownTomorrow;
  return t.countdownDays(days);
}

/** «Thursday, December 24». */
export function formatCallDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  // Noon UTC keeps the same calendar day in any zone from UTC-11 to UTC+11, whatever the DST offset.
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** A `HH:MM` slot as people read it: «6:00 PM». */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** «Thursday, December 24 at 6:00 PM». */
export function formatCallWhen(date: string, time: string): string {
  return t.callWhen(formatCallDate(date), formatTime(time));
}

/** City of an IANA zone for labels: `America/New_York` → `New York`. */
export function zoneCity(zone = CALL_TIMEZONE): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/** One-letter weekday names in calendar order: «S M T W T F S». */
export function weekdayInitials(): string[] {
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  // 4 January 2026 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => narrow.format(Date.UTC(2026, 0, 4 + t.weekStartsOn + i)));
}

/** The days of a month (`m` 0-11) in weeks that start on the locale's first day, `null` for the blanks before the 1st. */
export function monthCells(y: number, m: number): (string | null)[] {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() - t.weekStartsOn + 7) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => ymd(y, m, i + 1))];
}

/** «December 2026». */
export function formatMonth(y: number, m: number): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m, 1));
}
