// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineFunction } from '@aws-amplify/backend';

export const dialer = defineFunction({
  name: 'dialer',
  entry: './handler.ts',
  runtime: 24,
  timeoutSeconds: 30,
  resourceGroupName: 'calls',
});
