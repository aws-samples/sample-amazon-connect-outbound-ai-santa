# Amazon Connect setup

Santa is an [Agentic CX designer](https://docs.aws.amazon.com/connect/latest/adminguide/acxd.html)
application, `Santa Wishlist Agent`. A Connect contact flow, `Santa Outbound Call`, hands each call
to it. Both are created from the files in this folder:

| What | Files | Created by |
|---|---|---|
| Santa agent: application, two flows, two guardrails, seven context variables | [`designer/`](designer/) | `npm run designer:setup` (or by hand in the designer, see [step 2b](#2b-by-hand-in-the-designer)) |
| Contact flow `Santa Outbound Call` | [`santa-flow.template.json`](santa-flow.template.json) | `npm run connect:flow` |

The backend (`npm run sandbox`) creates the Lambdas and associates `flow-handler` with your instance.
Do the steps below after the first deploy.

Tested Region: Europe (Frankfurt). Agentic CX designer is also available in US East (N. Virginia),
US West (Oregon), Canada (Central), Europe (London), Asia Pacific (Sydney, Seoul, Tokyo, Singapore)
([Region list](https://docs.aws.amazon.com/connect/latest/adminguide/regions.html)).

## 1. Instance settings

1. **Telephony**: outbound calls enabled.
2. **Phone number**: claim a number that supports outbound calls to the country you call
   (`ALLOWED_PHONE_PREFIXES`, `+1` by default). For the US, claim a US DID (local) or toll-free
   number in the Connect admin website. Check the outbound column for your destination country in the
   [Telecoms Country Coverage Guide](https://d1v2gagwb6hfe1.cloudfront.net/Amazon_Connect_Telecoms_Coverage.pdf)
   before relying on a number as caller ID.
3. **Data storage**: leave call recordings unset or off. This sample does not record.
4. **Flow logs**: keep them off for the Santa flow. They would write the wishlist to CloudWatch. The
   template turns them off in its first block.

## 2. The Santa agent in Agentic CX designer

### 2a. With the script (tested path)

1. **Manual:** in the Amazon Connect console, open your instance and choose **Agentic CX designer**.
   Note the ID of the workspace you will use and put it in `.env` as `ACXD_WORKSPACE_ID`.
2. **Manual:** in the designer, open **Admin Hub → Programmatic Users** (account administrator
   access), create a user with a role that can edit the workspace, and choose **Generate API Key**.
   The key (`acxd_live_...`) is shown once. Put it in `.env.local` (git-ignored) as
   `ACXD_API_KEY=acxd_live_...` (`npm run setup` asks for both and writes them). Never put the key
   in `.env.example` or any committed file.
3. Run:

   ```bash
   npm run designer:setup -- --dry-run   # only checks the files in connect/designer/
   npm run designer:setup
   ```

   The script uses the [Agentic CX designer SDK](https://github.com/amazon-connect/agentic-cx-designer-sdk)
   and the Region in `AWS_REGION`. It is safe to run again: it updates what already exists, by name.

   | Resource | Name | File |
   |---|---|---|
   | Context variables | `childName`, `childNotes`, `wishlist`, `behaviour`, `summary`, `reason`, `outcome` | [`context-variables.json`](designer/context-variables.json) |
   | Guardrail on what the child says | `Santa Child Input Guardrail` | [`guardrail-child-input.json`](designer/guardrail-child-input.json) |
   | Guardrail on what Santa says | `Santa Reply Output Guardrail` | [`guardrail-santa-reply-output.json`](designer/guardrail-santa-reply-output.json) |
   | Main flow, with the Generative Journey prompt | `SantaWishlistConversation` | [`flow-santa-wishlist-conversation.json`](designer/flow-santa-wishlist-conversation.json) |
   | Fallback and unknown flow | `SantaGoodbyeFallback` | [`flow-santa-goodbye-fallback.json`](designer/flow-santa-goodbye-fallback.json) |
   | Application | `Santa Wishlist Agent` | [`application.json`](designer/application.json) |

   Then it creates a build, deploys it to the `development` environment and saves
   `ACXD_APPLICATION_ID` and `ACXD_DEPLOYMENT_ALIAS` in `.env`. Context variables are shared by the
   whole workspace, so the script only creates the missing ones and never changes existing ones.

The SDK takes its Region from your default AWS profile when none is given and then answers 401,
which looks like a bad key. The script always passes `AWS_REGION`.

### 2b. By hand in the designer

If you can't create a programmatic user, build the same agent in the designer:

1. **Context variables**: create the seven variables in
   [`context-variables.json`](designer/context-variables.json), type text, with the same names.
2. **Guardrails**: create both guardrails with the trigger, judge model, fallback behaviour and rules
   in the two `guardrail-*.json` files. Rule names must be plain ASCII.
3. **Flows**: create the flows `SantaWishlistConversation` and `SantaGoodbyeFallback`. On the canvas,
   **Settings → Advanced → Import** takes a flow JSON file. The files here are in the format of the
   designer API (`GetFlow`/`CreateFlow`); if the console does not accept one, rebuild it from the
   file: Start → five Define nodes (`wishlist`, `behaviour`, `summary`, `reason`, `askedForMore`) → Basic `Greeting`
   ("Ho, ho, ho! Hello? Is anyone there?") → Generative Journey `Santa conversation` (model
   `anthropic.claude-haiku-4-5`, temperature 0.4, max tokens 600, the `prompt` from the file, exit conditions `DeliverLetter` and
   `NoConversation` with their prompts, the five captured fields) → Basic `Letter delivered` /
   `No conversation` / `Error`, each setting `outcome` → Exit.
4. **Application**: create `Santa Wishlist Agent` with both flows, language English (US), the two
   guardrails, welcome flow `SantaWishlistConversation`, fallback and unknown flow `SantaGoodbyeFallback`.
5. **Build** the application and **deploy** the build to the `development` environment.
6. Put the application ID and the deployment alias in `.env` as `ACXD_APPLICATION_ID` and
   `ACXD_DEPLOYMENT_ALIAS`.

### What the agent does

`SantaWishlistConversation` greets the child with a fixed message, so the first words don't wait for
the model, and then hands over to the Generative Journey node `Santa conversation`. Its prompt
reads `{childName:NLX.Context}` and `{childNotes:NLX.Context}`, treats the notes as data, and covers
safeguarding, adults and other children answering, personal data and voicemail. The conversation
ends through one exit condition:

| Exit condition | When | Context variables set |
|---|---|---|
| `DeliverLetter` | After the goodbye, or when the child wants to stop | `outcome`, `wishlist` (JSON array), `behaviour`, `summary` |
| `NoConversation` | Voicemail, silence or nobody came to the phone | `outcome`, `reason` |

A failure or timeout of the node, and the fallback flow, set `outcome` to `Error` with a short Santa goodbye.

### Model

The Generative Journey uses Claude Haiku 4.5 (`anthropic.claude-haiku-4-5`). In the 13 chat scenarios
Amazon Nova 2 Lite answered faster (median 1.1 s against 1.4 s per reply, by chat, without speech)
but ended only 6 calls when the child said goodbye: it wrote another goodbye instead of exiting
through `DeliverLetter`, so the parents would get the cut-short email instead of the letter. Haiku 4.5
ended 12 of 13.

### Guardrails

They follow the rule that came out of testing the earlier Connect AI agent guardrail: strict on
what the child says, light on what Santa says, and the prompt covers the rest. The designer has no
Bedrock-style content filters: a rule detects with `regex`, `keyword` or `llmJudge` and then masks,
modifies, routes or flags. Both guardrails fall back to `continue`, so a guardrail failure doesn't end
the child's call.

| Guardrail | Rules | Action |
|---|---|---|
| `Santa Child Input Guardrail` | Swear words (two regex rules, whole words, the common English profanity the managed Bedrock list covers); sex and obvious prompt attacks ("ignore all/previous/your", "forget you are", "prompt") | Replace the turn with "Ho, ho, ho! The wind at the North Pole is so loud I couldn't hear you. Can you tell me what you'd like for Christmas?" |
| | Phone, email, card and password (regex) | Mask as `[phone]`, `[email]`, `[card]`, `[password]` |
| `Santa Reply Output Guardrail` | Swear words (same regex) | Replace the reply with "Ho, ho, ho! My beard got all tangled up. What else would you like for Christmas?" |
| | Phone, email | Mask with a space |

Only regex rules, on purpose. The designer also offers `llmJudge` rules, and we tried one on the
input (sexual content, real intent to hurt, hate, prompt attacks) and one on the output (Santa
spoilers, scaring the child, asking for personal data). `TestGuardrail` never ran them, so they could
not be verified before a call, and each would add a model call per turn. They were removed; the
prompt covers those cases, as it did on the AI agent, and the chat scenarios check it (step 5). The
regex rules are the equivalent of the managed profanity list and the sensitive-information rules of
the earlier AI agent guardrail, without the address rule, which turned "North Pole" into a placeholder.

What we learned building them:

1. A `keyword` rule matches inside words. Use a regex with letter boundaries on both sides, such as
   `(^|[^a-zA-Z])word([^a-zA-Z]|$)`; `(?i)` is not supported. "Sussex", "shitake", "cockatoo" and
   "promptly" pass; "sexy" and "prompts" don't.
2. A regex pattern can have at most 200 characters, so the profanity list is split in two rules.
3. `TestGuardrail` only runs regex rules: an `llmJudge` rule never reported a violation and the call
   answered in about 300 ms.

## 3. Contact flow

[`santa-flow.template.json`](santa-flow.template.json) is the flow in Connect flow language. It has
four placeholders:

| Placeholder | Value |
|---|---|
| `${FLOW_HANDLER_ARN}` | `flowHandlerFunctionArn` in `amplify_outputs.json` |
| `${ACXD_WORKSPACE_ID}` | `ACXD_WORKSPACE_ID` in `.env` |
| `${ACXD_APPLICATION_ID}` | `ACXD_APPLICATION_ID` in `.env` (saved by `npm run designer:setup`) |
| `${ACXD_DEPLOYMENT_ALIAS}` | `ACXD_DEPLOYMENT_ALIAS` in `.env` (saved by `npm run designer:setup`) |

`npm run connect:flow` fills them, creates the flow `Santa Outbound Call` (or updates it if it
exists), publishes it and saves `CONNECT_CONTACT_FLOW_ID` in `.env`. Then run `npm run sandbox`
again so the dialer uses it.

```bash
npm run connect:flow -- --dry-run          # only write santa-flow.json
npm run connect:flow -- --name "My Santa"  # another flow name
```

The **Set voice** block uses Amazon Connect agentic voice, English (US), voice Jameson. In flow JSON
that is `"TextToSpeechEngine": "connect:agentic"` and the voice name in capitals (`JAMESON`); the IDs
are not in the documentation, and the format was read from flows saved by the flow designer (English
(US) voices seen there: `BLAKE`, `KATIE`). To pick another voice, choose it in the block in the flow designer and
publish, or change `TextToSpeechVoice` in the template and run `npm run connect:flow` again. Listen to
the sample in the block before a demo.

What the flow does:

| # | Block | Settings | Next |
|---|---|---|---|
| 1 | Set logging behavior | Disabled | 2 |
| 2 | Set recording and analytics behavior | Nothing recorded | 3 |
| 3 | Set voice | Agentic voice `JAMESON`, language `en-US` | 4 |
| 4 | Invoke Lambda `flow-handler` | `action` = `start`. Returns `result`, `childName`, `childNotes` | `result` = `ok` → 5, otherwise → 9 |
| 5 | Agentic CX | `Santa Wishlist Agent`, `development` alias, context variables `childName` and `childNotes` from step 4, agentic voice speech recognition, audio filler off | Exit → 6. Escalation, error or timeout → 9 |
| 6 | Check `$.AgenticCX.ContextVariables.outcome` | `DeliverLetter` → 7. `NoConversation` or anything else → 8. `Error` → 9 | |
| 7 | Invoke Lambda `flow-handler` | `action` = `deliver`, `wishlist`, `behaviour`, `summary` from the context variables | 10 |
| 8 | Invoke Lambda `flow-handler` | `action` = `noResponse` | Play `Ho, ho, ho! It's Santa. I'll call back a little later.` → 10 |
| 9 | Play prompt | `Ho, ho, ho! The elves got tangled in the wires. Talk soon!` | 10 |
| 10 | Disconnect | | |

Why no Set contact attributes block: contact attributes are kept in the contact record for 24
months. The child's name and notes go from the Lambda output straight into the Agentic CX block, and
the wishlist from the context variables straight into a Lambda parameter.

When the call ends in step 9 after Santa talked with the child, the booking is `IN_CALL` and
`call-outcome` emails the parents that the call was cut short; it does not call again. That is why
`Error` (the agent failed or timed out, or the fallback flow ran) goes to step 9 and not to the retry
path: there was someone on the line, and calling the child back a few minutes later would be worse than
an email to the parents.

### 3b. Optional: ElevenLabs voice

Connect can speak Santa's replies with an ElevenLabs voice instead of agentic voice. Speech
recognition stays on agentic voice, so the child's audio stays in Connect, but ElevenLabs receives
the text of everything Santa says, including the child's name and wishes.
See [ADR 0005](../docs/adr/0005-elevenlabs-voice.md).

1. Set `ELEVENLABS_TTS=true` in `.env` and deploy. The stack creates the secret
   `santa-call-center/elevenlabs-api-key` with its own KMS key, both readable only by Connect for
   your instance (the stack output `ElevenLabsSecretArn` is the secret's ARN).
2. Put the key in the secret: `AWS_PROFILE=<profile> npm run elevenlabs:secret`. It reads
   `ELEVENLABS_API_KEY` from `.env.local` and writes to the Region in `AWS_REGION` (environment, else `.env`).
3. In the flow designer, open **Set voice** and set:

   | Field | Value |
   |---|---|
   | Voice provider | ElevenLabs |
   | Model | `eleven_flash_v2_5` (lowest latency; `eleven_multilingual_v2` sounds better but is slower) |
   | Voice | Your ElevenLabs voice ID |
   | Secrets Manager ARN | `ElevenLabsSecretArn` |
   | Language | English (US) |

   Save and publish, then test with a call.

If Santa is silent on the call, the problem is almost always on the ElevenLabs side. Check the
ElevenLabs request log (Developers → Request log) for the failed requests, and check that the key
has the Text to Speech permission, that the voice belongs to or is shared with the same account, and
that the plan has characters left. In our tests a free-plan account stayed silent while a paid
account with the same flow worked.

## 4. Optional: answering machine detection

Answering machine detection needs an outbound campaign: calls must use `TrafficType=CAMPAIGN`
and a campaign ID. The **Concurrent campaign active calls per instance** quota is 0 by default,
so request an increase in Service Quotas (5 is enough for demos). Then set `CONNECT_CAMPAIGN_ID`.
Without a campaign, the Santa agent exits through `NoConversation` when it hears a voicemail
greeting or nobody speaks, which goes to the retry path (step 8). This path has not been tested yet.

## 5. Test the agent by text

`scripts/santa-chat-test.py` starts a Connect chat on the `Santa Outbound Call` flow with a
synthetic booking and plays a scenario from `scripts/chat-scenarios/`. It exercises the same flow,
designer application, prompt, guardrails and `DeliverLetter` hand-over as a call, without telephony,
and the letter arrives at `TEST_PARENT_EMAIL`. The voice (speech recognition, TTS, latency) is not
covered. Run all scenarios after every prompt change.

```bash
set -a; . ./.env; set +a
export AWS_PROFILE=<profile> TEST_PARENT_EMAIL=success@simulator.amazonses.com BOOKINGS_TABLE=<bookingsTable from amplify_outputs.json>
for f in scripts/chat-scenarios/*.json; do python3 scripts/santa-chat-test.py "$f"; done
```

`success@simulator.amazonses.com` is the SES mailbox simulator: SES accepts the letter without
delivering it, also in sandbox. Use a real verified address only when you want to see the email.
Run the scenarios one at a time. Santa lines that come from a guardrail are tagged `[GUARDRAIL]`.

You can also try the agent in the designer's own test chat. Set `childName` and `childNotes` there
by hand: in a call they come from the booking.
