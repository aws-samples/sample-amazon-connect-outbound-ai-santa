// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { afterEach, describe, expect, it } from 'vitest';
import { handler } from './handler.js';

function event(triggerSource: string, email: string) {
  return { triggerSource, request: { userAttributes: { email } }, response: {} } as unknown as PreSignUpTriggerEvent;
}
const run = (e: PreSignUpTriggerEvent) => (handler as (e: PreSignUpTriggerEvent) => Promise<PreSignUpTriggerEvent>)(e);

afterEach(() => {
  delete process.env.SIGNUP_ALLOWLIST;
});

describe('pre-sign-up', () => {
  it('blocks self sign-up outside the allowlist', async () => {
    process.env.SIGNUP_ALLOWLIST = '@example.com';
    await expect(run(event('PreSignUp_SignUp', 'someone@other.org'))).rejects.toThrow(/isn't allowed/);
    await expect(run(event('PreSignUp_SignUp', 'parent@example.com'))).resolves.toBeTruthy();
  });

  it('always lets an admin create a user', async () => {
    process.env.SIGNUP_ALLOWLIST = '';
    await expect(run(event('PreSignUp_AdminCreateUser', 'someone@other.org'))).resolves.toBeTruthy();
  });
});
