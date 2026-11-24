// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Deployment configuration, read from environment variables at synth time.
 * Copy `.env.example` to `.env` and run `npm run sandbox`.
 */
function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

/** Geographic prefix of Bedrock cross-Region inference profiles for a Region, e.g. `us-east-1` → `us`. */
export function inferenceProfilePrefix(region: string): 'us' | 'eu' | 'apac' {
  if (region.startsWith('eu-')) return 'eu';
  if (region.startsWith('ap-')) return 'apac';
  return 'us';
}

export const config = {
  /** IANA time zone for the call window, the call date and the daily limits, e.g. America/New_York or Europe/London. */
  callTimezone: optional('CALL_TIMEZONE', 'America/New_York'),
  /** Amazon Connect instance ID (not the ARN). Required: Lambdas are associated with it. */
  connectInstanceId: required('CONNECT_INSTANCE_ID'),
  /** Published `Santa Outbound Call` contact flow ID. Empty on the first deploy; the dialer refuses to call until set. */
  connectContactFlowId: optional('CONNECT_CONTACT_FLOW_ID'),
  /** Claimed number used as caller ID, E.164. */
  connectSourcePhoneNumber: optional('CONNECT_SOURCE_PHONE_NUMBER'),
  /** Optional outbound campaign ID. When set, calls use TrafficType=CAMPAIGN with answering machine detection. */
  connectCampaignId: optional('CONNECT_CAMPAIGN_ID'),
  /** Verified SES identity used as sender. */
  senderEmail: required('SANTA_SENDER_EMAIL'),
  /**
   * Send Cognito's own emails (invitations, password resets) through your SES account instead of
   * Cognito's default sender, which allows 50 emails a day per AWS account. While SES is in the
   * sandbox they only reach verified addresses, so leave it false until SES has production access.
   */
  cognitoEmailViaSes: optional('COGNITO_EMAIL_VIA_SES', 'false') === 'true',
  /** SES identity (domain or address) that covers SANTA_SENDER_EMAIL. Defaults to the address itself. */
  sesIdentity: optional('SES_IDENTITY'),
  /** Set to false when the sender identity already exists in SES, so the stack does not try to create it. */
  createSenderIdentity: optional('CREATE_SENDER_IDENTITY', 'true') !== 'false',
  /** Comma-separated emails or @domains allowed to sign up. Empty means nobody can sign up. */
  signupAllowlist: optional('SIGNUP_ALLOWLIST'),
  /** Comma-separated E.164 prefixes Santa may call. */
  allowedPhonePrefixes: optional('ALLOWED_PHONE_PREFIXES', '+1'),
  /**
   * Set to false to let parents skip the SMS code and type any allowed number.
   * Anyone who can sign in can then make Santa call any number, so keep SIGNUP_ALLOWLIST tight.
   */
  requirePhoneVerification: optional('REQUIRE_PHONE_VERIFICATION', 'true') !== 'false',
  /**
   * AWS End User Messaging Notify configuration (ARN) that sends the phone verification SMS, and the
   * Notify code configuration ID that sets the code length, validity and attempts. Create both once
   * with `npm run notify:setup` (see docs/adr/0006-phone-verification-notify.md). Empty = SMS verification is off.
   */
  notifyConfigurationArn: optional('NOTIFY_CONFIGURATION_ARN'),
  notifyCodeConfigurationId: optional('NOTIFY_CODE_CONFIGURATION_ID'),
  /**
   * Bedrock model or inference profile for writing the parent email. The default is Amazon Nova Lite through
   * the cross-Region inference profile of the deployment Region (`us.` in the US, `eu.` in Europe, `apac.` in
   * Asia Pacific). Set the full ID to use another model.
   */
  bedrockModelId: optional('BEDROCK_MODEL_ID') || `${inferenceProfilePrefix(optional('AWS_REGION'))}.amazon.nova-lite-v1:0`,
  /** Call window in CALL_TIMEZONE wall-clock time, HH:MM. */
  callWindowStart: optional('CALL_WINDOW_START', '09:00'),
  callWindowEnd: optional('CALL_WINDOW_END', '22:00'),
  maxAttempts: optional('MAX_CALL_ATTEMPTS', '3'),
  retryDelayMinutes: optional('RETRY_DELAY_MINUTES', '15'),
  /** Global cap on calls per calendar day (in CALL_TIMEZONE), across all parents. Keeps telephony and AI cost bounded. */
  maxCallsPerDay: optional('MAX_CALLS_PER_DAY', '50'),
  /** Verification SMS a user may request per clock hour, against SMS pumping. */
  maxSmsCodesPerHour: optional('MAX_SMS_CODES_PER_HOUR', '5'),
  /**
   * AWS WAF web ACL on the AppSync API: AWS managed rules plus a per-IP rate limit (requests per
   * 5 minutes). Set ENABLE_WAF=false to skip it (it has a monthly cost).
   */
  enableWaf: optional('ENABLE_WAF', 'true') !== 'false',
  wafRateLimit: Number(optional('WAF_RATE_LIMIT', '300')),
  /** Web app URL, used in the invitation email. Optional. */
  appUrl: optional('APP_URL'),
  /**
   * Set to true to create the Secrets Manager secret and KMS key that let Connect use an ElevenLabs
   * voice in the Set voice block. The secret value is set separately with `npm run elevenlabs:secret`.
   */
  elevenLabsTts: optional('ELEVENLABS_TTS', 'false') === 'true',
  /**
   * Amazon store for the "See ideas on Amazon" link under each wish in the parents' email, e.g. amazon.com or amazon.es.
   * Set to "off" to send the email without links.
   */
  giftLinksDomain: optional('GIFT_LINKS_DOMAIN', 'amazon.com'),
  /**
   * Optional Amazon Associates tracking ID added to the gift links. The email then says the links are
   * affiliate links. Check your employer's and the Associates programme's rules before setting it.
   */
  amazonAssociateTag: optional('AMAZON_ASSOCIATE_TAG'),
};
