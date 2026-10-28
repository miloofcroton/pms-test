---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript

## Functions

- Always write functions as arrow functions assigned to a `const`. Never use the `function` keyword.
- For a default export, declare the `const` first, then `export default` it on its own line.

## Imports

- Import with `~/`, which means that package's own `src/`, never with a relative path: `~/modules/sync/runner` in the api, `~/utils/api` in the client.
- The client and api never import from each other. What both need lives in `shared/src/index.ts`, imported as `@sync-app/shared` with `import type` only: it is types, and neither build resolves it.
- The only relative imports are React Router's generated `./+types/...`, and imports inside config files, which load before the alias exists.

## Comments

- Never hard-wrap a comment. Write each sentence on one line, however long, and let the editor wrap it.
- Put no more than one sentence on a line. Separate statements go on separate lines.
- This applies to `//` comments and to each line inside a `/** */` block.
