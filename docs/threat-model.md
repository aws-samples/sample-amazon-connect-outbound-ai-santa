# Threat model

STRIDE review of the sample as deployed by `npm run sandbox`. Scope: the web app, the AppSync API and
its Lambdas, the call pipeline (Scheduler, Connect, flow Lambdas), and the third parties it calls.

## Assets

| Asset | Where | Sensitivity |
|---|---|---|
| Child's first name, parent notes, wishlist | DynamoDB bookings, Connect AI agent session, Bedrock, email | Personal data about a child |
| Parent email and mobile | Cognito, DynamoDB bookings, Connect contact record (phone only) | Personal data |
| The ability to place calls and send SMS and email | Lambda roles, Connect, Notify, SES | Cost and reputation |
| ElevenLabs API key (optional) | Secrets Manager, customer-managed KMS key | Secret |

## Trust boundaries

1. Browser to AppSync: the internet. Requests carry a Cognito user pool token; AWS WAF sits in front.
2. AppSync to Lambda: AWS, the Lambda gets the verified identity (`sub`, `username`, groups).
3. Lambda to AWS services: IAM, per-function least privilege.
4. Connect to the phone network and the child: untrusted speech, guarded by the Connect AI guardrail.
5. Connect to ElevenLabs (optional): third party, receives the text Santa speaks.

## Threats and mitigations

| # | STRIDE | Threat | Mitigation | Residual risk |
|---|---|---|---|---|
| 1 | Spoofing | Someone makes Santa call a phone that isn't theirs, to harass a family | Santa only calls the phone verified on the caller's Cognito user. Verification uses a Notify code bound to the user (`referenceId = user-<sub>`) and validated in the backend; only `VALID` marks the phone verified. `+34` mobiles only. Unverified numbers in the request are ignored while `REQUIRE_PHONE_VERIFICATION=true` | A parent with access to someone else's phone for a moment |
| 2 | Spoofing | Mass account creation to bypass per-user limits | Admin-only user creation by default (`allowAdminCreateUserOnly`), optional email/domain allowlist. If self sign-up is turned on, the daily call cap and WAF still bound the total | With open sign-up, one person can hold many accounts up to the daily cap |
| 3 | Tampering | Prompt injection through the notes or the child's speech, to make Santa say harmful things or reveal the prompt | Notes limited to 300 characters, brackets and control characters stripped, Bedrock guardrail (prompt attack, harmful content, denied topics) before storage. The prompt treats notes as data. Connect AI guardrail on every child turn. 13 chat scenarios in `scripts/chat-scenarios` | Guardrails are probabilistic; new jailbreaks may pass |
| 4 | Information disclosure | Child data kept longer than needed, or visible in logs and contact records | No recording, Contact Lens or transcript. Only `bookingId` in contact attributes. Lambdas log IDs and error names only. The booking is deleted after the email; TTL removes leftovers after 2 days; no point-in-time recovery. Admin view shows aggregate numbers only | Connect AI agent session retention is not documented; ElevenLabs retention depends on the plan |
| 5 | Information disclosure | A user reads or cancels another user's bookings | Every query and mutation filters by the caller's `sub` from the token; cancel checks `ownerSub`. The admin view is restricted to the `ADMINS` group in AppSync and again in the Lambda | None known |
| 6 | Denial of service / cost | Floods of API calls, SMS pumping (artificially inflated traffic), or many calls to run up telephony, AI and SMS cost | AWS WAF: AWS managed rules and a per-IP rate limit. `MAX_CALLS_PER_DAY` across all users, 3 pending calls per parent, a call window, `MAX_SMS_CODES_PER_HOUR` per user, Notify enabled for Spain only, Notify Basic tier daily limits and spend limits, Connect outbound only to allow-listed countries | Distributed traffic below the WAF rate limit; set AWS Budgets alerts |
| 7 | Elevation of privilege | A Lambda is abused to reach other resources | Per-function IAM. SES `SendEmail` limited by `ses:FromAddress`; Connect calls only on the instance; Scheduler role only invokes the dialer; Notify send only on its code configuration and Notify configuration. Three documented `*` resources: `ValidateNotifyCodeVerification` and `DescribeNotifyTemplates` (no resource type), and `sns:Publish` on the unused Cognito SNS role | `*` resources are read-only or need a valid code |
| 8 | Repudiation | No record of who scheduled a call | Bookings carry the owner `sub` until deletion; aggregate counters per day; CloudTrail for control plane actions | Bookings are deleted on purpose, so per-call history is short |

## Out of scope for the sample

- Legal basis, privacy notice and consent for children's data in your jurisdiction.
- Data processing agreements with third parties (ElevenLabs, if used).
- Penetration testing and incident response for a permanent public deployment.
