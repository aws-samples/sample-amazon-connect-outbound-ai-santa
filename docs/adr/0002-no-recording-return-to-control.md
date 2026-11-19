# 2. Return to Control tool instead of a post-call transcript

Status: Accepted

## Context

The first design sent the post-contact summary from Contact Lens to Bedrock to extract the
wishlist. Contact Lens for voice needs call recording on for both agent and customer. Recording a
child's voice conflicts with the goal of keeping only the wishlist.

## Decision

The AI agent collects the wishlist during the call and hands it over through a custom Return to
Control tool, `EntregarCarta`, with a JSON schema. The flow passes the tool's Lex session
attributes to a Lambda. Recording and conversational analytics stay off.

## Consequences

- No audio and no transcript are stored.
- The wishlist is only as good as the AI agent's extraction. There is no transcript to re-check
  it against.
- Bedrock still writes the email text, through the guardrail, from structured fields only.
- No Contact Lens charges.
