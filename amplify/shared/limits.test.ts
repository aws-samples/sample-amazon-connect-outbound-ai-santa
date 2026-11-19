// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { releaseDailyCall, reserveDailyCall, takeSmsCode } from './limits.js';

const ddb = mockClient(DynamoDBDocumentClient);
const full = () => new ConditionalCheckFailedException({ message: 'full', $metadata: {} });

beforeEach(() => {
  ddb.reset();
  process.env.STATS_TABLE = 'Stats';
  process.env.MAX_CALLS_PER_DAY = '50';
  process.env.MAX_SMS_CODES_PER_HOUR = '5';
});

describe('reserveDailyCall', () => {
  it('takes a slot for the call date only while under the cap', async () => {
    await expect(reserveDailyCall('2026-12-24')).resolves.toBe(true);
    const input = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.Key).toEqual({ statKey: 'CAP#CALLS#2026-12-24' });
    expect(input.ConditionExpression).toBe('attribute_not_exists(#n) OR #n < :max');
    expect(input.ExpressionAttributeValues).toMatchObject({ ':one': 1, ':max': 50 });
    // Expires three days after the call date.
    expect(input.ExpressionAttributeValues?.[':exp']).toBe(Date.parse('2026-12-27T00:00:00Z') / 1000);
  });

  it('returns false when the day is full', async () => {
    ddb.on(UpdateCommand).rejects(full());
    await expect(reserveDailyCall('2026-12-24')).resolves.toBe(false);
  });

  it('uses the default cap when the setting is invalid', async () => {
    process.env.MAX_CALLS_PER_DAY = 'lots';
    await reserveDailyCall('2026-12-24');
    expect(ddb.commandCalls(UpdateCommand)[0].args[0].input.ExpressionAttributeValues).toMatchObject({ ':max': 50 });
  });
});

describe('releaseDailyCall', () => {
  it('gives the slot back without going below zero', async () => {
    await releaseDailyCall('2026-12-24');
    const input = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.ExpressionAttributeValues).toMatchObject({ ':minus': -1 });
    expect(input.ConditionExpression).toBe('#n > :zero');
  });

  it('ignores a counter that is already at zero', async () => {
    ddb.on(UpdateCommand).rejects(full());
    await expect(releaseDailyCall('2026-12-24')).resolves.toBeUndefined();
  });
});

describe('takeSmsCode', () => {
  it('counts per user and clock hour, with a short expiry', async () => {
    const now = new Date('2026-12-20T09:41:00Z');
    await expect(takeSmsCode('sub-1', now)).resolves.toBe(true);
    const input = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.Key).toEqual({ statKey: 'CAP#SMS#sub-1#2026-12-20T09' });
    expect(input.ExpressionAttributeValues).toMatchObject({ ':max': 5, ':exp': now.getTime() / 1000 + 7200 });
  });

  it('returns false once the user reached the hourly limit', async () => {
    ddb.on(UpdateCommand).rejects(full());
    await expect(takeSmsCode('sub-1')).resolves.toBe(false);
  });
});
