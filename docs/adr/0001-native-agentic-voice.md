# 1. Amazon Connect agentic voice instead of a third-party voice

Status: Accepted

## Context

Santa needs a natural Spanish voice. The options were Amazon Connect agentic voice or a
third-party voice such as ElevenLabs. The calls carry a child's voice and name.

## Decision

Use Amazon Connect agentic voice with an orchestration AI agent. It is available in Europe
(Frankfurt), where the Connect instance runs, and supports Spanish.

## Consequences

- Audio stays inside Amazon Connect. No extra processor of children's data.
- No streaming integration to build or maintain.
- Voice choice is limited to the voices Connect offers for `es-ES`.
