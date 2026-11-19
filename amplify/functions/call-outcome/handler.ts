// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import type { EventBridgeEvent } from 'aws-lambda';
import { findByContactId, getBooking } from '../../shared/bookings.js';
import { handleCutShort, handleUnanswered } from '../../shared/outcome.js';

interface ContactEventDetail {
  eventType: string;
  contactId: string;
  instanceArn: string;
}

/** Runs on every Santa call DISCONNECTED event. A booking that still exists means no letter was delivered. */
export const handler = async (event: EventBridgeEvent<'Amazon Connect Contact Event', ContactEventDetail>) => {
  const { eventType, contactId } = event.detail;
  if (eventType !== 'DISCONNECTED' || !contactId) return;

  const indexed = await findByContactId(contactId);
  if (!indexed) return; // delivered (booking deleted) or not a Santa call
  // The index is eventually consistent: re-read the item so a just-delivered booking is not treated as missed.
  const booking = await getBooking(indexed.bookingId);
  if (!booking || booking.contactId !== contactId) return;

  switch (booking.status) {
    case 'CALLING':
    case 'NO_RESPONSE':
      await handleUnanswered(booking);
      break;
    case 'IN_CALL':
      await handleCutShort(booking);
      break;
    default:
      console.log('ignoring disconnect for booking in state', { bookingId: booking.bookingId, status: booking.status });
  }
};
