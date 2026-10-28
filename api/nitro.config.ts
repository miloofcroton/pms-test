import { fileURLToPath } from 'node:url';

import { defineNitroConfig } from 'nitropack/config';

// https://nitro.unjs.io/config
export default defineNitroConfig({
  srcDir: 'src',
  buildDir: '.build',
  compatibilityDate: '2024-12-16',
  // Nitro's own `~` alias is `srcDir`, which is what imports use: `~/modules/...`. `vite.config.ts` sets the same for vitest and vite-node.
  // `@sync-app/shared` is the types the api shares with the client, merged into the tsconfig Nitro generates.
  // Only TypeScript resolves it: every import of it is `import type`, so the build never does.
  typescript: { tsConfig: { compilerOptions: { paths: { '@sync-app/shared': [fileURLToPath(new URL('../shared/src/index.ts', import.meta.url))] } } } },
  ignore: [
    '**/*.test.ts',
    '**/*.spec.ts',
    // Nitro loads every file in `src/modules/` as one of its own build modules, but ours is app code that routes import.
    'modules/**',
  ],
});
