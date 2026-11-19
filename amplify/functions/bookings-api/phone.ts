// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { AdminUpdateUserAttributesCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import {
  EndUserMessagingClient,
  SendNotifyCodeVerificationCommand,
  ValidateNotifyCodeVerificationCommand,
} from '@aws-sdk/client-endusermessaging';
import type { AppSyncIdentityCognito } from 'aws-lambda';
import { takeSmsCode } from '../../shared/limits.js';
import { msg } from '../../shared/i18n.js';
import { isMobileAllowed } from '../../shared/validation.js';
import { UserError } from './errors.js';

const cognito = new CognitoIdentityProviderClient({});
const eum = new EndUserMessagingClient({});

function checkPhone(raw: string | undefined): string {
  const phone = (raw ?? '').replace(/[\s-]/g, '');
  if (!isMobileAllowed(phone, process.env.ALLOWED_PHONE_PREFIXES ?? '+1')) {
    throw new UserError(msg().phoneInvalid);
  }
  return phone;
}

/**
 * The reference ID binds a code to the user who asked for it: a code sent to user A can never
 * verify user B, even for the same phone number.
 */
function referenceId(identity: AppSyncIdentityCognito): string {
  return `user-${identity.sub}`;
}

/** AWS End User Messaging Notify generates the code, sends it by SMS and keeps it for validation. */
export async function sendPhoneCode(identity: AppSyncIdentityCognito, rawPhone: string | undefined): Promise<boolean> {
  const phone = checkPhone(rawPhone);
  if (!(await takeSmsCode(identity.sub))) {
    throw new UserError(msg().tooManyCodes);
  }
  try {
    await eum.send(
      new SendNotifyCodeVerificationCommand({
        channel: 'TEXT',
        originationIdentity: process.env.NOTIFY_CONFIGURATION_ARN,
        notifyCodeConfiguration: process.env.NOTIFY_CODE_CONFIGURATION_ID,
        destinationIdentity: phone,
        referenceId: referenceId(identity),
      }),
    );
  } catch (err) {
    const name = (err as Error).name;
    if (name === 'ThrottlingException' || name === 'ServiceQuotaExceededException') {
      throw new UserError(msg().tooManyCodesWait);
    }
    throw err;
  }
  return true;
}

/** Checks the code with Notify and, only if it is valid, saves the phone on the account as verified. */
export async function verifyPhoneCode(
  identity: AppSyncIdentityCognito,
  rawPhone: string | undefined,
  rawCode: string | undefined,
): Promise<boolean> {
  const phone = checkPhone(rawPhone);
  const code = (rawCode ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new UserError(msg().codeSixDigits);

  const res = await eum.send(
    new ValidateNotifyCodeVerificationCommand({ destinationIdentity: phone, code, referenceId: referenceId(identity) }),
  );
  if (res.status !== 'VALID') {
    throw new UserError(msg().codeWrong);
  }

  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: identity.username,
      UserAttributes: [
        { Name: 'phone_number', Value: phone },
        { Name: 'phone_number_verified', Value: 'true' },
      ],
    }),
  );
  return true;
}
