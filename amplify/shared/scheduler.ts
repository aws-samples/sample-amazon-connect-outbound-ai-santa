// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  ActionAfterCompletion,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  FlexibleTimeWindowMode,
  SchedulerClient,
} from '@aws-sdk/client-scheduler';
import { toAtExpression } from './time.js';

export const scheduler = new SchedulerClient({});

export function scheduleName(bookingId: string, attempt: number): string {
  return `santa-${bookingId}-${attempt}`;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Create a one-time schedule that invokes the dialer with `{ bookingId }` and deletes itself afterwards. */
export async function scheduleDial(bookingId: string, attempt: number, utc: Date): Promise<void> {
  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName(bookingId, attempt),
      GroupName: env('SCHEDULE_GROUP'),
      ScheduleExpression: toAtExpression(utc),
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
      ActionAfterCompletion: ActionAfterCompletion.DELETE,
      Target: {
        Arn: env('DIALER_FUNCTION_ARN'),
        RoleArn: env('SCHEDULER_ROLE_ARN'),
        Input: JSON.stringify({ bookingId }),
        RetryPolicy: { MaximumRetryAttempts: 2, MaximumEventAgeInSeconds: 300 },
      },
    }),
  );
}

export async function deleteSchedule(bookingId: string, attempt: number): Promise<void> {
  try {
    await scheduler.send(
      new DeleteScheduleCommand({ Name: scheduleName(bookingId, attempt), GroupName: env('SCHEDULE_GROUP') }),
    );
  } catch (err) {
    if ((err as Error).name !== 'ResourceNotFoundException') throw err;
  }
}
