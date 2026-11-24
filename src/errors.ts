// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { allowedPhonePrefixes } from './config.ts';
import { t } from './i18n.ts';

/**
 * Turn an error into a message a parent can act on.
 * The bookings API already returns messages written for parents; Cognito and the network do not.
 */
const BY_NAME: Record<string, string> = {
  CodeMismatchException: t.errCodeMismatch,
  ExpiredCodeException: t.errExpiredCode,
  LimitExceededException: t.errTooManyAttempts,
  TooManyRequestsException: t.errTooManyAttempts,
  TooManyFailedAttemptsException: t.errTooManyAttempts,
  InvalidParameterException: t.phoneRejected(allowedPhonePrefixes[0]),
  AliasExistsException: t.errAliasExists,
  CodeDeliveryFailureException: t.errCodeDelivery,
  NotAuthorizedException: t.errSessionExpired,
  UserUnAuthenticatedException: t.errSessionExpired,
  NetworkError: t.errNetwork,
};

export function friendlyError(err: unknown): string {
  const e = err as { name?: string; message?: string } | null;
  if (e?.name && Object.hasOwn(BY_NAME, e.name)) return BY_NAME[e.name];
  const message = e?.message ?? '';
  if (/failed to fetch|network/i.test(message)) return BY_NAME.NetworkError;
  // A bookings API UserError (see unwrap in api.ts) is written for parents.
  if (message && e?.name === 'UserError') return message;
  return t.errGeneric;
}
