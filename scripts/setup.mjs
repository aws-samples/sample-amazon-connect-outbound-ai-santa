#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * npm run setup: asks for the deployment settings, writes .env, checks the AWS account (read only),
 * can create the Notify resources, and prints the manual steps with their texts filled in.
 *
 *   npm run setup            interactive
 *   npm run setup -- --check only run the checks with the current .env
 *
 * Uses the AWS credentials of your shell (AWS_PROFILE or the default chain).
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { stdin as input, stdout as output } from 'node:process';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { checkAccount, createNotify, notifyStatus } from './lib/aws-steps.mjs';
import { PRESETS, countriesFromPrefixes, countryCaseText, needsCountryRequest, parseEnv, renderEnv, sesRequestText, validators } from './lib/setup-lib.mjs';

const ENV = '.env';
const ENV_LOCAL = '.env.local';
const checkOnly = process.argv.includes('--check');
const current = existsSync(ENV) ? parseEnv(readFileSync(ENV, 'utf8')) : {};
const readLocal = () => (existsSync(ENV_LOCAL) ? parseEnv(readFileSync(ENV_LOCAL, 'utf8')) : {});
// readline writes through this stream; while muted it drops the echo of what you type (the API key).
let muted = false;
const echo = new Writable({
  write(chunk, encoding, done) {
    if (!muted) output.write(chunk, encoding);
    done();
  },
});
echo.columns = output.columns;
const rl = createInterface({ input, output: echo, terminal: output.isTTY });

async function ask(question, fallback = '', validate = () => '') {
  for (;;) {
    const raw = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
    const value = raw || fallback;
    const error = validate(value);
    if (!error) return value;
    console.log(`  ${error}`);
  }
}
async function askSecret(question, validate) {
  for (;;) {
    output.write(`${question}: `);
    muted = true;
    const value = (await rl.question('').finally(() => { muted = false; })).trim();
    output.write('\n');
    const error = validate(value);
    if (!error) return value;
    console.log(`  ${error}`);
  }
}
/** Save secrets in .env.local (git-ignored, readable only by you), keeping the other keys. */
function writeLocal(values) {
  const base = existsSync(ENV_LOCAL) ? readFileSync(ENV_LOCAL, 'utf8') : '# Secrets for local scripts. Git-ignored; never commit it.\n';
  const text = renderEnv(base, values);
  writeFileSync(ENV_LOCAL, text.endsWith('\n') ? text : `${text}\n`, { mode: 0o600 });
}
const yes = async (q, def = true) => {
  const a = (await rl.question(`${q} ${def ? '[Y/n]' : '[y/N]'}: `)).trim().toLowerCase();
  return a ? a.startsWith('y') : def;
};

function presetFor(env) {
  return env.ALLOWED_PHONE_PREFIXES === '+34' ? 'es' : 'us';
}

