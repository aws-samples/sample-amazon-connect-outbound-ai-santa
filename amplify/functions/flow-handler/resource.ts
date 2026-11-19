// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineFunction } from '@aws-amplify/backend';

export const flowHandler = defineFunction({
  name: 'flow-handler',
  entry: './handler.ts',
  runtime: 24,
  // Connect waits at most 8 seconds for a Lambda in a flow.
  timeoutSeconds: 8,
  resourceGroupName: 'calls',
});
