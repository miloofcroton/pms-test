import { defineNitroConfig } from 'nitropack/config';

// https://nitro.unjs.io/config
export default defineNitroConfig({
  srcDir: 'src',
  buildDir: '.build',
  compatibilityDate: '2024-12-16',
  ignore: ['**/*.test.ts', '**/*.spec.ts'],
});
