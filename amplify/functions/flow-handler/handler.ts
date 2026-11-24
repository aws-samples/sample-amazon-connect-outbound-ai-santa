// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { ConnectContactFlowEvent, ConnectContactFlowResult } from 'aws-lambda';
import { getBooking, setStatus } from '../../shared/bookings.js';
import { msg } from '../../shared/i18n.js';
import { bumpStats, talkStats } from '../../shared/stats.js';
import { CHILD_NAME_MAX, NOTES_MAX, sanitizeFreeText } from '../../shared/validation.js';

const lambda = new LambdaClient({});

export const MAX_WISHES = 15;
export const WISH_MAX = 80;

/** The Santa agent passes the wishlist as a string. Accept a JSON array or a comma, semicolon or newline separated list. */
export function parseWishes(raw: string | undefined): string[] {
  if (!raw) return [];
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    items = raw.split(/[\n;,]/);
  }
  return items
    .map((i) => sanitizeFreeText(typeof i === 'string' ? i : String(i ?? ''), WISH_MAX))
    .filter(Boolean)
    .slice(0, MAX_WISHES);
}

/**
 * The child's name and notes go back to the flow as Lambda output ($.External), and the Agentic CX block
 * passes them to the Santa agent as context variables. They are never set as contact attributes, so they
 * are not kept in the contact record, and the flow has logging disabled.
 */
async function start(bookingId: string, contactId: string): Promise<ConnectContactFlowResult> {
  const booking = await getBooking(bookingId);
  if (!booking || booking.contactId !== contactId) return { result: 'unknown' };
  await setStatus(bookingId, 'IN_CALL', { answeredAt: new Date().toISOString() });
  await bumpStats({ answered: 1 });
  return {
    result: 'ok',
    childName: sanitizeFreeText(booking.childName, CHILD_NAME_MAX),
    childNotes: sanitizeFreeText(booking.notes, NOTES_MAX) || msg().noNotes,
  };
}
async function noResponse(bookingId: string, contactId: string): Promise<ConnectContactFlowResult> {
  const booking = await getBooking(bookingId);
  if (!booking || booking.contactId !== contactId) return { result: 'unknown' };
  await setStatus(bookingId, 'NO_RESPONSE');
  return { result: 'ok' };
}

async function deliver(bookingId: string, contactId: string, params: Record<string, unknown>): Promise<ConnectContactFlowResult> {
  const booking = await getBooking(bookingId);
  if (!booking || booking.contactId !== contactId) return { result: 'unknown' };
  await bumpStats(talkStats(booking.answeredAt));
  await setStatus(bookingId, 'DELIVERED', {
    wishes: parseWishes(params.wishlist as string | undefined),
    behaviour: sanitizeFreeText(params.behaviour, 200),
    summary: sanitizeFreeText(params.summary, 500),
  });
  // Writing and sending the letter takes longer than the 8-second limit for Lambdas in a flow, so it runs async.
  await lambda.send(
    new InvokeCommand({
      FunctionName: process.env.SEND_LETTER_FUNCTION_NAME,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({ bookingId })),
    }),
  );
  return { result: 'ok' };
}

export const handler = async (event: ConnectContactFlowEvent): Promise<ConnectContactFlowResult> => {
  const contact = event.Details.ContactData;
  const params = event.Details.Parameters ?? {};
  const bookingId = contact.Attributes?.bookingId;
  if (!bookingId) return { result: 'unknown' };
  try {
    switch (params.action) {
      case 'start':
        return await start(bookingId, contact.ContactId);
      case 'noResponse':
        return await noResponse(bookingId, contact.ContactId);
      case 'deliver':
        return await deliver(bookingId, contact.ContactId, params);
      default:
        return { result: 'error' };
    }
  } catch (err) {
    console.error('flow-handler failed', { action: params.action, bookingId, error: (err as Error).name });
    return { result: 'error' };
  }
};
