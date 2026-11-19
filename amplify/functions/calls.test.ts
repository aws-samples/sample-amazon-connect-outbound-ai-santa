// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ApplyGuardrailCommand, BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { ConnectClient, DescribeContactCommand, StartOutboundVoiceContactCommand } from '@aws-sdk/client-connect';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { QConnectClient, UpdateSessionDataCommand } from '@aws-sdk/client-qconnect';
import { CreateScheduleCommand, SchedulerClient } from '@aws-sdk/client-scheduler';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { ConnectContactFlowEvent, EventBridgeEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Booking } from '../shared/bookings.js';
import { handler as outcome } from './call-outcome/handler.js';
import { buildCallRequest, handler as dial } from './dialer/handler.js';
import { handler as flow, parseSessionArn, parseWishes } from './flow-handler/handler.js';
import { handler as sendLetter } from './send-letter/handler.js';

const ddb = mockClient(DynamoDBDocumentClient);
const connect = mockClient(ConnectClient);
const qconnect = mockClient(QConnectClient);
const lambda = mockClient(LambdaClient);
const scheduler = mockClient(SchedulerClient);
const ses = mockClient(SESv2Client);
const bedrock = mockClient(BedrockRuntimeClient);

const base: Booking = {
  bookingId: 'b1',
  ownerSub: 'user-1',
  childName: 'Lucía',
  notes: 'Le gustan los dinosaurios',
  parentEmail: 'parent@example.com',
  phoneNumber: '+34600123456',
  callDate: '2026-12-24',
  callTime: '18:00',
  callAtUtc: '2026-12-24T17:00:00.000Z',
  status: 'SCHEDULED',
  attempts: 0,
  createdAt: '2026-12-20T09:00:00.000Z',
  expiresAt: 0,
};

function withBooking(b: Partial<Booking>) {
  ddb.on(GetCommand).resolves({ Item: { ...base, ...b } });
}

function flowEvent(action: string, extra: Record<string, string> = {}): ConnectContactFlowEvent {
  return {
    Name: 'ContactFlowEvent',
    Details: {
      ContactData: { ContactId: 'c1', InstanceARN: 'arn:aws:connect:eu-central-1:111111111111:instance/instance-1', Attributes: { bookingId: 'b1' } },
      Parameters: { action, ...extra },
    },
  } as unknown as ConnectContactFlowEvent;
}

function disconnect(): EventBridgeEvent<'Amazon Connect Contact Event', { eventType: string; contactId: string; instanceArn: string }> {
  return { detail: { eventType: 'DISCONNECTED', contactId: 'c1', instanceArn: 'arn' } } as never;
}

beforeEach(() => {
  for (const m of [ddb, connect, qconnect, lambda, scheduler, ses, bedrock]) m.reset();
});

describe('dialer', () => {
  it('puts only the booking ID in contact attributes', () => {
    const req = buildCallRequest('b1', '+34600123456', 1);
    expect(req.Attributes).toEqual({ bookingId: 'b1' });
    expect(req.TrafficType).toBeUndefined();
    // Connect rejects a ring timeout without campaign traffic.
    expect(req.RingTimeoutInSeconds).toBeUndefined();
  });

  it('uses campaign traffic with answering machine detection when a campaign is configured', () => {
    process.env.CONNECT_CAMPAIGN_ID = 'camp-1';
    const req = buildCallRequest('b1', '+34600123456', 2);
    delete process.env.CONNECT_CAMPAIGN_ID;
    expect(req).toMatchObject({ TrafficType: 'CAMPAIGN', CampaignId: 'camp-1', ClientToken: 'b1-2', RingTimeoutInSeconds: 40 });
    expect(req.AnswerMachineDetectionConfig?.EnableAnswerMachineDetection).toBe(true);
  });

  it('places the call and stores the contact ID', async () => {
    withBooking({});
    connect.on(StartOutboundVoiceContactCommand).resolves({ ContactId: 'c1' });
    await dial({ bookingId: 'b1' });
    expect(connect.commandCalls(StartOutboundVoiceContactCommand)[0].args[0].input.DestinationPhoneNumber).toBe('+34600123456');
    const updates = ddb.commandCalls(UpdateCommand).map((c) => c.args[0].input.ExpressionAttributeValues);
    expect(updates).toContainEqual({ ':c': 'c1' });
  });

  it('schedules a retry when the call cannot be placed', async () => {
    withBooking({});
    connect.on(StartOutboundVoiceContactCommand).rejects(new Error('quota'));
    await dial({ bookingId: 'b1' });
    expect(scheduler.commandCalls(CreateScheduleCommand)[0].args[0].input.Name).toBe('santa-b1-2');
  });

  it('does nothing when the booking was cancelled', async () => {
    ddb.on(GetCommand).resolves({});
    await dial({ bookingId: 'b1' });
    expect(connect.commandCalls(StartOutboundVoiceContactCommand)).toHaveLength(0);
  });
});

