// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineBackend } from '@aws-amplify/backend';
import { Aws, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CfnGuardrail, CfnGuardrailVersion } from 'aws-cdk-lib/aws-bedrock';
import { CfnIntegrationAssociation } from 'aws-cdk-lib/aws-connect';
import type { CfnUserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { CfnScheduleGroup } from 'aws-cdk-lib/aws-scheduler';
import { EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses';
import { CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { auth } from './auth/resource.js';
import { applyNag } from './nag.js';
import { config } from './config.js';
import { data } from './data/resource.js';
import { bookingsApi } from './functions/bookings-api/resource.js';
import { callOutcome } from './functions/call-outcome/resource.js';
import { dialer } from './functions/dialer/resource.js';
import { flowHandler } from './functions/flow-handler/resource.js';
import { sendLetter } from './functions/send-letter/resource.js';

const backend = defineBackend({ auth, data, bookingsApi, dialer, callOutcome, flowHandler, sendLetter });

// Everything the call pipeline needs lives in the "calls" nested stack, next to its Lambdas.
// The data stack (bookings API) depends on it; it never depends on data or auth, so there is no cycle.
const stack = Stack.of(backend.dialer.resources.lambda);
const fns = {
  bookingsApi: backend.bookingsApi.resources.lambda,
  dialer: backend.dialer.resources.lambda,
  callOutcome: backend.callOutcome.resources.lambda,
  flowHandler: backend.flowHandler.resources.lambda,
  sendLetter: backend.sendLetter.resources.lambda,
};
const allFns = Object.values(fns);
const connectInstanceArn = `arn:${Aws.PARTITION}:connect:${stack.region}:${stack.account}:instance/${config.connectInstanceId}`;

// ---------- Bookings table ----------
// No point-in-time recovery on purpose: it would keep deleted child data for 35 days.
const table = new Table(stack, 'Bookings', {
  partitionKey: { name: 'bookingId', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  encryption: TableEncryption.AWS_MANAGED,
  timeToLiveAttribute: 'expiresAt',
  removalPolicy: RemovalPolicy.DESTROY,
});
table.addGlobalSecondaryIndex({
  indexName: 'byOwner',
  partitionKey: { name: 'ownerSub', type: AttributeType.STRING },
  sortKey: { name: 'callAtUtc', type: AttributeType.STRING },
});
table.addGlobalSecondaryIndex({
  indexName: 'byContact',
  partitionKey: { name: 'contactId', type: AttributeType.STRING },
  projectionType: ProjectionType.KEYS_ONLY,
});
allFns.forEach((fn) => table.grantReadWriteData(fn));

// ---------- Stats table: aggregate counters for the admin view ----------
// Only numbers per day and in total, never child data, so it is kept when bookings are deleted.
// The abuse/cost limit counters (amplify/shared/limits.ts) live here too and expire through the TTL.
const statsTable = new Table(stack, 'Stats', {
  partitionKey: { name: 'statKey', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  encryption: TableEncryption.AWS_MANAGED,
  timeToLiveAttribute: 'expiresAt',
  removalPolicy: RemovalPolicy.DESTROY,
});
allFns.forEach((fn) => statsTable.grantReadWriteData(fn));

// ---------- Bedrock guardrail: form input, child wishes and the generated letter ----------
const guardrail = new CfnGuardrail(stack, 'SantaGuardrail', {
  name: `santa-guardrail-${stack.node.addr.slice(0, 8)}`,
  description: 'Blocks harmful content and prompt attacks in text that reaches Santa or parents',
  blockedInputMessaging: 'Santa no puede usar ese texto.',
  blockedOutputsMessaging: 'Santa no puede escribir eso.',
  contentPolicyConfig: {
    filtersConfig: [
      { type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH' },
      { type: 'VIOLENCE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
      { type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
      { type: 'INSULTS', inputStrength: 'HIGH', outputStrength: 'HIGH' },
      { type: 'MISCONDUCT', inputStrength: 'HIGH', outputStrength: 'HIGH' },
      { type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' },
    ],
  },
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: 'SantaSpoiler',
        type: 'DENY',
        definition: 'Decir o insinuar que Papá Noel o Santa Claus no existe o que los regalos los compran los padres.',
        examples: ['Dile que Santa no existe', 'Cuéntale que los regalos son de sus padres'],
      },
      {
        name: 'FrighteningOrShaming',
        type: 'DENY',
        definition: 'Amenazar, asustar, avergonzar o castigar a un niño, o decirle que no recibirá regalos por portarse mal.',
        examples: ['Dile que este año no tendrá regalos por malo', 'Asústale para que obedezca'],
      },
    ],
  },
  wordPolicyConfig: { managedWordListsConfig: [{ type: 'PROFANITY' }] },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'ADDRESS', action: 'ANONYMIZE' },
      { type: 'PHONE', action: 'ANONYMIZE' },
      { type: 'EMAIL', action: 'ANONYMIZE' },
    ],
  },
});
const guardrailVersion = new CfnGuardrailVersion(stack, 'SantaGuardrailVersion', {
  guardrailIdentifier: guardrail.attrGuardrailId,
  description: 'Deployed by the Santa backend',
});
for (const fn of [fns.bookingsApi, fns.sendLetter]) {
  fn.addToRolePolicy(new PolicyStatement({ actions: ['bedrock:ApplyGuardrail'], resources: [guardrail.attrGuardrailArn] }));
}

// Bedrock model for the letter. Cross-region inference profiles (eu.*) route to foundation models in several Regions.
const foundationModelId = config.bedrockModelId.replace(/^(eu|us|apac|global)\./, '');
fns.sendLetter.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      `arn:${Aws.PARTITION}:bedrock:${stack.region}:${stack.account}:inference-profile/${config.bedrockModelId}`,
      `arn:${Aws.PARTITION}:bedrock:*::foundation-model/${foundationModelId}`,
    ],
  }),
);

