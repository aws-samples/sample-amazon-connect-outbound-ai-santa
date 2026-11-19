// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** Display helpers. Calls are booked in Madrid wall-clock time, so every date shown here is in that zone. */

export const CALL_TIMEZONE = 'Europe/Madrid';
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

/** `YYYY-MM-DD` and `HH:MM` for an instant, in Madrid. */
function madridParts(now: Date): { date: string; time: string } {
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

export function todayInMadrid(now = new Date()): string {
  return madridParts(now).date;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Today at 18:00 if there is still time, otherwise tomorrow at 18:00. */
export function defaultCallSlot(now = new Date()): { date: string; time: string } {
  const soon = madridParts(new Date(now.getTime() + DEFAULT_LEAD_MINUTES * 60_000));
  const today = todayInMadrid(now);
  if (soon.date === today && soon.time <= DEFAULT_TIME) return { date: today, time: DEFAULT_TIME };
  return { date: addDays(today, 1), time: DEFAULT_TIME };
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Times Santa can still call on `date` (Madrid), every 15 minutes inside the call window. */
export function callTimeSlots(date: string, now = new Date()): string[] {
  const soon = madridParts(new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000));
  if (date < soon.date) return [];
  let from = toMinutes(CALL_WINDOW_START);
  if (date === soon.date) from = Math.max(from, Math.ceil(toMinutes(soon.time) / SLOT_MINUTES) * SLOT_MINUTES);
  const slots: string[] = [];
  for (let m = from; m <= toMinutes(CALL_WINDOW_END); m += SLOT_MINUTES) slots.push(fromMinutes(m));
  return slots;
}

/** Santa calls until 24 December: this year's, or next year's once it has passed. Same rule as the backend. */
export function lastCallDay(now = new Date()): string {
  const today = todayInMadrid(now);
  const thisYear = `${today.slice(0, 4)}-12-24`;
  return today <= thisYear ? thisYear : `${Number(today.slice(0, 4)) + 1}-12-24`;
}

/** Today if Santa can still call today, otherwise tomorrow. */
export function firstCallDay(now = new Date()): string {
  const today = todayInMadrid(now);
  return callTimeSlots(today, now).length ? today : addDays(today, 1);
}

/** Whole calendar days from today (Madrid) to `date`. Negative if it has passed. */
export function daysUntil(date: string, now = new Date()): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(date) - toUtc(todayInMadrid(now))) / 86_400_000);
}

/** «¡Es hoy!», «Mañana», «Faltan 3 días». Empty when the date has passed. */
export function countdownLabel(date: string, now = new Date()): string {
  const days = daysUntil(date, now);
  if (days < 0) return '';
  if (days === 0) return '¡Es hoy!';
  if (days === 1) return '¡Es mañana!';
  return `Faltan ${days} días`;
}

/** «miércoles, 24 de diciembre». */
export function formatCallDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  // Noon UTC keeps the same calendar day in Madrid whatever the DST offset.
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: CALL_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** «miércoles, 24 de diciembre a las 18:00». */
export function formatCallWhen(date: string, time: string): string {
  return `${formatCallDate(date)} a las ${time}`;
}

/** Spanish number as people write it: `+34900123456` → `900 123 456`. Other formats are returned unchanged. */
export function formatNationalNumber(phone: string): string {
  const m = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : phone;
}

/** `+34600123456` → `+34 600 12 34 56`. Other formats are returned unchanged. */
export function formatPhone(phone: string): string {
  const m = /^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+34 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
