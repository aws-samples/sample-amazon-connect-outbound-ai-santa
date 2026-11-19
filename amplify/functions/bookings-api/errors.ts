// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** An error whose message is safe to show to the parent, in Spanish. */
export class UserError extends Error {
  readonly name = 'UserError';
}
