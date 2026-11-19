// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

export const client = generateClient<Schema>();

export type SantaCall = NonNullable<Schema['SantaCall']['type']>;

/** Amplify Data returns GraphQL errors in the result; turn them into an exception with the backend's message. */
export function unwrap<T>(res: { data?: T | null; errors?: { message: string }[] }): T {
  if (res.errors?.length) throw new Error(res.errors[0].message);
  return res.data as T;
}
