# 4. Santa only calls the signed-in parent's verified phone

Status: Accepted

## Context

A form that takes any phone number lets anyone make "Santa" call anyone. The notes field goes
into the prompt, so it can carry a prompt injection or something unpleasant for Santa to say to
a child.

## Decision

- Sign-up is limited to an allowlist of emails or domains. An empty allowlist blocks everyone.
- The parent verifies their mobile with an SMS code (since decision 34 sent and validated by AWS End
  User Messaging Notify; see [ADR 0006](0006-phone-verification-notify.md)). The number only takes
  effect after the code is confirmed.
- The backend reads the phone and email from Cognito and rejects unverified users. The form has no
  phone or email field to tamper with.
- Only `+34` numbers, between 10:00 and 20:30 Madrid time, up to 30 days ahead
  (later changed to 09:00 to 22:00, up to 24 December; see HISTORY), and at most 3
  pending calls per parent.
- Notes are limited to 300 characters. Brackets and control characters are stripped. The
  notes pass a Bedrock guardrail (prompt attack, harmful content, two denied topics) before they
  are stored.
- The Santa agent has its own guardrails (ADR 0007). The prompt treats the notes as data.

## Consequences

- A parent can only make Santa call their own phone.
- Each phone verification costs one Notify SMS. Per-user hourly SMS limit, a global daily call cap and
  AWS WAF on the API bound the cost of abuse (see the README "Security" section and `docs/threat-model.md`).
- The guardrail can reject harmless notes. The parent sees a message asking them to rewrite.
