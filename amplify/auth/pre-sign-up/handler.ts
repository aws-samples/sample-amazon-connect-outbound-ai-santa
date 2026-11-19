// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import type { PreSignUpTriggerHandler } from 'aws-lambda';
import { isEmailAllowed } from '../../shared/validation.js';

/**
 * Only allowlisted emails or domains can sign up by themselves. An empty allowlist blocks every
 * self sign-up. Users an admin creates (AdminCreateUser, including approved access requests) are
 * always allowed: a person already decided.
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  if (event.triggerSource === 'PreSignUp_AdminCreateUser') return event;
  const email = event.request.userAttributes.email ?? '';
  if (!isEmailAllowed(email, process.env.SIGNUP_ALLOWLIST ?? '')) {
    throw new Error('Este email no está autorizado para usar la demo de Santa.');
  }
  return event;
};
