// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { BatchGetCommand, ScanCommand, UpdateCommand, type ScanCommandOutput } from '@aws-sdk/lib-dynamodb';
import { callTimezone } from './i18n.js';
import { doc } from './bookings.js';

/**
 * Aggregate counters for the admin "Taller de Santa" view. Only numbers: no names, notes, wishes or
 * contact details, so these items can be kept after the bookings are deleted.
 */
export const STAT_NAMES = [
  'scheduled', // a parent scheduled a call
  'cancelled', // a parent cancelled before the call
  'dialled', // the dialer started an outbound call (each attempt counts)
  'answered', // the call reached Santa (someone picked up)
  'lettersSent', // letter emailed to the parents
  'wishes', // wishes in the letters
  'giftLinks', // Amazon search links in the letters
  'missed', // no answer after every attempt; parents told by email
  'cutShort', // answered but ended before Santa handed over the letter
  'talkSeconds', // seconds from answer to the end of the conversation, summed
  'timedCalls', // conversations included in talkSeconds
] as const;
export type StatName = (typeof STAT_NAMES)[number];
export type StatCounts = Record<StatName, number>;

const TOTAL_KEY = 'TOTAL';

function table(): string | undefined {
  return process.env.STATS_TABLE || undefined;
}

/** Seconds of conversation since the flow marked the call answered, for the average call length. */
export function talkStats(answeredAt: string | undefined, now = new Date()): Partial<StatCounts> {
  const seconds = answeredAt ? Math.round((now.getTime() - Date.parse(answeredAt)) / 1000) : NaN;
  // Ignore missing or implausible values (clock skew, a booking answered days ago).
  return seconds > 0 && seconds < 3600 ? { talkSeconds: seconds, timedCalls: 1 } : {};
}

/** Calendar day in the call time zone (CALL_TIMEZONE), YYYY-MM-DD. */
export function localDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: callTimezone() }).format(d);
}

export const dayKey = (day: string) => `DAY#${day}`;

/**
 * Add to the total and today's counters. Best effort: a failure is logged and never breaks the call
 * pipeline, so the numbers can be slightly low but a parent never misses a call or a letter because of them.
 */
export async function bumpStats(counts: Partial<StatCounts>, now = new Date()): Promise<void> {
  const name = table();
  const entries = Object.entries(counts).filter(([, n]) => typeof n === 'number' && n > 0) as [StatName, number][];
  if (!name || !entries.length) return;
  const names: Record<string, string> = {};
  const values: Record<string, number> = {};
  const adds = entries.map(([k, n], i) => {
    names[`#c${i}`] = k;
    values[`:c${i}`] = n;
    return `#c${i} :c${i}`;
  });
  try {
    await Promise.all(
      [TOTAL_KEY, dayKey(localDay(now))].map((statKey) =>
        doc.send(
          new UpdateCommand({
            TableName: name,
            Key: { statKey },
            UpdateExpression: `ADD ${adds.join(', ')}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
          }),
        ),
      ),
    );
  } catch (err) {
    console.error('stats update failed', { error: (err as Error).name });
  }
}

function toCounts(item: Record<string, unknown> | undefined): StatCounts {
  return Object.fromEntries(STAT_NAMES.map((k) => [k, Number(item?.[k] ?? 0)])) as StatCounts;
}

export interface DayStats extends StatCounts {
  day: string;
}

export interface WorkshopStats {
  totals: StatCounts;
  /** Oldest first, including today. */
  days: DayStats[];
  /** Bookings waiting for their scheduled time right now. */
  pending: number;
  /** Calls being dialled or in progress right now (CALLING, IN_CALL, NO_RESPONSE). */
  live: number;
  updatedAt: string;
}

/** Counts bookings by status. Reads only the status attribute, never child data. */
async function countBookings(): Promise<{ pending: number; live: number }> {
  let pending = 0;
  let live = 0;
  let start: Record<string, unknown> | undefined;
  do {
    const res: ScanCommandOutput = await doc.send(
      new ScanCommand({
        TableName: process.env.BOOKINGS_TABLE,
        ProjectionExpression: '#s',
        ExpressionAttributeNames: { '#s': 'status' },
        ExclusiveStartKey: start,
      }),
    );
    for (const item of res.Items ?? []) {
      if (item.status === 'SCHEDULED') pending++;
      // DELIVERED means the call is over and the letter is being sent, so it is not a call in progress.
      else if (item.status !== 'DELIVERED') live++;
    }
    start = res.LastEvaluatedKey;
  } while (start);
  return { pending, live };
}

export async function readWorkshopStats(dayCount = 7, now = new Date()): Promise<WorkshopStats> {
  const name = table();
  const days = Array.from({ length: dayCount }, (_, i) => localDay(new Date(now.getTime() - (dayCount - 1 - i) * 86_400_000)));
  const items = new Map<string, Record<string, unknown>>();
  if (name) {
    const res = await doc.send(
      new BatchGetCommand({ RequestItems: { [name]: { Keys: [TOTAL_KEY, ...days.map(dayKey)].map((statKey) => ({ statKey })) } } }),
    );
    for (const item of res.Responses?.[name] ?? []) items.set(item.statKey as string, item);
  }
  const { pending, live } = await countBookings();
  return {
    totals: toCounts(items.get(TOTAL_KEY)),
    days: days.map((day) => ({ day, ...toCounts(items.get(dayKey(day))) })),
    pending,
    live,
    updatedAt: now.toISOString(),
  };
}
