#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * npm run designer:setup: creates (or updates) the Santa agent in Agentic CX designer from the files
 * in connect/designer/, builds it and deploys the build to the `development` environment.
 *
 *   context variables  childName, childNotes, wishlist, behaviour, summary, reason, outcome (created if missing, never changed)
 *   guardrails         Santa Child Input Guardrail, Santa Reply Output Guardrail
 *   flows              SantaWishlistConversation, SantaGoodbyeFallback
 *   application        Santa Wishlist Agent
 *
 * Needs an API key of a programmatic user (Agentic CX designer > Admin Hub > Programmatic users) in
 * ACXD_API_KEY, in the environment or in .env.local. Reads AWS_REGION and ACXD_WORKSPACE_ID from .env
 * and saves ACXD_WORKSPACE_ID, ACXD_APPLICATION_ID and ACXD_DEPLOYMENT_ALIAS there for npm run connect:flow.
 *
 *   npm run designer:setup -- --dry-run   only check the files
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as acxd from 'amazon-connect-acxd-sdk';
import { applicationInput, checkDesigner, loadDesigner } from './lib/designer-lib.mjs';
import { parseEnv, renderEnv } from './lib/setup-lib.mjs';

const DIR = 'connect/designer';
const ENVIRONMENT = 'development';
const dryRun = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listAll(client, Command, input = {}) {
  const items = [];
  let nextToken;
  do {
    const page = await client.send(new Command({ ...input, nextToken }));
    items.push(...(page.items ?? []));
    nextToken = page.nextToken;
  } while (nextToken);
  return items;
}

async function waitFor(label, get, done, failed) {
  for (let i = 0; i < 60; i++) {
    const r = await get();
    if (done(r)) return r;
    if (failed(r)) throw new Error(`${label} failed: ${JSON.stringify(r).slice(0, 1500)}`);
    await sleep(5000);
  }
  throw new Error(`${label} did not finish in 5 minutes.`);
}

