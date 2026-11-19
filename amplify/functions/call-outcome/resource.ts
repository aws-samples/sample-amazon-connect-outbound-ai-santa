// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineFunction } from '@aws-amplify/backend';

export const callOutcome = defineFunction({
  name: 'call-outcome',
  entry: './handler.ts',
  runtime: 24,
  timeoutSeconds: 30,
  resourceGroupName: 'calls',
});
