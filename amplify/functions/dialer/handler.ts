// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import type { Context } from 'aws-lambda';
import { ConnectClient, StartOutboundVoiceContactCommand, type StartOutboundVoiceContactCommandInput } from '@aws-sdk/client-connect';
import { getBooking, markCalling, setContactId } from '../../shared/bookings.js';
import { handleUnanswered } from '../../shared/outcome.js';
import { bumpStats } from '../../shared/stats.js';

const connect = new ConnectClient({});

export function buildCallRequest(bookingId: string, phoneNumber: string, attempt: number): StartOutboundVoiceContactCommandInput {
  const flowId = process.env.CONNECT_CONTACT_FLOW_ID;
  const source = process.env.CONNECT_SOURCE_PHONE_NUMBER;
  if (!flowId || !source) {
    throw new Error('CONNECT_CONTACT_FLOW_ID and CONNECT_SOURCE_PHONE_NUMBER must be set before Santa can call');
  }
  const req: StartOutboundVoiceContactCommandInput = {
    InstanceId: process.env.CONNECT_INSTANCE_ID,
    ContactFlowId: flowId,
    DestinationPhoneNumber: phoneNumber,
    SourcePhoneNumber: source,
    // Only the booking ID goes into contact attributes: Connect keeps contact records for 24 months.
    Attributes: { bookingId },
    // Idempotency per attempt: a scheduler retry of the same attempt does not place a second call.
    ClientToken: `${bookingId}-${attempt}`,
  };
  const campaignId = process.env.CONNECT_CAMPAIGN_ID;
  if (campaignId) {
    req.TrafficType = 'CAMPAIGN';
    req.CampaignId = campaignId;
    // Connect only accepts a ring timeout on campaign traffic ("TrafficType CAMPAIGN is required to enable ring timer").
    req.RingTimeoutInSeconds = 40;
    req.AnswerMachineDetectionConfig = { EnableAnswerMachineDetection: true, AwaitAnswerMachinePrompt: false };
  }
  return req;
}

export const handler = async (event: { bookingId?: string }, context?: Context) => {
  if (!process.env.DIALER_FUNCTION_ARN && context?.invokedFunctionArn) {
    // Strip a version or alias qualifier so retries target the function itself.
    process.env.DIALER_FUNCTION_ARN = context.invokedFunctionArn.split(':').slice(0, 7).join(':');
  }
  const bookingId = event.bookingId;
  if (!bookingId) throw new Error('bookingId missing');

  const booking = await getBooking(bookingId);
  if (!booking) {
    console.log('booking no longer exists, skipping', { bookingId });
    return;
  }
  if (!(await markCalling(bookingId))) {
    console.log('booking not in SCHEDULED state, skipping', { bookingId, status: booking.status });
    return;
  }
  const attempt = booking.attempts + 1;

  try {
    const req = buildCallRequest(bookingId, booking.phoneNumber, attempt);
    const res = await connect.send(new StartOutboundVoiceContactCommand(req));
    await setContactId(bookingId, res.ContactId!);
    console.log('call started', { bookingId, attempt, contactId: res.ContactId });
    await bumpStats({ dialled: 1 });
  } catch (err) {
    console.error('call failed to start', { bookingId, attempt, error: (err as Error).name, message: (err as Error).message });
    await handleUnanswered({ ...booking, attempts: attempt, status: 'CALLING' });
  }
};
