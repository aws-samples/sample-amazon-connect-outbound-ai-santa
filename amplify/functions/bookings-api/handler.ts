// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { AppSyncIdentityCognito } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { deleteBooking, getBooking, listByOwner, putBooking, type Booking } from '../../shared/bookings.js';
import { checkText } from '../../shared/guardrail.js';
import { deleteSchedule, scheduleDial } from '../../shared/scheduler.js';
import { bumpStats, readWorkshopStats, type WorkshopStats } from '../../shared/stats.js';
import { releaseDailyCall, reserveDailyCall } from '../../shared/limits.js';
import { msg } from '../../shared/i18n.js';
import { localDate, localTime, validateCallTime } from '../../shared/time.js';
import { isPhoneAllowed, validateChildName, validateNotes } from '../../shared/validation.js';
import { UserError } from './errors.js';
import { sendPhoneCode, verifyPhoneCode } from './phone.js';

export { UserError };

const cognito = new CognitoIdentityProviderClient({});

const MAX_ACTIVE_BOOKINGS = 3;
/** Keep data at most this long after the scheduled time, even if something fails. */
const RETENTION_SECONDS = 2 * 86_400;

export interface PublicBooking {
  bookingId: string;
  childName: string;
  callDate: string;
  callTime: string;
  status: string;
}

function toPublic(b: Booking): PublicBooking {
  return { bookingId: b.bookingId, childName: b.childName, callDate: b.callDate, callTime: b.callTime, status: b.status };
}

export function phoneVerificationRequired(): boolean {
  return process.env.REQUIRE_PHONE_VERIFICATION !== 'false';
}

/**
 * The caller's verified email always comes from Cognito, never from the request.
 * The phone is the SMS-verified one from Cognito. Only when REQUIRE_PHONE_VERIFICATION=false
 * may the request supply an unverified number, and it must still match ALLOWED_PHONE_PREFIXES.
 */
export async function verifiedContact(username: string, requestedPhone?: string): Promise<{ email: string; phone: string }> {
  const res = await cognito.send(new AdminGetUserCommand({ UserPoolId: process.env.USER_POOL_ID, Username: username }));
  const attr = (n: string) => res.UserAttributes?.find((a) => a.Name === n)?.Value;
  if (attr('email_verified') !== 'true' || !attr('email')) throw new UserError(msg().verifyEmailFirst);
  const verifiedPhone = attr('phone_number_verified') === 'true' ? attr('phone_number') : undefined;
  const requested = requestedPhone?.replace(/[\s-]/g, '') || undefined;
  if (!phoneVerificationRequired() && requested) return { email: attr('email')!, phone: requested };
  if (!verifiedPhone) {
    throw new UserError(
      phoneVerificationRequired() ? msg().verifyPhoneFirst : msg().typePhone,
    );
  }
  return { email: attr('email')!, phone: verifiedPhone };
}

interface ScheduleArgs {
  childName?: string;
  notes?: string;
  callDate?: string;
  /** Only used when REQUIRE_PHONE_VERIFICATION=false. */
  phoneNumber?: string;
  callTime?: string;
  /** Admins only: call one minute from now, ignoring the date, time and call window. */
  inOneMinute?: boolean | null;
}

/** How far ahead a quick test call is placed. */
export const QUICK_TEST_DELAY_MS = 60_000;

