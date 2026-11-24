#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * npm run notify:setup: creates the Notify configuration and code configuration for the
 * verification SMS from .env (AWS_REGION, NOTIFY_COUNTRIES, NOTIFY_DISPLAY_NAME) and
 * writes NOTIFY_CONFIGURATION_ARN and NOTIFY_CODE_CONFIGURATION_ID back to .env.
 * npm run setup offers the same step; use this one to redo only Notify.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createNotify } from './lib/aws-steps.mjs';
import { parseEnv, renderEnv } from './lib/setup-lib.mjs';

try {
  const env = parseEnv(readFileSync('.env', 'utf8'));
  const n = await createNotify({
    region: env.AWS_REGION,
    displayName: env.NOTIFY_DISPLAY_NAME || 'SantaCallDemo',
    countries: (env.NOTIFY_COUNTRIES || 'US').split(',').map((c) => c.trim()),
  });
  writeFileSync('.env', renderEnv(readFileSync('.env', 'utf8'), { NOTIFY_CONFIGURATION_ARN: n.configArn, NOTIFY_CODE_CONFIGURATION_ID: n.codeConfigId }));
  console.log(`Notify is ACTIVE (template ${n.templateId}). Saved the two NOTIFY_ lines in .env; run npm run sandbox.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
