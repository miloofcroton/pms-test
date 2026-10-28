# Working agreements

## Notes

- Save plans, findings and anything else worth keeping across sessions to `.notes/`, not to Claude's memory. The user reads these files too. Start each session by reading `.notes/plan.md`.
- Decisions about the data and the rules go in `docs/mock-data-analysis.md`, which is committed.

## Git

- Never commit without the user's explicit approval for that specific commit. Approving a plan or design doesn't approve a commit. Finish the work, verify it, summarize it, ask "ready to commit?" and wait for a clear yes.
- For now, commit once per task in `.notes/plan.md`. The user may widen this to once per phase when the process is working. Ask as we go how much freedom there is, and don't assume it has widened.
- Never push unless asked. Leave existing commits alone unless told otherwise.

## Testing

- Test-driven: write the failing tests first, show them failing, then make them pass. The cases come from `docs/mock-data-analysis.md`, so add a row there for any new case.
- Unit tests (`*.test.ts`, `mise run test:unit`) cover pure code and need no database. Integration tests (`*.integration.test.ts`, `mise run test:integration`) run against the local postgres.
- Integration tests share the one local database with the app. Never assume a table is empty: give each test its own ids, for example a fresh property id, and assert only on the rows it wrote.
- A red integration test can leave rows that block a later migration. `mise run db:reset` wipes the database and starts it empty.
- Every error kind and every exception kind has a test at the layer that produces it, and a runner test that checks how it is stored.

## Language Scoped Rules

- The ESLint config in `eslint.config.ts` is the source of truth for formatting. Run `mise run lint:fix` after editing, then `mise run test:lint`.

## Other Scoped Rules

- These live next to this file in `.claude/rules/`, each one limited by its `paths` frontmatter.
- A scoped rule loads on its own only after a matching file has been read. Before creating a new file, read every rule in `.claude/rules/` whose `paths` match it. For example, read `react.md` before a new `.tsx` file and `markdown.md` before a new `.md` file.
