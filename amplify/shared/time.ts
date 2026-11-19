// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { callTimezone, msg, zoneCity } from './i18n.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Offset in ms between the wall clock in `timeZone` and UTC at instant `utcMs`. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

/** Convert a wall-clock date + time in `timeZone` to a UTC Date. */
export function wallTimeToUtc(date: string, time: string, timeZone = callTimezone()): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let utc = naive - zoneOffsetMs(naive, timeZone);
  // Second pass corrects the offset when the first guess crossed a DST change.
  utc = naive - zoneOffsetMs(utc, timeZone);
  return new Date(utc);
}

/** Santa calls until 24 December (in CALL_TIMEZONE). */
const LAST_CALL_DAY = '12-24';

/** `YYYY-MM-DD` in the call time zone (CALL_TIMEZONE) for an instant. */
export function localDate(now: Date, timeZone = callTimezone()): string {
  return new Date(now.getTime() + zoneOffsetMs(now.getTime(), timeZone)).toISOString().slice(0, 10);
}

/** `HH:mm` in the call time zone for an instant. */
export function localTime(at: Date, timeZone = callTimezone()): string {
  return new Date(at.getTime() + zoneOffsetMs(at.getTime(), timeZone)).toISOString().slice(11, 16);
}

/** 24 December of this year, or of next year once this year's has passed. */
export function lastCallDate(now = new Date()): string {
  const today = localDate(now);
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${LAST_CALL_DAY}`;
  return today <= thisYear ? thisYear : `${year + 1}-${LAST_CALL_DAY}`;
}

export interface CallTimeRules {
  windowStart: string;
  windowEnd: string;
  minLeadMinutes: number;
}

export type CallTimeResult = { ok: true; utc: Date } | { ok: false; error: string };

export function validateCallTime(date: string, time: string, rules: CallTimeRules, now = new Date()): CallTimeResult {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
    return { ok: false, error: msg().badDateTime };
  }
  const minutes = toMinutes(time);
  if (minutes < toMinutes(rules.windowStart) || minutes > toMinutes(rules.windowEnd)) {
    return { ok: false, error: msg().outsideWindow(rules.windowStart, rules.windowEnd, zoneCity(callTimezone())) };
  }
  const utc = wallTimeToUtc(date, time);
  if (Number.isNaN(utc.getTime())) {
    return { ok: false, error: msg().badDate };
  }
  const leadMs = utc.getTime() - now.getTime();
  if (leadMs < rules.minLeadMinutes * 60_000) {
    return { ok: false, error: msg().minLead(rules.minLeadMinutes) };
  }
  if (date > lastCallDate(now)) {
    return { ok: false, error: msg().lastDay };
  }
  return { ok: true, utc };
}

/** EventBridge Scheduler one-time expression in UTC, e.g. `at(2026-12-24T17:30:00)`. */
export function toAtExpression(utc: Date): string {
  return `at(${utc.toISOString().slice(0, 19)})`;
}
