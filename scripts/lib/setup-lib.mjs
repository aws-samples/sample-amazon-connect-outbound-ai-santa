// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Pure helpers for scripts/setup.mjs and scripts/connect-flow.mjs: no AWS calls, unit tested.

/** Settings that change together with the country you call. */
export const PRESETS = {
  us: {
    label: 'United States (New York time, +1)',
    CALL_TIMEZONE: 'America/New_York',
    ALLOWED_PHONE_PREFIXES: '+1',
    GIFT_LINKS_DOMAIN: 'amazon.com',
    NOTIFY_COUNTRIES: 'US',
    AWS_REGION: 'us-east-1',
    countryName: 'the United States',
    countryCode: 'US',
  },
  es: {
    label: 'Spain (Madrid time, +34; Santa still speaks English)',
    CALL_TIMEZONE: 'Europe/Madrid',
    ALLOWED_PHONE_PREFIXES: '+34',
    GIFT_LINKS_DOMAIN: 'amazon.es',
    NOTIFY_COUNTRIES: 'ES',
    AWS_REGION: 'eu-central-1',
    countryName: 'Spain',
    countryCode: 'ES',
  },
};

/** Countries a new Amazon Connect instance can call without a Support request, by Region (Nov 2026). */
export const DEFAULT_CALLABLE = {
  'us-east-1': ['US', 'CA', 'MX', 'PR', 'GB'],
  'us-west-2': ['US', 'CA', 'MX', 'PR', 'GB'],
  'ca-central-1': ['US', 'CA', 'MX', 'PR', 'GB'],
  'eu-central-1': ['GB', 'IT', 'FR', 'IE', 'US'],
  'eu-west-2': ['GB', 'IT', 'FR', 'IE', 'US'],
  'af-south-1': ['ZA', 'GB', 'US'],
  'ap-northeast-2': ['KR', 'GB', 'US'],
  'ap-southeast-1': ['SG', 'AU', 'HK', 'US', 'GB'],
  'ap-southeast-2': ['AU', 'NZ', 'US'],
  'ap-northeast-1': ['JP', 'VN', 'US'],
};

/** Country of each known calling prefix. Prefixes not listed here are reported by their code. */
const PREFIX_COUNTRY = { '+1': { code: 'US', name: 'the United States' }, '+34': { code: 'ES', name: 'Spain' } };

/** Countries Santa calls, from ALLOWED_PHONE_PREFIXES, e.g. "+1,+34". */
export function countriesFromPrefixes(csv) {
  return (csv || '+1')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => PREFIX_COUNTRY[p] ?? { code: p, name: `numbers starting with ${p}` });
}

/** True when calls to `country` from a new instance in `region` need a Support request first. */
export function needsCountryRequest(region, country) {
  const list = DEFAULT_CALLABLE[region];
  return !list || !list.includes(country);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;
// Notify display name: letters, digits, underscores, hyphens and spaces, at most 15 characters.
const DISPLAY_NAME_RE = /^[A-Za-z0-9_ -]{1,15}$/;

export const validators = {
  email: (v) => (EMAIL_RE.test(v) ? '' : 'Enter an email address, for example santa@example.com.'),
  instanceId: (v) => (!v || UUID_RE.test(v) ? '' : 'The instance ID is a UUID, for example 12345678-90ab-cdef-1234-567890abcdef (not the ARN).'),
  phone: (v) => (!v || E164_RE.test(v) ? '' : 'Use E.164, for example +18005550100.'),
  displayName: (v) => (DISPLAY_NAME_RE.test(v) ? '' : 'Up to 15 letters, digits, spaces, hyphens or underscores.'),
  region: (v) => (/^[a-z]{2}(-[a-z]+)+-\d$/.test(v) ? '' : 'Use a Region code, for example us-east-1.'),
  workspaceId: (v) => (!v || /^[A-Za-z0-9_-]{4,128}$/.test(v) ? '' : 'Paste only the workspace ID, without spaces or URL.'),
  acxdApiKey: (v) => (!v || /^acxd_[A-Za-z0-9_-]{8,}$/.test(v) ? '' : 'The key starts with acxd_ (Admin Hub > Programmatic users > Generate API key).'),
};

/**
 * Write values into the text of .env.example, keeping its comments and order. Keys that are not in
 * the template are appended at the end.
 */
export function renderEnv(template, values) {
  const pending = { ...values };
  const lines = template.split('\n').map((line) => {
    const m = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (!m || !(m[1] in pending)) return line;
    const out = `${m[1]}=${pending[m[1]]}`;
    delete pending[m[1]];
    return out;
  });
  const extra = Object.entries(pending).map(([k, v]) => `${k}=${v}`);
  return [...lines, ...(extra.length ? ['', '# Added by npm run setup', ...extra] : [])].join('\n');
}

/** Read KEY=value lines (no expansion). */
export function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Fill the contact flow template. Fails if a placeholder is left. */
export function renderFlow(template, { flowHandlerArn, workspaceId, applicationId, deploymentAlias }) {
  const out = template
    .replaceAll('${FLOW_HANDLER_ARN}', flowHandlerArn)
    .replaceAll('${ACXD_WORKSPACE_ID}', workspaceId)
    .replaceAll('${ACXD_APPLICATION_ID}', applicationId)
    .replaceAll('${ACXD_DEPLOYMENT_ALIAS}', deploymentAlias);
  const left = out.match(/\$\{[A-Z_]+\}/g);
  if (left) throw new Error(`Placeholders left in the flow: ${[...new Set(left)].join(', ')}`);
  JSON.parse(out);
  return out;
}

/** Text for the Support case that allows outbound calls to a country. */
export function countryCaseText({ countryName, countryCode, instanceId, region, accountId, callerId }) {
  return {
    url: 'https://console.aws.amazon.com/support/home#/case/create?issueType=customer-service&serviceCode=service-connect-number-management&categoryCode=country-allowlisting-for-outbound-calls',
    subject: `Allow outbound calls to ${countryName}`,
    description:
      `Please allow outbound calls to ${countryName} (${countryCode}), mobile numbers included, for Amazon Connect instance ` +
      `${instanceId || '<instance-id>'} in ${region} (account ${accountId || '<account-id>'}). Use case: scheduled outbound ` +
      'calls from an AI voice agent to people who booked the call and verified their own mobile number with an SMS code. ' +
      `Low volume (under 50 calls a day). Caller ID: ${callerId || '<your claimed number>'}.`,
  };
}

/** Text for the SES production access request (console: SES > Get set up > Request production access). */
export function sesRequestText({ websiteUrl }) {
  return {
    mailType: 'Transactional',
    websiteUrl: websiteUrl || '<a public page that describes your app>',
    useCase:
      'Transactional email for an Amazon Connect outbound AI voice agent. Users are created by an admin (no public ' +
      'sign-up). After a scheduled phone call, the app sends one email to the signed-in user who booked it, at the ' +
      'verified address on their account: a short letter with the call summary, or a notice that the call was missed. ' +
      'No marketing and no purchased or third-party lists. Under 50 emails a day. Bounces and complaints are monitored ' +
      'with SES reputation metrics, and the booking data is deleted after the email is sent.',
  };
}

/** Public URL of an Amplify Hosting branch, e.g. https://main.d1abcdef.amplifyapp.com. */
export function webAppUrl(branch, defaultDomain) {
  if (!branch || !defaultDomain) throw new Error('Amplify Hosting returned no default domain.');
  return `https://${branch}.${defaultDomain}`;
}
