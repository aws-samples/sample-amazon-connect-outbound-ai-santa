// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Read-only account checks and the Notify setup, shared by scripts/setup.mjs and scripts/notify-setup.mjs.
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import {
  ConnectClient,
  DescribeInstanceAttributeCommand,
  DescribeInstanceCommand,
  ListPhoneNumbersV2Command,
} from '@aws-sdk/client-connect';
import { CreateNotifyCodeConfigurationCommand, EndUserMessagingClient } from '@aws-sdk/client-endusermessaging';
import {
  CreateNotifyConfigurationCommand,
  DescribeNotifyConfigurationsCommand,
  DescribeNotifyTemplatesCommand,
  PinpointSMSVoiceV2Client,
} from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { GetAccountCommand, GetEmailIdentityCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run one check; errors become a failed check with the error name, never an exception. */
async function check(label, fn) {
  try {
    return { label, ...(await fn()) };
  } catch (err) {
    return { label, ok: false, detail: `${err.name}: ${err.message}`.slice(0, 200) };
  }
}

/** Read-only checks of everything the deployment needs. Each result: { label, ok, detail }. */
export async function checkAccount({ region, senderEmail, instanceId, callerId }) {
  const results = [];
  const sts = new STSClient({ region });
  const who = await check('AWS credentials', async () => {
    const id = await sts.send(new GetCallerIdentityCommand({}));
    return { ok: true, detail: `account ${id.Account}`, accountId: id.Account };
  });
  results.push(who);
  if (!who.ok) return results;

  results.push(
    await check('CDK bootstrap', async () => {
      try {
        const s = await new CloudFormationClient({ region }).send(new DescribeStacksCommand({ StackName: 'CDKToolkit' }));
        return { ok: true, detail: s.Stacks?.[0]?.StackStatus };
      } catch (err) {
        if (/does not exist/.test(err.message)) {
          return { ok: false, detail: `not bootstrapped: run npx cdk bootstrap aws://${who.accountId}/${region}` };
        }
        throw err;
      }
    }),
  );

  const ses = new SESv2Client({ region });
  results.push(
    await check('SES production access', async () => {
      const a = await ses.send(new GetAccountCommand({}));
      const review = a.Details?.ReviewDetails?.Status;
      return a.ProductionAccessEnabled
        ? { ok: true, detail: 'out of the sandbox' }
        : { ok: false, detail: `sandbox${review ? ` (review ${review})` : ''}: emails only reach verified addresses` };
    }),
  );
  if (senderEmail) {
    results.push(
      await check(`SES sender ${senderEmail}`, async () => {
        const domain = senderEmail.split('@')[1];
        for (const identity of [senderEmail, domain]) {
          try {
            const r = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: identity }));
            if (r.VerifiedForSendingStatus) return { ok: true, detail: `verified (${identity})` };
            return { ok: false, detail: `${identity} is ${r.VerificationStatus}: click the link in the verification email` };
          } catch (err) {
            if (err.name !== 'NotFoundException') throw err;
          }
        }
        return { ok: false, detail: 'not in SES yet: the first deploy creates it (CREATE_SENDER_IDENTITY=true)' };
      }),
    );
  }

  if (instanceId) {
    const connect = new ConnectClient({ region });
    results.push(
      await check('Connect instance', async () => {
        const i = await connect.send(new DescribeInstanceCommand({ InstanceId: instanceId }));
        const out = await connect.send(new DescribeInstanceAttributeCommand({ InstanceId: instanceId, AttributeType: 'OUTBOUND_CALLS' }));
        const outbound = out.Attribute?.Value === 'true';
        return {
          ok: i.Instance?.InstanceStatus === 'ACTIVE' && outbound,
          detail: `${i.Instance?.InstanceAlias} ${i.Instance?.InstanceStatus}, outbound calls ${outbound ? 'on' : 'OFF'}`,
          instanceArn: i.Instance?.Arn,
        };
      }),
    );
    const arn = results.at(-1).instanceArn;
    if (arn) {
      results.push(
        await check('Caller ID number', async () => {
          const r = await connect.send(new ListPhoneNumbersV2Command({ TargetArn: arn }));
          const numbers = (r.ListPhoneNumbersSummaryList ?? []).map((n) => n.PhoneNumber);
          if (!numbers.length) return { ok: false, detail: 'no number claimed on the instance' };
          if (callerId && !numbers.includes(callerId)) return { ok: false, detail: `${callerId} is not claimed here (claimed: ${numbers.join(', ')})` };
          return { ok: true, detail: numbers.join(', ') };
        }),
      );
    }
  }
  return results;
}

