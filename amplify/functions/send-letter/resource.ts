// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineFunction } from '@aws-amplify/backend';

export const sendLetter = defineFunction({
  name: 'send-letter',
  entry: './handler.ts',
  runtime: 24,
  timeoutSeconds: 60,
  resourceGroupName: 'calls',
});