// ---------- Scheduler: one-time schedules that invoke the dialer ----------
const scheduleGroup = new CfnScheduleGroup(stack, 'SantaScheduleGroup', {
  name: `santa-calls-${stack.node.addr.slice(0, 8)}`,
});
const schedulerRole = new Role(stack, 'SchedulerInvokeDialerRole', {
  assumedBy: new ServicePrincipal('scheduler.amazonaws.com', {
    conditions: { StringEquals: { 'aws:SourceAccount': stack.account } },
  }),
});
fns.dialer.grantInvoke(schedulerRole);
const schedulesArn = `arn:${Aws.PARTITION}:scheduler:${stack.region}:${stack.account}:schedule/${scheduleGroup.name}/*`;
for (const fn of [fns.bookingsApi, fns.dialer, fns.callOutcome]) {
  fn.addToRolePolicy(new PolicyStatement({ actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'], resources: [schedulesArn] }));
  fn.addToRolePolicy(new PolicyStatement({ actions: ['iam:PassRole'], resources: [schedulerRole.roleArn] }));
}

// ---------- SES ----------
// Creating the identity sends a verification email to the sender address. In the SES sandbox, recipients must be verified too.
if (config.createSenderIdentity) {
  new EmailIdentity(stack, 'SenderIdentity', { identity: Identity.email(config.senderEmail) });
}
for (const fn of [fns.dialer, fns.callOutcome, fns.sendLetter]) {
  fn.addToRolePolicy(
    new PolicyStatement({
      actions: ['ses:SendEmail'],
      // SES authorizes against the sender identity and, while the account is in the SES sandbox, also against
      // each verified recipient identity. So the resource is every identity in the account, and the
      // FromAddress condition keeps the Lambdas to the one sender address.
      resources: [`arn:${Aws.PARTITION}:ses:${stack.region}:${stack.account}:identity/*`],
      conditions: { StringEquals: { 'ses:FromAddress': config.senderEmail } },
    }),
  );
}

// ---------- Amazon Connect ----------
fns.dialer.addToRolePolicy(
  new PolicyStatement({ actions: ['connect:StartOutboundVoiceContact'], resources: [connectInstanceArn, `${connectInstanceArn}/*`] }),
);
fns.flowHandler.addToRolePolicy(
  new PolicyStatement({ actions: ['connect:DescribeContact'], resources: [`${connectInstanceArn}/contact/*`] }),
);
fns.flowHandler.addToRolePolicy(
  new PolicyStatement({
    actions: ['wisdom:UpdateSessionData'],
    resources: [`arn:${Aws.PARTITION}:wisdom:${stack.region}:${stack.account}:session/*`],
  }),
);
fns.sendLetter.grantInvoke(fns.flowHandler);

// Let the contact flow call flow-handler.
fns.flowHandler.addPermission('AllowConnectInvoke', {
  principal: new ServicePrincipal('connect.amazonaws.com'),
  sourceArn: connectInstanceArn,
  sourceAccount: stack.account,
});
new CfnIntegrationAssociation(stack, 'FlowHandlerConnectAssociation', {
  instanceId: connectInstanceArn,
  integrationType: 'LAMBDA_FUNCTION',
  integrationArn: fns.flowHandler.functionArn,
});

// ElevenLabs voice for the Set voice block. Connect reads the API key from this secret.
// Connect cannot use the default aws/secretsmanager key, so the secret has its own KMS key.
if (config.elevenLabsTts) {
  const secretName = 'santa-call-center/elevenlabs-api-key';
  // Fixed name so the key policy can reference the secret ARN without a dependency cycle.
  const secretArnPattern = `arn:${Aws.PARTITION}:secretsmanager:${stack.region}:${stack.account}:secret:${secretName}-*`;
  const connectConditions = {
    ArnLike: { 'aws:SourceArn': connectInstanceArn },
    StringEquals: { 'aws:SourceAccount': stack.account },
  };
  const elevenLabsKey = new Key(stack, 'ElevenLabsSecretKey', {
    description: 'Encrypts the ElevenLabs API key that Amazon Connect reads for text-to-speech',
    enableKeyRotation: true,
    pendingWindow: Duration.days(7),
    removalPolicy: RemovalPolicy.DESTROY,
  });
  elevenLabsKey.addToResourcePolicy(
    new PolicyStatement({
      principals: [new ServicePrincipal('connect.amazonaws.com')],
      actions: ['kms:Decrypt'],
      resources: ['*'],
      conditions: {
        ArnLike: connectConditions.ArnLike,
        StringEquals: connectConditions.StringEquals,
        StringLike: { 'kms:EncryptionContext:SecretARN': secretArnPattern },
      },
    }),
  );
  // Created with a random placeholder; `npm run elevenlabs:secret` puts the real key in.
  const elevenLabsSecret = new Secret(stack, 'ElevenLabsApiKey', {
    secretName,
    description: 'ElevenLabs API key for Amazon Connect text-to-speech, as {"apiToken": "..."}',
    encryptionKey: elevenLabsKey,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  elevenLabsSecret.addToResourcePolicy(
    new PolicyStatement({
      principals: [new ServicePrincipal('connect.amazonaws.com')],
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*'],
      conditions: connectConditions,
    }),
  );
  new CfnOutput(stack, 'ElevenLabsSecretArn', { value: elevenLabsSecret.secretArn });
}

// Call outcome: every disconnect of an API-initiated call on this instance.
new Rule(stack, 'SantaCallDisconnected', {
  eventPattern: {
    source: ['aws.connect'],
    detailType: ['Amazon Connect Contact Event'],
    detail: { eventType: ['DISCONNECTED'], instanceArn: [connectInstanceArn], initiationMethod: ['API'] },
  },
  targets: [new LambdaFunction(fns.callOutcome, { retryAttempts: 4, maxEventAge: Duration.hours(1) })],
});

// ---------- Environment ----------
function env(targets: IFunction[], values: Record<string, string>) {
  for (const fn of targets) {
    const lambda = fn as unknown as { addEnvironment(k: string, v: string): void };
    for (const [k, v] of Object.entries(values)) lambda.addEnvironment(k, v);
  }
}
env(allFns, { BOOKINGS_TABLE: table.tableName, STATS_TABLE: statsTable.tableName });
env([fns.bookingsApi, fns.dialer, fns.callOutcome], {
  SCHEDULE_GROUP: scheduleGroup.name!,
  SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
  MAX_CALL_ATTEMPTS: config.maxAttempts,
  RETRY_DELAY_MINUTES: config.retryDelayMinutes,
});
// The dialer reads its own ARN from the invocation context: a Lambda cannot reference itself in its environment.
env([fns.bookingsApi, fns.callOutcome], { DIALER_FUNCTION_ARN: fns.dialer.functionArn });
env([fns.bookingsApi, fns.sendLetter], {
  GUARDRAIL_ID: guardrail.attrGuardrailId,
  GUARDRAIL_VERSION: guardrailVersion.attrVersion,
});
env([fns.dialer, fns.callOutcome, fns.sendLetter], { SENDER_EMAIL: config.senderEmail });
env([fns.bookingsApi], {
  USER_POOL_ID: backend.auth.resources.userPool.userPoolId,
  ALLOWED_PHONE_PREFIXES: config.allowedPhonePrefixes,
  REQUIRE_PHONE_VERIFICATION: String(config.requirePhoneVerification),
  CALL_WINDOW_START: config.callWindowStart,
  CALL_WINDOW_END: config.callWindowEnd,
  MAX_CALLS_PER_DAY: config.maxCallsPerDay,
  MAX_SMS_CODES_PER_HOUR: config.maxSmsCodesPerHour,
});
env([fns.dialer], {
  CONNECT_INSTANCE_ID: config.connectInstanceId,
  CONNECT_CONTACT_FLOW_ID: config.connectContactFlowId,
  CONNECT_SOURCE_PHONE_NUMBER: config.connectSourcePhoneNumber,
  CONNECT_CAMPAIGN_ID: config.connectCampaignId,
});
env([fns.flowHandler], {
  QCONNECT_ASSISTANT_ID: config.qconnectAssistantId,
  SEND_LETTER_FUNCTION_NAME: fns.sendLetter.functionName,
});
env([fns.sendLetter], {
  BEDROCK_MODEL_ID: config.bedrockModelId,
  GIFT_LINKS_DOMAIN: config.giftLinksDomain,
  AMAZON_ASSOCIATE_TAG: config.amazonAssociateTag,
});

fns.bookingsApi.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['cognito-idp:AdminGetUser', 'cognito-idp:AdminUpdateUserAttributes'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);

// ---------- Phone verification: AWS End User Messaging Notify generates, sends and validates the code ----------
env([fns.bookingsApi], {
  NOTIFY_CONFIGURATION_ARN: config.notifyConfigurationArn,
  NOTIFY_CODE_CONFIGURATION_ID: config.notifyCodeConfigurationId,
});
if (config.notifyConfigurationArn && config.notifyCodeConfigurationId) {
  fns.bookingsApi.addToRolePolicy(
    new PolicyStatement({
      actions: ['end-user-messaging:SendNotifyCodeVerification'],
      resources: [
        `arn:${Aws.PARTITION}:end-user-messaging:${stack.region}:${stack.account}:notify-code-configuration/${config.notifyCodeConfigurationId}`,
      ],
    }),
  );
  // Sending through the Notify configuration (AWS-managed numbers) is authorized on that configuration,
  // and the service reads the configuration and its template with the caller's permissions.
  fns.bookingsApi.addToRolePolicy(
    new PolicyStatement({
      actions: ['sms-voice:SendNotifyTextMessage', 'sms-voice:DescribeNotifyConfigurations'],
      resources: [config.notifyConfigurationArn],
    }),
  );
  // ValidateNotifyCodeVerification and DescribeNotifyTemplates (read-only) have no resource type, so only "*".
  fns.bookingsApi.addToRolePolicy(
    new PolicyStatement({
      actions: ['end-user-messaging:ValidateNotifyCodeVerification', 'sms-voice:DescribeNotifyTemplates'],
      resources: ['*'],
    }),
  );
}

// ---------- Cognito: SNS SMS settings ----------
// The web app no longer uses Cognito's own SMS codes (SNS shared routes don't deliver to Spain since the
// CNMC sender ID rule); phone verification goes through Notify above. These settings are kept so the user
// pool is not replaced and Cognito can still send SMS if needed.
const authStack = Stack.of(backend.auth.resources.userPool);
const smsExternalId = `santa-sms-${authStack.node.addr.slice(0, 12)}`;
// The permission must be inline: Cognito checks it when the user pool is created, before a separate policy would exist.
const smsRole = new Role(authStack, 'CognitoSmsRole', {
  assumedBy: new ServicePrincipal('cognito-idp.amazonaws.com', {
    conditions: { StringEquals: { 'sts:ExternalId': smsExternalId, 'aws:SourceAccount': authStack.account } },
  }),
  inlinePolicies: {
    // Cognito publishes SMS directly to phone numbers, which has no narrower resource than "*".
    SendSms: new PolicyDocument({ statements: [new PolicyStatement({ actions: ['sns:Publish'], resources: ['*'] })] }),
  },
});
const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.node.addDependency(smsRole);
cfnUserPool.smsConfiguration = { snsCallerArn: smsRole.roleArn, externalId: smsExternalId, snsRegion: authStack.region };
cfnUserPool.autoVerifiedAttributes = ['email', 'phone_number'];
// Spanish, branded SMS text for Cognito's own SMS (not used by the web app).
const smsCodeMessage = 'Llamada de Santa: tu código de verificación es {####}';
cfnUserPool.smsVerificationMessage = smsCodeMessage;
cfnUserPool.verificationMessageTemplate = {
  ...(cfnUserPool.verificationMessageTemplate as CfnUserPool.VerificationMessageTemplateProperty),
  smsMessage: smsCodeMessage,
};
// A changed phone number only takes effect after the SMS code is confirmed.
cfnUserPool.userAttributeUpdateSettings = { attributesRequireVerificationBeforeUpdate: ['phone_number'] };
// Only an admin can create users: an open sign-up would let anyone make Santa call a phone. Setting it here
// keeps a redeploy from turning it back on if it was changed in the console.
cfnUserPool.adminCreateUserConfig = {
  ...(cfnUserPool.adminCreateUserConfig as CfnUserPool.AdminCreateUserConfigProperty),
  allowAdminCreateUserOnly: true,
  // Invitation sent when an admin creates the user.
  inviteMessageTemplate: {
    emailSubject: 'Ya puedes avisar a Santa',
    emailMessage:
      `¡Hola! Ya tienes acceso a la Llamada de Santa${config.appUrl ? ` (${config.appUrl})` : ''}.<br><br>` +
      'Entra con tu email {username} y esta contraseña temporal: <b>{####}</b><br>' +
      'Te pedirá que elijas una contraseña nueva.',
  },
};
// No guest access: the data API only accepts signed-in users, so unauthenticated identities are never needed.
backend.auth.resources.cfnResources.cfnIdentityPool.allowUnauthenticatedIdentities = false;

// ---------- Cognito email through SES (COGNITO_EMAIL_VIA_SES) ----------
// Cognito's default sender allows 50 emails a day per account. With SES, invitations and password resets
// use the account's SES quota and the Santa sender. The identity needs a sending authorization policy for
// Cognito; it is scoped to this account's user pools, without referencing the pool, to avoid a cycle.
if (config.cognitoEmailViaSes) {
  const identityName = config.sesIdentity || config.senderEmail;
  const identityArn = `arn:${Aws.PARTITION}:ses:${authStack.region}:${authStack.account}:identity/${identityName}`;
  const policyName = 'AllowCognitoUserPoolEmail';
  const policyDocument = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowCognitoUserPools',
        Effect: 'Allow',
        Principal: { Service: 'cognito-idp.amazonaws.com' },
        Action: ['ses:SendEmail', 'ses:SendRawEmail'],
        Resource: identityArn,
        Condition: {
          StringEquals: { 'aws:SourceAccount': authStack.account },
          ArnLike: { 'aws:SourceArn': `arn:${Aws.PARTITION}:cognito-idp:${authStack.region}:${authStack.account}:userpool/*` },
        },
      },
    ],
  });
  const call = (action: string, extra: Record<string, string> = {}) => ({
    service: 'SESV2',
    action,
    parameters: { EmailIdentity: identityName, PolicyName: policyName, ...extra },
    physicalResourceId: PhysicalResourceId.of(`${identityName}/${policyName}`),
  });
  const sesPolicy = new AwsCustomResource(authStack, 'CognitoSesIdentityPolicy', {
    onCreate: call('createEmailIdentityPolicy', { Policy: policyDocument }),
    onUpdate: call('updateEmailIdentityPolicy', { Policy: policyDocument }),
    onDelete: call('deleteEmailIdentityPolicy'),
    policy: AwsCustomResourcePolicy.fromStatements([
      new PolicyStatement({
        actions: ['ses:CreateEmailIdentityPolicy', 'ses:UpdateEmailIdentityPolicy', 'ses:DeleteEmailIdentityPolicy'],
        resources: [identityArn],
      }),
    ]),
    installLatestAwsSdk: false,
  });
  cfnUserPool.node.addDependency(sesPolicy);
  cfnUserPool.emailConfiguration = {
    emailSendingAccount: 'DEVELOPER',
    sourceArn: identityArn,
    from: `Santa <${config.senderEmail}>`,
  };
}

new CfnOutput(stack, 'FlowHandlerFunctionArn', { value: fns.flowHandler.functionArn });

// ---------- AWS WAF on the AppSync API ----------
// Managed rules for common exploits, known bad inputs and IPs with a bad reputation, plus a per-IP rate
// limit. The backend limits (calls per day, SMS per user) still apply; WAF stops floods before they reach it.
if (config.enableWaf) {
  const api = backend.data.resources.graphqlApi;
  const dataStack = Stack.of(api);
  const managed = (name: string, priority: number) => ({
    name,
    priority,
    overrideAction: { none: {} },
    statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
    visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: name },
  });
  const webAcl = new CfnWebACL(dataStack, 'SantaApiWebAcl', {
    scope: 'REGIONAL',
    defaultAction: { allow: {} },
    visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'santa-api' },
    rules: [
      {
        name: 'RatePerIp',
        priority: 0,
        action: { block: {} },
        statement: { rateBasedStatement: { limit: config.wafRateLimit, aggregateKeyType: 'IP' } },
        visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'RatePerIp' },
      },
      managed('AWSManagedRulesAmazonIpReputationList', 1),
      managed('AWSManagedRulesCommonRuleSet', 2),
      managed('AWSManagedRulesKnownBadInputsRuleSet', 3),
    ],
  });
  new CfnWebACLAssociation(dataStack, 'SantaApiWebAclAssociation', { resourceArn: api.arn, webAclArn: webAcl.attrArn });
}
backend.addOutput({
  custom: {
    flowHandlerFunctionArn: fns.flowHandler.functionArn,
    bookingsTable: table.tableName,
    requirePhoneVerification: config.requirePhoneVerification,
    // Shown to parents so they can save Santa's number in their contacts.
    santaCallerNumber: config.connectSourcePhoneNumber,
  },
});

// Security checks at synth time (AWS Solutions rules). Off for normal deploys: `npm run nag`.
if (process.env.CDK_NAG === 'true') applyNag(Stack.of(backend.auth.resources.userPool).node.root);
