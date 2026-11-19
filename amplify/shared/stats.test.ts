// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { BatchGetCommand, DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { AppSyncIdentityCognito } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { workshopStats } from '../functions/bookings-api/handler.js';
import { bumpStats, madridDay, readWorkshopStats, talkStats } from './stats.js';

const ddb = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddb.reset();
  process.env.STATS_TABLE = 'stats';
  process.env.BOOKINGS_TABLE = 'bookings';
});
afterEach(() => {
  delete process.env.STATS_TABLE;
});

describe('bumpStats', () => {
  it('adds to the total and to the Madrid calendar day', async () => {
    // 23:30 UTC on 24 Dec is already 25 Dec in Madrid.
    await bumpStats({ lettersSent: 1, wishes: 3, giftLinks: 0 }, new Date('2026-12-24T23:30:00Z'));
    const calls = ddb.commandCalls(UpdateCommand).map((c) => c.args[0].input);
    expect(calls.map((c) => c.Key)).toEqual([{ statKey: 'TOTAL' }, { statKey: 'DAY#2026-12-25' }]);
    expect(calls[0].UpdateExpression).toBe('ADD #c0 :c0, #c1 :c1');
    expect(calls[0].ExpressionAttributeNames).toEqual({ '#c0': 'lettersSent', '#c1': 'wishes' });
  });

  it('never throws, so the call pipeline is not affected', async () => {
    ddb.on(UpdateCommand).rejects(new Error('boom'));
    await expect(bumpStats({ dialled: 1 })).resolves.toBeUndefined();
  });

  it('does nothing without a table', async () => {
    delete process.env.STATS_TABLE;
    await bumpStats({ dialled: 1 });
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});

describe('readWorkshopStats', () => {
  it('returns totals, the last days with zeros filled in, and live booking counts', async () => {
    const now = new Date('2026-12-20T10:00:00Z');
    ddb.on(BatchGetCommand).resolves({
      Responses: { stats: [{ statKey: 'TOTAL', scheduled: 5, lettersSent: 2 }, { statKey: 'DAY#2026-12-20', scheduled: 1 }] },
    });
    ddb.on(ScanCommand).resolves({ Items: [{ status: 'SCHEDULED' }, { status: 'SCHEDULED' }, { status: 'IN_CALL' }, { status: 'DELIVERED' }] });

    const res = await readWorkshopStats(3, now);
    expect(res.totals).toMatchObject({ scheduled: 5, lettersSent: 2, wishes: 0 });
    expect(res.days.map((d) => d.day)).toEqual(['2026-12-18', '2026-12-19', '2026-12-20']);
    expect(res.days[2].scheduled).toBe(1);
    expect(res).toMatchObject({ pending: 2, live: 1 });
    expect(ddb.commandCalls(ScanCommand)[0].args[0].input.ProjectionExpression).toBe('#s');
  });
});

describe('workshopStats', () => {
  it('is only for the ADMINS group', async () => {
    const parent = { sub: 'u', username: 'u', groups: null } as unknown as AppSyncIdentityCognito;
    await expect(workshopStats(parent)).rejects.toThrow(/administradores/);
  });
});

it('talkStats measures the conversation and ignores bad values', () => {
  const now = new Date('2026-12-20T10:03:00Z');
  expect(talkStats('2026-12-20T10:00:00Z', now)).toEqual({ talkSeconds: 180, timedCalls: 1 });
  expect(talkStats(undefined, now)).toEqual({});
  expect(talkStats('2026-12-18T10:00:00Z', now)).toEqual({});
});

it('madridDay uses the Madrid calendar', () => {
  expect(madridDay(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
});
