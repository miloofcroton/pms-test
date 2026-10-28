import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

// `~` is `src/`, so imports read `~/modules/sync/runner`.
// This is for the tools built on Vite: vitest (both configs extend this) and vite-node, which runs the CLI and reads this file itself.
// Nitro's own `~` alias already means `src/`.
export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
});
