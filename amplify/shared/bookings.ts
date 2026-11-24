// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * SCHEDULED   waiting for the scheduler
 * CALLING     dialer started the outbound call
 * IN_CALL     the flow reached the Santa agent (someone answered)
 * NO_RESPONSE the flow detected voicemail or silence
 * DELIVERED   Santa finished; the letter email is being sent
 * Completed, missed and cancelled bookings are deleted, not kept with a final status.
 */
export type BookingStatus = 'SCHEDULED' | 'CALLING' | 'IN_CALL' | 'NO_RESPONSE' | 'DELIVERED';

export interface Booking {
  bookingId: string;
  ownerSub: string;
  childName: string;
  notes: string;
  parentEmail: string;
  phoneNumber: string;
  callDate: string; // wall clock in CALL_TIMEZONE
  callTime: string;
  callAtUtc: string;
  status: BookingStatus;
  attempts: number;
  contactId?: string;
  /** Set by the flow when Santa hands over the letter. */
  wishes?: string[];
  behaviour?: string;
  summary?: string;
  /** ISO time the flow reached the Santa agent. Used only for the average call length. */
  answeredAt?: string;
  createdAt: string;
  /** Epoch seconds. DynamoDB deletes the item after this as a safety net. */
  expiresAt: number;
}

export const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function table(): string {
  const name = process.env.BOOKINGS_TABLE;
  if (!name) throw new Error('BOOKINGS_TABLE is not set');
  return name;
}

export async function putBooking(b: Booking): Promise<void> {
  await doc.send(
    new PutCommand({ TableName: table(), Item: b, ConditionExpression: 'attribute_not_exists(bookingId)' }),
  );
}

export async function getBooking(bookingId: string): Promise<Booking | undefined> {
  const res = await doc.send(new GetCommand({ TableName: table(), Key: { bookingId } }));
  return res.Item as Booking | undefined;
}

export async function listByOwner(ownerSub: string): Promise<Booking[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: table(),
      IndexName: 'byOwner',
      KeyConditionExpression: 'ownerSub = :o',
      ExpressionAttributeValues: { ':o': ownerSub },
    }),
  );
  return (res.Items ?? []) as Booking[];
}

export async function findByContactId(contactId: string): Promise<Booking | undefined> {
  const res = await doc.send(
    new QueryCommand({
      TableName: table(),
      IndexName: 'byContact',
      KeyConditionExpression: 'contactId = :c',
      ExpressionAttributeValues: { ':c': contactId },
      Limit: 1,
    }),
  );
  return res.Items?.[0] as Booking | undefined;
}

/** Atomically move SCHEDULED -> CALLING and count the attempt. Returns false if another invocation got there first. */
export async function markCalling(bookingId: string): Promise<boolean> {
  try {
    await doc.send(
      new UpdateCommand({
        TableName: table(),
        Key: { bookingId },
        UpdateExpression: 'SET #s = :calling, attempts = attempts + :one REMOVE contactId',
        ConditionExpression: '#s = :scheduled',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':calling': 'CALLING', ':scheduled': 'SCHEDULED', ':one': 1 },
      }),
    );
    return true;
  } catch (err) {
    if ((err as Error).name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

export async function setContactId(bookingId: string, contactId: string): Promise<void> {
  await doc.send(
    new UpdateCommand({
      TableName: table(),
      Key: { bookingId },
      UpdateExpression: 'SET contactId = :c',
      ConditionExpression: 'attribute_exists(bookingId)',
      ExpressionAttributeValues: { ':c': contactId },
    }),
  );
}

export async function setStatus(bookingId: string, status: BookingStatus, extra: Record<string, unknown> = {}): Promise<void> {
  const names: Record<string, string> = { '#s': 'status' };
  const values: Record<string, unknown> = { ':s': status };
  const sets = ['#s = :s'];
  for (const [k, v] of Object.entries(extra)) {
    names[`#${k}`] = k;
    values[`:${k}`] = v;
    sets.push(`#${k} = :${k}`);
  }
  await doc.send(
    new UpdateCommand({
      TableName: table(),
      Key: { bookingId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ConditionExpression: 'attribute_exists(bookingId)',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function deleteBooking(bookingId: string): Promise<void> {
  await doc.send(new DeleteCommand({ TableName: table(), Key: { bookingId } }));
}
