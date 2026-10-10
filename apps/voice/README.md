# apps/voice (Phase 3)

Placeholder. Phase 3 builds the AI voice assistant here: a Python agent on
LiveKit Agents that introduces itself as an AI, asks for consent, asks the
qualifying questions from the industry pack (`voicePrompt` on each question in
`packages/core/src/industries/clinic.ts`), never gives medical advice, escalates
red-flag symptoms, and posts a signed, validated summary to the CRM.

Pydantic models will be generated from the zod schemas in `@healwyn/core`, so
the TypeScript and Python sides share one contract.