describe('flow-handler', () => {
  it('parses wishes from a JSON array or a separated list, capped and sanitised', () => {
    expect(parseWishes('["Una bici", "Un dinosaurio <grande>"]')).toEqual(['Una bici', 'Un dinosaurio grande']);
    expect(parseWishes('bici, patinete; muñeca')).toEqual(['bici', 'patinete', 'muñeca']);
    expect(parseWishes(Array.from({ length: 30 }, (_, i) => `w${i}`).join(','))).toHaveLength(15);
  });

  it('parses the AI agent session ARN', () => {
    expect(parseSessionArn('arn:aws:wisdom:eu-central-1:111111111111:session/assist-1/sess-1')).toEqual({ assistantId: 'assist-1', sessionId: 'sess-1' });
  });

  it('start: passes child context to the AI agent session and marks the call IN_CALL', async () => {
    withBooking({ status: 'CALLING', contactId: 'c1' });
    connect.on(DescribeContactCommand).resolves({ Contact: { WisdomInfo: { SessionArn: 'arn:aws:wisdom:eu-central-1:1:session/a1/s1' } } });
    await expect(flow(flowEvent('start'))).resolves.toEqual({ result: 'ok' });
    const data = qconnect.commandCalls(UpdateSessionDataCommand)[0].args[0].input;
    expect(data.sessionId).toBe('s1');
    expect(data.data).toContainEqual({ key: 'childName', value: { stringValue: 'Lucía' } });
  });

  it('start: ignores a contact that does not match the booking', async () => {
    withBooking({ status: 'CALLING', contactId: 'other' });
    await expect(flow(flowEvent('start'))).resolves.toEqual({ result: 'unknown' });
  });

  it('deliver: stores the wishes and hands off to send-letter asynchronously', async () => {
    withBooking({ status: 'IN_CALL', contactId: 'c1' });
    await expect(flow(flowEvent('deliver', { wishlist: '["bici"]', behaviour: 'muy bien', summary: 'Charla' }))).resolves.toEqual({ result: 'ok' });
    const update = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.ExpressionAttributeValues).toMatchObject({ ':s': 'DELIVERED', ':wishes': ['bici'] });
    expect(lambda.commandCalls(InvokeCommand)[0].args[0].input.InvocationType).toBe('Event');
  });
});

describe('call-outcome', () => {
  it('retries an unanswered call', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ bookingId: 'b1' }] });
    withBooking({ status: 'CALLING', contactId: 'c1', attempts: 1 });
    await outcome(disconnect());
    expect(scheduler.commandCalls(CreateScheduleCommand)[0].args[0].input.Name).toBe('santa-b1-2');
    expect(ses.commandCalls(SendEmailCommand)).toHaveLength(0);
  });

  it('emails the parent and deletes the booking after the last attempt', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ bookingId: 'b1' }] });
    withBooking({ status: 'NO_RESPONSE', contactId: 'c1', attempts: 3 });
    await outcome(disconnect());
    expect(ses.commandCalls(SendEmailCommand)[0].args[0].input.Content?.Simple?.Subject?.Data).toMatch(/ha intentado llamar/);
    expect(ddb.commandCalls(DeleteCommand)).toHaveLength(1);
    expect(scheduler.commandCalls(CreateScheduleCommand)).toHaveLength(0);
  });

  it('does not call the child again when the call was cut short', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ bookingId: 'b1' }] });
    withBooking({ status: 'IN_CALL', contactId: 'c1', attempts: 1 });
    await outcome(disconnect());
    expect(scheduler.commandCalls(CreateScheduleCommand)).toHaveLength(0);
    expect(ses.commandCalls(SendEmailCommand)).toHaveLength(1);
  });

  it('ignores a delivered booking', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ bookingId: 'b1' }] });
    withBooking({ status: 'DELIVERED', contactId: 'c1', attempts: 1 });
    await outcome(disconnect());
    expect(ses.commandCalls(SendEmailCommand)).toHaveLength(0);
    expect(ddb.commandCalls(DeleteCommand)).toHaveLength(0);
  });
});

describe('send-letter', () => {
  it('drops blocked wishes, emails the parent and deletes the booking', async () => {
    withBooking({ status: 'DELIVERED', wishes: ['una bici', 'algo horrible'], behaviour: 'bien', summary: 'Charla' });
    bedrock.on(ApplyGuardrailCommand, { content: [{ text: { text: 'una bici\nalgo horrible' } }] } as never).resolves({
      action: 'GUARDRAIL_INTERVENED',
      assessments: [{ contentPolicy: { filters: [{ type: 'VIOLENCE', confidence: 'HIGH', action: 'BLOCKED' }] } }],
    });
    bedrock.on(ApplyGuardrailCommand, { content: [{ text: { text: 'una bici' } }] } as never).resolves({ action: 'NONE' });
    bedrock.on(ApplyGuardrailCommand, { content: [{ text: { text: 'algo horrible' } }] } as never).resolves({
      action: 'GUARDRAIL_INTERVENED',
      assessments: [{ contentPolicy: { filters: [{ type: 'VIOLENCE', confidence: 'HIGH', action: 'BLOCKED' }] } }],
    });
    bedrock.on(ConverseCommand).resolves({ stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: 'Párrafo uno.\n\nPárrafo dos.' }] } } });

    await sendLetter({ bookingId: 'b1' });

    const mail = ses.commandCalls(SendEmailCommand)[0].args[0].input;
    expect(mail.Destination?.ToAddresses).toEqual(['parent@example.com']);
    expect(mail.Content?.Simple?.Body?.Text?.Data).toContain('una bici');
    expect(mail.Content?.Simple?.Body?.Text?.Data).not.toContain('algo horrible');
    expect(ddb.commandCalls(DeleteCommand)).toHaveLength(1);
  });

  it('uses the fallback letter when the guardrail blocks the generated text', async () => {
    withBooking({ status: 'DELIVERED', wishes: ['una bici'] });
    bedrock.on(ApplyGuardrailCommand).resolves({ action: 'NONE' });
    bedrock.on(ConverseCommand).resolves({ stopReason: 'guardrail_intervened', output: { message: { role: 'assistant', content: [{ text: 'x' }] } } });
    await sendLetter({ bookingId: 'b1' });
    expect(ses.commandCalls(SendEmailCommand)[0].args[0].input.Content?.Simple?.Body?.Text?.Data).toContain('Acabo de hablar con Lucía');
  });
});
