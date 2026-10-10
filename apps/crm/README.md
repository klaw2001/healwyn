# apps/crm (Phase 2)

Placeholder. Phase 2 builds the staff and manager app here: a Next.js app with
Supabase Auth, a pipeline board whose columns come from the industry pack, lead
profiles, staff workspaces, SLA timers and nurture sequences.

It will reuse:

- `@healwyn/core` for the industry pack (stages, staff levels, sequences) and schemas;
- `@healwyn/ui` for tokens and components (denser layout, same palette, dark mode);
- `@healwyn/db` for migrations, generated types and the data model.

Phase 1 leaves row level security on with no policies for `anon` or
`authenticated`; Phase 2 adds staff policies with matching grants. See `NEXT.md`.
