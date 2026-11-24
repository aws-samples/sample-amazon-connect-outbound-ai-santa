#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * npm run web:deploy: builds the web app against the deployed backend (amplify_outputs.json) and
 * publishes it on AWS Amplify Hosting as a manual deployment, without a Git connection.
 *
 * Creates the Amplify Hosting app WEB_APP_NAME (default santa-call-center) and its branch `main` if
 * they don't exist, uploads dist/ as a zip, waits for the deployment and checks that the page loads.
 * Saves the URL in .env as APP_URL, which the invitation email links to: run npm run sandbox again
 * afterwards. Needs the `zip` command and the AWS credentials of your shell.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AmplifyClient,
  CreateAppCommand,
  CreateBranchCommand,
  CreateDeploymentCommand,
  GetBranchCommand,
  GetJobCommand,
  ListAppsCommand,
  StartDeploymentCommand,
} from '@aws-sdk/client-amplify';
import { parseEnv, renderEnv, webAppUrl } from './lib/setup-lib.mjs';

const BRANCH = 'main';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  if (!existsSync('.env') || !existsSync('amplify_outputs.json')) throw new Error('Run npm run setup and npm run sandbox first.');
  const env = parseEnv(readFileSync('.env', 'utf8'));
  const region = env.AWS_REGION;
  if (!region) throw new Error('AWS_REGION is empty in .env.');
  const appName = env.WEB_APP_NAME || 'santa-call-center';
  const amplify = new AmplifyClient({ region });

  console.log('Building the web app (npm run build)...');
  execFileSync('npm', ['run', 'build'], { stdio: ['ignore', 'ignore', 'inherit'] });

  let app;
  let nextToken;
  do {
    const page = await amplify.send(new ListAppsCommand({ nextToken }));
    app = page.apps?.find((a) => a.name === appName);
    nextToken = page.nextToken;
  } while (!app && nextToken);
  if (!app) {
    app = (await amplify.send(new CreateAppCommand({ name: appName, platform: 'WEB', description: "Santa's Call web app (manual deployments)" }))).app;
    console.log(`Created Amplify Hosting app ${appName}.`);
  }
  const appId = app.appId;
  try {
    await amplify.send(new GetBranchCommand({ appId, branchName: BRANCH }));
  } catch (err) {
    if (err.name !== 'NotFoundException') throw err;
    await amplify.send(new CreateBranchCommand({ appId, branchName: BRANCH, stage: 'PRODUCTION' }));
    console.log(`Created branch ${BRANCH}.`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'santa-web-'));
  const zip = join(dir, 'dist.zip');
  try {
    // The zip must hold the contents of dist/, with index.html at its root.
    execFileSync('zip', ['-qr', zip, '.'], { cwd: 'dist' });
    const { jobId, zipUploadUrl } = await amplify.send(new CreateDeploymentCommand({ appId, branchName: BRANCH }));
    const put = await fetch(zipUploadUrl, { method: 'PUT', body: readFileSync(zip), headers: { 'Content-Type': 'application/zip' } });
    if (!put.ok) throw new Error(`Upload failed: HTTP ${put.status}`);
    await amplify.send(new StartDeploymentCommand({ appId, branchName: BRANCH, jobId }));
    let status;
    for (let i = 0; i < 60; i++) {
      status = (await amplify.send(new GetJobCommand({ appId, branchName: BRANCH, jobId }))).job?.summary?.status;
      if (['SUCCEED', 'FAILED', 'CANCELLED'].includes(status)) break;
      await sleep(5000);
    }
    if (status !== 'SUCCEED') throw new Error(`Deployment ${jobId} ended as ${status ?? 'unknown'}. See the Amplify console.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const url = webAppUrl(BRANCH, app.defaultDomain);
  // The page is public (it is the sign-in screen); everything behind it needs a Cognito sign-in.
  const page = await fetch(url);
  const html = await page.text();
  if (!page.ok || !html.includes('<div id="root">')) throw new Error(`Deployed, but ${url} answered HTTP ${page.status} without the app.`);
  writeFileSync('.env', renderEnv(readFileSync('.env', 'utf8'), { APP_URL: url }));
  console.log(`Published ${url}\nSaved APP_URL in .env. Run npm run sandbox again so the invitation email links to it.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