async function collect() {
  console.log("\nSanta's Call setup. Press Enter to keep the value in [brackets].\n");
  const presetKey = await ask(
    `Country you call: ${Object.entries(PRESETS).map(([k, p]) => `${k} = ${p.label}`).join(', ')}`,
    presetFor(current),
    (v) => (v in PRESETS ? '' : `Type one of: ${Object.keys(PRESETS).join(', ')}`),
  );
  const p = PRESETS[presetKey];
  const region = await ask('AWS Region (with Amazon Connect agentic voice)', current.AWS_REGION || p.AWS_REGION, validators.region);
  console.log('\nThe parents get the letter from this address. Use an address or domain you can verify in Amazon SES.');
  const sender = await ask('Sender email (SANTA_SENDER_EMAIL)', current.SANTA_SENDER_EMAIL !== 'santa@example.com' ? current.SANTA_SENDER_EMAIL : '', validators.email);
  const verified = await yes('Is this address (or its domain) already verified in SES in that Region?', current.CREATE_SENDER_IDENTITY === 'false');
  console.log('\nLeave the next two empty if you have not created the Connect instance yet; run npm run setup again later.');
  const instanceId = await ask('Amazon Connect instance ID (CONNECT_INSTANCE_ID)', current.CONNECT_INSTANCE_ID, validators.instanceId);
  const callerId = await ask('Claimed phone number for caller ID, E.164 (CONNECT_SOURCE_PHONE_NUMBER)', current.CONNECT_SOURCE_PHONE_NUMBER, validators.phone);
  console.log('\nAgentic CX designer: open it from your instance in the Amazon Connect console (connect/README.md, step 2).');
  console.log('Leave these empty if you have not done it yet. With a single workspace, npm run designer:setup finds the ID.');
  const workspaceId = await ask('Agentic CX designer workspace ID (ACXD_WORKSPACE_ID)', current.ACXD_WORKSPACE_ID, validators.workspaceId);
  if (!readLocal().ACXD_API_KEY) {
    const apiKey = await askSecret('Designer API key, saved in .env.local and not shown (Enter to skip)', validators.acxdApiKey);
    if (apiKey) {
      writeLocal({ ACXD_API_KEY: apiKey });
      console.log(`  Saved ACXD_API_KEY in ${ENV_LOCAL}.`);
    }
  }
  console.log('\nThe verification SMS shows this name. Notify reviews it: names that look like a known brand need verification.');
  const displayName = await ask('SMS display name (Notify)', current.NOTIFY_DISPLAY_NAME || 'SantaCallDemo', validators.displayName);
  const appUrl = await ask('Web app URL (APP_URL; leave empty, npm run web:deploy fills it)', current.APP_URL);
  const values = {
    AWS_REGION: region,
    CALL_TIMEZONE: p.CALL_TIMEZONE,
    ALLOWED_PHONE_PREFIXES: p.ALLOWED_PHONE_PREFIXES,
    GIFT_LINKS_DOMAIN: p.GIFT_LINKS_DOMAIN,
    NOTIFY_COUNTRIES: p.NOTIFY_COUNTRIES,
    NOTIFY_DISPLAY_NAME: displayName,
    SANTA_SENDER_EMAIL: sender,
    CREATE_SENDER_IDENTITY: verified ? 'false' : 'true',
    CONNECT_INSTANCE_ID: instanceId,
    CONNECT_SOURCE_PHONE_NUMBER: callerId,
    ACXD_WORKSPACE_ID: workspaceId,
    APP_URL: appUrl,
  };
  // Keep what an earlier run or a person already set (Notify IDs, designer IDs, flow ID...).
  for (const k of ['NOTIFY_CONFIGURATION_ARN', 'NOTIFY_CODE_CONFIGURATION_ID', 'ACXD_APPLICATION_ID', 'ACXD_DEPLOYMENT_ALIAS', 'CONNECT_CONTACT_FLOW_ID']) {
    if (current[k]) values[k] = current[k];
  }
  return { values };
}

function writeEnv(values) {
  if (existsSync(ENV)) copyFileSync(ENV, `${ENV}.bak`);
  const base = existsSync(ENV) ? readFileSync(ENV, 'utf8') : readFileSync('.env.example', 'utf8');
  writeFileSync(ENV, renderEnv(base, values));
  console.log(`\nWrote ${ENV}${existsSync(`${ENV}.bak`) ? ` (previous one in ${ENV}.bak)` : ''}.`);
}

