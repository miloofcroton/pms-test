# Working agreements

## Notes

- Save plans, findings and anything else worth keeping across sessions to `.notes/`, not to Claude's memory. The user reads these files too. Start each session by reading `.notes/plan.md`.
- Decisions about the data and the rules go in `docs/mock-data-analysis.md`, which is committed.

## Git

- Never commit without the user's explicit approval for that specific commit. Approving a plan or design doesn't approve a commit. Finish the work, verify it, summarize it, ask "ready to commit?" and wait for a clear yes.
- For now, commit once per task in `.notes/plan.md`. The user may widen this to once per phase when the process is working. Ask as we go how much freedom there is, and don't assume it has widened.
- Never push unless asked. Leave existing commits alone unless told otherwise.

## Language Scoped Rules

- The ESLint config in `eslint.config.ts` is the source of truth for formatting. Run `mise run lint:fix` after editing, then `mise run test:lint`.

## Other Scoped Rules

- These live next to this file in `.claude/rules/`, each one limited by its `paths` frontmatter.
- A scoped rule loads on its own only after a matching file has been read. Before creating a new file, read every rule in `.claude/rules/` whose `paths` match it. For example, read `react.md` before a new `.tsx` file and `markdown.md` before a new `.md` file.
