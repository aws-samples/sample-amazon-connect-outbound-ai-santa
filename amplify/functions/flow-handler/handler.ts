// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ConnectClient, DescribeContactCommand } from '@aws-sdk/client-connect';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { QConnectClient, UpdateSessionDataCommand } from '@aws-sdk/client-qconnect';
import type { ConnectContactFlowEvent, ConnectContactFlowResult } from 'aws-lambda';
import { getBooking, setStatus } from '../../shared/bookings.js';
import { bumpStats, talkStats } from '../../shared/stats.js';
import { sanitizeFreeText } from '../../shared/validation.js';

const connect = new ConnectClient({});
const qconnect = new QConnectClient({});
const lambda = new LambdaClient({});

export const MAX_WISHES = 15;
export const WISH_MAX = 80;

/** The AI agent passes the wishlist as a string. Accept a JSON array or a comma, semicolon or newline separated list. */
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

/** Session ARN format: arn:aws:wisdom:<region>:<account>:session/<assistantId>/<sessionId> */
export function parseSessionArn(arn: string): { assistantId: string; sessionId: string } | undefined {
  const m = /:session\/([^/]+)\/([^/]+)$/.exec(arn);
  return m ? { assistantId: m[1], sessionId: m[2] } : undefined;
}

async function start(bookingId: string, contactId: string, instanceArn: string): Promise<ConnectContactFlowResult> {
  const booking = await getBooking(bookingId);
  if (!booking || booking.contactId !== contactId) return { result: 'unknown' };
  await setStatus(bookingId, 'IN_CALL', { answeredAt: new Date().toISOString() });
  await bumpStats({ answered: 1 });

  const instanceId = instanceArn.split('/').pop();
  const contact = await connect.send(new DescribeContactCommand({ InstanceId: instanceId, ContactId: contactId }));
  const session = parseSessionArn(contact.Contact?.WisdomInfo?.SessionArn ?? '');
  if (!session) {
    console.error('no AI agent session on contact; is the Connect assistant block before this Lambda?', { bookingId });
    return { result: 'error' };
  }
  // Child context goes to the AI agent session, not to contact attributes, so it is not kept in the contact record.
  await qconnect.send(
    new UpdateSessionDataCommand({
      assistantId: process.env.QCONNECT_ASSISTANT_ID || session.assistantId,
      sessionId: session.sessionId,
      data: [
        { key: 'childName', value: { stringValue: booking.childName } },
        { key: 'childNotes', value: { stringValue: booking.notes || 'Sin notas.' } },
      ],
    }),
  );
  return { result: 'ok' };
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
        return await start(bookingId, contact.ContactId, contact.InstanceARN);
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
