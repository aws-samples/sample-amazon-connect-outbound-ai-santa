# 6. Phone verification with AWS End User Messaging Notify

Status: Accepted. Changes the SMS part of [ADR 0004](0004-abuse-controls.md).

## Context

Cognito sent the phone verification code through Amazon SNS. Since 15 September 2026 Spanish
carriers drop SMS from sender IDs that are not in the CNMC alias registry, so SNS shared routes no
longer deliver to Spain. A dedicated Spanish long code needs a registration with a real Spanish
company and takes weeks. A US toll-free number with international sending was tried, but AWS
support said it cannot send to Spain.

AWS End User Messaging Notify sends one-time passcodes from AWS-managed numbers with pre-approved
templates, without a registration. Spain is supported on the Basic tier. It can also generate and
validate the code itself (`SendNotifyCodeVerification` and `ValidateNotifyCodeVerification`, in the
`endusermessaging` API).

Cognito cannot send through Notify directly. Its options are SNS, End User Messaging
`SendTextMessage` with your own number, or a Custom SMS Sender trigger, which needs a KMS key.

## Decision

- The web app no longer uses Cognito's attribute verification. Two mutations in `bookings-api`:
  - `sendPhoneCode`: checks the number is a Spanish mobile (`+346…` or `+347…`) and in
    `ALLOWED_PHONE_PREFIXES`, then calls `SendNotifyCodeVerification`. Notify generates the code
    and sends it.
  - `verifyPhoneCode`: calls `ValidateNotifyCodeVerification`. Only if the result is `VALID` does
    the Lambda call `AdminUpdateUserAttributes` with `phone_number` and `phone_number_verified=true`.
- Every send and validate uses `referenceId = user-<sub>`, so a code sent for one user can never
  verify another user.
- The Notify configuration (display name `SantaCallDemo`, Basic tier, Spain only, SMS only) and
  the code configuration (6 digits, 10 minutes, 5 attempts, template
  `notify-code-verification-spanish-005`) are created once with the CLI and passed in
  `NOTIFY_CONFIGURATION_ARN` and `NOTIFY_CODE_CONFIGURATION_ID`. They are not in CloudFormation yet.
- The Cognito SNS settings stay, so the user pool is not replaced.

## Consequences

- The SMS text is Notify's template, not our own: "Tu código de verificación SantaCallDemo es: 123456."
- Plain display names like "Santa" go to `REQUIRES_VERIFICATION` in the automatic brand review.
- IAM needs, besides `end-user-messaging:SendNotifyCodeVerification` on the code configuration:
  `sms-voice:SendNotifyTextMessage` and `sms-voice:DescribeNotifyConfigurations` on the Notify
  configuration, and `sms-voice:DescribeNotifyTemplates` and
  `end-user-messaging:ValidateNotifyCodeVerification` on `*` (no resource type). The service checks
  `DescribeNotifyTemplates` with the caller's permissions; without it the send fails with
  `AccessDeniedException`.
- Notify spend limits and the Basic tier daily limit apply. Throttling shows the parent a
  "too many codes" message.
- Code generation, expiry and attempt limits are Notify's; there is no code storage in this app.
