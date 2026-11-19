// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

export const client = generateClient<Schema>();

export type SantaCall = NonNullable<Schema['SantaCall']['type']>;

/**
 * Amplify Data returns GraphQL errors in the result; turn them into an exception with the backend's message.
 * The bookings API's `UserError` (a message written for parents) keeps its name, so `friendlyError` can show it.
 */
export function unwrap<T>(res: { data?: T | null; errors?: { message: string; errorType?: string | null }[] }): T {
  if (res.errors?.length) {
    const [first] = res.errors;
    const err = new Error(first.message);
    if (first.errorType === 'UserError') err.name = 'UserError';
    throw err;
  }
  return res.data as T;
}
