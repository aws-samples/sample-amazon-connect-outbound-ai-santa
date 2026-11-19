// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import outputs from '../amplify_outputs.json';

export type Language = 'en' | 'es';

interface CustomOutputs {
  requirePhoneVerification?: boolean;
  santaCallerNumber?: string;
  language?: string;
  callTimezone?: string;
  allowedPhonePrefixes?: unknown;
}

const custom = (outputs as { custom?: CustomOutputs }).custom;

/** False when the backend lets parents skip the SMS code (REQUIRE_PHONE_VERIFICATION=false). */
export const phoneVerificationRequired = custom?.requirePhoneVerification !== false;

/** Number Santa calls from (CONNECT_SOURCE_PHONE_NUMBER), E.164. Empty until the backend is redeployed. */
export const santaCallerNumber = custom?.santaCallerNumber ?? '';

/** Language of everything parents see (SANTA_LANGUAGE). English unless the backend says Spanish. */
export const language: Language = custom?.language === 'es' ? 'es' : 'en';

function validTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone of the call window (CALL_TIMEZONE). Every date and time shown to parents is in this zone. */
const zone = custom?.callTimezone;
export const callTimezone: string = validTimeZone(zone) ? zone : 'America/New_York';

/** E.164 country prefixes Santa may call (ALLOWED_PHONE_PREFIXES). The backend enforces them again. */
export const allowedPhonePrefixes: string[] = (() => {
  const list = custom?.allowedPhonePrefixes;
  const raw: unknown[] = Array.isArray(list) ? list : [];
  const valid = raw.filter((p): p is string => typeof p === 'string' && /^\+[1-9]\d{0,3}$/.test(p));
  return valid.length ? [...new Set(valid)] : ['+1'];
})();
