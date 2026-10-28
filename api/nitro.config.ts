import { defineNitroConfig } from 'nitropack/config';

// https://nitro.unjs.io/config
export default defineNitroConfig({
  srcDir: 'src',
  buildDir: '.build',
  compatibilityDate: '2024-12-16',
  ignore: [
    '**/*.test.ts',
    '**/*.spec.ts',
    // Nitro loads every file in `src/modules/` as one of its own build modules, but ours is app code that routes import.
    'modules/**',
  ],
});
