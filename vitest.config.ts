// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['amplify/**/*.test.ts', 'src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
    env: {
      BOOKINGS_TABLE: 'Bookings',
      SCHEDULE_GROUP: 'santa-calls',
      SCHEDULER_ROLE_ARN: 'arn:aws:iam::111111111111:role/scheduler',
      DIALER_FUNCTION_ARN: 'arn:aws:lambda:eu-central-1:111111111111:function:dialer',
      GUARDRAIL_ID: 'gr-123',
      GUARDRAIL_VERSION: '1',
      SENDER_EMAIL: 'santa@example.com',
      USER_POOL_ID: 'eu-central-1_test',
      CONNECT_INSTANCE_ID: 'instance-1',
      // amplify/config.ts needs these two to be importable in tests.
      SANTA_SENDER_EMAIL: 'santa@example.com',
      CONNECT_CONTACT_FLOW_ID: 'flow-1',
      CONNECT_SOURCE_PHONE_NUMBER: '+34900000000',
      SEND_LETTER_FUNCTION_NAME: 'send-letter',
      BEDROCK_MODEL_ID: 'eu.amazon.nova-lite-v1:0',
      MAX_CALL_ATTEMPTS: '3',
      RETRY_DELAY_MINUTES: '15',
      AWS_REGION: 'eu-central-1',
      REQUIRE_PHONE_VERIFICATION: 'true',
      // Calls placed from Europe to Spanish numbers; i18n.test.ts covers the US defaults.
      CALL_TIMEZONE: 'Europe/Madrid',
      ALLOWED_PHONE_PREFIXES: '+34',
    },
  },
});