export async function scheduleCall(identity: AppSyncIdentityCognito, args: ScheduleArgs, now = new Date()): Promise<PublicBooking> {
  const name = validateChildName(args.childName);
  if (!name.ok) throw new UserError(name.error);
  const notes = validateNotes(args.notes);
  if (!notes.ok) throw new UserError(notes.error);

  const quick = args.inOneMinute === true;
  if (quick && !identity.groups?.includes(ADMIN_GROUP)) {
    throw new UserError(msg().adminOnlyQuickTest);
  }
  // A quick test skips the call window on purpose; every other check (phone, limits, guardrail) still applies.
  const quickAt = new Date(Math.ceil((now.getTime() + QUICK_TEST_DELAY_MS) / 1000) * 1000);
  const when = quick
    ? ({ ok: true, utc: quickAt } as const)
    : validateCallTime(
        args.callDate ?? '',
        args.callTime ?? '',
        {
          windowStart: process.env.CALL_WINDOW_START ?? '09:00',
          windowEnd: process.env.CALL_WINDOW_END ?? '22:00',
          minLeadMinutes: 5,
        },
        now,
      );
  if (!when.ok) throw new UserError(when.error);
  const callDate = quick ? localDate(when.utc) : args.callDate!;
  const callTime = quick ? localTime(when.utc) : args.callTime!;

  const { email, phone } = await verifiedContact(identity.username, args.phoneNumber);
  if (!isPhoneAllowed(phone, process.env.ALLOWED_PHONE_PREFIXES ?? '+1')) {
    throw new UserError(msg().phoneNotAllowed);
  }

  const active = await listByOwner(identity.sub);
  if (active.length >= MAX_ACTIVE_BOOKINGS) {
    throw new UserError(msg().maxActive(MAX_ACTIVE_BOOKINGS));
  }

  // The notes go into Santa's prompt, so they pass the guardrail (prompt attacks, harmful content) first.
  const textForCheck = `Nombre: ${name.value}\nNotas: ${notes.value}`;
  const check = await checkText(textForCheck, 'INPUT');
  if (!check.allowed) {
    throw new UserError(msg().notesBlocked);
  }

  // Global cost cap, after every other check so a rejected request never takes a slot.
  if (!(await reserveDailyCall(args.callDate!))) {
    throw new UserError(msg().dayFull);
  }

  const booking: Booking = {
    bookingId: randomUUID(),
    ownerSub: identity.sub,
    childName: name.value,
    notes: notes.value,
    parentEmail: email,
    phoneNumber: phone,
    callDate,
    callTime,
    callAtUtc: when.utc.toISOString(),
    status: 'SCHEDULED',
    attempts: 0,
    createdAt: now.toISOString(),
    expiresAt: Math.floor(when.utc.getTime() / 1000) + RETENTION_SECONDS,
  };
  try {
    await putBooking(booking);
  } catch (err) {
    await releaseDailyCall(booking.callDate);
    throw err;
  }
  try {
    await scheduleDial(booking.bookingId, 1, when.utc);
  } catch (err) {
    await deleteBooking(booking.bookingId);
    await releaseDailyCall(booking.callDate);
    throw err;
  }
  await bumpStats({ scheduled: 1 }, now);
  return toPublic(booking);
}

export async function cancelCall(identity: AppSyncIdentityCognito, bookingId: string): Promise<boolean> {
  const b = await getBooking(bookingId);
  if (!b || b.ownerSub !== identity.sub) throw new UserError(msg().callNotFound);
  if (b.status !== 'SCHEDULED') throw new UserError(msg().alreadyCalling);
  await deleteSchedule(b.bookingId, b.attempts + 1);
  await deleteBooking(b.bookingId);
  await releaseDailyCall(b.callDate);
  await bumpStats({ cancelled: 1 });
  return true;
}

export const ADMIN_GROUP = 'ADMINS';

/** Aggregate numbers for the admin view. AppSync already restricts the query to the group; this checks again. */
export async function workshopStats(identity: AppSyncIdentityCognito): Promise<WorkshopStats> {
  if (!identity.groups?.includes(ADMIN_GROUP)) throw new UserError(msg().adminOnlyWorkshop);
  return readWorkshopStats();
}

export async function listMyCalls(identity: AppSyncIdentityCognito): Promise<PublicBooking[]> {
  const items = await listByOwner(identity.sub);
  return items.map(toPublic).sort((a, b) => `${a.callDate}${a.callTime}`.localeCompare(`${b.callDate}${b.callTime}`));
}

/**
 * Payload sent by the Amplify Data `a.handler.function` resolver. Unlike a direct AppSync Lambda
 * resolver, `typeName` and `fieldName` sit at the top level and there is no `info` object.
 */
export interface AmplifyFunctionEvent {
  typeName: string;
  fieldName: string;
  /** Strings, except `inOneMinute` on scheduleCall, which is a boolean. */
  arguments: Record<string, string | undefined>;
  identity: AppSyncIdentityCognito | null;
}

export const handler = async (event: AmplifyFunctionEvent) => {
  const identity = event.identity;
  if (!identity?.sub || !identity.username) throw new Error('Unauthorized');
  try {
    switch (event.fieldName) {
      case 'scheduleCall':
        return await scheduleCall(identity, event.arguments as unknown as ScheduleArgs);
      case 'cancelCall':
        return await cancelCall(identity, event.arguments.bookingId ?? '');
      case 'listMyCalls':
        return await listMyCalls(identity);
      case 'workshopStats':
        return await workshopStats(identity);
      case 'sendPhoneCode':
        return await sendPhoneCode(identity, event.arguments.phoneNumber);
      case 'verifyPhoneCode':
        return await verifyPhoneCode(identity, event.arguments.phoneNumber, event.arguments.code);
      default:
        throw new Error(`Unknown field ${event.fieldName}`);
    }
  } catch (err) {
    if (err instanceof UserError) throw err;
    console.error('bookings-api failed', { field: event.fieldName, error: (err as Error).name });
    throw new Error(msg().genericError);
  }
};
