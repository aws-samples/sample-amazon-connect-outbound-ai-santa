# 7. Agentic CX designer instead of a Connect AI agent, English only

Status: Accepted. Supersedes the AI agent parts of ADR 0001, 0002 and 0003.

## Context

The first version ran Santa as a Connect AI agent: an orchestration prompt, a Connect AI guardrail,
a Return to Control tool (`EntregarCarta`) and a Lex bot with the AI agent intent. Setting it up
took five console steps, and the Lex bot had to be created in the Connect admin website because
only the console grants the bot role access to the AI agent. Agentic CX designer (GA, available
in the same Regions as agentic voice) runs the same conversation as an application with flows,
guardrails and context variables, and has an SDK (`amazon-connect-acxd-sdk`) that can create all
of it from files.

The sample also carried English and Spanish side by side (`SANTA_LANGUAGE`), which doubled the
prompts, flows, guardrails and chat scenarios. The sample is published in English.

## Decision

- Santa is the Agentic CX designer application `Santa Wishlist Agent`. Its flows
  (`SantaWishlistConversation`, `SantaGoodbyeFallback`), guardrails (`Santa Child Input Guardrail`,
  `Santa Reply Output Guardrail`) and context variables are JSON files in `connect/designer/`.
  `npm run designer:setup` creates or updates them, builds the application and deploys the build
  to the `development` environment.
- The contact flow `Santa Outbound Call` hands the call to the application with an Agentic CX
  block. `flow-handler` (`start`) returns the child's name and notes to the flow, and the block
  passes them as the context variables `childName` and `childNotes`. They are not set as contact
  attributes.
- The conversation ends through one of two exit conditions, `DeliverLetter` or `NoConversation`.
  The designer flow writes the outcome and the captured `wishlist`, `behaviour` and `summary` into
  context variables; the contact flow reads them from `$.AgenticCX.ContextVariables` and passes them
  to `flow-handler` (`deliver` or `noResponse`).
- Everything parents and children see or hear is US English. `SANTA_LANGUAGE`, the Spanish
  dictionaries, prompts, flows and chat scenarios are gone. The country settings stay
  (`CALL_TIMEZONE`, `ALLOWED_PHONE_PREFIXES`, `NOTIFY_COUNTRIES`, `GIFT_LINKS_DOMAIN`).

## Consequences

- No Lex bot, AI prompt, AI agent or Connect AI guardrail to create by hand, and `flow-handler`
  no longer needs `connect:DescribeContact` or `wisdom:UpdateSessionData`.
- The designer API key belongs to a programmatic user that only an account administrator can create
  in the designer's Admin Hub, so that step stays manual. The key lives in `.env.local`.
- The designer has no Bedrock-style content filters: its guardrails detect with regular
  expressions and an LLM judge. The backend Bedrock guardrail on the notes and the letter is unchanged.
- Agentic CX designer keeps conversation history and transcripts of what the child says. Check
  its retention against ADR 0003 before going beyond demos.
- The Generative Journey model is Claude Haiku 4.5: Nova 2 Lite was 0.3 s faster per reply but did not
  exit on the child's goodbye in 7 of 13 chat scenarios.
- The voice is the agentic voice Jameson (English US, `JAMESON`) in the contact flow's Set voice block
  (`connect:agentic`). Agentic voice IDs are not documented; the format comes from flows saved by the
  flow designer.
