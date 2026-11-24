// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countriesFromPrefixes, countryCaseText, needsCountryRequest, parseEnv, renderEnv, renderFlow, validators, webAppUrl } from './setup-lib.mjs';

describe('renderEnv', () => {
  it('fills keys in place, keeps comments and appends unknown keys', () => {
    const tpl = '# Required\nCONNECT_INSTANCE_ID=\n# sender\nSANTA_SENDER_EMAIL=santa@example.com\n';
    const out = renderEnv(tpl, { CONNECT_INSTANCE_ID: 'abc', SANTA_SENDER_EMAIL: 'me@example.org', NEW_KEY: '1' });
    expect(out).toContain('# Required\nCONNECT_INSTANCE_ID=abc\n# sender\nSANTA_SENDER_EMAIL=me@example.org');
    expect(out).toContain('# Added by npm run setup\nNEW_KEY=1');
    expect(parseEnv(out)).toMatchObject({ CONNECT_INSTANCE_ID: 'abc', NEW_KEY: '1' });
  });
});

describe('webAppUrl', () => {
  it('builds the branch URL of an Amplify Hosting app', () => {
    expect(webAppUrl('main', 'd1abcdef.amplifyapp.com')).toBe('https://main.d1abcdef.amplifyapp.com');
    expect(() => webAppUrl('main', undefined)).toThrow(/default domain/);
  });
});
describe('renderFlow', () => {
  const tpl = JSON.stringify({ f: '${FLOW_HANDLER_ARN}', w: '${ACXD_WORKSPACE_ID}', a: '${ACXD_APPLICATION_ID}', d: '${ACXD_DEPLOYMENT_ALIAS}' });
  const ids = { flowHandlerArn: 'F', workspaceId: 'W', applicationId: 'A', deploymentAlias: 'D' };
  it('replaces every placeholder', () => {
    expect(JSON.parse(renderFlow(tpl, ids))).toEqual({ f: 'F', w: 'W', a: 'A', d: 'D' });
  });
  it('fails when a placeholder is left', () => {
    expect(() => renderFlow(`${tpl.slice(0, -1)},"x":"\${NEW_ONE}"}`, ids)).toThrow(/NEW_ONE/);
  });
  it('fills the real contact flow template', () => {
    const flow = JSON.parse(renderFlow(readFileSync('connect/santa-flow.template.json', 'utf8'), ids));
    const agent = flow.Actions.find((a) => a.Type === 'ConnectParticipantWithAgenticCX');
    expect(agent.Parameters.AgentConfiguration).toMatchObject({ WorkspaceId: 'W', ApplicationId: 'A', Alias: 'D' });
  });
});
describe('country checks', () => {
  it('knows which countries a new instance can call', () => {
    expect(needsCountryRequest('us-east-1', 'US')).toBe(false);
    expect(needsCountryRequest('eu-central-1', 'ES')).toBe(true);
    expect(needsCountryRequest('eu-central-1', 'FR')).toBe(false);
    expect(needsCountryRequest('sa-east-1', 'BR')).toBe(true);
  });
  it('derives countries from the calling prefixes', () => {
    expect(countriesFromPrefixes('+1,+34').map((c) => c.code)).toEqual(['US', 'ES']);
    expect(countriesFromPrefixes('').map((c) => c.code)).toEqual(['US']);
    expect(countriesFromPrefixes('+44')[0].code).toBe('+44');
  });
  it('fills the Support case text', () => {
    const c = countryCaseText({ countryName: 'Spain', countryCode: 'ES', instanceId: 'i-1', region: 'eu-central-1', accountId: '111111111111', callerId: '+34900000000' });
    expect(c.url).toContain('country-allowlisting-for-outbound-calls');
    expect(c.description).toContain('Spain (ES)');
    expect(c.description).toContain('i-1 in eu-central-1 (account 111111111111)');
  });
});

describe('validators', () => {
  it('accepts good values and explains bad ones', () => {
    expect(validators.email('santa@example.com')).toBe('');
    expect(validators.email('santa')).not.toBe('');
    expect(validators.instanceId('')).toBe('');
    expect(validators.instanceId('arn:aws:connect:...')).toMatch(/UUID/);
    expect(validators.phone('+18005550100')).toBe('');
    expect(validators.displayName('SantaCallDemo')).toBe('');
    expect(validators.displayName('A name that is far too long')).not.toBe('');
  });
});
describe('designer validators', () => {
  it('accepts empty values and real-looking IDs and keys', () => {
    expect(validators.workspaceId('')).toBe('');
    expect(validators.workspaceId('ws_123abc')).toBe('');
    expect(validators.workspaceId('https://x/ws 1')).not.toBe('');
    expect(validators.acxdApiKey('')).toBe('');
    expect(validators.acxdApiKey('acxd_live_abcdefgh1234')).toBe('');
    expect(validators.acxdApiKey('sk-abc')).not.toBe('');
  });
});
