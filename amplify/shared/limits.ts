// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from './bookings.js';

/**
 * Abuse and cost limits, kept as atomic counters in the stats table. Each counter only holds a number
 * (no names, phones or emails) and expires through the table's `expiresAt` TTL.
 */

function isConditionFailure(err: unknown): boolean {
  return (err as Error).name === 'ConditionalCheckFailedException';
}

/** Adds 1 to `statKey` unless it already reached `max`. Returns false when the limit is reached. */
async function takeOne(statKey: string, max: number, expiresAt: number): Promise<boolean> {
  try {
    await doc.send(
      new UpdateCommand({
        TableName: process.env.STATS_TABLE,
        Key: { statKey },
        UpdateExpression: 'ADD #n :one SET expiresAt = :exp',
        ConditionExpression: 'attribute_not_exists(#n) OR #n < :max',
        ExpressionAttributeNames: { '#n': 'count' },
        ExpressionAttributeValues: { ':one': 1, ':max': max, ':exp': expiresAt },
      }),
    );
    return true;
  } catch (err) {
    if (isConditionFailure(err)) return false;
    throw err;
  }
}

function limit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

const DAY_SECONDS = 86_400;

/** Global cap on calls per calendar day (the call's date in CALL_TIMEZONE), across all parents. */
export const dailyCallKey = (callDate: string) => `CAP#CALLS#${callDate}`;

export async function reserveDailyCall(callDate: string): Promise<boolean> {
  // Keep the counter a few days past the call date so a late cancel still finds it.
  const expiresAt = Math.floor(Date.parse(`${callDate}T00:00:00Z`) / 1000) + 3 * DAY_SECONDS;
  return takeOne(dailyCallKey(callDate), limit('MAX_CALLS_PER_DAY', 50), expiresAt);
}

/** Gives the slot back when a booking is cancelled or could not be created. Best effort. */
export async function releaseDailyCall(callDate: string): Promise<void> {
  try {
    await doc.send(
      new UpdateCommand({
        TableName: process.env.STATS_TABLE,
        Key: { statKey: dailyCallKey(callDate) },
        UpdateExpression: 'ADD #n :minus',
        ConditionExpression: '#n > :zero',
        ExpressionAttributeNames: { '#n': 'count' },
        ExpressionAttributeValues: { ':minus': -1, ':zero': 0 },
      }),
    );
  } catch (err) {
    if (!isConditionFailure(err)) console.error('daily call release failed', { error: (err as Error).name });
  }
}

/** Per-user cap on verification SMS per clock hour, against SMS pumping and cost abuse. */
export async function takeSmsCode(userSub: string, now = new Date()): Promise<boolean> {
  const hour = now.toISOString().slice(0, 13);
  const expiresAt = Math.floor(now.getTime() / 1000) + 2 * 3600;
  return takeOne(`CAP#SMS#${userSub}#${hour}`, limit('MAX_SMS_CODES_PER_HOUR', 5), expiresAt);
}
