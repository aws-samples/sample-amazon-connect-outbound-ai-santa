// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineFunction } from '@aws-amplify/backend';
import { config } from '../../config.js';

export const preSignUp = defineFunction({
  name: 'pre-sign-up',
  entry: './handler.ts',
  runtime: 24,
  resourceGroupName: 'auth',
  environment: { SIGNUP_ALLOWLIST: config.signupAllowlist },
});
