// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { bookingsApi } from '../functions/bookings-api/resource.js';

const schema = a.schema({
  SantaCall: a.customType({
    bookingId: a.id().required(),
    childName: a.string().required(),
    callDate: a.string().required(),
    callTime: a.string().required(),
    status: a.string().required(),
  }),

  StatCounts: a.customType({
    scheduled: a.integer().required(),
    cancelled: a.integer().required(),
    dialled: a.integer().required(),
    answered: a.integer().required(),
    lettersSent: a.integer().required(),
    wishes: a.integer().required(),
    giftLinks: a.integer().required(),
    missed: a.integer().required(),
    cutShort: a.integer().required(),
    talkSeconds: a.integer().required(),
    timedCalls: a.integer().required(),
  }),

  DayStats: a.customType({
    day: a.string().required(),
    scheduled: a.integer().required(),
    cancelled: a.integer().required(),
    dialled: a.integer().required(),
    answered: a.integer().required(),
    lettersSent: a.integer().required(),
    wishes: a.integer().required(),
    giftLinks: a.integer().required(),
    missed: a.integer().required(),
    cutShort: a.integer().required(),
    talkSeconds: a.integer().required(),
    timedCalls: a.integer().required(),
  }),

  WorkshopStats: a.customType({
    totals: a.ref('StatCounts').required(),
    days: a.ref('DayStats').required().array().required(),
    pending: a.integer().required(),
    live: a.integer().required(),
    updatedAt: a.string().required(),
  }),

  scheduleCall: a
    .mutation()
    .arguments({
      childName: a.string().required(),
      notes: a.string(),
      callDate: a.string().required(),
      callTime: a.string().required(),
      phoneNumber: a.string(),
      // Admins only: ignore date and time and call one minute from now, for quick tests.
      inOneMinute: a.boolean(),
    })
    .returns(a.ref('SantaCall'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(bookingsApi)),

  cancelCall: a
    .mutation()
    .arguments({ bookingId: a.id().required() })
    .returns(a.boolean())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(bookingsApi)),

  listMyCalls: a
    .query()
    .returns(a.ref('SantaCall').array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(bookingsApi)),

  // Aggregate counters only (no child data), for the admin view.
  workshopStats: a
    .query()
    .returns(a.ref('WorkshopStats'))
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(bookingsApi)),

  // Phone verification with AWS End User Messaging Notify: AWS generates, sends and validates the code.
  sendPhoneCode: a
    .mutation()
    .arguments({ phoneNumber: a.string().required() })
    .returns(a.boolean())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(bookingsApi)),

  verifyPhoneCode: a
    .mutation()
    .arguments({ phoneNumber: a.string().required(), code: a.string().required() })
    .returns(a.boolean())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(bookingsApi)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
  // Request-level logs only. No field values and no verbose content: the arguments carry the child's
  // name and the parents' notes, which must never reach CloudWatch.
  logging: { fieldLogLevel: 'none', excludeVerboseContent: true, retention: '1 week' },
});
