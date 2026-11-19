# 5. Optional ElevenLabs voice for Santa
Status: Accepted. Changes the voice part of [ADR 0001](0001-native-agentic-voice.md).
## Context
The owner designed a Santa voice in ElevenLabs and wants the AI agent to use it. Since November
2025 Amazon Connect supports ElevenLabs as a text-to-speech provider in the Set voice block, with
the API key in Secrets Manager. No streaming integration is needed.
## Decision
- Use ElevenLabs only for text-to-speech, selected in the Set voice block. Speech recognition stays
  on Amazon Connect agentic voice, so the child's audio does not leave Connect.
- Keep it behind `ELEVENLABS_TTS` (default `false`). The stack creates the secret and a
  customer-managed KMS key (Connect cannot use `aws/secretsmanager`). Both resource policies allow
  only `connect.amazonaws.com` for this instance and account, and the key policy is limited to this secret.
- The key value is set with `npm run elevenlabs:secret` from `.env.local`, never in code or the template.
## Consequences
- ElevenLabs becomes a processor of the text Santa speaks, which includes the child's first name and
  wishes. Check their retention for your plan before real calls. Zero retention and EU data
  residency (`apiTokenRegion: eu`) need an ElevenLabs plan that includes them.
- ElevenLabs has its own pricing and terms. Use a paid plan for anything beyond a personal test: the
  free plan has a small monthly character quota and no commercial licence.
- Each reply adds a call to ElevenLabs, so latency depends on the model and on the provider region.
- Extra cost: one KMS key and one secret per deploy, plus ElevenLabs usage.
