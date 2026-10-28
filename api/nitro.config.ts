import { defineNitroConfig } from 'nitropack/config';

// https://nitro.unjs.io/config
export default defineNitroConfig({
  srcDir: 'src',
  buildDir: '.build',
  compatibilityDate: '2024-12-16',
  // Nitro's own `~` alias is `srcDir`, which is what imports use: `~/modules/...`. `vite.config.ts` sets the same for vitest and vite-node.
  ignore: [
    '**/*.test.ts',
    '**/*.spec.ts',
    // Nitro loads every file in `src/modules/` as one of its own build modules, but ours is app code that routes import.
    'modules/**',
  ],
});