try {
  const bundle = loadDesigner(DIR);
  const problems = checkDesigner(bundle);
  if (problems.length) throw new Error(`connect/designer/ has problems:\n  ${problems.join('\n  ')}`);
  console.log(`Checked ${DIR}: ${bundle.flows.length} flows, ${bundle.guardrails.length} guardrails, ${bundle.contextVariables.length} context variables.`);
  if (dryRun) process.exit(0);

  if (!existsSync('.env')) throw new Error('No .env: run npm run setup first.');
  const env = parseEnv(readFileSync('.env', 'utf8'));
  const local = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
  const apiKey = process.env.ACXD_API_KEY || local.ACXD_API_KEY;
  if (!apiKey) throw new Error('Set ACXD_API_KEY (environment or .env.local): Agentic CX designer > Admin Hub > Programmatic users > Generate API key.');
  // The SDK falls back to the default AWS profile's Region and then answers 401, so always pass it.
  const region = env.AWS_REGION;
  if (!region) throw new Error('AWS_REGION is empty in .env.');

  let workspaceId = env.ACXD_WORKSPACE_ID;
  if (!workspaceId) {
    const workspaces = await listAll(new acxd.AgenticCXDesignerClient({ apiKey, region }), acxd.ListWorkspacesCommand);
    if (workspaces.length !== 1) {
      const names = workspaces.map((w) => `${w.name} (${w.workspaceId})`).join(', ') || 'none visible to this key';
      throw new Error(`Set ACXD_WORKSPACE_ID in .env. Workspaces: ${names}.`);
    }
    workspaceId = workspaces[0].workspaceId;
  }
  const client = new acxd.AgenticCXDesignerClient({ apiKey, region, workspaceId });

  // Context variables are shared by the whole workspace: create the missing ones, leave existing ones alone.
  const existingVars = new Set((await listAll(client, acxd.ListContextVariablesCommand)).map((v) => v.name));
  for (const v of bundle.contextVariables) {
    if (existingVars.has(v.name)) continue;
    await client.send(new acxd.CreateContextVariableCommand(v));
    console.log(`Created context variable ${v.name}.`);
  }

  const existingGuardrails = await listAll(client, acxd.ListGuardrailsCommand);
  const guardrailIds = {};
  for (const g of bundle.guardrails) {
    const found = existingGuardrails.find((e) => e.name === g.name);
    if (found) await client.send(new acxd.UpdateGuardrailCommand({ guardrailIdentifier: found.guardrailId, ...g }));
    guardrailIds[g.name] = found ? found.guardrailId : (await client.send(new acxd.CreateGuardrailCommand(g))).guardrailId;
    console.log(`${found ? 'Updated' : 'Created'} guardrail "${g.name}".`);
  }

  const existingFlows = new Set((await listAll(client, acxd.ListFlowsCommand)).map((f) => f.flowId));
  for (const f of bundle.flows) {
    if (existingFlows.has(f.flowId)) {
      const { flowId, ...rest } = f;
      await client.send(new acxd.UpdateFlowCommand({ flowIdentifier: flowId, ...rest }));
    } else {
      await client.send(new acxd.CreateFlowCommand(f));
    }
    console.log(`${existingFlows.has(f.flowId) ? 'Updated' : 'Created'} flow ${f.flowId}.`);
  }

  const appInput = applicationInput(bundle.application, guardrailIds);
  const existingApp = (await listAll(client, acxd.ListApplicationsCommand)).find((a) => a.name === appInput.name);
  let applicationId = existingApp?.applicationId;
  if (existingApp) await client.send(new acxd.UpdateApplicationCommand({ applicationIdentifier: applicationId, ...appInput }));
  else applicationId = (await client.send(new acxd.CreateApplicationCommand(appInput))).applicationId;
  console.log(`${existingApp ? 'Updated' : 'Created'} application "${appInput.name}" (${applicationId}).`);

  const languageCodes = bundle.application.settings.languageCodes;
  const build = await client.send(
    new acxd.CreateApplicationBuildCommand({ applicationIdentifier: applicationId, description: `npm run designer:setup ${new Date().toISOString()}` }),
  );
  const built = await waitFor(
    'Build',
    () => client.send(new acxd.GetApplicationBuildCommand({ applicationIdentifier: applicationId, buildIdentifier: build.buildId })),
    (b) => b.status === 'BUILT',
    (b) => /FAIL|ERROR/i.test(b.status ?? ''),
  );
  console.log(`Built ${built.buildId}.`);

  const deployments = await listAll(client, acxd.ListApplicationDeploymentsCommand, { applicationIdentifier: applicationId });
  const current = deployments.find((d) => d.environment === ENVIRONMENT);
  const deployInput = { applicationIdentifier: applicationId, buildIdentifier: built.buildId, environment: ENVIRONMENT, languageCodes, description: 'Santa Outbound Call' };
  const started = current
    ? await client.send(new acxd.UpdateApplicationDeploymentCommand({ ...deployInput, deploymentIdentifier: current.deploymentId }))
    : await client.send(new acxd.CreateApplicationDeploymentCommand(deployInput));
  const deployed = await waitFor(
    'Deployment',
    () => client.send(new acxd.GetApplicationDeploymentCommand({ applicationIdentifier: applicationId, deploymentIdentifier: started.deploymentId })),
    (d) => d.deploymentStatus === 'deployed',
    (d) => /fail|error/i.test(d.deploymentStatus ?? ''),
  );
  console.log(`Deployed to ${ENVIRONMENT}: alias ${deployed.deploymentAlias}.`);

  writeFileSync(
    '.env',
    renderEnv(readFileSync('.env', 'utf8'), {
      ACXD_WORKSPACE_ID: workspaceId,
      ACXD_APPLICATION_ID: applicationId,
      ACXD_DEPLOYMENT_ALIAS: deployed.deploymentAlias,
    }),
  );
  console.log('Saved ACXD_WORKSPACE_ID, ACXD_APPLICATION_ID and ACXD_DEPLOYMENT_ALIAS in .env. Next: npm run connect:flow.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
