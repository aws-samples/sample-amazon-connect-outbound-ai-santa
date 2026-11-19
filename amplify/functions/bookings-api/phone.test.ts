// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { AdminUpdateUserAttributesCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import {
  EndUserMessagingClient,
  SendNotifyCodeVerificationCommand,
  ValidateNotifyCodeVerificationCommand,
} from '@aws-sdk/client-endusermessaging';
import type { AppSyncIdentityCognito } from 'aws-lambda';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { handler } from './handler.js';
import { sendPhoneCode, verifyPhoneCode } from './phone.js';

const cognito = mockClient(CognitoIdentityProviderClient);
const eum = mockClient(EndUserMessagingClient);
const ddb = mockClient(DynamoDBDocumentClient);

const identity = { sub: 'sub-1', username: 'user-1' } as AppSyncIdentityCognito;

beforeEach(() => {
  cognito.reset();
  eum.reset();
  ddb.reset();
  process.env.NOTIFY_CONFIGURATION_ARN = 'arn:aws:sms-voice:eu-central-1:111111111111:notify-configuration/notify-1';
  process.env.NOTIFY_CODE_CONFIGURATION_ID = 'cc-1';
  eum.on(SendNotifyCodeVerificationCommand).resolves({ messageId: 'm-1', verificationId: 'v-1' });
});

describe('sendPhoneCode', () => {
  it('asks Notify to generate and send a code bound to the user', async () => {
    await expect(sendPhoneCode(identity, '+34 600 123 456')).resolves.toBe(true);
    expect(eum.commandCalls(SendNotifyCodeVerificationCommand)[0].args[0].input).toEqual({
      channel: 'TEXT',
      originationIdentity: 'arn:aws:sms-voice:eu-central-1:111111111111:notify-configuration/notify-1',
      notifyCodeConfiguration: 'cc-1',
      destinationIdentity: '+34600123456',
      referenceId: 'user-sub-1',
    });
  });

  it('rejects numbers that are not Spanish mobiles without sending anything', async () => {
    for (const phone of ['+34900123456', '+447700900123', '600123456', '']) {
      await expect(sendPhoneCode(identity, phone)).rejects.toThrow(/móvil español/);
    }
    expect(eum.commandCalls(SendNotifyCodeVerificationCommand)).toHaveLength(0);
  });

  it('turns throttling into a message for the parent', async () => {
    eum.on(SendNotifyCodeVerificationCommand).rejects(Object.assign(new Error('slow down'), { name: 'ThrottlingException' }));
    await expect(sendPhoneCode(identity, '+34600123456')).rejects.toThrow(/demasiados códigos/);
  });

  it('stops at the per-user hourly limit without asking Notify', async () => {
    ddb.on(UpdateCommand).rejects(new ConditionalCheckFailedException({ message: 'limit', $metadata: {} }));
    await expect(sendPhoneCode(identity, '+34600123456')).rejects.toThrow(/demasiados códigos/);
    expect(eum.commandCalls(SendNotifyCodeVerificationCommand)).toHaveLength(0);
  });
});

describe('verifyPhoneCode', () => {
  it('saves the phone as verified only after Notify says the code is valid', async () => {
    eum.on(ValidateNotifyCodeVerificationCommand).resolves({ status: 'VALID' });
    await expect(verifyPhoneCode(identity, '+34600123456', ' 123456 ')).resolves.toBe(true);

    expect(eum.commandCalls(ValidateNotifyCodeVerificationCommand)[0].args[0].input).toEqual({
      destinationIdentity: '+34600123456',
      code: '123456',
      referenceId: 'user-sub-1',
    });
    expect(cognito.commandCalls(AdminUpdateUserAttributesCommand)[0].args[0].input).toEqual({
      UserPoolId: 'eu-central-1_test',
      Username: 'user-1',
      UserAttributes: [
        { Name: 'phone_number', Value: '+34600123456' },
        { Name: 'phone_number_verified', Value: 'true' },
      ],
    });
  });

  it('does not touch the account when the code is invalid', async () => {
    eum.on(ValidateNotifyCodeVerificationCommand).resolves({ status: 'INVALID' });
    await expect(verifyPhoneCode(identity, '+34600123456', '123456')).rejects.toThrow(/no es correcto/);
    expect(cognito.commandCalls(AdminUpdateUserAttributesCommand)).toHaveLength(0);
  });

  it('rejects malformed codes without calling Notify', async () => {
    await expect(verifyPhoneCode(identity, '+34600123456', '12ab')).rejects.toThrow(/6 cifras/);
    expect(eum.commandCalls(ValidateNotifyCodeVerificationCommand)).toHaveLength(0);
  });
});

describe('handler', () => {
  it('routes the phone mutations and shows parent-safe errors', async () => {
    eum.on(ValidateNotifyCodeVerificationCommand).resolves({ status: 'INVALID' });
    const event = (fieldName: string, args: Record<string, string>) => ({ typeName: 'Mutation', fieldName, arguments: args, identity });
    await expect(handler(event('sendPhoneCode', { phoneNumber: '+34600123456' }))).resolves.toBe(true);
    await expect(handler(event('verifyPhoneCode', { phoneNumber: '+34600123456', code: '000000' }))).rejects.toThrow(/no es correcto/);
  });
});
