# Amazon Connect setup

The backend creates the Lambdas and associates `flow-handler` with your instance. The AI agent,
the conversational AI bot and the contact flow are created in the Connect admin website, using
the files in this folder. Do this after the first `npm run sandbox` deploy.

Tested region: Europe (Frankfurt), where Amazon Connect agentic voice is available.

## 1. Instance settings

1. **Telephony**: outbound calls enabled.
2. **Phone number**: claim a number that supports outbound calls to Spain. Spanish toll-free
   numbers (+34 900) need no documents. Local numbers need a Spanish business address and tax ID.
   Check the outbound column for Spain in the
   [Telecoms Country Coverage Guide](https://d1v2gagwb6hfe1.cloudfront.net/Amazon_Connect_Telecoms_Coverage.pdf)
   before relying on a toll-free number as caller ID.
3. **Data storage**: leave call recordings unset or off. This sample does not record.
4. **Flow logs**: keep them off for the Santa flow (step 4.1). They would write the wishlist to CloudWatch.

## 2. AI agent

In **AI agent designer**:

1. **AI prompts → Create AI prompt**, type **Orchestration**, model `eu.anthropic.claude-haiku-4-5-20251001-v1:0`
   (the same model as the system `SelfServiceOrchestrationVoice` prompt). Paste the whole of
   [`santa-orchestration-prompt.yaml`](santa-orchestration-prompt.yaml) as the prompt and publish.
   It follows the structure of `SelfServiceOrchestrationVoice`:
   - `system` holds the instructions.
   - `messages` holds `{{$.conversationHistory}}` and an assistant turn prefilled with `<message>`.
   - It uses the system variables `{{$.toolConfigurationList}}`, `{{$.locale}}`, `{{$.contactId}}` and `{{$.dateTime}}`.
   - It uses the custom variables `{{$.Custom.childName}}` and `{{$.Custom.childNotes}}`, which `flow-handler` sets.
   - It keeps the sections of the system prompt adapted to Santa, and drops the sub-agent protocol because this agent has no sub-agents.
2. **AI guardrails → Create** with the settings in [`agent-guardrail.md`](agent-guardrail.md). Publish.
3. **AI agents → Create AI agent**, type **Orchestration**, copied from `SelfServiceOrchestrator`.
   - Prompt: the one from step 1. Guardrail: the one from step 2.
   - Locale: `es_ES`.
   - Tools: remove `Escalate` (no human agents). Keep `Complete`, with this instruction:
     `Use Complete only when you could not talk with the child: a voicemail greeting or recording, silence, only noise, or nobody came to the phone. In the same turn, say one short, cheerful goodbye in a <message></message> and do not leave a voicemail message. Never use Complete after talking with the child (use EntregarCarta instead), and never use both tools in the same call.`
   - **Add tool → Create new AI Tool**, name `EntregarCarta`, type **Return to Control**,
     input schema from [`entregar-carta-tool.json`](entregar-carta-tool.json).
     Instructions: `Use once, at the goodbye, after talking with the child.`
     The prompt's `<tool-instructions>` section explains how to fill each field.
   - Security profile: create one with no extra permissions; this agent uses no MCP tools.
   - Publish. The flow's Get customer input block names this agent in the Lex session attribute
     `x-amz-lex:q-in-connect:ai-agent-arn` (`...:$LATEST`), so it does not need to be the default
     Self Service agent. After changing the prompt, create a new prompt version and point the agent at it.
4. Copy the assistant ID (the domain ID on the AI agents page) into `QCONNECT_ASSISTANT_ID`.
   Optional: `flow-handler` can read it from the session ARN.

## 3. Conversational AI bot

**Routing → Flows → Conversational AI → Create bot**, locale Spanish (Spain), with the
**Amazon Connect AI agent intent** enabled. In the locale settings choose **Amazon Connect agentic
voice** for speech recognition and voice. Build the locale.

## 4. Contact flow

[`santa-flow.template.json`](santa-flow.template.json) is the flow in Connect flow language.
Replace the three placeholders and create it:

| Placeholder | Value |
|---|---|
| `${ASSISTANT_ARN}` | AI agent domain ARN: `arn:aws:wisdom:<region>:<account>:assistant/<id>` |
| `${FLOW_HANDLER_ARN}` | `flowHandlerFunctionArn` in `amplify_outputs.json` |
| `${LEX_BOT_ALIAS_ARN}` | Alias ARN of the bot from step 3 |

```bash
aws connect create-contact-flow --instance-id <instance-id> --name Santa --type CONTACT_FLOW \
  --status PUBLISHED --content file://santa-flow.json
```

Then open the flow in the designer and change the **Set voice** block to the **Amazon Connect
agentic voice** provider, Spanish (Spain). The template uses the Polly voice `Sergio` (generative)
because the agentic voice IDs are not documented for flow JSON.

### 4b. Optional: ElevenLabs voice

Connect can speak the AI agent's replies with an ElevenLabs voice instead of agentic voice. The
bot keeps agentic voice for speech recognition, so the child's audio stays in Connect, but
ElevenLabs receives the text of everything Santa says, including the child's name and wishes.
See [ADR 0005](../docs/adr/0005-elevenlabs-voice.md).

1. Set `ELEVENLABS_TTS=true` in `.env` and deploy. The stack creates the secret
   `santa-call-center/elevenlabs-api-key` with its own KMS key, both readable only by Connect for
   your instance (the stack output `ElevenLabsSecretArn` is the secret's ARN).
2. Put the key in the secret: `AWS_PROFILE=<profile> npm run elevenlabs:secret`. It reads
   `ELEVENLABS_API_KEY` from `.env.local`.
3. In the flow designer, open **Set voice** and set:

   | Field | Value |
   |---|---|
   | Voice provider | ElevenLabs |
   | Model | `eleven_flash_v2_5` (lowest latency; `eleven_multilingual_v2` sounds better but is slower) |
   | Voice | Your ElevenLabs voice ID |
   | Secrets Manager ARN | `ElevenLabsSecretArn` |
   | Language | Spanish (Spain) |

   Save and publish, then test with a call.

If Santa is silent on the call, the problem is almost always on the ElevenLabs side. Errors from
ElevenLabs inside the bot (Get customer input) do not take the error branch and do not show in the
flow logs. Check the ElevenLabs request log (Developers → Request log) for the failed requests, and
check that the key has the Text to Speech permission, that the voice belongs to or is shared with the
same account, and that the plan has characters left. In our tests a free-plan account stayed silent
while a paid account with the same flow worked.

What the flow does:

| # | Block | Settings | Next |
|---|---|---|---|
| 1 | Set logging behavior | Disabled | 2 |
| 2 | Set recording and analytics behavior | Nothing recorded | 3 |
| 3 | Set contact data + Set voice | Language `es-ES` | 4 |
| 4 | Connect assistant | AI agent domain | 5. Error → 10 |
| 5 | Invoke Lambda `flow-handler` | `action` = `start` | `$.External.result` = `ok` → 6, otherwise → 10 |
| 6 | Get customer input | Bot. Prompt `¡Jo, jo, jo! ¿Hola? ¿Hay alguien ahí?`. 6 s start timeout | 7. Error → 10 |
| 7 | Check Lex session attribute `Tool` | `EntregarCarta` → 8. `Complete` or no match → 9 | |
| 8 | Invoke Lambda `flow-handler` | `action` = `deliver`, `wishlist`, `behaviour`, `summary` from Lex session attributes | 11 |
| 9 | Invoke Lambda `flow-handler` | `action` = `noResponse` | Play `¡Jo, jo, jo! Soy Santa. Volveré a llamar un poco más tarde.` → 11 |
| 10 | Play prompt | `¡Jo, jo, jo! Los elfos tienen un lío con los cables. ¡Hasta pronto!` | 11 |
| 11 | Disconnect | | |

Publish the flow and copy its ID (the last part of the flow ARN) into `CONNECT_CONTACT_FLOW_ID`.
Set `CONNECT_SOURCE_PHONE_NUMBER` to the claimed number in E.164 (`+34900…`), then run
`npm run sandbox` again.

Why no Set contact attributes block after step 7: contact attributes are kept in the contact
record for 24 months. The wishlist goes straight from the Lex session attributes into the Lambda.

## 5. Optional: answering machine detection

Answering machine detection needs an outbound campaign: calls must use `TrafficType=CAMPAIGN`
and a campaign ID. The **Concurrent campaign active calls per instance** quota is 0 by default,
so request an increase in Service Quotas (5 is enough for demos). Then set `CONNECT_CAMPAIGN_ID`
and add block 3b. Without a campaign, two things cover voicemail: Santa says one line and hangs up if nobody
speaks within 6 seconds (step 6), and the AI agent uses `Complete` when it hears a voicemail
greeting, which also goes to the retry path (step 9).

This path has not been tested yet.

## 6. Test the AI agent by text

`scripts/santa-chat-test.py` starts a Connect chat on the Santa flow with a synthetic booking and plays a
scenario from `scripts/chat-scenarios/`. It exercises the same flow, AI agent, prompt, guardrail and
`EntregarCarta` hand-over as a call, without telephony, and the letter arrives at `TEST_PARENT_EMAIL`.
The voice (speech recognition, TTS, latency) is not covered. Run all scenarios after every prompt change.

```bash
set -a; . ./.env; set +a
export AWS_PROFILE=<profile> TEST_PARENT_EMAIL=success@simulator.amazonses.com BOOKINGS_TABLE=<bookingsTable from amplify_outputs.json>
for f in scripts/chat-scenarios/*.json; do python3 scripts/santa-chat-test.py "$f"; done
```

`success@simulator.amazonses.com` is the SES mailbox simulator: SES accepts the letter without
delivering it, also in sandbox. Use a real verified address only when you want to see the email.
Run the scenarios one at a time: ten or more chats at once make some fail in the flow's error branch.
Santa lines that come from the guardrail are tagged `[GUARDRAIL]`.

