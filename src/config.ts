// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import outputs from '../amplify_outputs.json';

const custom = (outputs as { custom?: { requirePhoneVerification?: boolean; santaCallerNumber?: string } }).custom;

/** False when the backend lets parents skip the SMS code (REQUIRE_PHONE_VERIFICATION=false). */
export const phoneVerificationRequired = custom?.requirePhoneVerification !== false;

/** Number Santa calls from (CONNECT_SOURCE_PHONE_NUMBER), E.164. Empty until the backend is redeployed. */
export const santaCallerNumber = custom?.santaCallerNumber ?? '';