/** Notify configuration status by ID, or undefined if it does not exist. */
export async function notifyStatus(region, configArn) {
  const id = configArn?.split('/').pop();
  if (!id) return undefined;
  const sv = new PinpointSMSVoiceV2Client({ region });
  try {
    const r = await sv.send(new DescribeNotifyConfigurationsCommand({ NotifyConfigurationIds: [id] }));
    return r.NotifyConfigurations?.[0]?.Status;
  } catch {
    return undefined;
  }
}

/**
 * Create the Notify configuration and the code configuration for the verification SMS.
 * Returns { configArn, codeConfigId, status, templateId }. Throws with a readable message when the
 * display name is not ACTIVE, so the caller can ask for another one.
 */
export async function createNotify({ region, displayName, countries, log = console.log }) {
  const sv = new PinpointSMSVoiceV2Client({ region });
  const eum = new EndUserMessagingClient({ region });
  // Santa speaks English, so the SMS template is English too.
  const lang = 'en';
  const templates = (await sv.send(new DescribeNotifyTemplatesCommand({ Filters: [{ Name: 'language-code', Values: [lang] }] })))
    .NotifyTemplates ?? [];
  const template = templates.find(
    (t) => t.Status === 'ACTIVE' && t.Channels?.includes('SMS') && countries.every((c) => t.SupportedCountries?.includes(c)),
  );
  if (!template) throw new Error(`No active SMS code template in "${lang}" supports ${countries.join(', ')}.`);
  log(`  Template ${template.TemplateId}. Creating the Notify configuration "${displayName}"...`);
  const { NotifyConfigurationId: id } = await sv.send(
    new CreateNotifyConfigurationCommand({
      DisplayName: displayName,
      UseCase: 'CODE_VERIFICATION',
      EnabledCountries: countries,
      EnabledChannels: ['SMS'],
      DefaultTemplateId: template.TemplateId,
      Tags: [{ Key: 'Project', Value: 'santa-call-center' }],
    }),
  );
  let config;
  for (let i = 0; i < 12; i++) {
    config = (await sv.send(new DescribeNotifyConfigurationsCommand({ NotifyConfigurationIds: [id] }))).NotifyConfigurations?.[0];
    if (config?.Status !== 'PENDING') break;
    await sleep(5000);
  }
  if (config?.Status !== 'ACTIVE') {
    const err = new Error(
      `The display name "${displayName}" is ${config?.Status}${config?.RejectionReason ? ` (${config.RejectionReason})` : ''}. ` +
        'Notify reviews display names automatically; names that look like a known brand need verification. ' +
        `Delete it with: aws pinpoint-sms-voice-v2 delete-notify-configuration --notify-configuration-id ${id} --region ${region}`,
    );
    err.configId = id;
    throw err;
  }
  log('  Creating the code configuration (6 digits, valid 10 minutes, 5 attempts)...');
  const cc = await eum.send(
    new CreateNotifyCodeConfigurationCommand({
      notifyCodeConfigurationName: `santa-call-code-${Date.now().toString(36)}`,
      codeConfigurationParameters: { codeType: 'NUMERIC', codeLength: 6, validityPeriodMinutes: 10, maxAttempts: 5 },
      channelParameters: { notify: { notifyTemplateId: template.TemplateId } },
      tags: [{ key: 'Project', value: 'santa-call-center' }],
    }),
  );
  return {
    configArn: config.NotifyConfigurationArn,
    codeConfigId: cc.notifyCodeConfiguration?.notifyCodeConfigurationId,
    status: config.Status,
    templateId: template.TemplateId,
  };
}
