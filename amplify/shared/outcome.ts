// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { deleteBooking, setStatus, type Booking } from './bookings.js';
import { missedCallEmail, sendEmail } from './email.js';
import { scheduleDial } from './scheduler.js';
import { bumpStats, talkStats } from './stats.js';

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Nobody answered, voicemail picked up, or the call could not be placed.
 * Schedule another attempt, or tell the parent and delete the booking when attempts run out.
 * `booking.attempts` must already include the attempt that just failed.
 */
export async function handleUnanswered(booking: Booking, now = new Date()): Promise<'RETRY' | 'GAVE_UP'> {
  const maxAttempts = intEnv('MAX_CALL_ATTEMPTS', 3);
  if (booking.attempts < maxAttempts) {
    const next = new Date(now.getTime() + intEnv('RETRY_DELAY_MINUTES', 15) * 60_000);
    await setStatus(booking.bookingId, 'SCHEDULED', { callAtUtc: next.toISOString() });
    await scheduleDial(booking.bookingId, booking.attempts + 1, next);
    console.log('retry scheduled', { bookingId: booking.bookingId, attempt: booking.attempts + 1 });
    return 'RETRY';
  }
  await sendEmail(booking.parentEmail, missedCallEmail(booking.childName, 'NO_ANSWER'));
  await deleteBooking(booking.bookingId);
  await bumpStats({ missed: 1 }, now);
  console.log('attempts exhausted, parent notified', { bookingId: booking.bookingId });
  return 'GAVE_UP';
}

/** The child answered but the call ended before Santa delivered the letter. Do not call the child again. */
export async function handleCutShort(booking: Booking): Promise<void> {
  await sendEmail(booking.parentEmail, missedCallEmail(booking.childName, 'CUT_SHORT'));
  await deleteBooking(booking.bookingId);
  await bumpStats({ cutShort: 1, ...talkStats(booking.answeredAt) });
  console.log('call cut short, parent notified', { bookingId: booking.bookingId });
}
