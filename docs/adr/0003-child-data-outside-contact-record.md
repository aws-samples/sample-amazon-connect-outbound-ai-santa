# 3. Keep child data out of the Connect contact record

Status: Accepted

## Context

Connect keeps contact records, including contact attributes, for 24 months, and this cannot be
shortened. The AI agent needs the child's name and the parents' notes.

## Decision

The only contact attribute is `bookingId`. The `flow-handler` Lambda reads the booking and writes
the name and notes into the AI agent session with `UpdateSessionData`. The prompt reads them as
`{{$.Custom.childName}}` and `{{$.Custom.childNotes}}`. The wishlist goes from Lex session
attributes straight into a Lambda parameter, never into a Set contact attributes block. Flow logs
are disabled for the Santa flow.

## Consequences

- The contact record holds the parent's phone number and the booking ID, nothing about the child.
- One more Lambda call at the start of the flow, which adds under a second.
- How long the AI agent session keeps custom data is not covered here. Check it before any use
  beyond demos.
