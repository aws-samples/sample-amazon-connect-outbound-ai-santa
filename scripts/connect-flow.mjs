#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * npm run connect:flow: fills connect/santa-flow.template.json with the IDs of this deployment and
 * creates (or updates) the "Santa Outbound Call" flow in your Connect instance.
 *
 * It takes the flow-handler ARN from amplify_outputs.json and the Agentic CX designer workspace,
 * application and deployment alias that npm run designer:setup saved in .env. Run it after
 * npm run sandbox and npm run designer:setup (connect/README.md).
 * --dry-run writes santa-flow.json and stops. --name <name> uses another flow name.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ConnectClient, CreateContactFlowCommand, ListContactFlowsCommand, UpdateContactFlowContentCommand } from '@aws-sdk/client-connect';
import { parseEnv, renderEnv, renderFlow } from './lib/setup-lib.mjs';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const dryRun = process.argv.includes('--dry-run');
const FLOW_NAME = arg('name', 'Santa Outbound Call');
const TEMPLATE = 'connect/santa-flow.template.json';
try {
  if (!existsSync('.env') || !existsSync('amplify_outputs.json')) throw new Error('Run npm run setup and npm run sandbox first.');
  const env = parseEnv(readFileSync('.env', 'utf8'));
  const region = env.AWS_REGION;
  const instanceId = env.CONNECT_INSTANCE_ID;
  if (!instanceId) throw new Error('CONNECT_INSTANCE_ID is empty in .env.');
  const flowHandlerArn = JSON.parse(readFileSync('amplify_outputs.json', 'utf8')).custom?.flowHandlerFunctionArn;
  if (!flowHandlerArn) throw new Error('No flowHandlerFunctionArn in amplify_outputs.json: run npm run sandbox.');
  const workspaceId = env.ACXD_WORKSPACE_ID;
  const applicationId = env.ACXD_APPLICATION_ID;
  const deploymentAlias = env.ACXD_DEPLOYMENT_ALIAS;
  if (!workspaceId || !applicationId || !deploymentAlias) {
    throw new Error('ACXD_WORKSPACE_ID, ACXD_APPLICATION_ID or ACXD_DEPLOYMENT_ALIAS is empty in .env: run npm run designer:setup first.');
  }
  const content = renderFlow(readFileSync(TEMPLATE, 'utf8'), { flowHandlerArn, workspaceId, applicationId, deploymentAlias });
  writeFileSync('santa-flow.json', content);
  console.log(`Filled ${TEMPLATE} -> santa-flow.json\n  application ${applicationId}\n  deployment alias ${deploymentAlias}`);
  if (dryRun) process.exit(0);
  const connect = new ConnectClient({ region });
  const flows = await connect.send(new ListContactFlowsCommand({ InstanceId: instanceId, ContactFlowTypes: ['CONTACT_FLOW'], MaxResults: 100 }));
  const existing = flows.ContactFlowSummaryList?.find((f) => f.Name === FLOW_NAME);
  let flowId = existing?.Id;
  if (flowId) {
    await connect.send(new UpdateContactFlowContentCommand({ InstanceId: instanceId, ContactFlowId: flowId, Content: content }));
    console.log(`Updated flow "${FLOW_NAME}" (${flowId}).`);
  } else {
    flowId = (await connect.send(new CreateContactFlowCommand({ InstanceId: instanceId, Name: FLOW_NAME, Type: 'CONTACT_FLOW', Content: content, Status: 'PUBLISHED' }))).ContactFlowId;
    console.log(`Created flow "${FLOW_NAME}" (${flowId}).`);
  }
  writeFileSync('.env', renderEnv(readFileSync('.env', 'utf8'), { CONNECT_CONTACT_FLOW_ID: flowId }));
  console.log('Saved CONNECT_CONTACT_FLOW_ID in .env. Now run npm run sandbox again.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