function printChecks(results) {
  console.log('\nAccount checks (read only):');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'TODO'} ${r.label}: ${r.detail}`);
}

function printManual({ env, results }) {
  const accountId = results.find((r) => r.accountId)?.accountId;
  const okLabel = (prefix) => results.find((r) => r.label.startsWith(prefix))?.ok;
  const steps = [];
  if (!env.CONNECT_INSTANCE_ID) {
    steps.push(
      'Create an Amazon Connect instance in ' + env.AWS_REGION + ' (console: Amazon Connect > Add an instance). ' +
        'Turn on outbound calls. Then put its ID in .env (npm run setup again).',
    );
  }
  if (env.CONNECT_INSTANCE_ID && !(process.env.ACXD_API_KEY || readLocal().ACXD_API_KEY)) {
    steps.push(
      'Open Agentic CX designer from your instance in the Amazon Connect console, note the workspace ID (ACXD_WORKSPACE_ID in .env) ' +
        'and create a programmatic user with an API key (Admin Hub > Programmatic users). Put the key in .env.local as ACXD_API_KEY.',
    );
  }
  const countries = countriesFromPrefixes(env.ALLOWED_PHONE_PREFIXES);
  const names = countries.map((c) => c.name).join(' and ');
  if (!env.CONNECT_SOURCE_PHONE_NUMBER || okLabel('Caller ID') === false) {
    steps.push(
      `Claim a phone number in the Connect admin website (Channels > Phone numbers > Claim a number) that can call ${names}. ` +
        (countries.some((c) => c.code === 'ES')
          ? 'Spanish toll-free (+34 900) numbers need no documents; local numbers need a Spanish business address and tax ID. '
          : '') +
        (countries.some((c) => c.code === 'US') ? 'US toll-free and local (DID) numbers can be claimed directly.' : ''),
    );
  }
  for (const country of countries.filter((c) => needsCountryRequest(env.AWS_REGION, c.code))) {
    const c = countryCaseText({
      countryName: country.name,
      countryCode: country.code,
      instanceId: env.CONNECT_INSTANCE_ID,
      region: env.AWS_REGION,
      accountId,
      callerId: env.CONNECT_SOURCE_PHONE_NUMBER,
    });
    steps.push(
      `New instances in ${env.AWS_REGION} cannot call ${country.name} by default. Unless you already asked, open a Support case ` +
        '(Account and billing: free on every support plan, console only):\n' +
        `       ${c.url}\n       Subject: ${c.subject}\n       Description: ${c.description}`,
    );
  }
  if (okLabel('SES production') === false) {
    const s = sesRequestText({ websiteUrl: env.APP_URL });
    steps.push(
      'Request SES production access (console: Amazon SES > Get set up > Request production access). Until it is ' +
        'granted, letters only reach addresses you verify in SES. Fill in:\n' +
        `       Mail type: ${s.mailType}\n       Website URL: ${s.websiteUrl}\n       Use case: ${s.useCase}`,
    );
  }
  if (okLabel('SES sender') === false) steps.push(`Verify ${env.SANTA_SENDER_EMAIL} in SES: click the link in the email AWS sends after the first deploy.`);
  steps.push(
    'After npm run sandbox: npm run designer:setup (creates and deploys the Santa Wishlist Agent), ' +
      'npm run connect:flow (creates the Santa Outbound Call flow), npm run web:deploy (publishes the web app on ' +
      'Amplify Hosting), then npm run sandbox again. See connect/README.md.',
  );
  console.log('\nManual steps:');
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
}

try {
  let env = current;
  if (!checkOnly) {
    const r = await collect();
    writeEnv(r.values);
    env = parseEnv(readFileSync(ENV, 'utf8'));
  }
  if (!env.AWS_REGION) throw new Error('No .env yet: run npm run setup without --check.');
  process.env.AWS_REGION = env.AWS_REGION;
  const results = await checkAccount({
    region: env.AWS_REGION,
    senderEmail: env.SANTA_SENDER_EMAIL,
    instanceId: env.CONNECT_INSTANCE_ID,
    callerId: env.CONNECT_SOURCE_PHONE_NUMBER,
  });

  const notify = await notifyStatus(env.AWS_REGION, env.NOTIFY_CONFIGURATION_ARN);
  results.push({
    label: 'Notify (verification SMS)',
    ok: notify === 'ACTIVE' && !!env.NOTIFY_CODE_CONFIGURATION_ID,
    detail: notify ? `${notify}` : 'not created',
  });
  results.push({
    label: 'Agentic CX designer API key',
    ok: !!(process.env.ACXD_API_KEY || readLocal().ACXD_API_KEY),
    detail: process.env.ACXD_API_KEY || readLocal().ACXD_API_KEY ? `set${env.ACXD_WORKSPACE_ID ? `, workspace ${env.ACXD_WORKSPACE_ID}` : ''}` : `not in ${ENV_LOCAL}`,
  });
  printChecks(results);

  if (!checkOnly && notify !== 'ACTIVE' && results[0].ok && (await yes('\nCreate the Notify resources for the verification SMS now?'))) {
    for (;;) {
      try {
        const n = await createNotify({
          region: env.AWS_REGION,
          displayName: env.NOTIFY_DISPLAY_NAME || 'SantaCallDemo',
          countries: env.NOTIFY_COUNTRIES.split(',').map((c) => c.trim()),
        });
        writeFileSync(ENV, renderEnv(readFileSync(ENV, 'utf8'), { NOTIFY_CONFIGURATION_ARN: n.configArn, NOTIFY_CODE_CONFIGURATION_ID: n.codeConfigId }));
        console.log(`  Notify is ACTIVE. Saved NOTIFY_CONFIGURATION_ARN and NOTIFY_CODE_CONFIGURATION_ID in ${ENV}.`);
        break;
      } catch (err) {
        console.log(`  ${err.message}`);
        if (!err.configId) break;
        const name = await ask('Try another display name (empty to stop)', '', (v) => (!v ? '' : validators.displayName(v)));
        if (!name) break;
        writeFileSync(ENV, renderEnv(readFileSync(ENV, 'utf8'), { NOTIFY_DISPLAY_NAME: name }));
        env.NOTIFY_DISPLAY_NAME = name;
      }
    }
  }
  printManual({ env, results });
  console.log('\nThen deploy: npm run sandbox   (run npm run setup -- --check any time to see what is left)\n');
} catch (err) {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
