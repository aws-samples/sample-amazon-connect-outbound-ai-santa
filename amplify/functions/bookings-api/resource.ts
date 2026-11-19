// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineFunction } from '@aws-amplify/backend';

export const bookingsApi = defineFunction({
  name: 'bookings-api',
  entry: './handler.ts',
  runtime: 24,
  timeoutSeconds: 20,
  resourceGroupName: 'data',
});
