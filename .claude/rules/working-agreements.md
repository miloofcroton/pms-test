# Working agreements

## Notes

- Save plans, findings and anything else worth keeping across sessions to `.notes/`, not to Claude's memory. The user reads these files too. Start each session by reading `.notes/plan.md`.
- Each case in the data, and the expected result of each day, goes in `MOCK-DATA-ANALYSIS.md`. Each decision the instructions' rules don't settle goes in `NOTES.md`, under "Decisions beyond the rules". Say each thing in one place and link to it from the others. `INSTRUCTIONS.md` is the original brief and is never edited.

## Git

- Never commit without the user's explicit approval for that specific commit. Approving a plan or design doesn't approve a commit. Finish the work, verify it, summarize it, ask "ready to commit?" and wait for a clear yes.
- For now, commit once per task in `.notes/plan.md`. The user may widen this to once per phase when the process is working. Ask as we go how much freedom there is, and don't assume it has widened.
- Never push unless asked. Leave existing commits alone unless told otherwise.

## Testing

- Test-driven: write the failing tests first, show them failing, then make them pass. The cases come from `MOCK-DATA-ANALYSIS.md`, so add a row there for any new case.
- Unit tests (`*.test.ts`, `mise run test:unit`) cover pure code and need no database. Integration tests (`*.integration.test.ts`, `mise run test:integration`) run against the local postgres.
- Integration tests have their own database, `sync_app_test`, next to the app's `sync_app`. `api/vitest.integration.setup.ts` migrates and empties it before every test file, so a file starts from nothing and needs no setup or cleanup of its own. Use the real data as it is: property `100` and the snapshots in `data/`.
- Every error kind and every exception kind has a test at the layer that produces it, and a runner test that checks how it is stored.

## Language Scoped Rules

- The ESLint config in `eslint.config.ts` is the source of truth for formatting. Run `mise run lint:fix` after editing, then `mise run test:lint`.

## Other Scoped Rules

- These live next to this file in `.claude/rules/`, each one limited by its `paths` frontmatter.
- A scoped rule loads on its own only after a matching file has been read. Before creating a new file, read every rule in `.claude/rules/` whose `paths` match it. For example, read `react.md` before a new `.tsx` file and `markdown.md` before a new `.md` file.
