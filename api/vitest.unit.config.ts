import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// Pure logic only: no database, no network.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'src/**/*.integration.test.ts'],
    environment: 'node',
  },
}));
